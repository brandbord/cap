'use strict';
/* ================= CALENDRIER ================= */
let calEvents = {};
function calMap(from, to) {
  const map = {}, t = D.today(), put = (d, e) => { if (d >= from && d <= to) (map[d] = map[d] || []).push(e); };
  db.actions.filter(a => isActive(a) && !a.inbox).forEach(a => {
    if (a.deadline) put(a.deadline, { kind: 'dl', k: 'actions', o: a });
    if (a.followup && a.followup !== a.deadline) put(a.followup, { kind: 'fu', k: 'actions', o: a });
  });
  db.routines.forEach(r => { const s = rStats(r); if (!s.dormant && s.state !== 'done' && s.due >= t) put(s.due, { kind: 'rt', k: 'routines', o: r }); });
  db.actions.filter(a => a.doneAt).forEach(a => put(a.doneAt, { kind: 'dn', k: 'actions', o: a }));
  db.activities.filter(x => x.type === 'fait' && x.routineId).forEach(x => put(x.date, { kind: 'dn', k: 'routines', o: byId(db.routines, x.routineId) || { title: '?' } }));
  return map;
}
function viewCalendar() {
  const t = D.today(), base = D.parse(D.monthStart(t)); base.setMonth(base.getMonth() + ui.cal.off);
  const y = base.getFullYear(), m = base.getMonth(), first = D.iso(base), last = D.iso(new Date(y, m + 1, 0));
  const start = D.monday(first), weeks = Math.ceil((D.diff(last, start) + 1) / 7), end = D.add(start, weeks * 7 - 1);
  calEvents = calMap(start, end);
  const title = base.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const wd = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = D.add(start, i), ev = calEvents[d] || [], done = ev.filter(e => e.kind === 'dn').length, main = ev.filter(e => e.kind !== 'dn');
    const shown = main.slice(0, 3), more = main.length - shown.length;
    cells += `<div class="cd ${D.parse(d).getMonth() !== m ? 'off' : ''} ${d === t ? 'today' : ''} ${d < t ? 'past' : ''}" data-do="calDay" data-d="${d}">
      <div class="cdh"><b>${D.parse(d).getDate()}</b>${done ? `<span class="cdn" title="${done} fait(s)">${ic('check', 11)}${done}</span>` : ''}<button class="cdadd" data-do="calAdd" data-d="${d}" title="Nouvelle action ce jour-là">${ic('plus', 13)}</button></div>
      ${shown.map(e => `<div class="cc ${e.kind}" data-do="open" data-k="${e.k}" data-id="${e.o.id}" title="${esc(e.o.title)}">${e.kind === 'rt' ? ic('repeat', 11) : domDot(e.o.domainId)}<span>${esc(e.o.title)}</span></div>`).join('')}
      ${more > 0 ? `<button class="ccm" data-do="calMore" data-d="${d}">+${more} autre${more > 1 ? 's' : ''}</button>` : ''}</div>`;
  }
  return `<div class="body"><div class="toolbar">
      <button class="iconbtn" data-do="calNav" data-v="-1" title="Mois précédent">${ic('left', 18)}</button>
      <h2 class="caltitle">${title}</h2>
      <button class="iconbtn" data-do="calNav" data-v="1" title="Mois suivant">${ic('right', 18)}</button>
      ${ui.cal.off ? '<button class="btn sm" data-do="calNav" data-v="0">Aujourd\'hui</button>' : ''}
      <span class="legend"><i class="dl"></i>deadline<i class="fu"></i>followup<i class="rt"></i>routine due<i class="dn"></i>fait</span></div>
    <div class="calwrap"><div class="calhead">${wd.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal" style="grid-template-rows:repeat(${weeks},minmax(0,1fr))">${cells}</div></div></div>`;
}

/* ================= REVUE DE LA SEMAINE ================= */
const reviewDue = () => D.diff(D.today(), db.meta.lastReview || db.meta.createdAt || D.today()) >= 7;
const hm = min => min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`;

function balance(days) {
  const from = D.add(D.today(), -(days - 1)), rows = db.domains.map(d => ({ id: d.id, name: d.name, color: d.color, min: 0, acts: 0, runs: 0, left: 0, leftMin: 0 }));
  rows.push({ id: null, name: 'Sans domaine', color: '#b9b2a6', min: 0, acts: 0, runs: 0, left: 0, leftMin: 0 });
  const row = id => rows.find(r => r.id === (id || null)) || rows[rows.length - 1];
  db.actions.forEach(a => {
    if (a.status === 'done' && a.doneAt >= from) { const r = row(a.domainId); r.acts++; r.min += a.effort || 0; }
    else if (isActive(a) && !a.inbox) { const r = row(a.domainId); r.left++; r.leftMin += a.effort || 0; }
  });
  db.activities.filter(x => x.type === 'fait' && x.routineId && x.date >= from).forEach(x => {
    const rt = byId(db.routines, x.routineId); if (!rt) return; const r = row(rt.domainId); r.runs++; r.min += rt.effort || 0;
  });
  return rows.filter(r => r.acts || r.runs || r.left);
}
function balanceHtml() {
  const rows = balance(ui.revPeriod), byMin = rows.some(r => r.min > 0);
  const val = r => byMin ? r.min : r.acts + r.runs, max = Math.max(1, ...rows.map(val));
  const totA = rows.reduce((s, r) => s + r.acts, 0), totR = rows.reduce((s, r) => s + r.runs, 0), totM = rows.reduce((s, r) => s + r.min, 0);
  return `<div class="seg" style="margin-bottom:12px">${[[7, '7 jours'], [30, '30 jours'], [90, '90 jours']].map(([d, l]) => `<button class="${ui.revPeriod === d ? 'on' : ''}" data-do="revp" data-v="${d}">${l}</button>`).join('')}</div>
    <div class="bkpis"><div><b>${totA}</b><span>action${totA > 1 ? 's' : ''} terminée${totA > 1 ? 's' : ''}</span></div><div><b>${totR}</b><span>routine${totR > 1 ? 's' : ''} faite${totR > 1 ? 's' : ''}</span></div><div><b>${totM ? hm(totM) : '—'}</b><span>temps estimé investi</span></div></div>
    ${rows.length ? rows.map(r => `<div class="brow"><div class="bl"><span class="dot" style="--c:${r.color}"></span>${esc(r.name)}</div>
      <div class="bbar"><i style="width:${Math.round(100 * val(r) / max)}%;background:${r.color}"></i></div>
      <div class="bv"><b>${byMin ? hm(r.min) : r.acts + r.runs}</b><small>${r.acts} action${r.acts > 1 ? 's' : ''} · ${r.runs} routine${r.runs > 1 ? 's' : ''}</small></div>
      <div class="bleft" title="Encore à faire">${r.left ? `reste ${r.left}${r.leftMin ? ' · ' + hm(r.leftMin) : ''}` : ''}</div></div>`).join('')
      : '<div class="muted" style="padding:10px 0">Rien de terminé sur cette période.</div>'}
    <p class="hint">Le temps vient de l'effort estimé sur tes actions et routines. « reste » = ce qui attend encore dans le domaine.</p>`;
}
function revRoutineRow(r) {
  const s = rStats(r), lab = { late: 'en retard', soon: 'bientôt', ok: 'ok', done: 'objectif atteint', dormant: r.paused ? 'en pause' : 'hors saison', snoozed: 'passée' }[s.state];
  return `<div class="rrow" data-do="open" data-k="routines" data-id="${r.id}">${domDot(r.domainId)}<span class="t">${esc(r.title)}</span>${serBadge(r, s.dones)}
    <span class="gap ${s.state}" style="flex-direction:row;align-items:baseline;gap:6px"><b style="font-size:14px">${s.since} j</b><small>${lab}</small></span></div>`;
}
function stepSection(n, title, why, body) {
  return `<section class="sec"><h2><span class="step">${n}</span>${title}<span class="why">${why}</span></h2>${body}</section>`;
}
function viewReview() {
  const b = todayBuckets(false), waiting = db.actions.filter(a => a.status === 'waiting').sort((x, y) => (x.followup || 'z').localeCompare(y.followup || 'z'));
  const stuck = b.stuck, last = db.meta.lastReview;
  const left = stepSection(1, 'Bilan', 'où est passée ton énergie', `<div class="card" style="padding:16px 18px">${balanceHtml()}</div>`) +
    stepSection(2, 'Trier la boîte', 'chaque idée doit avoir une criticité et une date', b.inbox.length ? `<div class="card">${b.inbox.map(triageRow).join('')}</div>` : '<div class="card allgood">Boîte vide ✓</div>') +
    stepSection(3, 'Ce qui traîne', 'reportées 3 fois ou plus : faire, découper ou abandonner', stuck.length ? `<div class="card">${stuck.map(todoRow).join('')}</div>` : '<div class="card allgood">Rien ne traîne ✓</div>');
  const right = stepSection(4, 'En attente', 'à relancer ou à laisser mûrir', waiting.length ? `<div class="card">${waiting.map(todoRow).join('')}</div>` : '<div class="card allgood">Rien en attente ✓</div>') +
    stepSection(5, 'Routines', 'où en es-tu ?', `<div class="card rlist">${db.routines.length ? db.routines.map(revRoutineRow).join('') : '<div class="allgood">Aucune routine</div>'}</div>`) +
    agendaHtml().replace('<section class="sec"><h2>', '<section class="sec"><h2><span class="step">6</span>');
  return `<div class="body"><div class="scroll today">
    <div class="capture" style="justify-content:space-between;padding:12px 18px">
      <span>${last ? `Dernière revue : <b>${fmtShort(last)}</b> (${rel(last)})` : 'Tu n\'as pas encore fait de revue.'}</span>
      <button class="btn primary" data-do="finishReview">${ic('check', 16)}Terminer la revue</button></div>
    <div class="tgrid"><div class="tcol">${left}</div><div class="tcol right">${right}</div></div></div></div>`;
}
