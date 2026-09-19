'use strict';
/* ================= SUIVIS · ÉVOLUTION (écran) ================= */
ui.evo = { cat: null, type: null, metric: null, gran: 'week', view: null, cum: false, weeks: 12, init: false };

const typeChipsHtml = (catId, cur, action) => {
  const ts = catId ? db.trackTypes.filter(t => t.catId === catId) : [];
  if (!ts.length) return '';
  return `<div class="toolbar fbar sub"><span class="fl">Type</span><button class="chip ${!cur ? 'on' : ''}" data-do="${action}" data-v="">Tous</button>
    ${ts.map(t => `<button class="chip ${cur === t.id ? 'on' : ''}" data-do="${action}" data-v="${t.id}">${esc(t.name)}</button>`).join('')}</div>`;
};
const segHtml = (opts, cur, action) => `<div class="seg">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-do="${action}" data-v="${v}">${l}</button>`).join('')}</div>`;

function viewTEvo() {
  const f = ui.evo;
  if (!f.init) { f.init = true; const t = topType(); if (t) { f.cat = t.catId; f.type = t.id; } } // point de départ : ce que tu travailles le plus
  if (f.cat && !tcat(f.cat)) { f.cat = null; f.type = null; }
  const scope = {}; if (f.cat) scope.catId = f.cat;
  if (f.type && ttype(f.type)?.catId === f.cat) scope.typeId = f.type; else f.type = null;
  const cat = f.cat ? tcat(f.cat) : null, col = cat ? catColor(cat) : accent(), scopeName = scope.typeId ? ttype(scope.typeId).name : cat ? cat.name : 'Tout';
  const head = `<div class="toolbar fbar"><button class="chip ${!f.cat ? 'on' : ''}" data-do="ecat" data-v="">Tout</button>
    ${db.trackCats.map(c => `<button class="chip ${f.cat === c.id ? 'on' : ''}" data-do="ecat" data-v="${c.id}"><span class="dot" style="--c:${catColor(c)}"></span>${esc(c.name)}</button>`).join('')}
    <span class="sp2"></span>${segHtml([[4, '4 sem.'], [12, '12 sem.'], [26, '26 sem.'], [52, '52 sem.']], f.weeks, 'eweeks')}</div>${typeChipsHtml(f.cat, f.type, 'etype')}`;
  const mets = evoMetrics(scope);
  if (!mets.length) return `<div class="body"><div class="scroll">${head}<div class="empty card"><b>Pas encore de données</b>Note quelques séances pour « ${esc(scopeName)} » et l'évolution apparaîtra ici.</div></div></div>`;
  const m = mets.includes(f.metric) ? f.metric : defaultEvoMetric(scope, mets); f.metric = m;
  const M = EM[m], additive = M.kind === 'sum' || M.kind === 'days' || M.kind === 'count', cum = f.cum && additive;
  let data = evoBuckets(scope, m, f.gran, f.weeks); if (cum) data = evoCumulative(data);
  const view = f.view || (cum ? 'line' : additive ? 'bars' : 'line');
  const S = evoSummary(scope, m, f.weeks), has = data.filter(d => d.value != null && (d.value > 0 || !additive));
  const bestB = has.length ? has.reduce((a, b) => ((M.lowerBetter ? b.value < a.value : b.value > a.value) ? b : a)) : null;
  const chart = !has.length ? '<div class="empty" style="padding:40px 10px"><b>Rien sur cette période</b>Essaie une période plus longue.</div>'
    : view === 'table' ? `<table class="tbl"><thead><tr><th>${GRAN[f.gran][1][0].toUpperCase() + GRAN[f.gran][1].slice(1)}</th><th>${M.label}${cum ? ' (cumulé)' : ''}</th><th>Entrées</th></tr></thead><tbody>${data.slice().reverse().map(d =>
        `<tr><td>${esc(d.tip)}${d.cur ? ' <small class="muted">(en cours)</small>' : ''}</td><td>${d.value == null ? '—' : M.fmt(d.value)}</td><td>${d.n}</td></tr>`).join('')}</tbody></table>`
    : view === 'bars' ? barChart({ data, color: col, fmt: M.fmt, tickFmt: M.tick || M.fmt }) : lineChart({ data, color: col, fmt: M.fmt, tickFmt: M.tick || null, connect: !additive });
  const arrow = S.delta == null ? '' : S.delta > 0.5 ? '▲' : S.delta < -0.5 ? '▼' : '=';
  const dtxt = S.delta == null ? '—' : `${arrow} ${S.delta > 0 ? '+' : ''}${nf(S.delta, Math.abs(S.delta) < 10 ? 1 : 0)} %`;
  const dsub = S.delta == null ? 'pas assez de données avant' : S.good > 0 ? 'en progression' : S.good < 0 ? 'en recul' : 'stable';
  return `<div class="body"><div class="scroll">${head}
    <section class="sec"><h2>Statistique<span class="why">une à la fois, parmi celles qui ont du sens pour « ${esc(scopeName)} »</span></h2>
      <div class="metricrow">${mets.map(k => `<button class="chip mchip ${k === m ? 'on' : ''}" data-do="emetric" data-v="${k}" title="${esc(EM[k].hint)}">${EM[k].label}</button>`).join('')}</div>
      <p class="hint" style="margin:8px 2px 0">${esc(M.hint[0].toUpperCase() + M.hint.slice(1))}.${!scope.typeId ? ' Pour les répétitions, le poids ou l\'allure, choisis un type d\'exercice ci-dessus.' : ''}</p></section>
    <div class="tiles4">
      <div class="stile"><small>${KIND_WORD[M.kind]} · ${f.weeks} sem.</small><b>${S.cur == null ? '—' : M.fmt(S.cur)}</b><span class="muted">${esc(scopeName)}</span></div>
      <div class="stile"><small>${f.weeks} sem. précédentes</small><b>${S.prev == null ? '—' : M.fmt(S.prev)}</b><span class="muted">pour comparer</span></div>
      <div class="stile"><small>Évolution</small><b class="dl ${S.good > 0 ? 'up' : S.good < 0 ? 'down' : ''}">${dtxt}</b><span class="muted">${dsub}</span></div>
      <div class="stile"><small>Meilleure ${GRAN[f.gran][1]}</small><b>${bestB ? M.fmt(bestB.value) : '—'}</b><span class="muted">${bestB ? esc(bestB.tip) : 'aucune donnée'}</span></div></div>
    <div class="tgrid"><div class="tcol">
      <section class="sec"><h2>${M.label}<span class="why">${GRAN[f.gran][0].toLowerCase()}${cum ? ', cumulé' : ''} · ${f.weeks} dernières semaines</span></h2>
        <div class="card cardc"><div class="cardtop ctrls">${segHtml([['day', 'Par séance'], ['week', 'Par semaine'], ['month', 'Par mois']], f.gran, 'egran')}
          ${additive ? segHtml([[0, 'Par période'], [1, 'Cumulé']], cum ? 1 : 0, 'ecum') : ''}
          ${segHtml([['bars', 'Barres'], ['line', 'Courbe'], ['table', 'Tableau']], view, 'eview')}</div>${chart}</div></section>
    </div><div class="tcol right">
      <section class="sec"><h2>Records<span class="why">${esc(scopeName)}</span></h2><div class="card">${recordsHtml(scope, 6)}</div></section>
      <section class="sec"><h2>Dernières séances</h2><div class="card">${lastLogsHtml(6, scope.catId || null, scope.typeId || null)}</div></section>
    </div></div></div></div>`;
}
