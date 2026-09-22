'use strict';
const at = el => { const r = el.getBoundingClientRect(); return [r.left, r.bottom + 4]; };
const emptyDb = () => ({ v: 1, domains: DEFAULT_DOMAINS.map(x => ({ ...x })), actions: [], routines: [], activities: [], trackCats: [], trackTypes: [], logs: [], meta: { sample: false, lastExport: null } });

/* ---------- thème (préférence propre à l'appareil, hors des données) ---------- */
const themePref = () => { try { return localStorage.getItem('cap.theme') || 'auto'; } catch (e) { return 'auto'; } };
const isDark = () => document.documentElement.dataset.theme === 'dark';
function applyTheme() {
  const p = themePref(), dark = p === 'dark' || (p === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#1b1815' : '#f6f2ea');
}
function setTheme(p) { try { localStorage.setItem('cap.theme', p); } catch (e) { /* ignore */ } applyTheme(); render(); }
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themePref() === 'auto') { applyTheme(); render(); } });

const H = {
  ...coursesH,
  ...listesH,
  ...moisH,
  ...courrierH,
  ...weekendH,
  ...cartesH,
  share: el => { const o = byId(coll(el.dataset.k), el.dataset.id); if (o && !!o.shared !== (el.dataset.to === '1')) toggleShared(el.dataset.k, el.dataset.id); },
  hideShared: el => setHideShared(el.dataset.v === '1'),
  hubPick: el => hubPick(el.dataset.id), hubKey: el => (el.dataset.k === 'del' ? hubDel() : hubDigit(el.dataset.k)), hubBack: () => hubBack(),
  hubOpen: el => hubOpen(el.dataset.app), hubHome: () => hubHome(), hubSwitch: () => hubSwitch(), hubChangePin: () => hubChangePin(),
  dbxConnect: () => dbxSync.connect(document.getElementById('dbx-key')?.value || dbxSync.key()),
  dbxNow: () => { dbxSync.syncNow(); },
  dbxOut: () => { dbxSync.disconnect(); toast('Dropbox déconnecté : tes données restent sur cet appareil'); },
  addLink: el => {
    const a = byId(db.actions, el.dataset.id), u = document.getElementById('lk-url'); let url = u.value.trim();
    if (!url) return u.focus();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch (e) { return toast('Ce lien n\'est pas valide'); }
    a.links = [...(a.links || []), { id: uid(), url, label: document.getElementById('lk-label').value.trim() }];
    save(); render();
  },
  delLink: el => mutate(() => { const a = byId(db.actions, el.dataset.id); a.links = (a.links || []).filter(l => l.id !== el.dataset.l); }, 'Lien retiré'),
  themeToggle: () => setTheme(isDark() ? 'light' : 'dark'),
  theme: el => setTheme(el.dataset.v),
  nav: el => { const v = el.dataset.view; ui.view = v; if (TRACK_VIEWS.includes(v)) ui.app = 'track'; else if (v !== 'settings') ui.app = 'cap'; render(); },
  appSwitch: () => { ui.app = ui.app === 'cap' ? 'track' : 'cap'; ui.view = ui.app === 'track' ? 'tdash' : 'today'; render(); scrollTo(0, 0); },
  /* ----- Suivis ----- */
  newLog: () => logModal({}),
  tlogCat: el => logModal({ catId: el.dataset.id }),
  logEdit: el => logModal({ logId: el.dataset.id }),
  qpick: el => { const inp = document.getElementById('qlog'), p = parseQuick(inp.value); inp.value = ttype(el.dataset.id).name + ' ' + p.rest; inp.focus(); qlogPreview(inp.value); },
  timerStart: el => { if (timerGet()) return toast('Un chrono tourne déjà'); timerSet({ typeId: el.dataset.id, start: Date.now() }); render(); },
  timerStop: () => timerStop(),
  timerCancel: () => { timerSet(null); render(); },
  demoLogs: () => { mutate(() => seedDemoLogs(), 'Séances d\'exemple ajoutées'); },
  clearDemo: () => mutate(() => { db.logs.filter(l => l.demo).forEach(l => removeLog(l.id)); }, 'Séances d\'exemple supprimées'),
  jmore: () => { ui.trk.jlimit += 45; render(); },
  jcat: el => { ui.trk.jcat = el.dataset.v || null; render(); },
  stype: el => { ui.trk.type = el.dataset.v || null; ui.trk.metric = null; render(); },
  ecat: el => { ui.evo.cat = el.dataset.v || null; ui.evo.type = null; ui.evo.metric = null; render(); },
  etype: el => { ui.evo.type = el.dataset.v || null; ui.evo.metric = null; render(); },
  emetric: el => { ui.evo.metric = el.dataset.v; render(); },
  egran: el => { ui.evo.gran = el.dataset.v; render(); },
  eview: el => { ui.evo.view = el.dataset.v; render(); },
  ecum: el => { ui.evo.cum = el.dataset.v === '1'; ui.evo.view = null; render(); },
  eweeks: el => { ui.evo.weeks = +el.dataset.v; render(); },
  scat: el => { ui.trk.cat = el.dataset.v || null; ui.trk.type = null; ui.trk.metric = null; render(); },
  sweeks: el => { ui.trk.weeks = +el.dataset.v; render(); },
  stable: el => { ui.trk.table = el.dataset.v === '1'; render(); },
  tmeasure: el => { const t = ttype(el.dataset.id), k = el.dataset.m; const on = t.measures.includes(k); const set = new Set(t.measures); if (on) set.delete(k); else set.add(k); t.measures = Object.keys(MEASURES).filter(x => set.has(x)); save(); render(); },
  taddType: el => { db.trackTypes.push({ id: uid(), catId: el.dataset.id, name: 'Nouveau type', keywords: '', measures: ['duration'] }); save(); render(); },
  taddCat: () => { db.trackCats.push({ id: uid(), name: 'Nouvelle catégorie', color: NEW_CAT_COLORS[db.trackCats.length % NEW_CAT_COLORS.length], goalKind: 'days', goal: 3, routineId: null }); save(); render(); },
  tdelType: el => {
    const t = ttype(el.dataset.id), n = logsOf({ typeId: t.id }).length;
    if (n && !confirm(`Supprimer « ${t.name} » supprimera aussi ses ${n} séance(s). Continuer ?`)) return;
    mutate(() => { logsOf({ typeId: t.id }).forEach(l => removeLog(l.id)); db.trackTypes.splice(db.trackTypes.indexOf(t), 1); }, 'Type supprimé');
  },
  tdelCat: el => {
    const c = tcat(el.dataset.id), tys = db.trackTypes.filter(t => t.catId === c.id), n = logsOf({ catId: c.id }).length;
    if ((tys.length || n) && !confirm(`Supprimer « ${c.name} » supprimera ses ${tys.length} type(s) et ${n} séance(s). Continuer ?`)) return;
    mutate(() => { logsOf({ catId: c.id }).forEach(l => removeLog(l.id)); tys.forEach(t => db.trackTypes.splice(db.trackTypes.indexOf(t), 1)); db.trackCats.splice(db.trackCats.indexOf(c), 1); }, 'Catégorie supprimée');
  },
  complete: el => completeAction(el.dataset.id),
  open: el => go(el.dataset.k, el.dataset.id),
  pmenu: el => postponeMenu(el.dataset.id, ...at(el)),
  wmenu: el => waitingMenu(el.dataset.id, ...at(el)),
  rdone: el => routineDone(el.dataset.id),
  tri: el => triage(el.dataset.id, JSON.parse(el.dataset.p)),
  clearSample: () => mutate(() => { db.actions = []; db.routines = []; db.activities = []; db.meta.sample = false; }, 'Exemples supprimés'),
  newAction: () => newActionModal(),
  newRoutine: () => newRoutineModal(),
  newAct: el => activityModal(el.dataset.id ? { k: el.dataset.k, id: el.dataset.id } : null),
  closeModal: () => closeModal(),
  closeDetail: () => { ui.sel[ui.view] = null; render(); },
  fstatus: el => { ui.f.actions.status = el.dataset.v; render(); },
  fdomain: el => { const f = ui.f[el.dataset.k]; f.domain = f.domain === el.dataset.v ? null : el.dataset.v; render(); },
  ftype: el => { ui.f.activities.type = el.dataset.v || null; render(); },
  tab: el => { ui.tab[el.dataset.k] = el.dataset.v; render(); },
  setcrit: el => { const a = byId(db.actions, el.dataset.id); a.crit = +el.dataset.v; a.inbox = false; save(); render(); },
  del: el => removeItem(el.dataset.k, el.dataset.id),
  month: el => {
    const r = byId(db.routines, el.dataset.id), m = +el.dataset.v, i = r.months.indexOf(m);
    if (i >= 0) { if (r.months.length > 1) r.months.splice(i, 1); } else r.months.push(m);
    save(); render();
  },
  pauseR: el => { const r = byId(db.routines, el.dataset.id); r.paused = !r.paused; save(); render(); },
  addDom: () => { db.domains.push({ id: uid(), name: 'Nouveau domaine', color: '#8f8a80' }); save(); render(); },
  delDom: el => mutate(() => {
    db.domains = db.domains.filter(d => d.id !== el.dataset.id);
    [...db.actions, ...db.routines].forEach(x => { if (x.domainId === el.dataset.id) x.domainId = null; });
  }, 'Domaine supprimé'),
  mins: el => { ui.minutes = el.dataset.v ? +el.dataset.v : null; render(); },
  rskip: el => skipMenu(el.dataset.id, ...at(el)),
  drop: el => mutate(() => { const a = byId(db.actions, el.dataset.id); a.status = 'dropped'; a.inbox = false; }, 'Action abandonnée'),
  newLinked: el => { const r = byId(db.routines, el.dataset.id); newActionModal({ domainId: r.domainId, routineId: r.id }); },
  calNav: el => { ui.cal.off = +el.dataset.v === 0 ? 0 : ui.cal.off + +el.dataset.v; render(); },
  calAdd: el => newActionModal({ followup: el.dataset.d }),
  calMore: (el, e) => {
    const ev = (calEvents[el.dataset.d] || []).filter(x => x.kind !== 'dn'), r = el.getBoundingClientRect();
    showMenu(r.left, r.bottom + 4, [{ label: fmtShort(el.dataset.d) }, ...ev.map(x => ({ label: x.o.title, icon: x.kind === 'rt' ? 'repeat' : x.kind === 'dl' ? 'clock' : 'list', run: () => go(x.k, x.o.id) }))]);
  },
  calDay: (el, e) => {
    const d = el.dataset.d, ev = (calEvents[d] || []).filter(x => x.kind !== 'dn');
    showMenu(e.clientX, e.clientY, [{ label: fmtShort(d) }, ...ev.map(x => ({ label: x.o.title, icon: x.kind === 'rt' ? 'repeat' : x.kind === 'dl' ? 'clock' : 'list', run: () => go(x.k, x.o.id) })),
      ...(ev.length ? ['-'] : []), { label: 'Nouvelle action ce jour-là', icon: 'plus', run: () => newActionModal({ followup: d }) }]);
  },
  moreMenu: el => {
    const r = el.getBoundingClientRect(), s = fileSync.st.state;
    const first = ui.app === 'track'
      ? [{ label: 'Réglages de Suivis', icon: 'gear', run: () => { ui.view = 'settings'; render(); } }, { label: 'Retour à Cap', icon: 'swap', run: () => H.appSwitch() }]
      : [{ label: 'Activités', icon: 'activity', run: () => { ui.view = 'activities'; render(); } },
        { label: 'Revue de la semaine', icon: 'review', run: () => { ui.view = 'review'; render(); } },
        { label: 'Réglages', icon: 'gear', run: () => { ui.view = 'settings'; render(); } }, { label: 'Ouvrir Suivis', icon: 'target', run: () => H.appSwitch() }];
    showMenu(r.left - 60, r.top - (first.length * 38 + 190 + 114), [...first, '-',
      { label: hideShared() ? 'Afficher le commun' : 'Masquer le commun', icon: 'users', run: () => setHideShared(!hideShared()) }, { label: 'Applications', icon: 'grid', run: () => hubHome() }, { label: `Changer de profil (${hub.name()})`, icon: 'users', run: () => hubSwitch() },
      { label: isDark() ? 'Thème clair' : 'Thème sombre', icon: isDark() ? 'sun' : 'moon', run: () => H.themeToggle() },
      ...(dbxSync.connected() ? [{ label: dbxSync.st.state === 'ok' ? 'Dropbox synchronisé ✓ (relancer)' : 'Synchroniser Dropbox', icon: 'repeat', run: () => dbxSync.syncNow() }] : []),
      ...(s !== 'ok' && s !== 'unsupported' && !dbxSync.connected() ? [{ label: s === 'needs' ? 'Reconnecter la sauvegarde' : 'Activer la sauvegarde auto', icon: 'download', run: () => H.syncClick() }] : [])]);
  },
  revp: el => { ui.revPeriod = +el.dataset.v; render(); },
  finishReview: () => { db.meta.lastReview = D.today(); save(); go('today'); toast('Revue terminée — belle semaine ✓'); },
  syncClick: () => (fileSync.st.state === 'needs' ? fileSync.reconnect() : fileSync.connect()),
  syncPick: () => fileSync.connect(),
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
    a.download = `cap-copie-${D.today()}.json`; a.click(); toast('Copie téléchargée');
  },
  import: () => document.getElementById('importFile').click(),
  reset: () => {
    if (!confirm('Effacer tes données perso définitivement ?' + (dbxSync.connected() ? '\n\nDropbox est connecté : cela effacera aussi tes autres appareils.' : '') + '\nLes éléments communs ne sont pas touchés.\n(pense à exporter une copie avant)')) return;
    const C = stores.c.data, doms = db.domains; hidden = { actions: [], routines: [], activities: [] };
    db = emptyDb(); db.domains = doms; db.actions.push(...C.actions); db.routines.push(...C.routines); db.activities.push(...C.activities);
    save(); assemble(); ensureTrackDefaults(); ui.sel = { actions: null, routines: null, activities: null }; render();
  },
};

document.addEventListener('click', e => {
  if (!e.target.closest('.menu')) closeMenu();
  const sort = e.target.closest('[data-sort]');
  if (sort) {
    const s = ui.sort[sort.dataset.k], k = sort.dataset.sort;
    if (s.key === k) s.dir = -s.dir; else { s.key = k; s.dir = ['priority', 'urgency', 'date', 'since'].includes(k) ? -1 : 1; }
    return refreshLight();
  }
  const el = e.target.closest('[data-do]');
  if (el) { e.stopPropagation(); return H[el.dataset.do]?.(el, e); }
  const row = e.target.closest('.row[data-row]');
  if (row) { ui.sel[row.dataset.k] = row.dataset.id; render(); }
});

function onField(el) {
  const { k, id, f } = el.dataset, o = byId(coll(k), id); if (!o) return;
  let v = el.value;
  if (el.type === 'number') v = Math.max(1, parseInt(v) || 1);
  else { if (el.hasAttribute('data-num')) v = v === '' ? null : +v; if (el.hasAttribute('data-null') && v === '') v = null; }
  if (k === 'actions' && f === 'status') return setStatus(id, v);
  if (k === 'activities' && f === 'link') { o.actionId = v[0] === 'a' ? v.slice(2) : null; o.routineId = v[0] === 'r' ? v.slice(2) : null; save(); return render(); }
  if (k === 'activities' && f === 'date' && !v) return;
  o[f] = v; save();
  if ((k === 'routines' && f === 'mode') || (k === 'activities' && f === 'type')) return render();
  refreshLight();
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'qlog') return qlogPreview(el.value);
  if (el.dataset.search === 'tjournal') { ui.trk.jq = el.value; const box = document.getElementById('jlist'); if (box) box.innerHTML = journalListHtml(); return; }
  if (el.dataset.tsel) { ui.trk[el.dataset.tsel] = el.value || null; if (el.dataset.tsel === 'type') ui.trk.metric = null; return render(); }
  if (el.dataset.tc) {
    const c = tcat(el.dataset.tc), f = el.dataset.f, v = el.value;
    if (f === 'goalv') { const n = parseFloat(v); c.goal = isNaN(n) ? 0 : c.goalKind === 'minutes' ? Math.round(n * 60) : n; }
    else if (f === 'goalKind') { c.goalKind = v; c.goal = v === 'minutes' ? 180 : 3; save(); return render(); }
    else if (f === 'routineId') c.routineId = v || null;
    else c[f] = v;
    return save();
  }
  if (el.dataset.tt) { ttype(el.dataset.tt)[el.dataset.f] = el.value; return save(); }
  if (el.dataset.search) { ui.f[el.dataset.search].q = el.value; return refreshLight(); }
  if (el.dataset.dom) { byId(db.domains, el.dataset.dom)[el.dataset.f] = el.value; save(); return refreshLight(); }
  if (el.dataset.f && el.dataset.k) onField(el);
});
document.addEventListener('change', e => {
  if (e.target.id !== 'importFile' || !e.target.files[0]) return;
  const rd = new FileReader();
  rd.onload = () => {
    try { const d = JSON.parse(rd.result); if (!Array.isArray(d.actions) || !Array.isArray(d.domains)) throw 0; COLLS.forEach(k => { d[k] = d[k] || []; }); db = d; save(); ensureTrackDefaults(); render(); toast('Sauvegarde importée'); }
    catch (err) { toast('Fichier invalide'); }
  };
  rd.readAsText(e.target.files[0]);
});

/* clic droit */
document.addEventListener('contextmenu', e => {
  const row = e.target.closest('[data-row]'); if (!row) return;
  e.preventDefault();
  const { k, id } = row.dataset, x = e.clientX, y = e.clientY, link = { k, id };
  let items = [];
  if (k === 'actions') {
    const a = byId(db.actions, id);
    items = [{ label: 'Ajouter' }, ...['call', 'visit', 'mail', 'note'].map(t => ({ label: TYPES[t].label, icon: TYPES[t].icon, run: () => activityModal(link, t) })), '-'];
    if (isActive(a)) items.push({ label: 'Terminer', icon: 'check', run: () => completeAction(id) },
      { label: 'Reporter…', icon: 'skip', run: () => postponeMenu(id, x, y) }, { label: 'Mettre en attente…', icon: 'pause', run: () => waitingMenu(id, x, y) }, '-');
    items.push({ label: a.shared ? 'Repasser en perso' : 'Passer en commun', icon: 'users', run: () => toggleShared(k, id) }, '-');
    items.push({ label: 'Supprimer', icon: 'trash', danger: true, run: () => removeItem(k, id) });
  } else if (k === 'routines') {
    const r = byId(db.routines, id);
    items = [{ label: 'Fait aujourd\'hui', icon: 'check', run: () => routineDone(id) },
      { label: 'Passer cette fois…', icon: 'skip', run: () => skipMenu(id, x, y) },
      { label: 'Nouvelle action liée', icon: 'link', run: () => newActionModal({ domainId: r.domainId, routineId: id }) },
      { label: 'Fait un autre jour…', icon: 'clock', run: () => askDate('Fait le', d => routineDone(id, d)) },
      { label: 'Ajouter une note', icon: 'note', run: () => activityModal(link, 'note') }, '-',
      { label: r.paused ? 'Reprendre' : 'Mettre en pause', icon: 'pause', run: () => { r.paused = !r.paused; save(); render(); } },
      { label: r.shared ? 'Repasser en perso' : 'Passer en commun', icon: 'users', run: () => toggleShared(k, id) },
      { label: 'Supprimer', icon: 'trash', danger: true, run: () => removeItem(k, id) }];
  } else if (k === 'activities') {
    const l = linkOf(byId(db.activities, id));
    if (l.o) items.push({ label: 'Ouvrir l\'élément lié', icon: 'list', run: () => go(l.k, l.o.id) }, '-');
    items.push({ label: 'Supprimer', icon: 'trash', danger: true, run: () => removeItem(k, id) });
  }
  showMenu(x, y, items);
});

/* clavier */
document.addEventListener('keydown', e => {
  if (hub.screen !== 'cap') return hubKeydown(e); // écrans de connexion et d'accueil : pas de raccourcis de Cap
  const t = e.target, typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName);
  if (e.key === 'Enter' && t.id === 'qlog') { e.preventDefault(); qlogSubmit(); return; }
  if (e.key === 'Tab' && !e.shiftKey && t.id === 'qlog') { const p = parseQuick(t.value); if (p.type && norm(p.q) !== norm(p.type.name)) { e.preventDefault(); t.value = p.type.name + ' ' + p.rest; qlogPreview(t.value); } return; }
  if (e.key === 'Enter' && (t.id === 'lk-url' || t.id === 'lk-label')) { document.querySelector('[data-do=addLink]')?.click(); return; }
  if (e.key === 'Enter' && t.id === 'cap' && t.value.trim()) {
    newAction(t.value.trim()); save(); render(); toast('Capturé — à trier ci-dessous'); return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && t.matches('textarea.notes')) {
    e.preventDefault();
    const s = t.selectionStart, before = t.value.slice(0, s), ins = (before && !before.endsWith('\n') ? '\n' : '') + fmtDM(D.today()) + ' : ';
    t.setRangeText(ins, s, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input', { bubbles: true })); return;
  }
  if (e.key === 'Escape') {
    if (document.getElementById('modal')) return closeModal();
    if (document.querySelector('.menu')) return closeMenu();
    if (typing) return t.blur();
    if (ui.sel[ui.view]) { ui.sel[ui.view] = null; render(); }
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || document.getElementById('modal')) return;
  if ((ui.view === 'today' || ui.view === 'review') && kbdRows() && kbdKey(e)) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); if (ui.app === 'track') logModal({}); else newActionModal(); }
  if (e.key === '/') { const s = document.querySelector('[data-search]'); if (s) { e.preventDefault(); s.focus(); } }
});

/* ---------- tri au clavier (accueil et revue) ----------
   ↑↓ / J K : naviguer · 1-4 : criticité · D : demain · S : +1 semaine · M : +1 mois · F : fait · P : passer (routine) */
const kbdRows = () => [...document.querySelectorAll('.tri[data-row], .trow[data-row]')];
function applyFocus() {
  document.querySelectorAll('.kf').forEach(x => x.classList.remove('kf'));
  if (!ui.focus) return;
  const el = kbdRows().find(r => r.dataset.id === ui.focus);
  if (el) { el.classList.add('kf'); el.scrollIntoView({ block: 'nearest' }); }
}
function kbdMove(delta) {
  const rows = kbdRows(); if (!rows.length) return;
  const i = rows.findIndex(r => r.dataset.id === ui.focus);
  ui.focus = rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? 0 : i + delta))].dataset.id; applyFocus();
}
/* exécute une action puis garde le focus à la même position (la ligne courante a pu disparaître) */
function kbdThen(fn) {
  const rows = kbdRows(), i = rows.findIndex(r => r.dataset.id === ui.focus);
  fn();
  const after = kbdRows(); ui.focus = after.length ? after[Math.min(Math.max(i, 0), after.length - 1)].dataset.id : null; applyFocus();
}
function kbdKey(e) {
  const k = e.key.toLowerCase();
  if (k === 'arrowdown' || k === 'j') { e.preventDefault(); kbdMove(1); return true; }
  if (k === 'arrowup' || k === 'k') { e.preventDefault(); kbdMove(-1); return true; }
  const row = kbdRows().find(r => r.dataset.id === ui.focus); if (!row) return false;
  const id = row.dataset.id, isRt = row.dataset.k === 'routines', a = isRt ? null : byId(db.actions, id), t = D.today();
  const dates = { d: D.add(t, 1), s: D.add(t, 7), m: D.addMonths(t, 1) };
  if (!isRt && '1234'.includes(k) && k.length === 1) { e.preventDefault(); kbdThen(() => triage(id, { crit: CRITS[+k - 1] })); return true; }
  if (!isRt && dates[k]) { e.preventDefault(); kbdThen(() => (a.inbox ? triage(id, { followup: dates[k], triFu: true }) : postpone(id, dates[k]))); return true; }
  if (k === 'f') { e.preventDefault(); kbdThen(() => (isRt ? routineDone(id) : completeAction(id))); return true; }
  if (k === 'p' && isRt) { e.preventDefault(); const r = row.getBoundingClientRect(); skipMenu(id, r.left + 60, r.bottom); return true; }
  return false;
}

/* poignée de redimensionnement liste / détail */
document.addEventListener('mousedown', e => {
  if (!e.target.closest('[data-grip]')) return;
  const split = e.target.closest('.split'), r = split.getBoundingClientRect();
  const move = ev => { ui.split = Math.max(22, Math.min(75, Math.round(100 * (r.bottom - ev.clientY) / r.height))); split.style.setProperty('--detail', ui.split + '%'); };
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); e.preventDefault();
});

applyTheme();
if (/~dark/.test(location.hash)) setTheme('dark'); else if (/~light/.test(location.hash)) setTheme('light');
hubBoot(); // profil → (code) → accueil des applis ; charge les données du profil et lance les synchros
/* installable + hors ligne (uniquement quand l'appli est servie en https ou localhost) */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) toast('Nouvelle version de Cap prête', () => location.reload(), 'Recharger', 20000); });
}
