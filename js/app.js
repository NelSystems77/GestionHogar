import * as DB from './db.js';
import { $, $$ } from './utils.js';
import { seedIfNeeded } from './modules/shopping.js';

const ROUTES = {
  '': ['Inicio', () => import('./modules/dashboard.js')],
  finanzas: ['Finanzas', () => import('./modules/finance.js')],
  obligaciones: ['Pagos', () => import('./modules/obligations.js')],
  super: ['Supermercado', () => import('./modules/shopping.js')],
  tareas: ['Tareas del hogar', () => import('./modules/tasks.js')],
  ajustes: ['Ajustes', () => import('./modules/settings.js')]
};

export const SCALES = [90, 100, 115, 130, 150, 175, 200];

// Aplica tema, tamaño de interfaz, alto contraste y modo fácil
export function applyTheme() {
  const { theme, uiScale, contrast, easyMode } = DB.settings();
  const root = document.documentElement;
  const set = (k, on) => (on ? root.setAttribute(k, '') : root.removeAttribute(k));
  root.dataset.theme = theme === 'auto' ? '' : theme;
  root.style.setProperty('--ui', (uiScale || 100) / 100);
  set('data-contrast', contrast);
  set('data-easy', easyMode);
  set('data-big', (uiScale || 100) >= 140);
  requestAnimationFrame(measure);
}

export async function setScale(v) {
  await DB.setSetting('uiScale', v);
  applyTheme();
}
export async function stepScale(dir) {
  const cur = DB.settings().uiScale || 100;
  const i = SCALES.reduce((b, s, k) => (Math.abs(s - cur) < Math.abs(SCALES[b] - cur) ? k : b), 0);
  await setScale(SCALES[Math.min(SCALES.length - 1, Math.max(0, i + dir))]);
}

// Las barras superior/inferior cambian de alto con el tamaño de letra
function measure() {
  const r = document.documentElement.style;
  r.setProperty('--top-h', $('.top-bar').offsetHeight + 'px');
  r.setProperty('--nav-h', $('#nav').offsetHeight + 'px');
}

async function route() {
  const key = location.hash.replace(/^#\/?/, '');
  const [title, load] = ROUTES[key] || ROUTES[''];
  $('#pageTitle').textContent = title;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.route === (ROUTES[key] ? key : '')));
  const app = $('#app');
  try {
    const mod = await load();
    await mod.render(app);
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    app.innerHTML = '<div class="card"><h3>Ocurrió un error</h3><p class="muted">No se pudo cargar esta sección. Recarga la página.</p></div>';
  }
}

// Splash: se oculta cuando la app está lista, tras un mínimo para que se aprecie
const splashStart = performance.now();
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  try { sessionStorage.setItem('splashed', '1'); } catch (e) { /* modo privado */ }
  const go = () => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 700);
  };
  setTimeout(go, Math.max(0, 1700 - (performance.now() - splashStart)));
  el.addEventListener('click', go, { once: true }); // tocar para saltar
}
setTimeout(() => document.getElementById('splash')?.remove(), 8000); // seguridad

async function start() {
  try {
    await DB.init();
    await DB.loadSettings();
    await seedIfNeeded();
    if (!DB.settings().firstSeen) await DB.setSetting('firstSeen', Date.now());
  } catch (e) {
    $('#app').innerHTML = '<div class="card"><h3>Almacenamiento no disponible</h3><p class="muted">GestionHogar necesita IndexedDB. Sal del modo privado e inténtalo de nuevo.</p></div>';
    return;
  }
  applyTheme();
  $('#smaller').onclick = () => stepScale(-1);
  $('#bigger').onclick = () => stepScale(1);
  new ResizeObserver(measure).observe($('#nav'));
  window.addEventListener('resize', measure);
  window.addEventListener('hashchange', route);
  await route();
  hideSplash();
  import('./interest.js').then(m => m.retryPending()).catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
start();
