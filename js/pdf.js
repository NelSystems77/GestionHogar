import { money, toBase, monthLabel, shiftMonth, fmtDate, today } from './utils.js';
import { doughnut, groupedBars, hbars } from './charts.js';
import { summarize, EXPENSE_CATS, INCOME_CATS } from './modules/finance.js';
import * as DB from './db.js';

let loading;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  loading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/jspdf.umd.min.js';
    s.onload = () => res(window.jspdf.jsPDF);
    s.onerror = () => { loading = null; rej(new Error('No se pudo cargar el generador de PDF')); };
    document.head.appendChild(s);
  });
  return loading;
}

const GREEN = [0, 168, 98], DARK = [26, 35, 50], GREY = [107, 119, 133];
const M = 14; // margen
const PW = 210, PH = 297;

function header(doc, title, sub) {
  doc.setFillColor(...GREEN); doc.rect(0, 0, PW, 24, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('GestionHogar', M, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`${title}${sub ? ' · ' + sub : ''}`, M, 19);
  doc.setTextColor(...DARK);
}
function footer(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(`Generado el ${fmtDate(today())} · GestionHogar`, M, PH - 8);
    doc.text(`Página ${i} de ${n}`, PW - M, PH - 8, { align: 'right' });
  }
}
function image(doc, canvas, y, width = PW - M * 2) {
  const h = width * canvas.height / canvas.width;
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', M, y, width, h);
  return y + h + 4;
}
function ensure(doc, y, need, title, sub) {
  if (y + need > PH - 16) { doc.addPage(); header(doc, title, sub); return 34; }
  return y;
}
function kpiBoxes(doc, y, items) {
  const w = (PW - M * 2 - 6 * (items.length - 1)) / items.length;
  items.forEach(([label, value, color], i) => {
    const x = M + i * (w + 6);
    doc.setDrawColor(227, 232, 237); doc.setFillColor(248, 250, 251); doc.roundedRect(x, y, w, 18, 2, 2, 'FD');
    doc.setFontSize(8); doc.setTextColor(...GREY); doc.text(label, x + 3, y + 6);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...(color || DARK)); doc.text(value, x + 3, y + 14);
    doc.setFont('helvetica', 'normal');
  });
  doc.setTextColor(...DARK);
  return y + 24;
}
const catName = (t, c) => ((t === 'income' ? INCOME_CATS : EXPENSE_CATS).find(x => x[0] === c) || [0, c])[1];
// jsPDF (fuentes base) no soporta algunos caracteres; los símbolos de moneda van como texto
const pdfMoney = (a, c) => money(a, c).replace('₡', 'CRC ');

export async function financeReport(month) {
  const JsPDF = await loadJsPDF();
  const all = await DB.all('transactions');
  const txs = all.filter(t => t.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const s = summarize(txs);
  const base = DB.settings().baseCurrency;
  const fmtBase = v => pdfMoney(v, base);
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const title = 'Reporte financiero', sub = monthLabel(month);
  header(doc, title, sub);
  let y = kpiBoxes(doc, 32, [
    ['Ingresos', fmtBase(s.income), GREEN], ['Gastos', fmtBase(s.expense), [224, 72, 72]],
    ['Balance', fmtBase(s.balance)], ['% ahorro', s.savings.toFixed(0) + '%']]);

  const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: catName('expense', c), value: v }));
  y = image(doc, doughnut(cats, { title: 'Gastos por categoría', fmt: v => fmtBase(v).replace(/\.\d+$/, '') }), y);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const k = shiftMonth(month, -i);
    const m = summarize(all.filter(t => t.date.startsWith(k)));
    months.push({ label: monthLabel(k).slice(0, 3), a: m.income, b: m.expense });
  }
  y = ensure(doc, y, 75, title, sub);
  y = image(doc, groupedBars(months, { title: 'Ingresos vs gastos (últimos 6 meses)', fmt: v => fmtBase(v).replace(/\.\d+$/, '') }), y);

  // Tabla de movimientos
  y = ensure(doc, y, 30, title, sub);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Detalle de movimientos', M, y); y += 6;
  const cols = [[M, 'Fecha'], [M + 22, 'Descripción'], [M + 92, 'Categoría'], [PW - M, 'Monto']];
  const head = () => { doc.setFillColor(...GREEN); doc.rect(M, y - 4.5, PW - M * 2, 7, 'F'); doc.setTextColor(255); doc.setFontSize(9);
    cols.forEach(([x, l], i) => doc.text(l, x + (i === 3 ? 0 : 2), y, i === 3 ? { align: 'right' } : undefined)); doc.setTextColor(...DARK); y += 7; };
  head(); doc.setFont('helvetica', 'normal');
  txs.forEach((t, i) => {
    if (y > PH - 20) { doc.addPage(); header(doc, title, sub); y = 34; head(); doc.setFont('helvetica', 'normal'); }
    if (i % 2) { doc.setFillColor(246, 248, 250); doc.rect(M, y - 4.5, PW - M * 2, 6.5, 'F'); }
    doc.setFontSize(9);
    doc.text(fmtDate(t.date), M + 2, y);
    doc.text(String(t.description || catName(t.type, t.category)).slice(0, 38), M + 24, y);
    doc.text(catName(t.type, t.category).slice(0, 22), M + 94, y);
    doc.setTextColor(...(t.type === 'income' ? GREEN : [224, 72, 72]));
    doc.text((t.type === 'income' ? '+' : '-') + pdfMoney(t.amount, t.currency), PW - M, y, { align: 'right' });
    doc.setTextColor(...DARK); y += 6.5;
  });
  if (!txs.length) doc.text('Sin movimientos en este mes.', M + 2, y);
  footer(doc);
  doc.save(`reporte-financiero-${month}.pdf`);
}

export async function shoppingReport(list, items, storeName) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const title = 'Lista de compras', sub = list.name;
  header(doc, title, sub);
  const bought = items.filter(i => i.checked), missing = items.filter(i => !i.checked);
  const sum = a => a.reduce((s, i) => s + i.price * i.qty, 0);
  const base = DB.settings().baseCurrency;
  let y = kpiBoxes(doc, 32, [['Comprados', `${bought.length} de ${items.length}`, GREEN], ['Faltan', String(missing.length), [224, 72, 72]],
    ['En carrito', pdfMoney(sum(bought), base)], ['Estimado total', pdfMoney(sum(items), base)]]);
  doc.setFontSize(9); doc.setTextColor(...GREY); doc.text(`${storeName || 'Sin supermercado'} · ${fmtDate(list.date)}`, M, y - 2); doc.setTextColor(...DARK);
  y += 4;
  const byCat = {};
  items.forEach(i => { byCat[i.category || 'Otros'] = (byCat[i.category || 'Otros'] || 0) + i.price * i.qty; });
  const data = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  if (data.length) y = image(doc, doughnut(data, { title: 'Gasto estimado por categoría', fmt: v => pdfMoney(v, base).replace(/\.\d+$/, '') }), y);
  const section = (label, arr, color) => {
    y = ensure(doc, y, 14, title, sub);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...color); doc.text(`${label} (${arr.length})`, M, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK);
    arr.forEach(i => {
      y = ensure(doc, y, 8, title, sub);
      doc.rect(M, y - 3.2, 3.5, 3.5); if (i.checked) { doc.text('x', M + 0.7, y - 0.3); }
      doc.text(`${i.qty} ${i.unit || 'u'}  ${i.name}`.slice(0, 60), M + 6, y);
      doc.text(i.price ? pdfMoney(i.price * i.qty, base) : '-', PW - M, y, { align: 'right' });
      y += 6.5;
    });
    y += 3;
  };
  section('Faltan por comprar', missing, [224, 72, 72]);
  section('Ya comprados', bought, GREEN);
  footer(doc);
  doc.save(`lista-${list.name.replace(/[^\w]+/g, '-').toLowerCase()}.pdf`);
}
