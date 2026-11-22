import * as DB from '../db.js';
import { $, $$, esc, money, today, fmtDate, formModal, toast, barRows } from '../utils.js';
import { addExpense } from './finance.js';

const SEED = {
  'Frutas y verduras': ['Banano', 'Manzana', 'Tomate', 'Cebolla', 'Papa', 'Zanahoria', 'Lechuga', 'Limón', 'Aguacate', 'Chayote'],
  'Lácteos y huevos': ['Leche', 'Huevos', 'Queso', 'Mantequilla', 'Yogurt', 'Natilla'],
  'Carnes': ['Pollo', 'Carne molida', 'Cerdo', 'Salchichón', 'Atún', 'Pescado'],
  'Granos y despensa': ['Arroz', 'Frijoles', 'Azúcar', 'Sal', 'Aceite', 'Pasta', 'Café', 'Harina', 'Pan', 'Galletas', 'Salsa de tomate'],
  'Bebidas': ['Agua', 'Jugo', 'Refresco'],
  'Limpieza': ['Detergente', 'Jabón de platos', 'Cloro', 'Papel higiénico', 'Servilletas', 'Bolsas de basura', 'Desinfectante'],
  'Higiene personal': ['Jabón', 'Shampoo', 'Pasta dental', 'Desodorante', 'Cepillo de dientes']
};
const SEED_STORES = ['AutoMercado', 'Walmart', 'Más x Menos', 'Fresh Market', 'Pali'];
const EMOJI = { 'Frutas y verduras': '🥬', 'Lácteos y huevos': '🥛', 'Carnes': '🍗', 'Granos y despensa': '🍚', 'Bebidas': '🧃', 'Limpieza': '🧽', 'Higiene personal': '🧴', 'Otros': '🛍️' };
const UNITS = ['u', 'kg', 'g', 'L', 'paq', 'bolsa', 'caja'];

// Listas pre-cargadas. Cada ítem: [nombre, cantidad]
const WEEKLY = [['Leche', 2], ['Huevos', 1], ['Pan', 1], ['Arroz', 1], ['Frijoles', 1], ['Pollo', 1], ['Tomate', 1], ['Cebolla', 1], ['Banano', 1], ['Queso', 1], ['Café', 1], ['Aceite', 1], ['Papel higiénico', 1]];
const BIWEEKLY = [...WEEKLY, ['Carne molida', 1], ['Pasta', 2], ['Azúcar', 1], ['Atún', 3], ['Yogurt', 4], ['Papa', 1], ['Zanahoria', 1], ['Lechuga', 1], ['Detergente', 1], ['Jabón de platos', 1]];
const CLEAN = [['Detergente', 1], ['Jabón de platos', 1], ['Cloro', 1], ['Desinfectante', 1], ['Papel higiénico', 1], ['Bolsas de basura', 1], ['Servilletas', 1], ['Jabón', 2], ['Shampoo', 1], ['Pasta dental', 1], ['Desodorante', 1]];
export const BUILTIN_TEMPLATES = [
  { id: 'b-sem', emoji: '🛒', name: 'Compra semanal', items: WEEKLY },
  { id: 'b-qui', emoji: '📆', name: 'Compra quincenal', items: BIWEEKLY },
  { id: 'b-men', emoji: '🏠', name: 'Compra mensual', items: [...BIWEEKLY, ['Sal', 1], ['Harina', 1], ['Agua', 2], ['Jugo', 2], ['Galletas', 2], ['Cepillo de dientes', 1]] },
  { id: 'b-exp', emoji: '⚡', name: 'Compra express', items: [['Leche', 1], ['Pan', 1], ['Huevos', 1], ['Banano', 1], ['Agua', 1]] },
  { id: 'b-lim', emoji: '🧼', name: 'Limpieza y aseo', items: CLEAN },
  { id: 'b-fyv', emoji: '🥕', name: 'Frutas y verduras', items: [['Banano', 1], ['Manzana', 1], ['Tomate', 1], ['Cebolla', 1], ['Papa', 1], ['Zanahoria', 1], ['Lechuga', 1], ['Limón', 1], ['Aguacate', 2], ['Chayote', 2]] }
];

export async function seedIfNeeded() {
  if (DB.settings().seeded) return;
  for (const [category, names] of Object.entries(SEED)) for (const name of names) await DB.add('products', { name, category, favorite: false });
  for (const name of SEED_STORES) await DB.add('stores', { name });
  await DB.setSetting('seeded', true);
}

const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const buzz = () => navigator.vibrate && navigator.vibrate(15);

let tab = 'listas';
let openList = null;
let query = '';

// ---------- creación de listas ----------
async function newList() {
  const [stores, mine, lists] = await Promise.all([DB.all('stores'), DB.all('templates'), DB.all('lists')]);
  const lastDone = lists.filter(l => l.completed).sort((a, b) => b.id - a.id)[0];
  const tplOptions = [['empty', 'Lista vacía'],
    ...BUILTIN_TEMPLATES.map(t => [t.id, `${t.emoji} ${t.name} (${t.items.length})`]),
    ...mine.map(t => [`m-${t.id}`, `⭐ ${t.name} (${t.items.length})`]),
    ...(lastDone ? [['last', `🔁 Repetir «${lastDone.name}»`]] : [])];
  const r = await formModal({
    title: 'Nueva lista de compras', submitLabel: 'Crear lista',
    fields: [
      { name: 'tpl', label: 'Empezar con', type: 'select', value: openTpl || 'empty', options: tplOptions },
      { name: 'name', label: 'Nombre', required: true, value: '' },
      { name: 'storeId', label: 'Supermercado', type: 'select', value: stores[0]?.id, options: [['', 'Sin definir'], ...stores.map(s => [s.id, s.name])] },
      { name: 'budget', label: 'Presupuesto (opcional)', type: 'number', min: 0, step: '0.01' }]
  });
  openTpl = null;
  if (!r) return null;
  const id = await DB.add('lists', { name: r.name, storeId: r.storeId ? +r.storeId : null, budget: r.budget || 0, date: today(), completed: false });
  let rows = [];
  if (r.tpl.startsWith('b-')) rows = BUILTIN_TEMPLATES.find(t => t.id === r.tpl).items.map(([name, qty]) => ({ name, qty }));
  else if (r.tpl.startsWith('m-')) rows = mine.find(t => t.id === +r.tpl.slice(2)).items.map(([name, qty, unit]) => ({ name, qty, unit }));
  else if (r.tpl === 'last') rows = (await DB.where('listItems', i => i.listId === lastDone.id)).map(i => ({ name: i.name, qty: i.qty, unit: i.unit }));
  await fillItems(id, rows);
  return id;
}
let openTpl = null;

async function fillItems(listId, rows) {
  if (!rows.length) return;
  const [products, hist] = await Promise.all([DB.all('products'), DB.all('priceHistory')]);
  for (const row of rows) {
    const p = products.find(x => norm(x.name) === norm(row.name));
    const last = hist.filter(h => norm(h.name) === norm(row.name)).sort((a, b) => b.date.localeCompare(a.date))[0];
    await DB.add('listItems', { listId, name: p?.name || row.name, category: p?.category || 'Otros', qty: row.qty || 1, unit: row.unit || 'u', price: last?.price || 0, checked: false });
  }
}

// ---------- vista de la lista (modo compra) ----------
async function listView(el, listId) {
  const list = await DB.get('lists', listId);
  if (!list) { openList = null; return render(el); }
  const [items, products, stores, hist] = await Promise.all([DB.where('listItems', i => i.listId === listId), DB.all('products'), DB.all('stores'), DB.all('priceHistory')]);
  const store = stores.find(s => s.id === list.storeId);
  const ro = list.completed;
  const sum = a => a.reduce((s, i) => s + i.price * i.qty, 0);
  const emoji = i => EMOJI[i.category] || '🛍️';
  const step = i => (i.unit === 'kg' || i.unit === 'L') ? 0.5 : 1;
  const qtyTxt = i => `${+i.qty.toFixed(2)} ${i.unit || 'u'}`;

  const row = i => `<li class="shop-row ${i.checked ? 'got' : ''}" data-id="${i.id}">
    <span class="emoji" aria-hidden="true">${emoji(i)}</span>
    <div class="info"><b>${esc(i.name)}</b>
      <button class="pricechip" data-act="price" ${ro ? 'disabled' : ''}>${i.price ? `${money(i.price)} c/u` : '+ precio'}</button></div>
    ${ro ? `<span class="qtyro">${qtyTxt(i)}</span>` : `<div class="qty"><button data-act="dec" aria-label="Menos">−</button><span>${qtyTxt(i)}</span><button data-act="inc" aria-label="Más">+</button></div>`}
    ${ro ? '' : i.checked ? '<button class="check undo" data-act="toggle" aria-label="Devolver a pendientes">↩</button>' : '<button class="check" data-act="toggle" aria-label="Marcar como comprado">✓</button>'}
  </li>`;

  el.innerHTML = `
    <div class="row-between"><button class="btn ghost sm" data-act="back">‹ Listas</button>
      <div class="row"><button class="btn ghost sm" data-act="pdf">📄 PDF</button><button class="btn ghost sm" data-act="menu">⋯</button></div></div>
    <h2 class="list-title">${esc(list.name)}</h2>
    <p class="muted">${esc(store?.name || 'Sin supermercado')} · ${fmtDate(list.date)}${ro ? ' · finalizada' : ''}</p>
    <div class="sticky-zone"><section class="shop-head" id="head"></section>
    ${ro ? '' : `<div class="search"><span aria-hidden="true">🔍</span><input id="q" type="search" placeholder="Buscar producto…" autocomplete="off" value="${esc(query)}">
      ${window.SpeechRecognition || window.webkitSpeechRecognition ? '<button id="mic" aria-label="Buscar por voz">🎤</button>' : ''}</div>
      <div id="results"></div>`}</div>
    <h3 class="sec-title missing-t" id="mt"></h3><ul class="shop-list" id="missing"></ul>
    <div id="done"></div>
    <details class="bought-box" id="boughtBox"><summary id="bt"></summary><ul class="shop-list" id="bought"></ul></details>
    ${ro ? '' : '<div class="finish-bar"><button class="btn primary block big" data-act="finish">✓ Finalizar compra</button></div>'}`;

  const $h = id => el.querySelector('#' + id);

  function paintResults() {
    const box = $h('results'); if (!box) return;
    const q = norm(query.trim());
    if (!q) { box.innerHTML = ''; return; }
    const inList = items.filter(i => norm(i.name).includes(q));
    const names = new Set(items.map(i => norm(i.name)));
    const cat = products.filter(p => norm(p.name).includes(q) && !names.has(norm(p.name))).slice(0, 12);
    const exact = items.some(i => norm(i.name) === q) || products.some(p => norm(p.name) === q);
    box.innerHTML = `<div class="results card">
      ${inList.map(i => `<div class="res" data-id="${i.id}"><span class="emoji">${emoji(i)}</span><div class="info"><b>${esc(i.name)}</b><small>${i.checked ? '✅ ya comprado' : '⏳ falta · en tu lista'}</small></div>
        <button class="btn ${i.checked ? 'ghost' : 'primary'} sm" data-act="toggle">${i.checked ? '↩ Devolver' : '✓ Comprar'}</button></div>`).join('')}
      ${cat.map(p => `<div class="res" data-pname="${esc(p.name)}"><span class="emoji">${EMOJI[p.category] || '🛍️'}</span><div class="info"><b>${esc(p.name)}</b><small>No está en tu lista</small></div>
        <div class="row"><button class="btn ghost sm" data-act="addp">+ Agregar</button><button class="btn primary sm" data-act="addbuy">✓ Ya lo tomé</button></div></div>`).join('')}
      ${!exact ? `<div class="res" data-pname="${esc(query.trim())}"><span class="emoji">➕</span><div class="info"><b>Crear «${esc(query.trim())}»</b><small>Producto nuevo</small></div>
        <div class="row"><button class="btn ghost sm" data-act="addp">+ Agregar</button><button class="btn primary sm" data-act="addbuy">✓ Ya lo tomé</button></div></div>` : ''}
    </div>`;
  }

  function paint() {
    const missing = items.filter(i => !i.checked), bought = items.filter(i => i.checked);
    const pct = items.length ? bought.length / items.length * 100 : 0;
    const over = list.budget && sum(items) > list.budget;
    $h('head').innerHTML = `<div class="row-between"><div class="count"><b>${bought.length}</b> de <b>${items.length}</b> comprados</div><div class="count miss">Faltan <b>${missing.length}</b></div></div>
      <div class="bar big ${over ? 'over' : ''}"><i style="width:${pct}%"></i></div>
      <div class="row-between money"><span>🛒 Carrito <b>${money(sum(bought))}</b></span><span>Estimado <b>${money(sum(items))}</b>${list.budget ? ` / ${money(list.budget)}` : ''}</span></div>`;
    $h('mt').textContent = `Faltan por comprar (${missing.length})`;
    const groups = missing.reduce((g, i) => ((g[i.category || 'Otros'] ||= []).push(i), g), {});
    $h('missing').innerHTML = Object.entries(groups).map(([c, arr]) =>
      `<li class="cat-sep">${EMOJI[c] || '🛍️'} ${esc(c)}</li>${arr.map(row).join('')}`).join('')
      || (items.length ? '' : '<li class="empty">Tu lista está vacía.<br>Usa el buscador de arriba para agregar productos.</li>');
    $h('done').innerHTML = items.length && !missing.length ? `<div class="card celebrate">🎉<h3>¡Todo comprado!</h3><p class="muted">No te falta nada. Revisa el carrito y finaliza la compra.</p></div>` : '';
    $h('bt').textContent = `✅ Comprados (${bought.length})`;
    $h('bought').innerHTML = bought.map(row).join('') || '<li class="empty">Aún no has comprado nada</li>';
    if (!$h('boughtBox').dataset.touched) $h('boughtBox').open = !missing.length && !!bought.length;
    paintResults();
  }
  $h('boughtBox').addEventListener('toggle', e => { e.target.dataset.touched = '1'; });

  const find = e => { const li = e.target.closest('[data-id]'); return li && items.find(i => i.id === +li.dataset.id); };
  async function setChecked(it, v, rowEl) {
    buzz();
    if (rowEl && !it.checked === v) { rowEl.classList.add('leaving'); await wait(260); }
    it.checked = v; it.checkedAt = v ? Date.now() : null;
    await DB.put('listItems', it); paint();
  }
  async function addItem(name, checked) {
    const p = products.find(x => norm(x.name) === norm(name));
    if (!p) { const np = { name, category: 'Otros', favorite: false }; np.id = await DB.add('products', np); products.push(np); }
    const prod = p || products[products.length - 1];
    const l = hist.filter(h => norm(h.name) === norm(name)).sort((a, b) => b.date.localeCompare(a.date));
    const last = l.find(h => h.storeId === list.storeId) || l[0];
    const it = { listId, name: prod.name, category: prod.category, qty: 1, unit: 'u', price: last?.price || 0, checked, checkedAt: checked ? Date.now() : null };
    it.id = await DB.add('listItems', it); items.push(it);
    toast(`${checked ? 'En el carrito' : 'Agregado'}: ${prod.name}`); buzz();
    query = ''; const qi = $h('q'); if (qi) { qi.value = ''; qi.focus(); }
    paint();
  }

  el.onclick = async e => {
    if (!ro && e.target.closest('.shop-row .info b')) { const it0 = find(e); if (it0) return editItem(it0); }
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const act = btn.dataset.act, it = find(e), rowEl = e.target.closest('.shop-row');
    if (act === 'back') { openList = null; query = ''; return render(el); }
    if (act === 'toggle' && it) return setChecked(it, !it.checked, rowEl);
    if (act === 'inc' && it) { it.qty += step(it); await DB.put('listItems', it); return paint(); }
    if (act === 'dec' && it) { it.qty = Math.max(step(it), it.qty - step(it)); await DB.put('listItems', it); return paint(); }
    if (act === 'price' && it) {
      const r = await formModal({ title: `Precio de ${it.name}`, fields: [{ name: 'price', label: 'Precio por unidad', type: 'number', min: 0, step: '0.01', value: it.price || '' }],
        onDelete: () => DB.del('listItems', it.id).then(() => items.splice(items.indexOf(it), 1)) });
      if (r) { it.price = r.price || 0; await DB.put('listItems', it); }
      return paint();
    }
    if (act === 'addp' || act === 'addbuy') return addItem(btn.closest('[data-pname]').dataset.pname, act === 'addbuy');
    if (act === 'pdf') { try { await (await import('../pdf.js')).shoppingReport(list, items, store?.name); } catch (err) { toast(err.message); } return; }
    if (act === 'menu') return listMenu();
    if (act === 'finish') return finish();
  };
  async function editItem(it) {
    const r = await formModal({ title: 'Editar artículo', fields: [
      { name: 'name', label: 'Nombre', required: true, value: it.name },
      { name: 'qty', label: 'Cantidad', type: 'number', min: 0.01, step: '0.01', required: true, value: it.qty },
      { name: 'unit', label: 'Unidad', type: 'select', value: it.unit || 'u', options: UNITS },
      { name: 'price', label: 'Precio por unidad', type: 'number', min: 0, step: '0.01', value: it.price || '' }],
      onDelete: () => DB.del('listItems', it.id).then(() => items.splice(items.indexOf(it), 1)) });
    if (r) Object.assign(it, { name: r.name, qty: r.qty || 1, unit: r.unit, price: r.price || 0 }), await DB.put('listItems', it);
    paint();
  }
  async function listMenu() {
    const r = await formModal({ title: 'Opciones de la lista', submitLabel: 'Aplicar', fields: [
      { name: 'action', label: 'Acción', type: 'select', value: 'tpl', options: [
        ['tpl', '⭐ Guardar como plantilla'], ['rename', '✎ Renombrar / presupuesto'], ['reset', '↩ Desmarcar todo'], ['delete', '🗑 Eliminar lista']] }] });
    if (!r) return;
    if (r.action === 'tpl') {
      const t = await formModal({ title: 'Guardar plantilla', fields: [{ name: 'name', label: 'Nombre de la plantilla', required: true, value: list.name }] });
      if (t) { await DB.add('templates', { name: t.name, items: items.map(i => [i.name, i.qty, i.unit]) }); toast('Plantilla guardada'); }
    } else if (r.action === 'rename') {
      const t = await formModal({ title: 'Editar lista', fields: [{ name: 'name', label: 'Nombre', required: true, value: list.name }, { name: 'budget', label: 'Presupuesto', type: 'number', min: 0, step: '0.01', value: list.budget || '' }] });
      if (t) { list.name = t.name; list.budget = t.budget || 0; await DB.put('lists', list); return listView(el, listId); }
    } else if (r.action === 'reset') {
      for (const i of items) { i.checked = false; await DB.put('listItems', i); } paint();
    } else if (r.action === 'delete' && confirm('¿Eliminar esta lista?')) {
      for (const i of items) await DB.del('listItems', i.id);
      await DB.del('lists', listId); openList = null; render(el);
    }
  }

  async function finish() {
    const bought = items.filter(i => i.checked), missing = items.filter(i => !i.checked);
    if (!bought.length) return toast('Marca al menos un producto como comprado');
    const total = sum(bought);
    if (!confirm(`¿Finalizar compra por ${money(total)}?\nSe registrará como gasto de alimentación.`)) return;
    const txId = total > 0 ? await addExpense({ amount: total, category: 'comida', description: `Súper: ${list.name}` }) : null;
    for (const i of bought) if (i.price > 0) await DB.add('priceHistory', { name: i.name, storeId: list.storeId, price: i.price, date: today() });
    await DB.put('lists', { ...list, completed: true, total, txId });
    if (missing.length && confirm(`Quedaron ${missing.length} productos sin comprar.\n¿Pasarlos a una nueva lista de pendientes?`)) {
      const nid = await DB.add('lists', { name: `Pendientes de ${list.name}`, storeId: list.storeId, budget: 0, date: today(), completed: false });
      await fillItems(nid, missing.map(i => ({ name: i.name, qty: i.qty, unit: i.unit })));
    }
    toast('Compra finalizada'); query = ''; render_(listId);
  }
  const render_ = id => listView(el, id);

  const qi = $h('q');
  if (qi) {
    qi.oninput = () => { query = qi.value; paintResults(); };
    qi.onkeydown = e => { if (e.key === 'Enter' && query.trim()) { const q = norm(query.trim()); const hit = items.find(i => norm(i.name) === q) ; if (!hit && !products.find(p => norm(p.name) === q)) addItem(query.trim(), false); } };
    const mic = $h('mic');
    if (mic) mic.onclick = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = new SR();
      rec.lang = 'es-CR'; rec.onresult = ev => { query = ev.results[0][0].transcript.replace(/[.]$/, ''); qi.value = query; paintResults(); };
      rec.onerror = () => toast('No se pudo usar el micrófono'); mic.classList.add('on'); rec.onend = () => mic.classList.remove('on'); rec.start();
    };
  }
  paint();
}

// ---------- pantalla principal de Súper ----------
export async function render(el) {
  el.onclick = null; el.ondblclick = null;
  if (openList) return listView(el, openList);
  const tabs = `<div class="tabs">${[['listas', 'Listas'], ['plantillas', 'Plantillas'], ['catalogo', 'Catálogo'], ['tiendas', 'Tiendas'], ['precios', 'Precios']]
    .map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const re = () => render(el);
  const wireTabs = () => $$('[data-tab]', el).forEach(b => b.onclick = () => { tab = b.dataset.tab; re(); });

  if (tab === 'listas') {
    const [lists, stores, allItems] = await Promise.all([DB.all('lists'), DB.all('stores'), DB.all('listItems')]);
    lists.sort((a, b) => b.id - a.id);
    const budget = DB.settings().foodBudget, mk = today().slice(0, 7);
    const spent = lists.filter(l => l.completed && l.date.startsWith(mk)).reduce((s, l) => s + (l.total || 0), 0);
    el.innerHTML = `${tabs}
      ${budget ? `<div class="card"><div class="row-between"><span>Presupuesto del mes</span><b>${money(spent)} / ${money(budget)}</b></div>
        <div class="bar big ${spent > budget ? 'over' : ''}"><i style="width:${Math.min(100, spent / budget * 100)}%"></i></div></div>` : ''}
      <button class="btn primary block big" id="newList">＋ Nueva lista de compras</button>
      <div class="quick"><span class="muted">Empezar rápido:</span><div class="chips">${BUILTIN_TEMPLATES.slice(0, 4).map(t => `<button class="chip" data-quick="${t.id}">${t.emoji} ${esc(t.name)}</button>`).join('')}</div></div>
      <ul class="list">${lists.map(l => { const its = allItems.filter(i => i.listId === l.id), got = its.filter(i => i.checked).length;
        return `<li class="item list-card" data-open="${l.id}"><div style="flex:1"><b>${esc(l.name)}</b>
        <small>${fmtDate(l.date)} · ${esc(stores.find(s => s.id === l.storeId)?.name || 'Sin súper')}</small>
        ${l.completed ? '' : `<div class="bar"><i style="width:${its.length ? got / its.length * 100 : 0}%"></i></div>`}</div>
        <span class="badge ${l.completed ? 'paid' : 'ok'}">${l.completed ? money(l.total) : `${got}/${its.length}`}</span></li>`; }).join('')
        || '<li class="empty">Crea tu primera lista o elige una plantilla.</li>'}</ul>`;
    wireTabs();
    const start = async () => { const id = await newList(); if (id) { openList = id; query = ''; re(); } };
    $('#newList', el).onclick = start;
    $$('[data-quick]', el).forEach(b => b.onclick = () => { openTpl = b.dataset.quick; start(); });
    $$('[data-open]', el).forEach(li => li.onclick = () => { openList = +li.dataset.open; query = ''; re(); });
  } else if (tab === 'plantillas') {
    const mine = await DB.all('templates');
    const card = (t, mineFlag) => `<div class="card tpl"><div class="row-between"><b>${t.emoji || '⭐'} ${esc(t.name)}</b><small>${t.items.length} artículos</small></div>
      <small class="muted">${esc(t.items.slice(0, 6).map(i => i[0]).join(', '))}…</small>
      <div class="row-between"><button class="btn primary sm" data-use="${mineFlag ? 'm-' : ''}${t.id}">Usar plantilla</button>${mineFlag ? `<button class="btn ghost sm" data-deltpl="${t.id}">Eliminar</button>` : ''}</div></div>`;
    el.innerHTML = `${tabs}<h3>Listas pre-cargadas</h3>${BUILTIN_TEMPLATES.map(t => card(t, false)).join('')}
      <h3>Mis plantillas</h3>${mine.map(t => card(t, true)).join('') || '<p class="empty">Desde cualquier lista usa «⋯ → Guardar como plantilla».</p>'}`;
    wireTabs();
    $$('[data-use]', el).forEach(b => b.onclick = async () => { openTpl = b.dataset.use; const id = await newList(); if (id) { openList = id; re(); } });
    $$('[data-deltpl]', el).forEach(b => b.onclick = async () => { if (confirm('¿Eliminar plantilla?')) { await DB.del('templates', +b.dataset.deltpl); re(); } });
  } else if (tab === 'catalogo') {
    const products = (await DB.all('products')).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const groups = products.reduce((g, p) => ((g[p.category] ||= []).push(p), g), {});
    el.innerHTML = `${tabs}<div class="row-between"><h3>Catálogo (${products.length})</h3><button class="btn primary sm" id="addP">+ Producto</button></div>
      ${Object.entries(groups).map(([c, ps]) => `<div class="card"><h4>${EMOJI[c] || '🛍️'} ${esc(c)}</h4><div class="chips">${ps.map(p =>
        `<button class="chip ${p.favorite ? 'fav' : ''}" data-p="${p.id}">${p.favorite ? '★ ' : ''}${esc(p.name)}</button>`).join('')}</div></div>`).join('')}`;
    wireTabs();
    const editP = async (p = {}) => {
      const cats = [...new Set([...Object.keys(SEED), 'Otros', ...products.map(x => x.category)])];
      const r = await formModal({ title: p.id ? 'Editar producto' : 'Nuevo producto', fields: [
        { name: 'name', label: 'Nombre', required: true, value: p.name },
        { name: 'category', label: 'Categoría', type: 'select', value: p.category || 'Otros', options: cats },
        { name: 'favorite', label: 'Favorito', type: 'checkbox', value: p.favorite }],
        onDelete: p.id ? () => DB.del('products', p.id) : null });
      if (r) await DB.put('products', { ...p, ...r });
      re();
    };
    $('#addP', el).onclick = () => editP();
    $$('[data-p]', el).forEach(b => b.onclick = () => editP(products.find(p => p.id === +b.dataset.p)));
  } else if (tab === 'tiendas') {
    const stores = await DB.all('stores');
    el.innerHTML = `${tabs}<div class="row-between"><h3>Supermercados</h3><button class="btn primary sm" id="addS">+ Tienda</button></div>
      <ul class="list">${stores.map(s => `<li class="item" data-s="${s.id}"><b>${esc(s.name)}</b><span>✎</span></li>`).join('')}</ul>`;
    wireTabs();
    const editS = async (s = {}) => {
      const r = await formModal({ title: s.id ? 'Editar tienda' : 'Nueva tienda', fields: [{ name: 'name', label: 'Nombre', required: true, value: s.name }],
        onDelete: s.id ? () => DB.del('stores', s.id) : null });
      if (r) await DB.put('stores', { ...s, ...r });
      re();
    };
    $('#addS', el).onclick = () => editS();
    $$('[data-s]', el).forEach(li => li.onclick = () => editS(stores.find(s => s.id === +li.dataset.s)));
  } else {
    const [hist, stores] = await Promise.all([DB.all('priceHistory'), DB.all('stores')]);
    const latest = {};
    for (const h of hist.sort((a, b) => a.date.localeCompare(b.date))) (latest[h.name] ||= {})[h.storeId] = h.price;
    const rows = Object.entries(latest);
    el.innerHTML = `${tabs}<h3>Comparación de precios</h3>
      ${rows.map(([name, byStore]) => { const entries = Object.entries(byStore); const min = Math.min(...entries.map(e => e[1]));
        return `<div class="card"><b>${esc(name)}</b>${barRows(entries.map(([sid, v]) => ({ label: stores.find(s => s.id === +sid)?.name || 'Sin súper', value: v })))}
        <small>Más barato: ${money(min)}</small></div>`; }).join('')
        || '<p class="empty">Los precios se guardan al finalizar tus compras.</p>'}`;
    wireTabs();
  }
}
