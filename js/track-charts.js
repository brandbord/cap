'use strict';
/* Graphiques SVG sans dépendance. Règles : marques fines (barres <= 24 px, bout arrondi 4 px, base droite),
   traits de 2 px, points >= 8 px avec anneau de la couleur de surface, grille en fins traits pleins, texte en
   couleurs de texte (jamais celle de la série), infobulle sur chaque marque (souris et clavier). */
const chartW = () => (matchMedia('(max-width:760px)').matches ? 400 : 720); // en petit écran on réduit la largeur logique pour garder des textes lisibles
const niceStep = raw => { const p = 10 ** Math.floor(Math.log10(raw || 1)), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
function yScale(max, ticks = 3) {
  const step = niceStep((max || 1) / ticks), top = Math.max(step, Math.ceil((max || 1) / step) * step), t = [];
  for (let v = 0; v <= top + 1e-9; v += step) t.push(Math.round(v * 1000) / 1000);
  return { top, ticks: t };
}
const fmtDay = s => { const d = D.parse(s); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', ''); };

/* ---------- anneau de progression ---------- */
function ringHtml({ pct, color, size = 84, stroke = 8, big, small, done }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return `<div class="ring2" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <div class="rc">${done ? ic('check', size > 60 ? 22 : 14) : `<b>${big}</b>`}${small ? `<small>${small}</small>` : ''}</div></div>`;
}

/* ---------- mini courbe (tendance) ---------- */
function sparkSvg(vals, color, w = 110, h = 32) {
  const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null); if (pts.length < 2) return '';
  const max = Math.max(1, ...pts.map(p => p[1])), x = i => 3 + i * (w - 6) / (vals.length - 1), y = v => h - 4 - v / max * (h - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(last[0])}" cy="${y(last[1])}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/></svg>`;
}

/* ---------- barres verticales ---------- */
function barChart({ data, color, fmt, tickFmt, goal, unitLabel = '', h = 236 }) {
  const W = chartW(), L = 40, R = 16, T = 14, B = 28, pw = W - L - R, ph = h - T - B;
  const max = Math.max(goal || 0, ...data.map(d => d.value || 0)), sc = yScale(max), band = pw / data.length, bw = Math.max(2, Math.min(24, band - 2));
  const y = v => T + ph - v / sc.top * ph, every = Math.ceil(data.length / 7);
  const maxIdx = data.reduce((b, d, i) => ((d.value || 0) > (data[b].value || 0) ? i : b), 0);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Évolution par semaine"><g class="ax">`;
  sc.ticks.forEach(t => { s += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${(tickFmt || fmt)(t)}</text>`; });
  data.forEach((d, i) => { if ((data.length - 1 - i) % every === 0) s += `<text x="${L + band * i + band / 2}" y="${h - 8}" text-anchor="middle">${d.label || fmtDay(d.from)}</text>`; });
  s += '</g>';
  data.forEach((d, i) => {
    const cx = L + band * i + band / 2, x0 = cx - bw / 2, v = d.value || 0, top = y(v), r = Math.min(4, (T + ph - top) / 2);
    const tip = `${fmt(v)}|${d.tip || 'Sem. du ' + fmtDay(d.from)}${d.cur ? ' (en cours)' : ''}${d.n ? '' : ' · rien de noté'}`;
    if (v > 0) s += `<path class="bar" d="M${x0},${T + ph}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${T + ph}Z" fill="${color}" opacity="${d.cur ? .55 : 1}"/>`;
    if (i === maxIdx && v > 0) s += `<text class="lab" x="${cx}" y="${top - 6}" text-anchor="middle">${fmt(v)}</text>`;
    s += `<rect class="hit" x="${L + band * i}" y="${T}" width="${band}" height="${ph + B}" fill="transparent" tabindex="0" data-tip="${esc(tip)}"/>`;
  });
  if (goal) s += `<line x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}" class="goalline"/><text class="lab goal" x="${W - R}" y="${y(goal) - 6}" text-anchor="end">objectif ${(tickFmt || fmt)(goal)}</text>`;
  return s + '</svg>';
}

/* ---------- courbe (meilleure performance par semaine, écarts visibles) ---------- */
function lineChart({ data, color, fmt, tickFmt, connect = false, h = 236 }) {
  const W = chartW(), L = 40, R = 56, T = 14, B = 28, pw = W - L - R, ph = h - T - B;
  const vals = data.map(d => d.value).filter(v => v != null), max = Math.max(1, ...vals), min = Math.min(...vals);
  const lo = vals.length > 1 && min > max * 0.3 ? Math.floor(min * 0.85) : 0, sc = yScale(max - lo), top = lo + sc.top;
  const x = i => L + (data.length > 1 ? i * pw / (data.length - 1) : pw / 2), y = v => T + ph - (v - lo) / (top - lo) * ph, every = Math.ceil(data.length / 7);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Progression"><g class="ax">`;
  sc.ticks.forEach(t => { const v = lo + t; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${(tickFmt || (x => nf(x, 1)))(v)}</text>`; });
  data.forEach((d, i) => { if ((data.length - 1 - i) % every === 0) s += `<text x="${x(i)}" y="${h - 8}" text-anchor="middle">${d.label || fmtDay(d.from)}</text>`; });
  s += '</g>';
  let seg = []; const segs = [];
  data.forEach((d, i) => { if (d.value == null) { if (seg.length && !connect) segs.push(seg); if (!connect) seg = []; } else seg.push(i); }); if (seg.length) segs.push(seg); // connect : on relie les points existants malgré les semaines vides (suivi de progression)
  segs.forEach(sg => { if (sg.length < 2) return;
    const dd = sg.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(data[i].value).toFixed(1)}`).join('');
    s += `<path d="${dd}L${x(sg[sg.length - 1])},${T + ph}L${x(sg[0])},${T + ph}Z" fill="${color}" opacity=".1"/><path d="${dd}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`; });
  const lastIdx = data.map(d => d.value).lastIndexOf(data.filter(d => d.value != null).pop()?.value);
  data.forEach((d, i) => {
    if (d.value == null) return;
    const tip = `${fmt(d.value)}|${d.tip || 'Sem. du ' + fmtDay(d.from)}${d.cur ? ' (en cours)' : ''}`;
    s += `<g class="pt"><line class="xh" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${T + ph}"/><circle cx="${x(i)}" cy="${y(d.value)}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>
      <circle class="hit" cx="${x(i)}" cy="${y(d.value)}" r="13" fill="transparent" tabindex="0" data-tip="${esc(tip)}"/></g>`;
  });
  if (lastIdx >= 0) s += `<text class="lab" x="${x(lastIdx) + 9}" y="${y(data[lastIdx].value) + 4}">${fmt(data[lastIdx].value)}</text>`;
  return s + '</svg>';
}

/* ---------- mosaïque annuelle ---------- */
function heatmapSvg({ counts, color, weeks }) {
  const cell = 12, gap = 3, L = 26, T = 18, W = L + weeks * (cell + gap), H = T + 7 * (cell + gap);
  const cur = D.monday(D.today()), start = D.add(cur, -7 * (weeks - 1)), today = D.today();
  let s = `<svg class="chart heat" viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="Activité sur ${weeks} semaines"><g class="ax">`;
  ['lun', 'mer', 'ven'].forEach((l, k) => { s += `<text x="0" y="${T + (k * 2) * (cell + gap) + cell - 1}">${l}</text>`; });
  let lastM = -1;
  for (let w = 0; w < weeks; w++) { const d = D.parse(D.add(start, w * 7)); if (d.getMonth() !== lastM && d.getDate() <= 7) { s += `<text x="${L + w * (cell + gap)}" y="10">${MONTHS[d.getMonth()]}</text>`; lastM = d.getMonth(); } }
  s += '</g>';
  for (let w = 0; w < weeks; w++) for (let k = 0; k < 7; k++) {
    const d = D.add(start, w * 7 + k); if (d > today) continue;
    const n = counts.get(d) || 0, lv = n === 0 ? 0 : n === 1 ? .32 : n === 2 ? .55 : n === 3 ? .78 : 1;
    s += `<rect class="cell" x="${L + w * (cell + gap)}" y="${T + k * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${n ? color : 'var(--line)'}" ${n ? `opacity="${lv}"` : 'opacity=".55"'} tabindex="0" data-tip="${esc(`${n} entrée${n > 1 ? 's' : ''}|${fmtDay(d)}`)}"/>`;
  }
  const lx = W - 5 * 17 - 60;
  s += `<g class="ax"><text x="${lx - 6}" y="${H + 14}" text-anchor="end">moins</text>${[0, .32, .55, .78, 1].map((o, i) => `<rect x="${lx + i * 17}" y="${H + 4}" width="12" height="12" rx="3" fill="${o ? color : 'var(--line)'}" opacity="${o || .55}"/>`).join('')}<text x="${lx + 5 * 17 + 2}" y="${H + 14}">plus</text></g>`;
  return s + '</svg>';
}

/* ---------- infobulle unique (souris + clavier), texte inséré via textContent ---------- */
(() => {
  const tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip);
  const show = (el, x, y) => {
    const [v, l] = (el.dataset.tip || '').split('|'); tip.textContent = '';
    const b = document.createElement('b'); b.textContent = v; const sp = document.createElement('span'); sp.textContent = l || '';
    tip.append(b, sp); tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(x + 14, innerWidth - r.width - 8)) + 'px'; tip.style.top = Math.max(8, y - r.height - 12) + 'px';
  };
  document.addEventListener('pointermove', e => { const el = e.target.closest?.('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else tip.style.display = 'none'; });
  document.addEventListener('focusin', e => { const el = e.target.closest?.('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', () => { tip.style.display = 'none'; });
  document.addEventListener('scroll', () => { tip.style.display = 'none'; }, true);
})();
