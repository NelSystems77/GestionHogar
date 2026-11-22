import * as DB from '../db.js';
import { $, $$, esc, money, today, monthKey, daysBetween, formModal, toast } from '../utils.js';
import { addExpense } from './finance.js';

const CATS = [['servicios', 'Servicios (luz, agua, internet)'], ['vivienda', 'Vivienda / alquiler'], ['deudas', 'Deudas / préstamos'],
  ['salud', 'Seguros / salud'], ['entretenimiento', 'Suscripciones'], ['educacion', 'Educación'], ['otros', 'Otros']];

// Fecha de vencimiento de este mes (ajustada al último día si el mes es corto)
export function dueDateThisMonth(day, now = new Date()) {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const d = new Date(now.getFullYear(), now.getMonth(), Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function statuses() {
  const [obs, pays] = await Promise.all([DB.all('obligations'), DB.all('obligationPayments')]);
  const mk = monthKey();
  return obs.filter(o => o.active !== false).map(o => {
    const paid = pays.find(p => p.obligationId === o.id && p.month === mk);
    const due = dueDateThisMonth(o.dueDay);
    const diff = daysBetween(today(), due);
    const state = paid ? 'paid' : diff < 0 ? 'overdue' : diff <= (o.alertDays ?? 3) ? 'soon' : 'ok';
    return { ...o, paid, due, diff, state };
  }).sort((a, b) => a.dueDay - b.dueDay);
}

async function edit(raw = {}) {
  const { paid, due, diff, state, ...o } = raw;
  const res = await formModal({
    title: o.id ? 'Editar pago' : 'Nuevo pago recurrente',
    fields: [
      { name: 'name', label: 'Nombre', required: true, value: o.name, placeholder: 'Ej: Electricidad' },
      { name: 'amount', label: 'Monto estimado', type: 'number', min: 0, step: '0.01', required: true, value: o.amount },
      { name: 'currency', label: 'Moneda', type: 'select', value: o.currency || DB.settings().baseCurrency, options: [['CRC', '₡ Colones'], ['USD', '$ Dólares']] },
      { name: 'dueDay', label: 'Día de vencimiento (1-31)', type: 'number', min: 1, max: 31, required: true, value: o.dueDay },
      { name: 'category', label: 'Categoría', type: 'select', value: o.category || 'servicios', options: CATS },
      { name: 'alertDays', label: 'Avisar con (días)', type: 'number', min: 0, max: 30, value: o.alertDays ?? 3 },
      { name: 'active', label: 'Activo', type: 'checkbox', value: o.active !== false }
    ],
    onDelete: o.id ? () => DB.del('obligations', o.id) : null
  });
  if (!res) return;
  res.dueDay = Math.min(31, Math.max(1, Math.round(res.dueDay || 1)));
  res.alertDays = res.alertDays ?? 3;
  await DB.put('obligations', { ...o, ...res });
  toast('Pago guardado');
}

async function pay(o) {
  const res = await formModal({
    title: `Pagar ${o.name}`, submitLabel: 'Registrar pago',
    fields: [{ name: 'amount', label: 'Monto pagado', type: 'number', min: 0.01, step: '0.01', required: true, value: o.amount },
      { name: 'date', label: 'Fecha', type: 'date', required: true, value: today() }]
  });
  if (!res || !(res.amount > 0)) return;
  const txId = await addExpense({ amount: res.amount, currency: o.currency, category: o.category, description: o.name, date: res.date });
  await DB.add('obligationPayments', { obligationId: o.id, month: monthKey(), amount: res.amount, date: res.date, txId });
  toast('Pago registrado como gasto');
}

async function undo(o) {
  if (!o.paid || !confirm('¿Deshacer el pago de este mes? También se elimina el gasto asociado.')) return;
  if (o.paid.txId) await DB.del('transactions', o.paid.txId);
  await DB.del('obligationPayments', o.paid.id);
  toast('Pago deshecho');
}

const LABEL = { paid: 'Pagado', overdue: 'Vencido', soon: 'Por vencer', ok: 'Al día' };

export async function render(el) {
  const list = await statuses();
  const pending = list.filter(o => !o.paid).reduce((s, o) => s + (o.currency === DB.settings().baseCurrency ? o.amount : 0), 0);
  el.innerHTML = `
    <div class="row-between"><h2>Pagos del mes</h2><button class="btn primary sm" id="add">+ Pago</button></div>
    ${list.length ? `<p class="muted">Pendiente (${DB.settings().baseCurrency}): <b>${money(pending)}</b></p>` : ''}
    <ul class="list">${list.map(o => `<li class="item ob ${o.state}" data-id="${o.id}">
      <div><b>${esc(o.name)}</b><small>Día ${o.dueDay} · ${money(o.amount, o.currency)}
        ${o.state === 'overdue' ? ` · hace ${-o.diff} d` : o.state === 'soon' ? ` · en ${o.diff} d` : ''}</small></div>
      <div class="row"><span class="badge ${o.state}">${LABEL[o.state]}</span>
      ${o.paid ? `<button class="btn ghost sm" data-undo="${o.id}">↩</button>` : `<button class="btn primary sm" data-pay="${o.id}">Pagar</button>`}
      <button class="btn ghost sm" data-edit="${o.id}">✎</button></div></li>`).join('')
      || '<li class="empty">Agrega tus pagos recurrentes (luz, agua, internet, seguros…)</li>'}</ul>`;
  const re = () => render(el);
  $('#add', el).onclick = async () => { await edit(); re(); };
  const find = id => list.find(o => o.id === +id);
  $$('[data-pay]', el).forEach(b => b.onclick = async () => { await pay(find(b.dataset.pay)); re(); });
  $$('[data-undo]', el).forEach(b => b.onclick = async () => { await undo(find(b.dataset.undo)); re(); });
  $$('[data-edit]', el).forEach(b => b.onclick = async () => { await edit(find(b.dataset.edit)); re(); });
}
