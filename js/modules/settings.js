import * as DB from '../db.js';
import { $, esc, toast, confirmBox } from '../utils.js';
import { applyTheme } from '../app.js';
import { seedIfNeeded } from './shopping.js';

export async function render(el) {
  const s = DB.settings();
  el.innerHTML = `
    <div class="card"><h3>Finanzas</h3>
      <label class="field"><span>Moneda base de reportes</span><select id="base"><option value="CRC" ${s.baseCurrency === 'CRC' ? 'selected' : ''}>₡ Colones</option><option value="USD" ${s.baseCurrency === 'USD' ? 'selected' : ''}>$ Dólares</option></select></label>
      <label class="field"><span>Tipo de cambio (1 USD = ? CRC)</span><input id="rate" type="number" min="1" step="0.01" value="${esc(s.exchangeRate)}"></label>
      <label class="field"><span>Presupuesto mensual de supermercado</span><input id="fb" type="number" min="0" step="0.01" value="${esc(s.foodBudget)}"></label>
      <button class="btn primary" id="saveFin">Guardar</button></div>
    <div class="card"><h3>Apariencia</h3>
      <label class="field"><span>Tema</span><select id="theme"><option value="auto">Automático</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label></div>
    <div class="card"><h3>Respaldo de datos</h3><p class="muted">Tus datos viven solo en este dispositivo. Exporta un respaldo con regularidad.</p>
      <div class="row"><button class="btn primary" id="exp">⬇ Exportar</button><label class="btn ghost" for="imp">⬆ Importar</label><input type="file" id="imp" accept="application/json" hidden></div></div>
    <div class="card danger-zone"><h3>Zona de peligro</h3><p class="muted">Borra todos los datos de la app en este dispositivo.</p><button class="btn danger" id="reset">Borrar todo</button></div>
    <p class="muted center">GestionHogar v1.0 · 100% local y privado</p>`;
  $('#theme', el).value = s.theme;
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
