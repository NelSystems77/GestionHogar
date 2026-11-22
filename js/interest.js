// Encuesta voluntaria de interés en una versión Pro.
// Envía SOLO la respuesta (sí / tal vez / no) y un rango de precio. Sin datos personales ni de contenido.
import * as DB from './db.js';
import { FIREBASE } from './firebase-config.js';

export const ANSWERS = [['si', 'Sí, pagaría'], ['tal_vez', 'Tal vez'], ['no', 'No por ahora']];
export const PRICES = [['na', 'Prefiero no decir'], ['lt2', 'Menos de $2 al mes'], ['2a5', 'Entre $2 y $5 al mes'], ['gt5', 'Más de $5 al mes']];

export const enabled = () => !!FIREBASE.apiKey;
export const state = () => DB.settings().interest || null;   // { answer, price, sent }

function deviceId() {
  let id = DB.settings().deviceId;
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/-/g, ''); DB.setSetting('deviceId', id); }
  return id.length >= 16 ? id : id.padEnd(16, '0');
}

async function send(rec) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/interest` +
    `?documentId=${encodeURIComponent(deviceId())}&key=${encodeURIComponent(FIREBASE.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { answer: { stringValue: rec.answer }, price: { stringValue: rec.price }, v: { integerValue: '1' } } })
  });
  // 409 = este dispositivo ya había votado: se considera registrado
  return res.ok || res.status === 409;
}

export async function submit(answer, price) {
  const rec = { answer, price: price || 'na', sent: false, at: Date.now() };
  await DB.setSetting('interest', rec);
  if (!enabled()) return false;
  try { rec.sent = await send(rec); } catch (e) { rec.sent = false; }
  await DB.setSetting('interest', rec);
  return rec.sent;
}

// Reintenta enviar una respuesta pendiente (por ejemplo, si estaba sin conexión)
export async function retryPending() {
  const rec = state();
  if (!rec || rec.sent || !enabled()) return;
  try { rec.sent = await send(rec); if (rec.sent) await DB.setSetting('interest', rec); } catch (e) { /* sin conexión */ }
}

// ¿Mostrar la tarjeta en el inicio? Tras 3 días de uso, si no respondió ni la pospuso
export function shouldPrompt() {
  const s = DB.settings();
  if (!enabled() || s.interest) return false;
  if (Date.now() < (s.interestSnooze || 0)) return false;
  return Date.now() - (s.firstSeen || Date.now()) >= 3 * 864e5;
}
export const snooze = () => DB.setSetting('interestSnooze', Date.now() + 14 * 864e5);
