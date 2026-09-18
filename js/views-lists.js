'use strict';
/* ---------- tri / filtre ---------- */
function sortRows(rows, kind, valFn) {
  const { key, dir } = ui.sort[kind];
  return rows.map(r => ({ r, v: valFn(r, key) })).sort((a, b) => {
    const an = a.v == null || a.v === '', bn = b.v == null || b.v === '';
    if (an !== bn) return an ? 1 : -1;
    const c = typeof a.v === 'string' ? a.v.localeCompare(b.v, 'fr') : a.v - b.v;
    return c * dir;
  }).map(x => x.r);
}
const matchQ = (q, ...txt) => !q || txt.join(' ').toLowerCase().includes(q.toLowerCase());
const hdHtml = (kind, cls, cols) => `<div class="hd ${cls}">${cols.map(([k, l]) =>
  k ? `<span data-sort="${k}" data-k="${kind}" class="${ui.sort[kind].key === k ? 'sorted' : ''}">${l}${ui.sort[kind].key === k ? (ui.sort[kind].dir < 0 ? ' ↓' : ' ↑') : ''}</span>` : `<span>${l}</span>`).join('')}</div>`;
const emptyRows = (t, s) => `<div class="empty"><b>${t}</b>${s}</div>`;

/* « J'ai X minutes » : filtre commun à l'accueil et aux actions */
const MINS = [[15, '15 min'], [30, '30 min'], [60, '1 h'], [240, '½ jour']];
const minsHtml = () => `<span class="mins" title="Ne montre que ce qui tient dans le temps dont tu disposes (effort estimé)">${ic('clock', 14)}<span>J'ai</span>${MINS.map(([m, l]) =>
  `<button class="${ui.minutes === m ? 'on' : ''}" data-do="mins" data-v="${m}">${l}</button>`).join('')}${ui.minutes ? '<button data-do="mins" data-v="" class="x">tout voir</button>' : ''}</span>`;

/* ---------- ACTIONS ---------- */
function actionRows() {
  const f = ui.f.actions;
  let rows = db.actions.filter(a =>
    (f.status === 'active' ? isActive(a) : f.status === 'waiting' ? a.status === 'waiting' : f.status === 'done' ? (a.status === 'done' || a.status === 'dropped') : true) &&
    (!f.domain || a.domainId === f.domain) && (!ui.minutes || (a.effort && a.effort <= ui.minutes)) && matchQ(f.q, a.title, a.notes));
  rows = sortRows(rows, 'actions', (a, k) => ({
    priority: score(a), crit: a.crit, title: a.title.toLowerCase(), status: Object.keys(STATUS).indexOf(a.status),
    deadline: a.deadline, followup: a.followup, effort: a.effort, postponed: a.postponed,
  }[k]));
  const head = hdHtml('actions', 'g-actions', [['', ''], ['priority', 'Criticité'], ['title', 'Action'], ['status', 'Statut'], ['deadline', 'Deadline'], ['followup', 'Followup'], ['effort', 'Effort'], ['postponed', '↻']]);
  if (!rows.length) return head + emptyRows('Rien ici', 'Aucune action ne correspond à ces filtres.');
  return head + rows.map(a => `<div class="row g-actions ${ui.sel.actions === a.id ? 'sel' : ''} ${isActive(a) ? '' : 'faded'}" data-row data-k="actions" data-id="${a.id}">
    <button class="check" data-do="complete" data-id="${a.id}" title="Terminer" style="${isActive(a) ? '' : 'visibility:hidden'}">${ic('check', 13)}</button>
    ${critPill(a.crit)}
    <div class="ttl">${domDot(a.domainId)}<span class="t">${esc(a.title)}</span>${a.inbox ? '<span class="tag">à trier</span>' : ''}${(a.links || []).length ? `<span class="muted" title="${a.links.length} lien(s) Drive">${ic('link', 13)}</span>` : ''}</div>
    ${statusChip(a.status)}${dateCell(a.deadline, 'deadline')}${dateCell(a.followup, 'followup')}
    <span class="muted">${a.effort ? effortLabel(a.effort) : '—'}</span>${ppBadge(a) || '<span></span>'}</div>`).join('');
}
function viewActions() {
  const f = ui.f.actions;
  const seg = [['active', 'Actives'], ['waiting', 'En attente'], ['done', 'Terminées'], ['all', 'Toutes']];
  const tb = `<div class="toolbar"><div class="seg">${seg.map(([k, l]) => `<button class="${f.status === k ? 'on' : ''}" data-do="fstatus" data-v="${k}">${l}</button>`).join('')}</div>
    ${db.domains.map(d => `<button class="chip ${f.domain === d.id ? 'on' : ''}" data-do="fdomain" data-k="actions" data-v="${d.id}">${domDot(d.id)}${esc(d.name)}</button>`).join('')}
    ${minsHtml()}
    <label class="search">${ic('search', 15)}<input data-search="actions" placeholder="Rechercher…" value="${esc(f.q)}"></label></div>`;
  return page(tb, 'actions', actionDetail);
}
function actionDetail(a) {
  const tab = ui.tab.actions, acts = db.activities.filter(x => x.actionId === a.id).sort((x, y) => y.date.localeCompare(x.date));
  const F = f => `data-k="actions" data-id="${a.id}" data-f="${f}"`;
  return `<div class="dhead"><input class="tin" ${F('title')} value="${esc(a.title)}" placeholder="Titre de l'action">
      <button class="btn sm" data-do="pmenu" data-id="${a.id}">${ic('skip', 14)}Reporter</button>
      <button class="btn sm" data-do="wmenu" data-id="${a.id}">${ic('pause', 14)}En attente</button>
      <button class="iconbtn" data-do="del" data-k="actions" data-id="${a.id}" title="Supprimer">${ic('trash', 16)}</button>
      <button class="iconbtn" data-do="closeDetail" title="Fermer (Échap)">${ic('x', 16)}</button></div>
    <div class="fields">
      <div class="fld"><label>Domaine</label><select ${F('domainId')} data-null><option value="">— Sans domaine</option>${db.domains.map(d => `<option value="${d.id}" ${a.domainId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
      <div class="fld"><label>Statut</label><select ${F('status')}>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld wide"><label>Criticité</label><div class="cpick">${CRITS.map(c => `<button class="c${c} ${a.crit === c ? 'on' : ''}" data-do="setcrit" data-id="${a.id}" data-v="${c}" title="${CRIT_LABEL[c]}">${c}%</button>`).join('')}</div></div>
      <div class="fld"><label>Deadline</label><input type="date" ${F('deadline')} data-null value="${a.deadline || ''}"></div>
      <div class="fld"><label>Followup</label><input type="date" ${F('followup')} data-null value="${a.followup || ''}"></div>
      <div class="fld"><label>Effort estimé</label><select ${F('effort')} data-num data-null><option value="">—</option>${EFFORTS.map(([m, l]) => `<option value="${m}" ${a.effort === m ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label>Créée le · reportée</label><div class="muted" style="padding:7px 0">${fmtShort(a.createdAt)} · ${a.postponed || 0}×</div></div>
      ${a.routineId && byId(db.routines, a.routineId) ? `<div class="fld"><label>Routine liée</label><button class="btn sm" data-do="open" data-k="routines" data-id="${a.routineId}">${ic('repeat', 14)}${esc(byId(db.routines, a.routineId).title)}</button></div>` : ''}
    </div>
    <div class="tabs"><button class="${tab === 'notes' ? 'on' : ''}" data-do="tab" data-k="actions" data-v="notes">Notes</button>
      <button class="${tab === 'acts' ? 'on' : ''}" data-do="tab" data-k="actions" data-v="acts">Activités (${acts.length})</button>
      <button class="${tab === 'links' ? 'on' : ''}" data-do="tab" data-k="actions" data-v="links">Liens Drive (${(a.links || []).length})</button><span class="sp"></span></div>
    <div class="tabbody">${tab === 'notes'
      ? `<textarea class="notes" ${F('notes')} placeholder="Dernières actions intéressantes… ex : 18/09 : J'ai acheté le matériel pour commencer les travaux !">${esc(a.notes)}</textarea>
         <div class="hint"><kbd>Ctrl</kbd>+<kbd>D</kbd> insère la date du jour au début de la ligne.</div>`
      : tab === 'links' ? linksHtml(a) : `<div class="alist">${actList(acts)}</div><p><button class="btn sm" data-do="newAct" data-k="actions" data-id="${a.id}">${ic('plus', 14)}Ajouter une activité</button></p>`}</div>`;
}
/* Liens vers des fichiers déjà rangés dans un Drive : rien n'est stocké dans Cap */
const DRIVES = [[/drive\.google|docs\.google|sheets\.google|slides\.google/, 'Google Drive'], [/onedrive|1drv\.ms|sharepoint\.com/, 'OneDrive'],
  [/dropbox\.com|db\.tt/, 'Dropbox'], [/icloud\.com/, 'iCloud'], [/notion\.(so|site)/, 'Notion']];
const driveOf = url => (DRIVES.find(([re]) => re.test(url)) || [null, 'Lien'])[1];
function linksHtml(a) {
  const ls = a.links || [];
  return `<div class="alist">${ls.length ? ls.map(l => `<div class="arow lrow"><span class="ty">${ic('link', 14)}${driveOf(l.url)}</span>
      <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" class="lk">${esc(l.label || l.url)}</a>
      <button class="iconbtn" data-do="delLink" data-id="${a.id}" data-l="${l.id}" title="Retirer le lien">${ic('trash', 14)}</button></div>`).join('')
    : '<div class="muted" style="padding:10px 0">Aucun lien. Devis, factures, photos : gardes-les dans ton Drive et colle ici le lien.</div>'}</div>
    <div class="linkadd"><input class="in" id="lk-url" placeholder="Colle le lien du fichier (Google Drive, OneDrive, Dropbox…)" autocomplete="off">
      <input class="in" id="lk-label" placeholder="Nom (facultatif)" autocomplete="off"><button class="btn sm" data-do="addLink" data-id="${a.id}">${ic('plus', 14)}Ajouter</button></div>`;
}
function actList(acts) {
  if (!acts.length) return '<div class="muted" style="padding:10px 0">Aucune activité pour l\'instant. Clic droit sur une action pour en ajouter.</div>';
  return acts.map(x => `<div class="arow" data-do="open" data-k="activities" data-id="${x.id}" style="cursor:pointer"><span class="muted">${fmtShort(x.date)}</span>
    <span class="ty">${ic(TYPES[x.type].icon, 14)}${TYPES[x.type].label}</span><span>${esc(x.text) || '<span class="muted">—</span>'}</span>
    <button class="iconbtn" data-do="del" data-k="activities" data-id="${x.id}" title="Supprimer">${ic('trash', 14)}</button></div>`).join('');
}

/* ---------- ROUTINES ---------- */
function serBadge(r, dones) {
  const s = rSeries(r, dones), tx = seriesText(s);
  return tx ? `<span class="ser ${s.kind === 'ok' ? 'sun' : 'moon'}" title="${tx}">${ic(s.kind === 'ok' ? 'sun' : 'moon', 13)}${s.count}</span>` : '';
}
function linkedHtml(r, linked) {
  return `<div class="alist">${linked.length ? linked.map(a => `<div class="arow" data-do="open" data-k="actions" data-id="${a.id}" style="cursor:pointer;grid-template-columns:22px 1fr 110px 90px">
    ${domDot(a.domainId)}<span>${esc(a.title)}</span>${statusChip(a.status)}${critPill(a.crit)}</div>`).join('') : '<div class="muted" style="padding:10px 0">Aucune action liée. Utile quand la routine révèle un vrai sujet (« le moteur grince »).</div>'}</div>
    <p><button class="btn sm" data-do="newLinked" data-id="${r.id}">${ic('plus', 14)}Nouvelle action liée</button></p>`;
}
function stripHtml(r, dones, big) {
  const col = dom(r.domainId)?.color || '#999';
  return `<div class="strip ${big ? 'big' : ''}">${stripCells(r, dones).map(c => `<i class="${c.c ? 'f' : ''} ${c.cur ? 'cur' : ''}" style="--c:${col};--o:${c.o}" title="${c.weekly ? 'Semaine du ' + fmtDM(c.from) : MONTHS[D.parse(c.from).getMonth()] + ' ' + c.from.slice(0, 4)} : ${c.c} fois"></i>`).join('')}</div>`;
}
function routineRows() {
  const f = ui.f.routines;
  let rows = db.routines.filter(r => (!f.domain || r.domainId === f.domain) && matchQ(f.q, r.title, r.notes)).map(r => ({ r, s: rStats(r) }));
  rows = sortRows(rows, 'routines', (x, k) => ({
    urgency: x.s.dormant ? -1 : x.s.since / x.s.gap, title: x.r.title.toLowerCase(), last: x.s.last, since: x.s.since,
  }[k]));
  const head = hdHtml('routines', 'g-routines', [['title', 'Routine'], ['', 'Règle'], ['last', 'Dernier fait'], ['urgency', 'Jours sans action'], ['', 'Période'], ['', '12 dernières périodes'], ['', '']]);
  if (!rows.length) return head + emptyRows('Aucune routine', 'Crée ta première routine avec le bouton en haut à droite.');
  return head + rows.map(({ r, s }) => `<div class="row g-routines ${ui.sel.routines === r.id ? 'sel' : ''}" data-row data-k="routines" data-id="${r.id}">
    <div class="ttl">${domDot(r.domainId)}<span class="t">${esc(r.title)}</span>${serBadge(r, s.dones)}${s.dormant ? `<span class="dormant-tag">${r.paused ? 'en pause' : 'hors saison'}</span>` : s.state === 'snoozed' ? `<span class="dormant-tag">passée · revient ${rel(r.snoozeUntil)}</span>` : ''}</div>
    <span>${ruleText(r)}${seasonText(r) ? `<br><small class="muted">${seasonText(r)}</small>` : ''}</span>
    <span>${s.last ? `${fmtShort(s.last)}<br><small class="muted">${rel(s.last)}</small>` : '<span class="muted">jamais</span>'}</span>
    <div class="gap ${s.state}"><b>${s.since} j</b><small>max ${s.gap} j</small><div class="bar"><i style="--p:${Math.min(100, Math.round(100 * s.since / s.gap))}%"></i></div></div>
    <span>${s.pc !== null ? `${s.pc}/${s.target} <small class="muted">${r.per === 'semaine' ? 'sem.' : r.per === 'mois' ? 'mois' : 'an'}</small>` : '<span class="muted">—</span>'}</span>
    ${stripHtml(r, s.dones)}
    <div class="ract"><button class="iconbtn" data-do="rskip" data-id="${r.id}" title="Passer cette fois">${ic('skip', 15)}</button><button class="btn sm" data-do="rdone" data-id="${r.id}">${ic('check', 14)}Fait</button></div></div>`).join('');
}
function viewRoutines() {
  const f = ui.f.routines;
  const tb = `<div class="toolbar">${db.domains.map(d => `<button class="chip ${f.domain === d.id ? 'on' : ''}" data-do="fdomain" data-k="routines" data-v="${d.id}">${domDot(d.id)}${esc(d.name)}</button>`).join('')}
    <label class="search">${ic('search', 15)}<input data-search="routines" placeholder="Rechercher…" value="${esc(f.q)}"></label></div>`;
  return page(tb, 'routines', routineDetail);
}
function liveHtml(r) {
  const s = rStats(r);
  return `<div class="tiles" id="live">
    <div class="tile"><small>Dernier fait</small><b>${s.last ? rel(s.last) : 'jamais'}</b></div>
    <div class="tile ${s.state === 'late' ? 'late' : s.state === 'soon' ? 'soon' : ''}"><small>Jours sans action</small><b>${s.since} j <span class="muted" style="font:400 13px var(--sans)">/ max ${s.gap}</span></b></div>
    <div class="tile ${s.state === 'late' ? 'late' : ''}"><small>Prochaine échéance</small><b>${s.dormant ? '—' : rel(s.due, true)}</b></div>
    <div class="tile ${s.state === 'done' ? 'done' : ''}"><small>${r.mode === 'freq' ? 'Cette période' : 'Total réalisé'}</small><b>${r.mode === 'freq' ? `${s.pc} / ${s.target}` : s.dones.length}</b></div>
    ${(() => { const se = rSeries(r, s.dones), tx = seriesText(se);
      return `<div class="tile ser-tile ${tx ? (se.kind === 'ok' ? 'sun' : 'moon') : ''}" title="${tx}"><small>Série</small><b>${tx ? `${ic(se.kind === 'ok' ? 'sun' : 'moon', 20)} ${se.count} <span class="muted" style="font:400 13px var(--sans)">${GRAN_LABEL[se.gran][se.count > 1 ? 1 : 0]}</span>` : '<span class="muted">—</span>'}</b></div>`; })()}</div>`;
}
function routineDetail(r) {
  const tab = ui.tab.routines, s = rStats(r), F = f => `data-k="routines" data-id="${r.id}" data-f="${f}"`;
  const linked = db.actions.filter(a => a.routineId === r.id);
  const rule = r.mode === 'freq'
    ? `<input class="in" type="number" min="1" ${F('n')} value="${r.n}"> fois par <select ${F('per')}>${[['semaine', 'semaine'], ['mois', 'mois'], ['an', 'an']].map(([v, l]) => `<option value="${v}" ${r.per === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`
    : `tous les <input class="in" type="number" min="1" ${F('n')} value="${r.n}"><select ${F('unit')}>${[['jour', 'jours'], ['semaine', 'semaines'], ['mois', 'mois'], ['an', 'ans']].map(([v, l]) => `<option value="${v}" ${r.unit === v ? 'selected' : ''}>${l}</option>`).join('')}</select> après le dernier fait`;
  return `<div class="dhead"><input class="tin" ${F('title')} value="${esc(r.title)}">
      <button class="btn sm" data-do="rskip" data-id="${r.id}" title="Elle disparaît quelques jours, sans casser ta série">${ic('skip', 14)}Passer cette fois</button>
      <button class="btn sm" data-do="newLinked" data-id="${r.id}">${ic('link', 14)}Action liée</button>
      <button class="btn sm" data-do="rdone" data-id="${r.id}">${ic('check', 14)}Fait aujourd'hui</button>
      <button class="iconbtn" data-do="del" data-k="routines" data-id="${r.id}" title="Supprimer">${ic('trash', 16)}</button>
      <button class="iconbtn" data-do="closeDetail" title="Fermer (Échap)">${ic('x', 16)}</button></div>
    ${liveHtml(r)}
    <div class="fields">
      <div class="fld"><label>Domaine</label><select ${F('domainId')} data-null><option value="">— Sans domaine</option>${db.domains.map(d => `<option value="${d.id}" ${r.domainId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
      <div class="fld"><label>Type de règle</label><select ${F('mode')}><option value="freq" ${r.mode === 'freq' ? 'selected' : ''}>Fréquence</option><option value="interval" ${r.mode === 'interval' ? 'selected' : ''}>Intervalle</option></select></div>
      <div class="fld wide"><label>Règle</label><div class="rule">${rule}</div></div>
      <div class="fld"><label>Effort estimé</label><select ${F('effort')} data-num data-null><option value="">—</option>${EFFORTS.map(([m, l]) => `<option value="${m}" ${r.effort === m ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld wide"><label>Saison (mois actifs)</label><div class="months">${MONTHS.map((m, i) => `<button class="${r.months.includes(i + 1) ? 'on' : ''}" data-do="month" data-id="${r.id}" data-v="${i + 1}">${m}</button>`).join('')}</div></div>
      <div class="fld"><label>État</label><button class="btn sm" data-do="pauseR" data-id="${r.id}">${r.paused ? 'Reprendre la routine' : 'Mettre en pause'}</button></div>
    </div>
    <div class="tabs"><button class="${tab === 'notes' ? 'on' : ''}" data-do="tab" data-k="routines" data-v="notes">Notes</button>
      <button class="${tab === 'hist' ? 'on' : ''}" data-do="tab" data-k="routines" data-v="hist">Historique (${s.dones.length})</button>
      <button class="${tab === 'linked' ? 'on' : ''}" data-do="tab" data-k="routines" data-v="linked">Actions liées (${linked.length})</button><span class="sp"></span></div>
    <div class="tabbody">${tab === 'notes'
      ? `<textarea class="notes" ${F('notes')} placeholder="Astuces, où est le matériel, ce qu'il ne faut pas oublier…">${esc(r.notes)}</textarea><div class="hint"><kbd>Ctrl</kbd>+<kbd>D</kbd> insère la date du jour.</div>`
      : tab === 'linked' ? linkedHtml(r, linked) : `${stripHtml(r, s.dones, true)}<div class="alist" style="margin-top:14px">${actList(db.activities.filter(x => x.routineId === r.id).sort((x, y) => y.date.localeCompare(x.date)))}</div>
         <p><button class="btn sm" data-do="newAct" data-k="routines" data-id="${r.id}">${ic('plus', 14)}Fait un autre jour / note…</button></p>`}</div>`;
}

/* ---------- ACTIVITÉS ---------- */
const linkOf = x => x.actionId ? { k: 'actions', o: byId(db.actions, x.actionId) } : x.routineId ? { k: 'routines', o: byId(db.routines, x.routineId) } : { k: null, o: null };
function activityRows() {
  const f = ui.f.activities;
  let rows = db.activities.filter(x => (!f.type || x.type === f.type) && matchQ(f.q, x.text, linkOf(x).o?.title || ''));
  rows = sortRows(rows, 'activities', (x, k) => ({ date: x.date, type: x.type, text: x.text.toLowerCase(), link: (linkOf(x).o?.title || '').toLowerCase() }[k]));
  const head = hdHtml('activities', 'g-acts', [['date', 'Date'], ['type', 'Type'], ['text', 'Détail'], ['link', 'Lié à']]);
  if (!rows.length) return head + emptyRows('Aucune activité', 'Les appels, visites, mails et « fait » apparaîtront ici.');
  return head + rows.map(x => { const l = linkOf(x);
    return `<div class="row g-acts ${ui.sel.activities === x.id ? 'sel' : ''}" data-row data-k="activities" data-id="${x.id}">
    <span>${fmtShort(x.date)}<br><small class="muted">${rel(x.date)}</small></span><span class="ty">${ic(TYPES[x.type].icon, 14)}${TYPES[x.type].label}</span>
    <span class="ttl"><span class="t">${esc(x.text) || '<span class="muted">—</span>'}</span></span>
    <span class="ttl">${l.o ? `${domDot(l.o.domainId)}<span class="t">${esc(l.o.title)}</span><small>${l.k === 'routines' ? '↻' : ''}</small>` : '<span class="muted">—</span>'}</span></div>`; }).join('');
}
function viewActivities() {
  const f = ui.f.activities;
  const tb = `<div class="toolbar"><button class="chip ${!f.type ? 'on' : ''}" data-do="ftype" data-v="">Toutes</button>
    ${Object.entries(TYPES).map(([k, t]) => `<button class="chip ${f.type === k ? 'on' : ''}" data-do="ftype" data-v="${k}">${ic(t.icon, 13)}${t.label}</button>`).join('')}
    <label class="search">${ic('search', 15)}<input data-search="activities" placeholder="Rechercher…" value="${esc(f.q)}"></label></div>`;
  return page(tb, 'activities', activityDetail);
}
function activityDetail(x) {
  const F = f => `data-k="activities" data-id="${x.id}" data-f="${f}"`;
  const val = x.actionId ? 'a:' + x.actionId : x.routineId ? 'r:' + x.routineId : '';
  return `<div class="dhead"><h2 style="font:600 21px var(--serif);margin:0;flex:1">${ic(TYPES[x.type].icon, 20)} ${TYPES[x.type].label} · ${fmtShort(x.date)}</h2>
      <button class="iconbtn" data-do="del" data-k="activities" data-id="${x.id}" title="Supprimer">${ic('trash', 16)}</button>
      <button class="iconbtn" data-do="closeDetail">${ic('x', 16)}</button></div>
    <div class="fields">
      <div class="fld"><label>Type</label><select ${F('type')}>${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
      <div class="fld"><label>Date</label><input type="date" ${F('date')} value="${x.date}"></div>
      <div class="fld wide"><label>Lié à</label><select ${F('link')}><option value="">— Aucun</option>
        <optgroup label="Actions">${db.actions.map(a => `<option value="a:${a.id}" ${val === 'a:' + a.id ? 'selected' : ''}>${esc(a.title)}</option>`).join('')}</optgroup>
        <optgroup label="Routines">${db.routines.map(r => `<option value="r:${r.id}" ${val === 'r:' + r.id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</optgroup></select></div>
    </div>
    <div class="tabbody"><textarea class="notes" ${F('text')} placeholder="Ce qui s'est dit / fait…">${esc(x.text)}</textarea>
      ${linkOf(x).o ? `<p><button class="btn sm" data-do="open" data-k="${linkOf(x).k}" data-id="${linkOf(x).o.id}">Ouvrir « ${esc(linkOf(x).o.title)} »</button></p>` : ''}</div>`;
}

/* ---------- coquille liste + détail ---------- */
const ROWS = { actions: actionRows, routines: routineRows, activities: activityRows };
function page(toolbar, kind, detailFn) {
  const sel = ui.sel[kind] && byId(coll(kind), ui.sel[kind]);
  if (!sel) ui.sel[kind] = null;
  return `<div class="body">${toolbar}<div class="split ${sel ? 'has' : ''}" style="--detail:${ui.split}%">
    <div class="listwrap"><div class="rows" id="rows">${ROWS[kind]()}</div></div>
    <div class="grip" data-grip></div><div class="detail" id="detail">${sel ? detailFn(sel) : ''}</div></div></div>`;
}
