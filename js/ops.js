'use strict';
const ui = {
  view: 'today',
  sel: { actions: null, routines: null, activities: null },
  tab: { actions: 'notes', routines: 'notes' },
  f: { actions: { status: 'active', domain: null, q: '' }, routines: { domain: null, q: '' }, activities: { type: null, q: '' } },
  sort: { actions: { key: 'priority', dir: -1 }, routines: { key: 'urgency', dir: -1 }, activities: { key: 'date', dir: -1 } },
  split: 46,
  minutes: null,          // filtre « j'ai X minutes »
  cal: { off: 0 },        // décalage de mois du calendrier
  focus: null,            // ligne ciblée au clavier sur l'accueil
  revPeriod: 30,          // période du bilan par domaine (jours)
};
const COLL = { actions: 'actions', routines: 'routines', activities: 'activities' };
const coll = k => db[COLL[k]];

/* mutation avec annulation */
function mutate(fn, msg) {
  const prev = JSON.stringify(db);
  fn(); save(); render();
  if (msg) toast(msg, () => { db = JSON.parse(prev); save(); render(); });
}

function newAction(title, o = {}) {
  const a = {
    id: uid(), title, domainId: null, crit: null, status: 'todo', deadline: null, followup: null, effort: null, notes: '',
    postponed: 0, inbox: true, triFu: false, createdAt: D.today(), doneAt: null, ...o,
  };
  if (a.crit !== null) a.inbox = false;
  db.actions.push(a); return a;
}
function newActivity(o) {
  const x = { id: uid(), type: 'note', date: D.today(), text: '', actionId: null, routineId: null, ...o };
  db.activities.push(x); return x;
}

function completeAction(id) {
  mutate(() => {
    const a = byId(db.actions, id);
    a.status = 'done'; a.doneAt = D.today(); a.inbox = false;
    newActivity({ type: 'fait', actionId: id, text: 'Action terminée' });
  }, 'Action terminée — bravo ✓');
}
function setStatus(id, status) {
  const a = byId(db.actions, id);
  if (status === 'done') return completeAction(id);
  a.status = status; a.doneAt = null; save(); render();
}
function postpone(id, to) {
  mutate(() => {
    const a = byId(db.actions, id);
    a.followup = to;
    if (a.status !== 'waiting') a.postponed = (a.postponed || 0) + 1;
    if (a.deadline && a.deadline < to) a.deadline = to;
    a.inbox = false;
  }, `Reporté au ${fmtShort(to)}`);
}
function setWaiting(id, to) {
  mutate(() => { const a = byId(db.actions, id); a.status = 'waiting'; a.followup = to; a.inbox = false; }, `En attente — relance ${rel(to)}`);
}
function routineDone(id, date = D.today()) {
  mutate(() => { newActivity({ type: 'fait', routineId: id, date }); byId(db.routines, id).snoozeUntil = null; }, 'Routine faite ✓');
}
function removeItem(kind, id) {
  mutate(() => {
    const list = coll(kind), i = list.findIndex(x => x.id === id); list.splice(i, 1);
    if (kind === 'actions') db.activities = db.activities.filter(x => x.actionId !== id);
    if (kind === 'routines') db.activities = db.activities.filter(x => x.routineId !== id);
    if (ui.sel[kind] === id) ui.sel[kind] = null;
  }, 'Supprimé');
}
function triage(id, patch) {
  const a = byId(db.actions, id); Object.assign(a, patch);
  if (a.crit !== null && a.triFu) a.inbox = false;
  save(); render();
}

/* ---------- navigation ---------- */
function go(view, id = null) {
  ui.view = view;
  if (id) {
    ui.sel[view] = id;
    if (view === 'actions') {
      const a = byId(db.actions, id), f = ui.f.actions;
      if (a && !isActive(a) && f.status !== 'all' && f.status !== 'done') f.status = 'all';
      f.domain = null; f.q = '';
    }
    if (view === 'routines') { ui.f.routines.domain = null; ui.f.routines.q = ''; }
    if (view === 'activities') { ui.f.activities.type = null; ui.f.activities.q = ''; }
  }
  render();
  if (id) document.querySelector('.row.sel')?.scrollIntoView({ block: 'nearest' });
}

/* ---------- overlays ---------- */
function closeMenu() { document.querySelector('.menu')?.remove(); }
function showMenu(x, y, items) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu';
  items.forEach(it => {
    if (it === '-') { m.appendChild(document.createElement('hr')); return; }
    if (it.label && !it.run) { const l = document.createElement('div'); l.className = 'lbl'; l.textContent = it.label; m.appendChild(l); return; }
    const b = document.createElement('button');
    b.className = it.danger ? 'danger' : ''; b.innerHTML = (it.icon ? ic(it.icon, 15) : '<span style="width:15px"></span>') + esc(it.label);
    b.onclick = e => { e.stopPropagation(); closeMenu(); it.run(); };
    m.appendChild(b);
  });
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
}
function openModal(html) {
  closeModal();
  const s = document.createElement('div'); s.className = 'scrim'; s.id = 'modal';
  s.innerHTML = `<div class="modal">${html}</div>`;
  s.addEventListener('mousedown', e => { if (e.target === s) closeModal(); });
  document.body.appendChild(s);
  s.querySelector('input:not([type=hidden]),textarea')?.focus();
  return s;
}
function closeModal() { document.getElementById('modal')?.remove(); }
let toastTimer;
function toast(msg, undo) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (undo) { const b = document.createElement('button'); b.textContent = 'Annuler'; b.onclick = () => { t.remove(); undo(); }; t.appendChild(b); }
  document.body.appendChild(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 6000);
}

/* menus de dates rapides */
const quickDates = () => { const t = D.today(); return [['Demain', D.add(t, 1)], ['Dans 3 jours', D.add(t, 3)], ['Dans 1 semaine', D.add(t, 7)], ['Dans 2 semaines', D.add(t, 14)], ['Dans 1 mois', D.addMonths(t, 1)]]; };
function postponeMenu(id, x, y) {
  const items = [{ label: 'Reporter à…' }, ...quickDates().map(([l, d]) => ({ label: l, icon: 'skip', run: () => postpone(id, d) })),
    { label: 'Choisir une date…', icon: 'clock', run: () => askDate('Reporter à', d => postpone(id, d)) }];
  showMenu(x, y, items);
}
function waitingMenu(id, x, y) {
  const items = [{ label: 'En attente, relancer…' }, ...quickDates().map(([l, d]) => ({ label: l, icon: 'pause', run: () => setWaiting(id, d) })),
    { label: 'Choisir une date…', icon: 'clock', run: () => askDate('Relancer le', d => setWaiting(id, d)) }];
  showMenu(x, y, items);
}
/* « Passer cette fois » : la routine disparaît jusqu'à la date choisie, sans casser la série */
function skipRoutine(id, until) {
  mutate(() => { const r = byId(db.routines, id); r.snoozeUntil = until; r.skips = [...(r.skips || []), D.today()]; }, `Routine passée, retour ${rel(until)}`);
}
function skipMenu(id, x, y) {
  showMenu(x, y, [{ label: 'Pas cette fois, revoir…' }, ...quickDates().slice(0, 4).map(([l, d]) => ({ label: l, icon: 'skip', run: () => skipRoutine(id, d) })),
    { label: 'Choisir une date…', icon: 'clock', run: () => askDate('Revoir la routine le', d => skipRoutine(id, d)) }]);
}
function askDate(title, cb) {
  const m = openModal(`<h3>${esc(title)}</h3><div class="fld"><input class="in" type="date" id="askd" value="${D.add(D.today(), 1)}"></div>
    <div class="acts"><button class="btn" data-do="closeModal">Annuler</button><button class="btn primary" id="askok">Valider</button></div>`);
  m.querySelector('#askok').onclick = () => { const v = m.querySelector('#askd').value; if (v) { closeModal(); cb(v); } };
}
