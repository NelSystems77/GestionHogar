import * as DB from '../db.js';
import { $, esc, toast, confirmBox } from '../utils.js';
import { applyTheme, setScale, SCALES } from '../app.js';
import { seedIfNeeded } from './shopping.js';
import { enabled as interestOn, state as interestState, ANSWERS } from '../interest.js';
import { askInterest } from './interest-ui.js';

export async function render(el) {
  const s = DB.settings();
  el.innerHTML = `
    <div class="card"><h3>Finanzas</h3>
      <label class="field"><span>Moneda base de reportes</span><select id="base"><option value="CRC" ${s.baseCurrency === 'CRC' ? 'selected' : ''}>₡ Colones</option><option value="USD" ${s.baseCurrency === 'USD' ? 'selected' : ''}>$ Dólares</option></select></label>
      <label class="field"><span>Tipo de cambio (1 USD = ? CRC)</span><input id="rate" type="number" min="1" step="0.01" value="${esc(s.exchangeRate)}"></label>
      <label class="field"><span>Presupuesto mensual de supermercado</span><input id="fb" type="number" min="0" step="0.01" value="${esc(s.foodBudget)}"></label>
      <button class="btn primary" id="saveFin">Guardar</button></div>
    <div class="card easy-card"><h3>👓 Tamaño y comodidad de lectura</h3>
      <p class="muted">Elige el tamaño que te resulte más cómodo. Se aplica a toda la aplicación.</p>
      <div class="size-presets">${[['Normal', 100], ['Grande', 130], ['Muy grande', 160], ['Extra grande', 200]].map(([l, v]) =>
        `<button class="btn ${Math.abs((s.uiScale || 100) - v) < 15 ? 'on' : ''}" data-scale="${v}">${l}</button>`).join('')}</div>
      <label class="field"><span>Ajuste fino: <b id="pct">${s.uiScale || 100}%</b></span>
        <input id="scale" type="range" min="${SCALES[0]}" max="${SCALES[SCALES.length - 1]}" step="5" value="${s.uiScale || 100}"></label>
      <div class="size-preview"><b>Vista previa</b><p style="margin:.3rem 0 0">Así se verá el texto de tus listas y pagos.</p></div>
      <label class="field inline"><input id="contrast" type="checkbox" ${s.contrast ? 'checked' : ''}><span>Alto contraste (letras más nítidas)</span></label>
      <label class="field inline"><input id="easy" type="checkbox" ${s.easyMode ? 'checked' : ''}><span>Modo fácil: botones y letras grandes</span></label></div>
    <div class="card"><h3>Apariencia</h3>
      <label class="field"><span>Tema</span><select id="theme"><option value="auto">Automático</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label></div>
    <div class="card"><h3>Respaldo de datos</h3><p class="muted">Tus datos viven solo en este dispositivo. Exporta un respaldo con regularidad.</p>
      <div class="row"><button class="btn primary" id="exp">⬇ Exportar</button><label class="btn ghost" for="imp">⬆ Importar</label><input type="file" id="imp" accept="application/json" hidden></div></div>
    ${interestOn() ? `<div class="card"><h3>💬 Versión Pro</h3>${interestState()
      ? `<p class="muted">¡Gracias! Tu respuesta: <b>${esc((ANSWERS.find(a => a[0] === interestState().answer) || [0, ''])[1])}</b>${interestState().sent ? '' : ' (pendiente de enviar)'}.</p>`
      : `<p class="muted">¿Te interesaría sincronizar con tu familia y tener respaldo en la nube? Tu respuesta es voluntaria y anónima.</p><button class="btn primary" id="pro">Quiero opinar</button>`}
      <p class="muted">Privacidad: la app guarda tus datos solo en este dispositivo. Únicamente se envía la respuesta de esta encuesta, si tú decides responder.</p></div>` : ''}
    <div class="card danger-zone"><h3>Zona de peligro</h3><p class="muted">Borra todos los datos de la app en este dispositivo.</p><button class="btn danger" id="reset">Borrar todo</button></div>
    <p class="muted center">Gestión Hogar · tus datos viven solo en este dispositivo</p>`;
  $('#theme', el).value = s.theme;
  const pro = el.querySelector('#pro');
  if (pro) pro.onclick = async () => { if (await askInterest()) render(el); };
  const scaleIn = $('#scale', el);
  scaleIn.oninput = () => {
    $('#pct', el).textContent = scaleIn.value + '%';
    document.documentElement.style.setProperty('--ui', scaleIn.value / 100);
  };
  scaleIn.onchange = async () => { await setScale(+scaleIn.value); render(el); };
  el.querySelectorAll('[data-scale]').forEach(b => { b.onclick = async () => { await setScale(+b.dataset.scale); render(el); }; });
  $('#contrast', el).onchange = async e => { await DB.setSetting('contrast', e.target.checked); applyTheme(); };
  $('#easy', el).onchange = async e => {
    await DB.setSetting('easyMode', e.target.checked);
    if (e.target.checked) {
      await DB.setSetting('contrast', true);
      if ((DB.settings().uiScale || 100) < 150) await DB.setSetting('uiScale', 150);
    }
    applyTheme();
    render(el);
  };
  $('#theme', el).onchange = async e => { await DB.setSetting('theme', e.target.value); applyTheme(); };
  $('#saveFin', el).onclick = async () => {
    const rate = Number($('#rate', el).value);
    if (!(rate > 0)) return toast('Tipo de cambio inválido');
    await DB.setSetting('baseCurrency', $('#base', el).value);
    await DB.setSetting('exchangeRate', rate);
    await DB.setSetting('foodBudget', Number($('#fb', el).value) || 0);
    toast('Ajustes guardados');
  };
  $('#exp', el).onclick = async () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(await DB.exportAll(), null, 2)], { type: 'application/json' }));
    a.download = `gestionhogar-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  $('#imp', el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (!confirmBox('Importar reemplazará todos tus datos actuales. ¿Continuar?')) return;
      await DB.importAll(JSON.parse(await f.text()));
      applyTheme(); toast('Respaldo importado'); render(el);
    } catch (err) { toast(err.message || 'No se pudo importar'); }
  };
  $('#reset', el).onclick = async () => {
    if (!confirmBox('Se borrarán TODOS los datos. ¿Seguro?')) return;
    await DB.resetAll(); await seedIfNeeded(); applyTheme(); toast('Datos borrados'); render(el);
  };
}
