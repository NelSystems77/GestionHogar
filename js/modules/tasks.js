import * as DB from '../db.js';
import { $, $$, esc, today, parseDate, isoDate, daysBetween, fmtDate, formModal, toast } from '../utils.js';

const CATS = [['limpieza', '🧹 Limpieza'], ['mantenimiento', '🔧 Mantenimiento'], ['vehiculo', '🚗 Vehículo'],
  ['jardin', '🌿 Jardín'], ['mascotas', '🐾 Mascotas'], ['documentos', '📄 Documentos'], ['otros', '📌 Otros']];
const REPEAT = [['none', 'No se repite'], ['daily', 'Cada día'], ['weekly', 'Cada semana'], ['monthly', 'Cada mes'], ['yearly', 'Cada año']];
const catLabel = c => (CATS.find(x => x[0] === c) || [0, c])[1];
let filter = 'pending';

export function nextDue(dateStr, repeat) {
  const d = parseDate(dateStr);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeat === 'monthly') {
    const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else if (repeat === 'yearly') {
    const day = d.getDate(), m = d.getMonth(); d.setDate(1); d.setFullYear(d.getFullYear() + 1);
    d.setMonth(m); d.setDate(Math.min(day, new Date(d.getFullYear(), m + 1, 0).getDate()));
  }
  return isoDate(d);
}

export async function pendingTasks() {
  return (await DB.where('tasks', t => !t.done)).sort((a, b) => a.due.localeCompare(b.due));
}

async function edit(t = {}) {
  const r = await formModal({
    title: t.id ? 'Editar tarea' : 'Nueva tarea',
    fields: [
      { name: 'title', label: 'Tarea', required: true, value: t.title, placeholder: 'Ej: Cambiar filtro de agua' },
      { name: 'category', label: 'Categoría', type: 'select', value: t.category || 'otros', options: CATS },
      { name: 'due', label: 'Fecha', type: 'date', required: true, value: t.due || today() },
      { name: 'repeat', label: 'Repetición', type: 'select', value: t.repeat || 'none', options: REPEAT },
      { name: 'notes', label: 'Notas', value: t.notes }
    ],
    onDelete: t.id ? () => DB.del('tasks', t.id) : null
  });
  if (r) { await DB.put('tasks', { done: false, ...t, ...r }); toast('Tarea guardada'); }
}

async function complete(t) {
  await DB.put('tasks', { ...t, done: true, doneAt: today() });
  if (t.repeat && t.repeat !== 'none') {
    let due = nextDue(t.due, t.repeat);
    while (due < today()) due = nextDue(due, t.repeat); // no crear tareas ya vencidas
    await DB.add('tasks', { title: t.title, category: t.category, due, repeat: t.repeat, notes: t.notes, done: false });
    toast(`Hecho. Próxima: ${fmtDate(due)}`);
  } else toast('Tarea completada');
}

export async function render(el) {
  const all = await DB.all('tasks');
  const list = (filter === 'pending' ? all.filter(t => !t.done).sort((a, b) => a.due.localeCompare(b.due))
    : all.filter(t => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 50));
  el.innerHTML = `
    <div class="tabs"><button data-f="pending" class="${filter === 'pending' ? 'on' : ''}">Pendientes</button>
      <button data-f="done" class="${filter === 'done' ? 'on' : ''}">Hechas</button></div>
    <ul class="list">${list.map(t => { const d = daysBetween(today(), t.due);
      const state = t.done ? '' : d < 0 ? 'overdue' : d === 0 ? 'soon' : '';
      return `<li class="item ${state} ${t.done ? 'done' : ''}" data-id="${t.id}">
        <label class="chk"><input type="checkbox" data-done="${t.id}" ${t.done ? 'checked disabled' : ''}>
        <div><b>${esc(t.title)}</b><small>${esc(catLabel(t.category))} · ${t.done ? 'hecha ' + fmtDate(t.doneAt || t.due) : (d < 0 ? `vencida hace ${-d} d` : d === 0 ? 'hoy' : fmtDate(t.due))}
        ${t.repeat && t.repeat !== 'none' ? ' · 🔁' : ''}</small></div></label>
        ${t.done ? '' : `<button class="btn ghost sm" data-edit="${t.id}">✎</button>`}</li>`; }).join('')
      || `<li class="empty">${filter === 'pending' ? 'No tienes tareas pendientes 🎉' : 'Aún no has completado tareas'}</li>`}</ul>
    <button class="fab" id="add" aria-label="Nueva tarea">+</button>`;
  const re = () => render(el);
  $$('[data-f]', el).forEach(b => b.onclick = () => { filter = b.dataset.f; re(); });
  $('#add', el).onclick = async () => { await edit(); re(); };
  $$('[data-edit]', el).forEach(b => b.onclick = async () => { await edit(all.find(t => t.id === +b.dataset.edit)); re(); });
  $$('[data-done]', el).forEach(c => c.onchange = async () => { if (c.checked) { await complete(all.find(t => t.id === +c.dataset.done)); re(); } });
}
