import { formModal, toast } from '../utils.js';
import { ANSWERS, PRICES, submit } from '../interest.js';

// Abre la pregunta de interés. Devuelve true si el usuario respondió.
export async function askInterest() {
  const r = await formModal({
    title: '¿Te gustaría una versión Pro?',
    intro: 'Estamos evaluando una versión con sincronización entre dispositivos, hogar compartido con tu familia y respaldo en la nube. Tu respuesta es voluntaria y anónima: solo cuenta cuántas personas se interesan. No se envía nada de tus datos.',
    submitLabel: 'Enviar respuesta',
    fields: [
      { name: 'answer', label: '¿Pagarías por esa versión?', type: 'select', value: 'si', options: ANSWERS },
      { name: 'price', label: 'Si tu respuesta es sí, ¿cuánto te parecería razonable?', type: 'select', value: 'na', options: PRICES }
    ]
  });
  if (!r) return false;
  const sent = await submit(r.answer, r.answer === 'no' ? 'na' : r.price);
  toast(sent ? '¡Gracias! Registramos tu respuesta' : 'Gracias. Se enviará cuando haya conexión');
  window.dispatchEvent(new Event('interest-changed'));
  return true;
}
