'use strict';
/* ---------- réglages ---------- */
function dbxSettingsHtml() {
  const s = dbxSync, st = s.st;
  const head = `<h2>Synchronisation Dropbox<span class="why">PC, téléphone : mêmes données partout</span></h2>`;
  if (!s.canOAuth) return `<section class="sec">${head}<div class="card" style="padding:16px"><p class="hint" style="margin:0">La synchronisation fonctionne quand Cap est ouvert depuis son adresse en ligne (GitHub Pages), pas depuis le fichier <b>index.html</b> de ton PC. Tout est expliqué dans <b>GUIDE-SYNCHRO.md</b>.</p></div></section>`;
  if (s.connected()) {
    const label = { ok: `Synchronisé ${st.last ? ago(st.last) : ''}`, syncing: 'Synchronisation en cours…', offline: 'Hors ligne : la synchro reprendra dès le retour du réseau.',
      needs: 'La connexion a expiré : reconnecte-toi ci-dessous.', error: `Erreur : ${esc(st.err || 'inconnue')}`, none: 'En attente' }[st.state];
    return `<section class="sec">${head}<div class="card" style="padding:16px"><p style="margin:0 0 12px"><b>${label}</b></p>
      <p class="hint" style="margin:0 0 12px">Fichier : <code>Applications/Cap/cap-donnees.json</code> dans ton Dropbox. La synchro se fait à l'ouverture, après chaque modification et au retour dans l'appli.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-do="dbxNow">Synchroniser maintenant</button>
      ${st.state === 'needs' ? '<button class="btn primary" data-do="dbxConnect">Reconnecter Dropbox</button>' : ''}
      <button class="btn danger" data-do="dbxOut">Se déconnecter</button></div></div></section>`;
  }
  return `<section class="sec">${head}<div class="card" style="padding:16px">
    <p class="hint" style="margin:0 0 12px">Colle la <b>clé d'app</b> de ton application Dropbox, puis connecte-toi. Étapes détaillées dans <b>GUIDE-SYNCHRO.md</b>.</p>
    <div class="linkadd" style="margin:0 0 12px"><input class="in" id="dbx-key" placeholder="Clé d'app Dropbox" value="${esc(s.key())}" autocomplete="off" style="flex:1 1 240px"><button class="btn primary" data-do="dbxConnect">Se connecter à Dropbox</button></div>
    <p class="hint" style="margin:0">Adresse de redirection à déclarer dans l'app Dropbox : <code style="user-select:all">${esc(s.redirectUri())}</code></p></div></section>`;
}
function viewSettings() {
  return `<div class="body"><div class="scroll" style="max-width:760px">
    <section class="sec"><h2>Domaines<span class="why">couleur + nom, utilisés partout</span></h2><div class="card">
      ${db.domains.map(d => {
        const n = db.actions.filter(a => a.domainId === d.id).length + db.routines.filter(r => r.domainId === d.id).length;
        return `<div class="dom"><input type="color" value="${d.color}" data-dom="${d.id}" data-f="color">
          <input class="in" value="${esc(d.name)}" data-dom="${d.id}" data-f="name"><span class="muted">${n} élément${n > 1 ? 's' : ''}</span>
          <button class="iconbtn" data-do="delDom" data-id="${d.id}" title="Supprimer">${ic('trash', 15)}</button></div>`;
      }).join('')}
      <div style="padding:10px 16px"><button class="btn sm" data-do="addDom">${ic('plus', 14)}Ajouter un domaine</button></div></div></section>
    <section class="sec"><h2>Apparence<span class="why">propre à cet appareil</span></h2><div class="card" style="padding:16px">
      <div class="seg">${[['light', 'Clair'], ['dark', 'Sombre'], ['auto', 'Auto (système)']].map(([v, l]) => `<button class="${themePref() === v ? 'on' : ''}" data-do="theme" data-v="${v}">${l}</button>`).join('')}</div></div></section>
    ${dbxSettingsHtml()}
    <section class="sec"><h2>Sauvegarde automatique<span class="why">chaque modification est recopiée dans un fichier</span></h2><div class="card" style="padding:16px">
      ${syncBadge()}
      <p class="hint" style="margin:10px 0 12px">${fileSync.st.state === 'ok' ? `Tout est enregistré en continu dans <b>${esc(fileSync.st.name)}</b>. Rien à faire.`
        : fileSync.supported ? 'Choisis un fichier une seule fois (par exemple dans OneDrive pour avoir aussi une copie dans le cloud). Ensuite, plus rien à faire.' : 'Ce navigateur ne permet pas l\'écriture dans un fichier.'}</p>
      ${fileSync.supported ? `<button class="btn" data-do="syncPick">${ic('download', 15)}${fileSync.st.state === 'none' ? 'Choisir le fichier de sauvegarde' : 'Changer de fichier'}</button>` : ''}</div></section>
    <section class="sec"><h2>Outils<span class="why">export manuel, import, remise à zéro</span></h2><div class="card" style="padding:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" data-do="export">${ic('download', 15)}Exporter une copie</button>
      <button class="btn" data-do="import">${ic('upload', 15)}Importer</button>
      <button class="btn danger" data-do="reset">${ic('trash', 15)}Tout effacer</button>
      <input type="file" id="importFile" accept="application/json" hidden></div></section></div></div>`;
}

/* ---------- modales ---------- */
function newActionModal(o = {}) {
  const rt = o.routineId ? byId(db.routines, o.routineId) : null;
  const m = openModal(`<h3>Nouvelle action</h3>
    ${rt ? `<p class="muted" style="margin-top:-8px">${ic('link', 13)} Liée à la routine : <b style="color:var(--ink)">${esc(rt.title)}</b></p>` : ''}
    <div class="fld"><label>Quoi ?</label><input class="in" id="na-t" placeholder="${rt ? 'Ex : réparer ce qui a coincé' : 'Ex : appeler le plombier'}" autocomplete="off"></div>
    <div class="fld"><label>Domaine</label><div class="mini" id="na-d">${db.domains.map(d => `<button class="dbtn ${o.domainId === d.id ? 'on' : ''}" style="--c:${d.color}" title="${esc(d.name)}" data-v="${d.id}"></button>`).join('')}</div></div>
    <div class="fld"><label>Criticité (vide = à trier plus tard)</label><div class="cpick" id="na-c">${CRITS.map(c => `<button class="c${c}" data-v="${c}">${c}%</button>`).join('')}</div></div>
    <div class="fields" style="padding:0"><div class="fld"><label>Deadline</label><input type="date" id="na-dl" value="${o.deadline || ''}"></div><div class="fld"><label>Followup</label><input type="date" id="na-fu" value="${o.followup || ''}"></div></div>
    <div class="acts"><button class="btn" data-do="closeModal">Annuler</button><button class="btn primary" id="na-ok">Créer</button></div>`);
  const pick = (sel, cls) => m.querySelector(sel).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    const on = b.classList.contains('on'); m.querySelectorAll(sel + ' button').forEach(x => x.classList.remove('on')); if (!on) b.classList.add('on'); });
  pick('#na-d'); pick('#na-c');
  const ok = () => {
    const t = m.querySelector('#na-t').value.trim(); if (!t) return m.querySelector('#na-t').focus();
    const c = m.querySelector('#na-c .on')?.dataset.v, d = m.querySelector('#na-d .on')?.dataset.v;
    const fu = m.querySelector('#na-fu').value || null;
    closeModal(); const a = newAction(t, { domainId: d || null, crit: c ? +c : null, deadline: m.querySelector('#na-dl').value || null, followup: fu, triFu: !!fu, routineId: o.routineId || null });
    save(); go('actions', a.id);
  };
  m.querySelector('#na-ok').onclick = ok;
  m.querySelector('#na-t').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
}
function newRoutineModal() {
  const m = openModal(`<h3>Nouvelle routine</h3>
    <div class="fld"><label>Quoi ?</label><input class="in" id="nr-t" placeholder="Ex : arroser les plantes" autocomplete="off"></div>
    <div class="fld"><label>Domaine</label><select class="in" id="nr-d">${db.domains.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div>
    <p class="hint">Tu règles la fréquence ensuite, dans la fiche (1× par semaine par défaut).</p>
    <div class="acts"><button class="btn" data-do="closeModal">Annuler</button><button class="btn primary" id="nr-ok">Créer</button></div>`);
  const ok = () => {
    const t = m.querySelector('#nr-t').value.trim(); if (!t) return;
    const r = { id: uid(), title: t, domainId: m.querySelector('#nr-d').value, mode: 'freq', n: 1, per: 'semaine', unit: 'mois', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], effort: null, notes: '', paused: false, createdAt: D.today() };
    db.routines.push(r); save(); closeModal(); go('routines', r.id);
  };
  m.querySelector('#nr-ok').onclick = ok;
  m.querySelector('#nr-t').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
}
function activityModal(link, type = 'note') {
  const o = link ? (link.k === 'actions' ? byId(db.actions, link.id) : byId(db.routines, link.id)) : null;
  const m = openModal(`<h3>Ajouter une activité</h3>
    ${o ? `<p class="muted" style="margin-top:-8px">Liée à : <b style="color:var(--ink)">${esc(o.title)}</b></p>` : ''}
    <div class="fld"><label>Type</label><div class="tychips" id="ac-t">${Object.entries(TYPES).filter(([k]) => k !== 'fait' || (link && link.k === 'routines') || !link || link.k === 'actions')
      .map(([k, t]) => `<button class="chip ${k === type ? 'on' : ''}" data-v="${k}">${ic(t.icon, 13)}${t.label}</button>`).join('')}</div></div>
    ${o ? '' : `<div class="fld"><label>Lié à</label><select class="in" id="ac-l"><option value="">— Aucun</option><optgroup label="Actions">${db.actions.filter(isActive).map(a => `<option value="a:${a.id}">${esc(a.title)}</option>`).join('')}</optgroup><optgroup label="Routines">${db.routines.map(r => `<option value="r:${r.id}">${esc(r.title)}</option>`).join('')}</optgroup></select></div>`}
    <div class="fld"><label>Date</label><input class="in" type="date" id="ac-d" value="${D.today()}"></div>
    <div class="fld"><label>Détail</label><textarea class="notes" id="ac-x" style="min-height:80px" placeholder="Ce qui s'est dit / fait…"></textarea></div>
    <div class="acts"><button class="btn" data-do="closeModal">Annuler</button><button class="btn primary" id="ac-ok">Enregistrer</button></div>`);
  let ty = type;
  m.querySelector('#ac-t').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ty = b.dataset.v;
    m.querySelectorAll('#ac-t .chip').forEach(x => x.classList.toggle('on', x === b)); });
  m.querySelector('#ac-ok').onclick = () => {
    let actionId = link?.k === 'actions' ? link.id : null, routineId = link?.k === 'routines' ? link.id : null;
    const sel = m.querySelector('#ac-l')?.value; if (sel) { if (sel[0] === 'a') actionId = sel.slice(2); else routineId = sel.slice(2); }
    const x = newActivity({ type: ty, date: m.querySelector('#ac-d').value || D.today(), text: m.querySelector('#ac-x').value.trim(), actionId, routineId });
    save(); closeModal(); render(); toast('Activité ajoutée');
  };
}

/* ---------- rendu principal ---------- */
const TITLES = {
  today: ['Aujourd\'hui', 'ce qui demande ton attention'], actions: ['Actions', 'tout ce que tu as décidé de mener'],
  calendar: ['Calendrier', 'deadlines, followups et routines à venir'], review: ['Revue de la semaine', 'deux minutes pour faire le tri et repartir léger'],
  routines: ['Routines', 'ce qui doit revenir régulièrement'], activities: ['Activités', 'appels, visites, mails, notes, « fait »'], settings: ['Réglages', ''],
};
function topHtml() {
  let [t, s] = TITLES[ui.view];
  if (ui.view === 'today') { t = greeting(); s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); s = s[0].toUpperCase() + s.slice(1); }
  const btn = { actions: `<button class="btn primary" data-do="newAction">${ic('plus', 16)}<span class="lbl">Nouvelle action</span></button>`,
    routines: `<button class="btn primary" data-do="newRoutine">${ic('plus', 16)}<span class="lbl">Nouvelle routine</span></button>`,
    activities: `<button class="btn primary" data-do="newAct">${ic('plus', 16)}<span class="lbl">Activité</span></button>`,
    calendar: `<button class="btn primary" data-do="newAction">${ic('plus', 16)}<span class="lbl">Nouvelle action</span></button>`,
    today: `<button class="btn primary" data-do="newAction">${ic('plus', 16)}<span class="lbl">Nouvelle action</span> <kbd style="margin-left:4px;background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.3);color:#fff">N</kbd></button>` }[ui.view] || '';
  return `<header class="top"><h1>${t}</h1><span class="sub">${s}</span><span class="sp"></span>${btn}</header>`;
}
function render() {
  const app = document.getElementById('app');
  const sc = app.querySelector('.rows')?.scrollTop, sc2 = app.querySelector('.scroll')?.scrollTop, ds = app.querySelector('#detail')?.scrollTop;
  const focus = document.activeElement?.id;
  const v = { today: () => `<div class="body">${viewToday()}</div>`, actions: viewActions, routines: viewRoutines, activities: viewActivities, calendar: viewCalendar, review: viewReview, settings: viewSettings }[ui.view]();
  app.innerHTML = sidebarHtml() + `<main class="main">${topHtml()}${v}</main>`;
  const r = app.querySelector('.rows'); if (r && sc) r.scrollTop = sc;
  const s2 = app.querySelector('.scroll'); if (s2 && sc2) s2.scrollTop = sc2;
  const d = app.querySelector('#detail'); if (d && ds) d.scrollTop = ds;
  if (focus) document.getElementById(focus)?.focus();
  if (typeof applyFocus === 'function') applyFocus();
}
function refreshSide() { const s = document.querySelector('.side'); if (s) s.outerHTML = sidebarHtml(); }
/* rafraîchissement léger : liste + tuiles + sidebar, sans toucher au champ en cours de saisie */
function refreshLight() {
  const app = document.getElementById('app'), kind = ui.view;
  const rows = app.querySelector('#rows'); if (rows && ROWS[kind]) { const sc = rows.scrollTop; rows.innerHTML = ROWS[kind](); rows.scrollTop = sc; }
  const live = app.querySelector('#live'), r = ui.sel.routines && byId(db.routines, ui.sel.routines);
  if (live && r) live.outerHTML = liveHtml(r);
  app.querySelector('.side').outerHTML = sidebarHtml();
}
