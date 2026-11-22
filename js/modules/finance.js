import * as DB from '../db.js';
import { $, $$, esc, money, toBase, today, monthKey, monthLabel, shiftMonth, fmtDate, formModal, toast, barRows } from '../utils.js';
import { doughnut, groupedBars } from '../charts.js';

export const EXPENSE_CATS = [
  ['vivienda', 'Vivienda'], ['comida', 'Alimentación'], ['transporte', 'Transporte'],
  ['servicios', 'Servicios'], ['deudas', 'Deudas'], ['hormiga', 'Gastos hormiga'],
  ['entretenimiento', 'Entretenimiento'], ['salud', 'Salud'], ['educacion', 'Educación'],
  ['hogar', 'Hogar y mantenimiento'], ['otros', 'Otros']];
export const INCOME_CATS = [['salario', 'Salario'], ['ventas', 'Ventas / Freelance'],
  ['inversion', 'Inversión'], ['otros', 'Otros']];
const ACCOUNTS = [['efectivo', 'Efectivo'], ['banco', 'Cuenta bancaria'], ['tarjeta', 'Tarjeta'], ['sinpe', 'SINPE / Wallet']];
const catName = (t, c) => ((t === 'income' ? INCOME_CATS : EXPENSE_CATS).find(x => x[0] === c) || [0, c])[1];

let month = monthKey();
let tab = 'mov';

export function summarize(txs) {
  let income = 0, expense = 0;
  const byCat = {};
  for (const t of txs) {
    const v = toBase(t.amount, t.currency);
    if (t.type === 'income') income += v;
    else { expense += v; byCat[t.category] = (byCat[t.category] || 0) + v; }
  }
  return { income, expense, balance: income - expense, savings: income > 0 ? (income - expense) / income * 100 : 0, byCat };
}

export async function addExpense(data) {
  return DB.add('transactions', { type: 'expense', currency: DB.settings().baseCurrency, account: 'efectivo', date: today(), ...data });
}

async function editTx(tx = {}) {
  const type = tx.type || 'expense';
  const base = DB.settings().baseCurrency;
  const res = await formModal({
    title: tx.id ? 'Editar movimiento' : 'Nuevo movimiento',
    fields: [
      { name: 'type', label: 'Tipo', type: 'select', value: type, options: [['expense', 'Gasto'], ['income', 'Ingreso']] },
      { name: 'amount', label: 'Monto', type: 'number', step: '0.01', min: 0, required: true, value: tx.amount },
      { name: 'currency', label: 'Moneda', type: 'select', value: tx.currency || base, options: [['CRC', '₡ Colones'], ['USD', '$ Dólares']] },
      { name: 'category', label: 'Categoría', type: 'select', value: tx.category || 'otros', options: [...EXPENSE_CATS, ...INCOME_CATS.filter(i => !EXPENSE_CATS.some(e => e[0] === i[0]))] },
      { name: 'description', label: 'Descripción', value: tx.description },
      { name: 'date', label: 'Fecha', type: 'date', required: true, value: tx.date || today() },
      { name: 'account', label: 'Cuenta', type: 'select', value: tx.account || 'efectivo', options: ACCOUNTS }
    ],
    onDelete: tx.id ? () => DB.del('transactions', tx.id) : null
  });
  if (!res) return;
  if (!(res.amount > 0)) return toast('Ingresa un monto mayor a 0');
  await DB.put('transactions', { ...tx, ...res });
  toast('Movimiento guardado');
}

async function editGoal(g = {}) {
  const res = await formModal({
    title: g.id ? 'Editar meta' : 'Nueva meta',
    fields: [
      { name: 'name', label: 'Nombre', required: true, value: g.name, placeholder: 'Ej: Vacaciones' },
      { name: 'target', label: 'Meta', type: 'number', min: 1, step: '0.01', required: true, value: g.target },
      { name: 'current', label: 'Ahorrado', type: 'number', min: 0, step: '0.01', required: true, value: g.current ?? 0 },
      { name: 'currency', label: 'Moneda', type: 'select', value: g.currency || DB.settings().baseCurrency, options: [['CRC', '₡ Colones'], ['USD', '$ Dólares']] }
    ],
    onDelete: g.id ? () => DB.del('goals', g.id) : null
  });
  if (res) { await DB.put('goals', { ...g, ...res }); toast('Meta guardada'); }
}

function exportCSV(txs) {
  const rows = [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Moneda', 'Cuenta']];
  for (const t of txs) rows.push([t.date, t.type === 'income' ? 'Ingreso' : 'Gasto', catName(t.type, t.category), t.description || '', t.amount, t.currency, t.account]);
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = `movimientos-${month}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function render(el) {
  const [allTx, goals] = await Promise.all([DB.all('transactions'), DB.all('goals')]);
  const txs = allTx.filter(t => t.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const s = summarize(txs);

  const movHtml = `
    <div class="kpis">
      <div class="kpi income"><small>Ingresos</small><b>${money(s.income)}</b></div>
      <div class="kpi expense"><small>Gastos</small><b>${money(s.expense)}</b></div>
      <div class="kpi"><small>Balance</small><b>${money(s.balance)}</b></div>
      <div class="kpi"><small>% ahorro</small><b>${s.savings.toFixed(0)}%</b></div>
    </div>
    ${Object.keys(s.byCat).length ? `<div class="card"><h3>Gastos por categoría</h3>${barRows(
      Object.entries(s.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: catName('expense', c), value: v })))}</div>` : ''}
    <div class="row-between"><h3>Movimientos</h3><button class="btn ghost sm" id="csv">⬇ CSV</button></div>
    <ul class="list">${txs.map(t => `<li data-id="${t.id}" class="item">
      <div><b>${esc(t.description || catName(t.type, t.category))}</b><small>${fmtDate(t.date)} · ${esc(catName(t.type, t.category))} · ${esc(t.account)}</small></div>
      <span class="amt ${t.type}">${t.type === 'income' ? '+' : '-'}${money(t.amount, t.currency)}</span></li>`).join('')
      || '<li class="empty">Sin movimientos este mes</li>'}</ul>`;

  const goalsHtml = `
    <div class="row-between"><h3>Mis metas</h3><button class="btn primary sm" id="addGoal">+ Meta</button></div>
    ${goals.map(g => { const p = Math.min(100, g.current / g.target * 100); return `<div class="card goal" data-gid="${g.id}">
      <div class="row-between"><b>${esc(g.name)}</b><span>${p.toFixed(0)}%</span></div>
      <div class="bar big"><i style="width:${p}%"></i></div>
      <small>${money(g.current, g.currency)} de ${money(g.target, g.currency)}</small>
      <div class="row-between"><button class="btn ghost sm" data-contrib="${g.id}">+ Aportar</button><button class="btn ghost sm" data-edit="${g.id}">Editar</button></div></div>`; }).join('')
      || '<p class="empty">Aún no tienes metas de ahorro</p>'}`;

  el.innerHTML = `
    <div class="tabs"><button data-tab="mov" class="${tab === 'mov' ? 'on' : ''}">Movimientos</button>
      <button data-tab="rep" class="${tab === 'rep' ? 'on' : ''}">Reportes</button>
      <button data-tab="metas" class="${tab === 'metas' ? 'on' : ''}">Metas</button></div>
    ${tab !== 'metas' ? `<div class="month-nav"><button class="btn ghost sm" id="prev">‹</button><b>${esc(monthLabel(month))}</b><button class="btn ghost sm" id="next">›</button></div>` : ''}
    ${tab === 'mov' ? movHtml : tab === 'rep' ? `<div id="charts"></div>
      <button class="btn primary block" id="pdf">📄 Descargar reporte en PDF</button>` : goalsHtml}
    ${tab === 'mov' ? '<button class="fab" id="addTx" aria-label="Nuevo movimiento">+</button>' : ''}`;

  const re = () => render(el);
  $$('[data-tab]', el).forEach(b => b.onclick = () => { tab = b.dataset.tab; re(); });
  if (tab !== 'metas') {
    $('#prev', el).onclick = () => { month = shiftMonth(month, -1); re(); };
    $('#next', el).onclick = () => { month = shiftMonth(month, 1); re(); };
  }
  if (tab === 'rep') {
    const base = DB.settings().baseCurrency;
    const f = v => money(v, base);
    const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: catName('expense', c), value: v }));
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const k = shiftMonth(month, -i), m = summarize(allTx.filter(t => t.date.startsWith(k)));
      months.push({ label: monthLabel(k).slice(0, 3), a: m.income, b: m.expense });
    }
    const box = $('#charts', el);
    for (const c of [doughnut(cats, { title: 'Gastos por categoría', fmt: f }), groupedBars(months, { title: 'Ingresos vs gastos (6 meses)', fmt: f })]) {
      c.className = 'chart'; box.appendChild(c);
    }
    $('#pdf', el).onclick = async e => {
      e.target.disabled = true; e.target.textContent = 'Generando…';
      try { await (await import('../pdf.js')).financeReport(month); toast('PDF generado'); }
      catch (err) { toast(err.message); }
      e.target.disabled = false; e.target.textContent = '📄 Descargar reporte en PDF';
    };
  } else if (tab === 'mov') {
    $('#addTx', el).onclick = async () => { await editTx(); re(); };
    $('#csv', el).onclick = () => exportCSV(txs);
    $$('li[data-id]', el).forEach(li => li.onclick = async () => { await editTx(txs.find(t => t.id === +li.dataset.id)); re(); });
  } else {
    $('#addGoal', el).onclick = async () => { await editGoal(); re(); };
    $$('[data-edit]', el).forEach(b => b.onclick = async () => { await editGoal(goals.find(g => g.id === +b.dataset.edit)); re(); });
    $$('[data-contrib]', el).forEach(b => b.onclick = async () => {
      const g = goals.find(x => x.id === +b.dataset.contrib);
      const r = await formModal({ title: `Aportar a ${g.name}`, fields: [{ name: 'amount', label: 'Monto', type: 'number', min: 0.01, step: '0.01', required: true }] });
      if (r && r.amount > 0) { g.current += r.amount; await DB.put('goals', g); toast('Aporte registrado'); re(); }
    });
  }
}
