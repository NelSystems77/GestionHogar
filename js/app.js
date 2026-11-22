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

export function applyTheme() {
  const t = DB.settings().theme;
  document.documentElement.dataset.theme = t === 'auto' ? '' : t;
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

async function start() {
  try {
    await DB.init();
    await DB.loadSettings();
    await seedIfNeeded();
  } catch (e) {
    $('#app').innerHTML = '<div class="card"><h3>Almacenamiento no disponible</h3><p class="muted">GestionHogar necesita IndexedDB. Sal del modo privado e inténtalo de nuevo.</p></div>';
    return;
  }
  applyTheme();
  window.addEventListener('hashchange', route);
  await route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
start();
