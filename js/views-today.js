'use strict';
/* ---------- petits composants ---------- */
const domDot = id => { const d = dom(id); return `<span class="dot" style="--c:${d ? d.color : '#bbb'}" title="${esc(d ? d.name : 'Sans domaine')}"></span>`; };
const critPill = v => v == null ? '<span class="crit none">à définir</span>'
  : `<span class="crit c${v}" title="${CRIT_LABEL[v]}"><i></i><i></i><i></i><i></i><b>${v}%</b></span>`;
const statusChip = s => `<span class="st ${s}">${s === 'waiting' ? ic('pause', 13) : ''}${STATUS[s]}</span>`;
function dateCell(s, kind) {
  if (!s) return '<span class="muted">—</span>';
  const n = D.diff(s, D.today());
  let cls = '';
  if (kind === 'deadline') cls = n < 0 ? 'late' : n <= 3 ? 'soon' : '';
  else cls = n <= 0 ? 'due' : '';
  return `<span class="dt ${cls}">${fmtShort(s)}<em>${rel(s, kind === 'deadline')}</em></span>`;
}
const ppBadge = a => (a.postponed || 0) > 0 ? `<span class="pp ${a.postponed >= 3 ? 'hot' : ''}" title="Reportée ${a.postponed} fois">↻ ${a.postponed}</span>` : '';

/* ---------- sidebar ---------- */
function syncBadge() {
  const { state, name } = fileSync.st;
  const M = {
    ok: ['ok', `Sauvegarde auto · ${esc(name)}`, ''],
    none: ['warn', 'Activer la sauvegarde automatique', 'syncClick'],
    needs: ['warn', 'Reconnecter le fichier de sauvegarde', 'syncClick'],
    error: ['bad', 'Écriture impossible — réessayer', 'syncClick'],
    unsupported: ['warn', 'Sauvegarde dans le navigateur seulement (utilise Edge ou Chrome)', ''],
  }[state];
  return `<button class="sync ${M[0]}" ${M[2] ? `data-do="${M[2]}"` : 'disabled'} title="${state === 'ok' ? 'Chaque modification est recopiée dans ce fichier' : ''}"><i></i>${M[1]}</button>`;
}
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`; };
function dbxBadge() {
  if (!dbxSync.connected()) return '';
  const { state, last } = dbxSync.st;
  const M = {
    ok: ['ok', `Dropbox · synchronisé ${last ? ago(last) : ''}`, 'dbxNow'], syncing: ['ok', 'Dropbox · synchronisation…', ''],
    offline: ['warn', 'Hors ligne · synchro en attente', 'dbxNow'], needs: ['warn', 'Reconnecter Dropbox', 'nav-settings'], error: ['bad', 'Synchro Dropbox en échec · réessayer', 'dbxNow'],
    none: ['ok', 'Dropbox · en attente', ''],
  }[state] || ['ok', 'Dropbox', ''];
  return `<button class="sync ${M[0]}" ${M[2] === 'nav-settings' ? 'data-do="nav" data-view="settings"' : M[2] ? `data-do="${M[2]}"` : 'disabled'}><i></i>${M[1]}</button>`;
}
function sidebarHtml() {
  const b = todayBuckets(false), late = db.routines.filter(r => rStats(r).state === 'late').length;
  const todayN = b.inbox.length + b.late.length + b.due.length + late;
  const NCAP = [
    ['today', 'sun', 'Aujourd\'hui', todayN ? `<span class="n hot">${todayN}</span>` : ''],
    ['actions', 'list', 'Actions', `<span class="n">${db.actions.filter(isActive).length}</span>`],
    ['routines', 'repeat', 'Routines', late ? `<span class="n hot">${late}</span>` : `<span class="n">${db.routines.length}</span>`],
    ['activities', 'activity', 'Activités', `<span class="n">${db.activities.length}</span>`],
    ['calendar', 'calendar', 'Calendrier', ''],
    ['review', 'review', 'Revue', reviewDue() ? '<span class="n dotn" title="Ta revue de la semaine est due"></span>' : ''],
  ];
  const NTRK = [['tdash', 'target', 'Aperçu', ''], ['tjournal', 'journal', 'Journal', `<span class="n">${db.logs.length}</span>`], ['tstats', 'chart', 'Stats', ''], ['tevo', 'trend', 'Évolution', '']];
  const trk = ui.app === 'track', N = trk ? NTRK : NCAP;
  return `<aside class="side">
    <div class="brand"><button class="brandbtn" data-do="appSwitch" title="${trk ? 'Retour à Cap' : 'Ouvrir Suivis'}"><b>${trk ? 'Suivis' : APP_NAME}</b><span>${trk ? 'ce que je fais, vraiment' : 'ma vie, en clair'}</span>${ic('swap', 14)}</button><button class="iconbtn theme" data-do="themeToggle" title="Thème clair / sombre">${ic(isDark() ? 'sun' : 'moon', 16)}</button></div>
    ${N.map(([v, i, l, n]) => `<button class="nav ${ui.view === v ? 'on' : ''} ${v === 'activities' || v === 'review' ? 'm-hide' : ''}" data-do="nav" data-view="${v}">${ic(i, 18)}<span class="nl">${l}</span>${n}</button>`).join('')}
    <div class="grow"></div>
    ${ui.view === 'today' ? '<div class="keys"><b>Clavier</b><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>1</kbd>–<kbd>4</kbd> criticité</span><span><kbd>D</kbd> demain · <kbd>S</kbd> +1 sem.</span><span><kbd>M</kbd> +1 mois · <kbd>F</kbd> fait</span><span><kbd>P</kbd> passer une routine</span></div>' : ''}
    <button class="nav m-hide" data-do="hideShared" data-v="${hideShared() ? 0 : 1}" title="Masquer / afficher les actions et routines communes">${ic('users', 18)}<span class="nl">Commun : ${hideShared() ? 'masqué' : 'visible'}</span></button>
    <button class="nav m-hide" data-do="hubHome" title="Retour à l'accueil des applications">${ic('grid', 18)}<span class="nl">Applications</span></button>
    ${dbxBadge()}${dbxSync.connected() && fileSync.st.state !== 'ok' ? '' : syncBadge()}
    <button class="nav only-m ${['activities', 'review', 'settings'].includes(ui.view) ? 'on' : ''}" data-do="moreMenu">${ic('more', 18)}<span class="nl">Plus</span></button>
    <button class="nav m-hide ${ui.view === 'settings' ? 'on' : ''}" data-do="nav" data-view="settings">${ic('gear', 18)}<span class="nl">Réglages</span></button>
  </aside>`;
}

/* ---------- Aujourd'hui ---------- */
function todoRow(a) {
  const meta = [`${domDot(a.domainId)} ${esc(dom(a.domainId)?.name || 'Sans domaine')}`];
  if (a.shared) meta.push(sharedTag(a));
  if (a.deadline) meta.push(`Deadline ${dateCell(a.deadline, 'deadline')}`);
  if (a.followup && (a.followup <= D.today() || a.status === 'waiting')) meta.push(`${a.status === 'waiting' ? 'Relance' : 'Followup'} ${dateCell(a.followup, 'followup')}`);
  if (a.status === 'waiting') meta.push(statusChip('waiting'));
  if (a.effort) meta.push(`${ic('clock', 12)} ${effortLabel(a.effort)}`);
  if (a.postponed) meta.push(ppBadge(a));
  return `<div class="trow" data-row data-k="actions" data-id="${a.id}">
    <button class="check" data-do="complete" data-id="${a.id}" title="Terminer">${ic('check', 13)}</button>
    <div><div class="tt" data-do="open" data-k="actions" data-id="${a.id}">${esc(a.title)}</div><div class="tmeta">${meta.join('<span>·</span>')}</div></div>
    ${critPill(a.crit)}
    <div class="tact"><button class="iconbtn" data-do="pmenu" data-id="${a.id}" title="Reporter">${ic('skip', 16)}</button>
      <button class="iconbtn" data-do="wmenu" data-id="${a.id}" title="Mettre en attente">${ic('pause', 16)}</button>
      <button class="iconbtn" data-do="drop" data-id="${a.id}" title="Abandonner">${ic('x', 16)}</button></div>
  </div>`;
}
function triageRow(a) {
  const fu = [['Aujourd\'hui', D.today()], ['Demain', D.add(D.today(), 1)], ['+1 sem.', D.add(D.today(), 7)], ['+1 mois', D.addMonths(D.today(), 1)], ['Sans date', null]];
  return `<div class="tri" data-row data-k="actions" data-id="${a.id}">
    <div class="tt">${esc(a.title)}</div>
    <div class="trctl">
      <span class="mini"><span class="lbl">Domaine</span>${db.domains.map(d => `<button class="dbtn ${a.domainId === d.id ? 'on' : ''}" style="--c:${d.color}" title="${esc(d.name)}" data-do="tri" data-id="${a.id}" data-p='{"domainId":"${d.id}"}'></button>`).join('')}</span>
      <span class="mini"><span class="lbl">Criticité</span>${CRITS.map(c => `<button class="c${c} ${a.crit === c ? 'on' : ''}" title="${CRIT_LABEL[c]}" data-do="tri" data-id="${a.id}" data-p='{"crit":${c}}'>${c}%</button>`).join('')}</span>
      <span class="mini"><span class="lbl">Followup</span>${fu.map(([l, d]) => `<button class="${a.triFu && a.followup === d ? 'on' : ''}" data-do="tri" data-id="${a.id}" data-p='{"followup":${d ? `"${d}"` : 'null'},"triFu":true}'>${l}</button>`).join('')}</span>
    </div></div>`;
}
function routineTodayRow({ r, s }) {
  const cls = s.state === 'late' ? 'late' : 'soon';
  return `<div class="trow" data-row data-k="routines" data-id="${r.id}">
    <button class="check" data-do="rdone" data-id="${r.id}" title="Fait aujourd'hui">${ic('check', 13)}</button>
    <div><div class="tt" data-do="open" data-k="routines" data-id="${r.id}">${esc(r.title)} ${sharedTag(r)} ${serBadge(r, s.dones)}</div>
      <div class="tmeta">${domDot(r.domainId)} ${esc(dom(r.domainId)?.name || '')}<span>·</span>${ruleText(r)}<span>·</span>dernier : ${s.last ? rel(s.last) : 'jamais'}</div></div>
    <div class="gap ${cls}"><b>${s.since} j</b><small>sans action / max ${s.gap}</small></div>
    <div class="tact"><button class="iconbtn" data-do="rskip" data-id="${r.id}" title="Passer cette fois">${ic('skip', 16)}</button></div>
  </div>`;
}
function section(title, why, items, render, tone) {
  if (!items.length) return '';
  return `<section class="sec"><h2>${title}<span class="cnt">${items.length}</span><span class="why">${why}</span></h2><div class="card">${items.map(render).join('')}</div></section>`;
}
function greeting() { const h = new Date().getHours(); return (h < 6 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir') + ', ' + hub.name(); }

/* 7 prochains jours : deadlines et followups à venir */
function agendaHtml() {
  const t = D.today(), act = db.actions.filter(a => isActive(a) && !a.inbox);
  const days = [];
  for (let i = 1; i <= 7; i++) {
    const d = D.add(t, i);
    const items = act.filter(a => a.deadline === d || a.followup === d).map(a => ({ a, dl: a.deadline === d }));
    days.push({ d, items });
  }
  const dt = D.parse;
  return `<section class="sec"><h2>7 prochains jours<span class="why">deadlines et followups</span></h2><div class="card agenda">${days.map(({ d, items }) => `
    <div class="ag ${items.length ? '' : 'idle'}"><div class="agd"><span>${dt(d).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span><b>${dt(d).getDate()}</b></div>
      <div class="agi">${items.length ? items.map(({ a, dl }) => `<div class="agit" data-do="open" data-k="actions" data-id="${a.id}">${domDot(a.domainId)}<span class="t">${esc(a.title)}</span><em class="${dl ? 'dl' : ''}">${dl ? 'deadline' : 'followup'}</em></div>`).join('') : '<span class="muted">—</span>'}</div></div>`).join('')}
  </div></section>`;
}

function viewToday() {
  const b = todayBuckets(), lateR = b.routines.filter(x => x.s.state === 'late').length;
  const left = section('À trier', 'criticité + date de suivi, et ça disparaît', b.inbox, triageRow) +
    section('En retard', 'deadline dépassée', b.late, todoRow) +
    section('Pour aujourd\'hui', 'followup arrivé ou deadline ce jour', b.due, todoRow);
  const right = section('Routines à faire', 'règle non respectée, ou presque', b.routines, routineTodayRow) +
    agendaHtml() + section('Ça traîne', 'reportées 3 fois ou plus : les faire, les découper ou les abandonner', b.stuck, todoRow);
  return `<div class="scroll today">
    ${db.meta.sample ? `<div class="banner">${ic('note', 16)}Données d'exemple pour tester l'interface.<button data-do="clearSample">Repartir de zéro</button></div>` : ''}
    <div class="capture">${ic('plus', 18)}<input id="cap" placeholder="${matchMedia('(max-width:760px)').matches ? 'Une idée à capturer…' : 'Une idée, un truc à ne pas oublier… (Entrée pour capturer)'}" autocomplete="off"></div>
    <div class="kpis">
      <div class="kpi ${b.inbox.length ? 'warn' : ''}"><b>${b.inbox.length}</b><span>à trier</span></div>
      <div class="kpi ${b.late.length ? 'late' : ''}"><b>${b.late.length}</b><span>actions en retard</span></div>
      <div class="kpi ${lateR ? 'late' : ''}"><b>${lateR}</b><span>routines en retard</span></div>
      <div class="kpi ok"><b>${doneThisWeek()}</b><span>faits sur 7 jours</span></div>
    </div>
    ${reviewDue() ? `<div class="banner review">${ic('review', 16)}C'est le moment de ta revue de la semaine (2 minutes).<button data-do="nav" data-view="review">Lancer la revue</button></div>` : ''}
    ${trackStripHtml()}
    <div class="minsrow">${minsHtml()}${ui.minutes ? '<span class="muted">Filtre actif : seules les actions avec un effort estimé sont affichées.</span>' : ''}</div>
    <div class="tgrid"><div class="tcol">${left || `<div class="empty card"><b>Rien d'urgent ☀</b>Tout est à jour, profites-en.</div>`}</div><div class="tcol right">${right}</div></div>
  </div>`;
}
