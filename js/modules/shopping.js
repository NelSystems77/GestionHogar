import * as DB from '../db.js';
import { $, $$, esc, money, today, fmtDate, formModal, toast, barRows } from '../utils.js';
import { addExpense } from './finance.js';

const SEED = {
  'Frutas y verduras': ['Banano', 'Manzana', 'Tomate', 'Cebolla', 'Papa', 'Zanahoria', 'Lechuga', 'Limón'],
  'Lácteos y huevos': ['Leche', 'Huevos', 'Queso', 'Mantequilla', 'Yogurt', 'Natilla'],
  'Carnes': ['Pollo', 'Carne molida', 'Cerdo', 'Salchichón', 'Atún'],
  'Granos y despensa': ['Arroz', 'Frijoles', 'Azúcar', 'Sal', 'Aceite', 'Pasta', 'Café', 'Harina', 'Pan'],
  'Bebidas': ['Agua', 'Jugo', 'Refresco'],
  'Limpieza': ['Detergente', 'Jabón de platos', 'Cloro', 'Papel higiénico', 'Servilletas', 'Bolsas de basura'],
  'Higiene personal': ['Jabón', 'Shampoo', 'Pasta dental', 'Desodorante']
};
const SEED_STORES = ['AutoMercado', 'Walmart', 'Más x Menos', 'Fresh Market', 'Pali'];

export async function seedIfNeeded() {
  if (DB.settings().seeded) return;
  for (const [category, names] of Object.entries(SEED)) for (const name of names) await DB.add('products', { name, category, favorite: false });
  for (const name of SEED_STORES) await DB.add('stores', { name });
  await DB.setSetting('seeded', true);
}

let tab = 'listas';
let openList = null;

async function newList() {
  const stores = await DB.all('stores');
  const r = await formModal({
    title: 'Nueva lista de compras', submitLabel: 'Crear',
    fields: [{ name: 'name', label: 'Nombre', required: true, placeholder: 'Ej: Compra semanal' },
      { name: 'storeId', label: 'Supermercado', type: 'select', value: stores[0]?.id, options: [['', 'Sin definir'], ...stores.map(s => [s.id, s.name])] },
      { name: 'budget', label: 'Presupuesto (opcional)', type: 'number', min: 0, step: '0.01' }]
  });
  if (!r) return null;
  return DB.add('lists', { name: r.name, storeId: r.storeId ? +r.storeId : null, budget: r.budget || 0, date: today(), completed: false });
}

async function listView(el, listId) {
  const list = await DB.get('lists', listId);
  if (!list) { openList = null; return render(el); }
  const [items, products, stores] = await Promise.all([DB.where('listItems', i => i.listId === listId), DB.all('products'), DB.all('stores')]);
  const store = stores.find(s => s.id === list.storeId);
  const total = items.filter(i => i.checked).reduce((s, i) => s + i.price * i.qty, 0);
  const est = items.reduce((s, i) => s + i.price * i.qty, 0);
  const over = list.budget && est > list.budget;
  el.innerHTML = `
    <div class="row-between"><button class="btn ghost sm" id="back">‹ Listas</button>
      ${list.completed ? '<span class="badge paid">Finalizada</span>' : '<button class="btn primary sm" id="finish">✓ Finalizar compra</button>'}</div>
    <h2>${esc(list.name)}</h2>
    <p class="muted">${esc(store?.name || 'Sin supermercado')} · ${fmtDate(list.date)}</p>
    <div class="kpis"><div class="kpi"><small>En carrito</small><b>${money(total)}</b></div>
      <div class="kpi ${over ? 'expense' : ''}"><small>Estimado${list.budget ? ' / ' + money(list.budget) : ''}</small><b>${money(est)}</b></div></div>
    ${list.completed ? '' : `<div class="add-item"><input id="q" list="plist" placeholder="Agregar producto…" autocomplete="off">
      <datalist id="plist">${products.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>
      <button class="btn primary" id="addItem">+</button></div>`}
    <ul class="list">${items.map(i => `<li class="item ${i.checked ? 'done' : ''}" data-id="${i.id}">
      <label class="chk"><input type="checkbox" data-chk="${i.id}" ${i.checked ? 'checked' : ''} ${list.completed ? 'disabled' : ''}>
      <div><b>${esc(i.name)}</b><small>${i.qty} × ${i.price ? money(i.price) : 'sin precio'}</small></div></label>
      <div class="row"><b>${money(i.price * i.qty)}</b>${list.completed ? '' : `<button class="btn ghost sm" data-edit="${i.id}">✎</button>`}</div></li>`).join('')
      || '<li class="empty">Lista vacía. Agrega productos arriba.</li>'}</ul>`;

  const re = () => listView(el, listId);
  $('#back', el).onclick = () => { openList = null; render(el); };
  const fin = $('#finish', el);
  if (fin) fin.onclick = async () => {
    const bought = items.filter(i => i.checked);
    if (!bought.length) return toast('Marca al menos un producto como comprado');
    const sum = bought.reduce((s, i) => s + i.price * i.qty, 0);
    if (!confirm(`Finalizar compra por ${money(sum)}? Se registrará como gasto de alimentación.`)) return;
    const txId = sum > 0 ? await addExpense({ amount: sum, category: 'comida', description: `Súper: ${list.name}` }) : null;
    for (const i of bought) if (i.price > 0) await DB.add('priceHistory', { name: i.name, storeId: list.storeId, price: i.price, date: today() });
    await DB.put('lists', { ...list, completed: true, total: sum, txId });
    toast('Compra finalizada'); re();
  };
  const addBtn = $('#addItem', el);
  if (addBtn) {
    const doAdd = async () => {
      const name = $('#q', el).value.trim();
      if (!name) return;
      const known = products.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (!known) await DB.add('products', { name, category: 'Otros', favorite: false });
      const hist = (await DB.all('priceHistory')).filter(h => h.name.toLowerCase() === name.toLowerCase()).sort((a, b) => b.date.localeCompare(a.date));
      const last = hist.find(h => h.storeId === list.storeId) || hist[0];
      await DB.add('listItems', { listId, name: known?.name || name, qty: 1, price: last?.price || 0, checked: false });
      re();
    };
    addBtn.onclick = doAdd;
    $('#q', el).onkeydown = e => { if (e.key === 'Enter') doAdd(); };
  }
  $$('[data-chk]', el).forEach(c => c.onchange = async () => {
    const it = items.find(i => i.id === +c.dataset.chk); it.checked = c.checked; await DB.put('listItems', it); re();
  });
  $$('[data-edit]', el).forEach(b => b.onclick = async () => {
    const it = items.find(i => i.id === +b.dataset.edit);
    const r = await formModal({ title: it.name, fields: [
      { name: 'qty', label: 'Cantidad', type: 'number', min: 0.01, step: '0.01', required: true, value: it.qty },
      { name: 'price', label: 'Precio unitario', type: 'number', min: 0, step: '0.01', value: it.price }],
      onDelete: () => DB.del('listItems', it.id) });
    if (r) { await DB.put('listItems', { ...it, qty: r.qty || 1, price: r.price || 0 }); }
    re();
  });
}

export async function render(el) {
  if (openList) return listView(el, openList);
  const tabs = `<div class="tabs">${[['listas', 'Listas'], ['catalogo', 'Catálogo'], ['tiendas', 'Tiendas'], ['precios', 'Precios']]
    .map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const re = () => render(el);
  const wireTabs = () => $$('[data-tab]', el).forEach(b => b.onclick = () => { tab = b.dataset.tab; re(); });

  if (tab === 'listas') {
    const lists = (await DB.all('lists')).sort((a, b) => b.id - a.id);
    const stores = await DB.all('stores');
    const budget = DB.settings().foodBudget;
    const mk = today().slice(0, 7);
    const spent = lists.filter(l => l.completed && l.date.startsWith(mk)).reduce((s, l) => s + (l.total || 0), 0);
    el.innerHTML = `${tabs}
      ${budget ? `<div class="card"><div class="row-between"><span>Presupuesto del mes</span><b>${money(spent)} / ${money(budget)}</b></div>
        <div class="bar big ${spent > budget ? 'over' : ''}"><i style="width:${Math.min(100, spent / budget * 100)}%"></i></div></div>` : ''}
      <ul class="list">${lists.map(l => `<li class="item" data-open="${l.id}"><div><b>${esc(l.name)}</b>
        <small>${fmtDate(l.date)} · ${esc(stores.find(s => s.id === l.storeId)?.name || 'Sin súper')}</small></div>
        <span class="badge ${l.completed ? 'paid' : 'ok'}">${l.completed ? money(l.total) : 'Activa'}</span></li>`).join('')
        || '<li class="empty">Crea tu primera lista de compras</li>'}</ul>
      <button class="fab" id="newList" aria-label="Nueva lista">+</button>`;
    wireTabs();
    $('#newList', el).onclick = async () => { const id = await newList(); if (id) { openList = id; re(); } };
    $$('[data-open]', el).forEach(li => li.onclick = () => { openList = +li.dataset.open; re(); });
  } else if (tab === 'catalogo') {
    const products = (await DB.all('products')).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const groups = products.reduce((g, p) => ((g[p.category] ||= []).push(p), g), {});
    el.innerHTML = `${tabs}<div class="row-between"><h3>Catálogo (${products.length})</h3><button class="btn primary sm" id="addP">+ Producto</button></div>
      ${Object.entries(groups).map(([c, ps]) => `<div class="card"><h4>${esc(c)}</h4><div class="chips">${ps.map(p =>
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
    // Último precio por producto y tienda
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
