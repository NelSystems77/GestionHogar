import * as DB from '../db.js';
import { esc, money, monthKey, monthLabel, fmtDate, today, daysBetween, barRows } from '../utils.js';
import { summarize, EXPENSE_CATS } from './finance.js';
import { statuses } from './obligations.js';
import { pendingTasks } from './tasks.js';

export async function render(el) {
  const mk = monthKey();
  const [txs, obs, tasks, lists, goals] = await Promise.all([
    DB.where('transactions', t => t.date.startsWith(mk)), statuses(), pendingTasks(), DB.all('lists'), DB.all('goals')]);
  const s = summarize(txs);
  const alerts = obs.filter(o => o.state === 'overdue' || o.state === 'soon');
  const dueTasks = tasks.filter(t => daysBetween(today(), t.due) <= 0).slice(0, 5);
  const budget = DB.settings().foodBudget;
  const food = lists.filter(l => l.completed && l.date.startsWith(mk)).reduce((a, l) => a + (l.total || 0), 0);
  const top = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([c, v]) => ({ label: (EXPENSE_CATS.find(x => x[0] === c) || [0, c])[1], value: v }));

  el.innerHTML = `
    <h2 class="cap">${esc(monthLabel(mk))}</h2>
    <div class="kpis">
      <div class="kpi income"><small>Ingresos</small><b>${money(s.income)}</b></div>
      <div class="kpi expense"><small>Gastos</small><b>${money(s.expense)}</b></div>
      <div class="kpi"><small>Balance</small><b>${money(s.balance)}</b></div>
      <div class="kpi"><small>% ahorro</small><b>${s.savings.toFixed(0)}%</b></div>
    </div>
    ${alerts.length ? `<div class="card warn"><h3>⚠️ Pagos que requieren atención</h3><ul class="list">${alerts.map(o =>
      `<li class="item ob ${o.state}"><div><b>${esc(o.name)}</b><small>${o.state === 'overdue' ? `Vencido hace ${-o.diff} d` : o.diff === 0 ? 'Vence hoy' : `Vence en ${o.diff} d`} (${fmtDate(o.due)})</small></div><b>${money(o.amount, o.currency)}</b></li>`).join('')}</ul>
      <a href="#/obligaciones" class="link">Ver todos los pagos →</a></div>` : ''}
    <div class="card"><h3>✅ Tareas de hoy y atrasadas</h3>
      ${dueTasks.length ? `<ul class="list">${dueTasks.map(t => `<li class="item ${daysBetween(today(), t.due) < 0 ? 'overdue' : 'soon'}"><b>${esc(t.title)}</b><small>${fmtDate(t.due)}</small></li>`).join('')}</ul>`
        : '<p class="muted">Todo al día 🎉</p>'}<a href="#/tareas" class="link">Ver tareas →</a></div>
    ${budget ? `<div class="card"><div class="row-between"><h3>🛒 Súper del mes</h3><b>${money(food)} / ${money(budget)}</b></div>
      <div class="bar big ${food > budget ? 'over' : ''}"><i style="width:${Math.min(100, food / budget * 100)}%"></i></div></div>` : ''}
    ${top.length ? `<div class="card"><h3>Principales gastos</h3>${barRows(top)}</div>` : ''}
    ${goals.length ? `<div class="card"><h3>🎯 Metas</h3>${goals.slice(0, 3).map(g => `<div class="row-between"><span>${esc(g.name)}</span><small>${Math.min(100, g.current / g.target * 100).toFixed(0)}%</small></div>
      <div class="bar"><i style="width:${Math.min(100, g.current / g.target * 100)}%"></i></div>`).join('')}</div>` : ''}
    ${!txs.length && !obs.length && !tasks.length ? '<div class="card"><h3>👋 Bienvenido</h3><p>Empieza registrando un gasto en <a href="#/finanzas">Finanzas</a>, tus pagos recurrentes en <a href="#/obligaciones">Pagos</a> o una lista en <a href="#/super">Súper</a>.</p></div>' : ''}`;
}
