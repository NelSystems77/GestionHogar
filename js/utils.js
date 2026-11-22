import { settings } from './db.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = v => String(v ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDate(new Date());
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
export const monthLabel = key => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
};
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};
export const fmtDate = s => parseDate(s).toLocaleDateString('es', { day: 'numeric', month: 'short' });

export const SYMBOL = { CRC: '₡', USD: '$' };
export function money(amount, currency) {
  const cur = currency || settings().baseCurrency;
  return `${SYMBOL[cur] || ''}${Number(amount || 0).toLocaleString('es-CR', {
    minimumFractionDigits: cur === 'USD' ? 2 : 0, maximumFractionDigits: 2 })}`;
}
// Convierte un monto a la moneda base configurada
export function toBase(amount, currency) {
  const { baseCurrency, exchangeRate } = settings();
  const a = Number(amount) || 0;
  if (currency === baseCurrency) return a;
  return currency === 'USD' ? a * exchangeRate : a / exchangeRate;
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

export function confirmBox(msg) { return window.confirm(msg); }

// Diálogo modal con formulario. fields: [{name,label,type,value,options,required,step,placeholder}]
export function formModal({ title, fields, submitLabel = 'Guardar', onDelete, intro }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    const inputs = fields.map(f => {
      const id = `f_${f.name}`;
      let ctl;
      if (f.type === 'select') {
        ctl = `<select id="${id}" name="${f.name}">${f.options.map(o => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`;
        }).join('')}</select>`;
      } else if (f.type === 'checkbox') {
        ctl = `<input id="${id}" name="${f.name}" type="checkbox" ${f.value ? 'checked' : ''}>`;
      } else {
        ctl = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}"
          ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''}
          ${f.max != null ? `max="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}">`;
      }
      return `<label class="field ${f.type === 'checkbox' ? 'inline' : ''}" for="${id}"><span>${esc(f.label)}</span>${ctl}</label>`;
    }).join('');
    wrap.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>${intro ? `<p class="muted">${esc(intro)}</p>` : ''}${inputs}
      <div class="modal-actions">
        ${onDelete ? '<button type="button" class="btn danger" data-act="del">Eliminar</button>' : ''}
        <button type="button" class="btn ghost" data-act="cancel">Cancelar</button>
        <button type="submit" class="btn primary">${esc(submitLabel)}</button>
      </div></form>`;
    document.body.appendChild(wrap);
    const form = wrap.firstElementChild;
    const close = v => { wrap.remove(); resolve(v); };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const out = {};
      for (const f of fields) {
        const el = form.elements[f.name];
        out[f.name] = f.type === 'checkbox' ? el.checked
          : f.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim();
      }
      close(out);
    });
    form.querySelector('[data-act=cancel]').onclick = () => close(null);
    const d = form.querySelector('[data-act=del]');
    if (d) d.onclick = async () => { if (confirmBox('¿Eliminar este elemento?')) { await onDelete(); close(null); } };
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(null); });
    (form.querySelector('input,select') || form).focus();
  });
}

export function barRows(rows, fmt = money) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return rows.map(r => `<div class="bar-row"><span class="bar-label">${esc(r.label)}</span>
    <div class="bar"><i style="width:${(r.value / max * 100).toFixed(1)}%"></i></div>
    <span class="bar-value">${fmt(r.value)}</span></div>`).join('');
}
