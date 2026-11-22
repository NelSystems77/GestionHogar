// Gráficos dibujados en canvas (sin dependencias). Sirven para pantalla y para el PDF.
export const PALETTE = ['#00A862', '#3B82C4', '#E0A100', '#E04848', '#8E5BD9', '#12A5A5', '#E0702B', '#6B7785', '#C2478B', '#5B8C2A', '#8A6D3B'];

function setup(w, h, scale = 2) {
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  c.style.width = '100%'; c.style.maxWidth = w + 'px'; c.style.height = 'auto';
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); // fondo blanco para el PDF
  g.textBaseline = 'middle';
  return { c, g };
}

// Dona con leyenda. data: [{label, value}]
export function doughnut(data, { w = 560, h = 300, title = '', fmt = v => v.toFixed(0) } = {}) {
  const { c, g } = setup(w, h);
  const total = data.reduce((s, d) => s + d.value, 0);
  g.fillStyle = '#1A2332'; g.font = 'bold 16px system-ui,sans-serif'; g.textAlign = 'left';
  if (title) g.fillText(title, 12, 18);
  if (!total) { g.fillStyle = '#6B7785'; g.font = '14px system-ui'; g.fillText('Sin datos para graficar', 12, h / 2); return c; }
  const cx = 130, cy = h / 2 + 12, R = 100, r = 58;
  let a = -Math.PI / 2;
  data.forEach((d, i) => {
    const s = d.value / total * Math.PI * 2;
    g.beginPath(); g.arc(cx, cy, R, a, a + s); g.arc(cx, cy, r, a + s, a, true); g.closePath();
    g.fillStyle = PALETTE[i % PALETTE.length]; g.fill();
    a += s;
  });
  g.fillStyle = '#1A2332'; g.textAlign = 'center'; g.font = 'bold 15px system-ui'; g.fillText(fmt(total), cx, cy - 6);
  g.font = '11px system-ui'; g.fillStyle = '#6B7785'; g.fillText('total', cx, cy + 12);
  g.textAlign = 'left';
  const rowH = Math.min(26, (h - 50) / data.length);
  data.forEach((d, i) => {
    const y = 42 + i * rowH;
    g.fillStyle = PALETTE[i % PALETTE.length]; g.fillRect(260, y - 6, 12, 12);
    g.fillStyle = '#1A2332'; g.font = '13px system-ui';
    g.fillText(`${d.label.slice(0, 22)}  ${(d.value / total * 100).toFixed(0)}%`, 280, y);
    g.textAlign = 'right'; g.fillText(fmt(d.value), w - 12, y); g.textAlign = 'left';
  });
  return c;
}

// Barras agrupadas ingresos vs gastos. data: [{label, a, b}]
export function groupedBars(data, { w = 560, h = 280, title = '', aLabel = 'Ingresos', bLabel = 'Gastos', fmt = v => v.toFixed(0) } = {}) {
  const { c, g } = setup(w, h);
  g.fillStyle = '#1A2332'; g.font = 'bold 16px system-ui'; g.textAlign = 'left';
  if (title) g.fillText(title, 12, 18);
  const max = Math.max(...data.flatMap(d => [d.a, d.b]), 1);
  const x0 = 12, y0 = h - 34, top = 56, bw = (w - 24) / data.length;
  g.strokeStyle = '#E3E8ED'; g.lineWidth = 1;
  for (let i = 0; i <= 3; i++) { const y = y0 - (y0 - top) * i / 3; g.beginPath(); g.moveTo(x0, y); g.lineTo(w - 12, y); g.stroke(); }
  data.forEach((d, i) => {
    const gx = x0 + i * bw + bw * 0.15, barW = bw * 0.33;
    [[d.a, '#00A862'], [d.b, '#E04848']].forEach(([v, col], k) => {
      const bh = (y0 - top) * v / max;
      g.fillStyle = col; g.fillRect(gx + k * (barW + 3), y0 - bh, barW, bh);
    });
    g.fillStyle = '#6B7785'; g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText(d.label, x0 + i * bw + bw / 2, y0 + 16);
  });
  g.textAlign = 'left'; g.font = '12px system-ui';
  g.fillStyle = '#00A862'; g.fillRect(w - 190, 10, 12, 12); g.fillStyle = '#1A2332'; g.fillText(aLabel, w - 172, 16);
  g.fillStyle = '#E04848'; g.fillRect(w - 100, 10, 12, 12); g.fillStyle = '#1A2332'; g.fillText(bLabel, w - 82, 16);
  g.fillStyle = '#6B7785'; g.fillText('máx. ' + fmt(max), 12, 38);
  return c;
}

// Barras horizontales simples. data: [{label, value}]
export function hbars(data, { w = 560, title = '', fmt = v => v.toFixed(0) } = {}) {
  const rowH = 28, h = 44 + data.length * rowH;
  const { c, g } = setup(w, h);
  g.fillStyle = '#1A2332'; g.font = 'bold 16px system-ui'; g.textAlign = 'left';
  if (title) g.fillText(title, 12, 18);
  const max = Math.max(...data.map(d => d.value), 1);
  data.forEach((d, i) => {
    const y = 42 + i * rowH;
    g.fillStyle = '#1A2332'; g.font = '13px system-ui'; g.fillText(d.label.slice(0, 18), 12, y);
    const bw = (w - 250) * d.value / max;
    g.fillStyle = PALETTE[i % PALETTE.length]; g.fillRect(140, y - 8, Math.max(bw, 2), 16);
    g.fillStyle = '#1A2332'; g.fillText(fmt(d.value), 148 + bw, y);
  });
  return c;
}
