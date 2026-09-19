'use strict';
/* ================= SUIVIS : journal, stats, saisie détaillée, réglages ================= */

/* ---------- Journal ---------- */
function journalListHtml() {
  const f = ui.trk, q = norm(f.jq);
  const all = db.logs.filter(l => (!f.jcat || logCat(l)?.id === f.jcat) && (!q || norm(`${logType(l)?.name || ''} ${l.note}`).includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (!all.length) return `<div class="empty"><b>Rien à afficher</b>${db.logs.length ? 'Aucune séance ne correspond à ces filtres.' : 'Tes séances apparaîtront ici.'}</div>`;
  const ls = all.slice(0, f.jlimit), days = [...new Set(ls.map(l => l.date))];
  return days.map(d => { const dl = ls.filter(l => l.date === d), min = dl.reduce((s, l) => s + (l.duration || 0), 0);
    return `<div class="jday"><span>${dayLabel(d)}</span><small>${dl.length} entrée${dl.length > 1 ? 's' : ''}${min ? ' · ' + hmin(min) : ''}</small></div>` +
      dl.map(l => { const t = logType(l), c = logCat(l);
        return `<div class="jrow" data-do="logEdit" data-id="${l.id}"><span class="dot" style="--c:${catColor(c)}"></span><div class="jn"><b>${esc(t?.name || 'Type supprimé')}</b><small>${esc(c?.name || '')}${l.note ? ' · ' + esc(l.note) : ''}</small></div><span class="jv">${esc(fmtLog(l))}</span></div>`; }).join(''); }).join('')
    + (all.length > ls.length ? `<div style="padding:12px;text-align:center"><button class="btn sm" data-do="jmore">Voir plus (${all.length - ls.length})</button></div>` : '');
}
function viewTJournal() {
  const f = ui.trk;
  return `<div class="body"><div class="toolbar"><button class="chip ${!f.jcat ? 'on' : ''}" data-do="jcat" data-v="">Tout</button>
    ${db.trackCats.map(c => `<button class="chip ${f.jcat === c.id ? 'on' : ''}" data-do="jcat" data-v="${c.id}"><span class="dot" style="--c:${catColor(c)}"></span>${esc(c.name)}</button>`).join('')}
    <label class="search">${ic('search', 15)}<input data-search="tjournal" placeholder="Rechercher…" value="${esc(f.jq)}"></label></div>
    <div class="scroll"><div class="card" id="jlist">${journalListHtml()}</div></div></div>`;
}

/* ---------- Stats ---------- */
function defaultMetric(scope, mets) {
  const c = scope.catId && tcat(scope.catId), pref = scope.typeId ? ['maxreps', 'maxweight', 'distance', 'minutes', 'days'] : c ? [{ days: 'days', minutes: 'minutes', sessions: 'sessions' }[c.goalKind], 'days'] : ['days', 'minutes'];
  return pref.find(m => mets.includes(m)) || mets[0] || 'days';
}
function tableHtml(data, M) {
  return `<table class="tbl"><thead><tr><th>Semaine du</th><th>${M.label}</th><th>Entrées</th></tr></thead><tbody>${data.slice().reverse().map(d =>
    `<tr><td>${fmtDay(d.from)}${d.cur ? ' <small class="muted">(en cours)</small>' : ''}</td><td>${d.value == null ? '—' : M.fmt(d.value)}</td><td>${d.n}</td></tr>`).join('')}</tbody></table>`;
}
function viewTStats() {
  const f = ui.trk, scope = {};
  if (f.cat && !tcat(f.cat)) f.cat = null;
  if (f.cat) scope.catId = f.cat;
  if (f.type && ttype(f.type)?.catId === f.cat) scope.typeId = f.type; else f.type = null;
  const mets = metricsFor(scope), m = mets.includes(f.metric) ? f.metric : defaultMetric(scope, mets); f.metric = m;
  const M = METRICS[m], cat = f.cat ? tcat(f.cat) : null, col = cat ? catColor(cat) : accent();
  const data = weekly(scope, m, f.weeks), from = data[0].from;
  const goal = cat && cat.goal && ((cat.goalKind === 'days' && m === 'days') || (cat.goalKind === 'minutes' && m === 'minutes') || (cat.goalKind === 'sessions' && m === 'sessions')) && !scope.typeId ? cat.goal : null;
  const per = logsOf({ ...scope, from }), min = per.reduce((s, l) => s + (l.duration || 0), 0), dys = new Set(per.map(l => l.date)).size;
  const ser = cat ? catSeries(cat) : null, tx = seriesText(ser);
  const scopeName = scope.typeId ? ttype(scope.typeId).name : cat ? cat.name : 'Tout';
  const chart = data.every(d => !d.value) ? '<div class="empty" style="padding:40px 10px"><b>Pas encore de données</b>Note une séance pour voir la courbe.</div>'
    : f.table ? tableHtml(data, M)
    : M.bar ? barChart({ data, color: col, fmt: M.fmt, tickFmt: m === 'minutes' ? v => hmin(v) : M.fmt, goal }) : lineChart({ data, color: col, fmt: M.fmt });
  return `<div class="body"><div class="scroll">
    <div class="toolbar fbar">
      <button class="chip ${!f.cat ? 'on' : ''}" data-do="scat" data-v="">Tout</button>
      ${db.trackCats.map(c => `<button class="chip ${f.cat === c.id ? 'on' : ''}" data-do="scat" data-v="${c.id}"><span class="dot" style="--c:${catColor(c)}"></span>${esc(c.name)}</button>`).join('')}
      <select class="in sel" data-tsel="metric">${mets.map(k => `<option value="${k}" ${k === m ? 'selected' : ''}>${METRICS[k].label}</option>`).join('')}</select>
      <div class="seg">${[4, 12, 26, 52].map(w => `<button class="${f.weeks === w ? 'on' : ''}" data-do="sweeks" data-v="${w}">${w} sem.</button>`).join('')}</div></div>
    ${typeChipsHtml(f.cat, f.type, 'stype')}
    <div class="tiles4">
      <div class="stile"><small>Jours actifs</small><b>${dys}</b><span class="muted">sur ${f.weeks * 7} jours</span></div>
      <div class="stile"><small>Entrées</small><b>${per.length}</b><span class="muted">séances notées</span></div>
      <div class="stile"><small>Temps noté</small><b>${min ? hmin(min) : '—'}</b><span class="muted">durées saisies</span></div>
      <div class="stile"><small>Série en cours</small><b>${tx ? `<span class="ser ${ser.kind === 'ok' ? 'sun' : 'moon'}" style="font-size:22px;padding:2px 12px 2px 10px">${ic(ser.kind === 'ok' ? 'sun' : 'moon', 22)}${ser.count}</span>` : '—'}</b><span class="muted">${tx || (cat ? 'pas encore de série' : 'choisis une catégorie')}</span></div></div>
    <div class="tgrid"><div class="tcol">
      <section class="sec"><h2>${M.label}<span class="why">par semaine · ${esc(scopeName)} · ${f.weeks} dernières semaines</span></h2>
        <div class="card cardc"><div class="cardtop"><span></span><div class="seg"><button class="${!f.table ? 'on' : ''}" data-do="stable" data-v="0">Graphique</button><button class="${f.table ? 'on' : ''}" data-do="stable" data-v="1">Tableau</button></div></div>${chart}</div></section>
      <section class="sec"><h2>Mosaïque<span class="why">${heatWeeks()} semaines · ${esc(scopeName)}</span></h2><div class="card" style="padding:14px 16px">${heatmapSvg({ counts: heatCounts(scope), color: col, weeks: heatWeeks() })}</div></section>
    </div><div class="tcol right">
      <section class="sec"><h2>Records<span class="why">${esc(scopeName)}</span></h2><div class="card">${recordsHtml(scope, 8)}</div></section>
      ${!f.cat ? `<section class="sec"><h2>Répartition<span class="why">${f.weeks} semaines</span></h2><div class="card">${shareHtml(f.weeks * 7)}</div></section>` : `<section class="sec"><h2>Dernières séances</h2><div class="card">${lastLogsHtml(6, f.cat)}</div></section>`}
    </div></div></div></div>`;
}

/* ---------- Saisie détaillée ---------- */
function logModal(o = {}) {
  const l = o.logId ? byId(db.logs, o.logId) : null;
  const lastType = db.logs.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.typeId;
  let typeId = l?.typeId || o.typeId || (o.catId && db.trackTypes.find(t => t.catId === o.catId)?.id) || lastType || db.trackTypes[0]?.id;
  if (!typeId) return toast('Crée d\'abord un type de séance dans les Réglages');
  const cur = { ...(l || {}) };
  const m = openModal(`<h3>${l ? 'Modifier la séance' : 'Nouvelle séance'}</h3>
    <div class="fld"><label>Type</label><select class="in" id="lm-t">${db.trackCats.map(c => `<optgroup label="${esc(c.name)}">${db.trackTypes.filter(t => t.catId === c.id).map(t => `<option value="${t.id}" ${t.id === typeId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    <div class="lmgrid" id="lm-m"></div>
    <div class="fld"><label>Date</label><input class="in" type="date" id="lm-d" value="${l?.date || o.date || D.today()}"></div>
    <div class="fld"><label>Note (facultatif)</label><input class="in" id="lm-n" value="${esc(l?.note || '')}" placeholder="Ressenti, ce que tu as travaillé…" autocomplete="off"></div>
    <div class="acts">${l ? `<button class="btn danger" id="lm-del" style="margin-right:auto">${ic('trash', 14)}Supprimer</button>` : ''}<button class="btn" data-do="closeModal">Annuler</button><button class="btn primary" id="lm-ok">Enregistrer</button></div>`);
  const draw = () => {
    const t = ttype(m.querySelector('#lm-t').value);
    m.querySelector('#lm-m').innerHTML = t.measures.map(k => `<div class="fld"><label>${MEASURES[k].label}${MEASURES[k].unit ? ` (${MEASURES[k].unit})` : ''}</label><input class="in" type="number" step="any" min="0" inputmode="decimal" data-mk="${k}" value="${cur[k] ?? ''}"></div>`).join('') || '<p class="hint" style="grid-column:1/-1">Ce type ne mesure rien : la séance est simplement notée comme faite.</p>';
    m.querySelectorAll('[data-mk]').forEach(i => i.addEventListener('input', () => { cur[i.dataset.mk] = i.value; }));
  };
  m.querySelector('#lm-t').addEventListener('change', draw); draw();
  m.querySelector('#lm-ok').onclick = () => {
    const t = ttype(m.querySelector('#lm-t').value), patch = { typeId: t.id, date: m.querySelector('#lm-d').value || D.today(), note: m.querySelector('#lm-n').value.trim() };
    ['sets', 'reps', 'weight', 'duration', 'distance'].forEach(k => { patch[k] = t.measures.includes(k) && cur[k] !== '' && cur[k] != null ? +cur[k] : null; });
    closeModal();
    if (l) mutate(() => updateLog(l.id, patch), 'Séance modifiée'); else mutate(() => addLog(patch), `${t.name} noté ✓`);
  };
  if (l) m.querySelector('#lm-del').onclick = () => { closeModal(); mutate(() => removeLog(l.id), 'Séance supprimée'); };
}

/* ---------- Réglages de Suivis ---------- */
const NEW_CAT_COLORS = ['#7a5aa6', '#3f8f7f', '#a0526a', '#6b7a2a'];
function trackSettingsHtml() {
  const routines = db.routines;
  const cats = db.trackCats.map(c => {
    const unit = c.goalKind === 'minutes' ? 'h' : c.goalKind === 'days' ? 'j' : 'séances', v = c.goalKind === 'minutes' ? (c.goal || 0) / 60 : (c.goal || 0);
    return `<div class="tset"><input type="color" value="${c.color}" data-tc="${c.id}" data-f="color" title="Couleur"><input class="in" value="${esc(c.name)}" data-tc="${c.id}" data-f="name" placeholder="Nom">
      <div class="goalf"><select class="in" data-tc="${c.id}" data-f="goalKind">${Object.entries(GOAL_KINDS).map(([k, l]) => `<option value="${k}" ${c.goalKind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input class="in" type="number" min="0" step="any" value="${v || ''}" data-tc="${c.id}" data-f="goalv" placeholder="objectif"><span class="muted">${unit}</span></div>
      <select class="in" data-tc="${c.id}" data-f="routineId" title="Une séance dans cette catégorie valide cette routine"><option value="">Ne valide aucune routine</option>${routines.map(r => `<option value="${r.id}" ${c.routineId === r.id ? 'selected' : ''}>Valide « ${esc(r.title)} »</option>`).join('')}</select>
      <button class="iconbtn" data-do="tdelCat" data-id="${c.id}" title="Supprimer">${ic('trash', 15)}</button></div>`;
  }).join('');
  const types = db.trackCats.map(c => `<div class="tgroup"><div class="tgh"><span class="dot" style="--c:${catColor(c)}"></span><b>${esc(c.name)}</b></div>
    ${db.trackTypes.filter(t => t.catId === c.id).map(t => `<div class="ttrow"><input class="in" value="${esc(t.name)}" data-tt="${t.id}" data-f="name" placeholder="Nom du type">
      <input class="in" value="${esc(t.keywords || '')}" data-tt="${t.id}" data-f="keywords" placeholder="mots-clés (facultatif)">
      <div class="mchips">${Object.entries(MEASURES).map(([k, mm]) => `<button class="${t.measures.includes(k) ? 'on' : ''}" data-do="tmeasure" data-id="${t.id}" data-m="${k}" title="${mm.label}">${mm.label}</button>`).join('')}</div>
      <button class="iconbtn" data-do="tdelType" data-id="${t.id}" title="Supprimer">${ic('trash', 15)}</button></div>`).join('')}
    <div style="padding:6px 16px 12px"><button class="btn sm" data-do="taddType" data-id="${c.id}">${ic('plus', 14)}Ajouter un type</button></div></div>`).join('');
  return `<section class="sec"><h2>Catégories de suivi<span class="why">objectif hebdomadaire et lien avec une routine</span></h2><div class="card">${cats}
      <div style="padding:10px 16px"><button class="btn sm" data-do="taddCat">${ic('plus', 14)}Ajouter une catégorie</button></div></div></section>
    <section class="sec"><h2>Types de séance<span class="why">le nom sert de mot-clé pour la saisie rapide</span></h2><div class="card">${types || '<div class="empty">Crée d\'abord une catégorie.</div>'}</div></section>
    <section class="sec"><h2>Séances d'exemple</h2><div class="card" style="padding:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" data-do="demoLogs">Ajouter des séances d'exemple</button>${hasDemo() ? '<button class="btn danger" data-do="clearDemo">Supprimer les séances d\'exemple</button>' : ''}</div></section>`;
}
