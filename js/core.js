'use strict';
const APP_NAME = 'Cap';
let KEY = 'cap.v1'; // devient « cap.v1.<profil> » à l'ouverture d'un profil (voir hub.js)

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const D = {
  iso: d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  parse: s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  today: () => D.iso(new Date()),
  add: (s, n) => { const d = D.parse(s); d.setDate(d.getDate() + n); return D.iso(d); },
  addMonths: (s, n) => {
    const d = D.parse(s), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return D.iso(d);
  },
  diff: (a, b) => Math.round((D.parse(a) - D.parse(b)) / 864e5),
  monday: s => D.add(s, -((D.parse(s).getDay() + 6) % 7)),
  monthStart: s => s.slice(0, 8) + '01',
};
const fmtShort = s => D.parse(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
const fmtDM = s => { const d = D.parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
function rel(s, late = false) {
  const n = D.diff(s, D.today());
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return late ? '1 j de retard' : 'hier';
  if (n > 0) return n > 60 ? `dans ${Math.round(n / 30)} mois` : `dans ${n} j`;
  return late ? `${-n} j de retard` : (n < -60 ? `il y a ${Math.round(-n / 30)} mois` : `il y a ${-n} j`);
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- constantes ---------- */
const STATUS = { todo: 'À faire', doing: 'En cours', waiting: 'En attente', done: 'Fait', dropped: 'Abandonné' };
const CRITS = [25, 50, 70, 90];
const CRIT_LABEL = { 25: 'Peut attendre', 50: 'À faire', 70: 'Important', 90: 'Urgent' };
const EFFORTS = [[5, '5 min'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h'], [240, '½ jour'], [480, '1 jour']];
const effortLabel = m => (EFFORTS.find(e => e[0] === m) || [0, ''])[1];
const TYPES = {
  call: { label: 'Appel', icon: 'phone' }, visit: { label: 'Visite', icon: 'pin' }, mail: { label: 'Mail', icon: 'mail' },
  note: { label: 'Note', icon: 'note' }, fait: { label: 'Fait', icon: 'check' },
};
const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  journal: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V7M17 16v-9"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  play: '<path d="m6 3 14 9-14 9z"/>', stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  review: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  note: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skip: '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};
const ic = (n, s = 16) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

/* ---------- données ----------
   `db` = ce que voit le profil : ses données perso + les éléments communs, assemblés en mémoire (sync.js : stores).
   Les vues lisent et modifient `db` comme avant ; save() range chaque élément dans le bon fichier. */
let db;
function load() { loadStores(); }
function save() {
  db.meta.savedAt = Date.now();
  commit(true);
  if (typeof fileSync !== 'undefined') fileSync.schedule();
}

const DEFAULT_DOMAINS = [
  { id: 'sante', name: 'Santé', color: '#5f9a7a' }, { id: 'travaux', name: 'Travaux', color: '#c4744a' },
  { id: 'jardin', name: 'Jardin', color: '#8aa34a' }, { id: 'admin', name: 'Admin & finances', color: '#c49a3a' },
  { id: 'perso', name: 'Perso', color: '#a5688f' }, { id: 'pro', name: 'Pro', color: '#5f7fa8' },
];

function seed() {
  const t = D.today(), d = n => D.add(t, n);
  const A = (title, domainId, crit, status, o = {}) => ({
    id: uid(), title, domainId, crit, status, deadline: null, followup: null, effort: null, notes: '', postponed: 0,
    inbox: false, triFu: true, createdAt: d(-20), doneAt: null, ...o,
  });
  const actions = [
    A('Prendre RDV chez le dentiste', 'sante', 70, 'todo', { deadline: d(12), followup: d(0), effort: 15, postponed: 1 }),
    A('Faire réparer le portail', 'travaux', 50, 'todo', { followup: d(-3), effort: 60, postponed: 4, createdAt: d(-60), notes: '02/09 : j\'ai le numéro de l\'installateur.\n28/08 : le moteur grince encore.' }),
    A('Devis isolation des combles (3 devis)', 'travaux', 70, 'waiting', { followup: d(4), effort: 30, notes: '14/09 : devis Isotech reçu, j\'attends les 2 autres.' }),
    A('Résilier l\'ancien contrat d\'assurance', 'admin', 70, 'waiting', { followup: d(0), effort: 15, notes: '15/09 : conseillère absente, à rappeler jeudi.' }),
    A('Déclarer les impôts', 'admin', 90, 'doing', { deadline: d(5), followup: d(1), effort: 120 }),
    A('Renouveler le passeport', 'admin', 50, 'todo', { deadline: d(48), followup: d(20), effort: 60 }),
    A('Réserver les vacances d\'octobre', 'perso', 25, 'todo', { followup: d(6), effort: 60, postponed: 3 }),
    A('Préparer l\'entretien annuel', 'pro', 70, 'todo', { deadline: d(-2), effort: 120 }),
    A('Prise de sang : prendre RDV au labo', 'sante', 50, 'todo', { followup: d(0), effort: 5 }),
    A('Tailler la haie', 'jardin', 25, 'todo', { deadline: d(20), effort: 240 }),
    A('Refaire la salle de bain ?', null, null, 'todo', { inbox: true, triFu: false, createdAt: d(0) }),
    A('Racheter des ampoules', null, null, 'todo', { inbox: true, triFu: false, createdAt: d(0) }),
    A('Changer les pneus', 'perso', 50, 'done', { doneAt: d(-2), createdAt: d(-30) }),
  ];
  const R = (title, domainId, rule, o = {}) => ({
    id: uid(), title, domainId, mode: 'freq', n: 1, per: 'mois', unit: 'mois', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    effort: null, notes: '', paused: false, createdAt: d(-400), ...rule, ...o,
  });
  const routines = [
    R('Tondre la pelouse', 'jardin', { n: 2, per: 'mois', months: [4, 5, 6, 7, 8, 9, 10] }, { effort: 60 }),
    R('Faire du sport', 'perso', { n: 3, per: 'semaine' }, { effort: 60 }),
    R('Appeler mes parents', 'perso', { n: 1, per: 'semaine' }, { effort: 30 }),
    R('Entretien de la toiture', 'travaux', { mode: 'interval', n: 12, unit: 'mois' }),
    R('Entretien de la chaudière', 'travaux', { mode: 'interval', n: 12, unit: 'mois' }),
  ];
  const mon = w => D.add(D.monday(t), -7 * w), mo = m => D.monthStart(D.addMonths(D.monthStart(t), -m));
  const weeks = (a, b, offs) => { const r = []; for (let w = a; w <= b; w++) offs.forEach(o => r.push(D.add(mon(w), o))); return r; };
  routines[0].createdAt = d(-120); routines[1].createdAt = d(-100); routines[2].createdAt = d(-60);
  const dones = [
    [0, [d(-13), ...[1, 2, 3, 4].flatMap(m => [D.add(mo(m), 6), D.add(mo(m), 20)])]],            // tondeuse : ☀ plusieurs mois
    [1, [...weeks(3, 12, [0, 2, 4]), D.add(mon(2), 1), D.add(mon(1), 0), D.add(mon(1), 3)]],     // sport : 🌙 2 semaines ratées
    [2, [d(-3), ...weeks(1, 6, [2])]],                                                              // parents : ☀ 6 semaines
    [3, [d(-330)]], [4, [d(-390)]],
  ];
  const activities = [];
  dones.forEach(([i, dates]) => dates.filter(x => x <= t && x >= routines[i].createdAt).forEach(x => activities.push({ id: uid(), type: 'fait', date: x, text: '', routineId: routines[i].id, actionId: null })));
  const act = (i, type, k, text) => activities.push({ id: uid(), type, date: d(-k), text, actionId: actions[i].id, routineId: null });
  act(3, 'call', 3, 'Conseillère absente, rappeler jeudi.');
  act(2, 'mail', 6, 'Demande de devis envoyée à 2 autres entreprises.');
  act(2, 'visit', 9, 'Visite Isotech : mesures des combles.');
  act(1, 'note', 9, 'Le moteur grince toujours.');
  act(12, 'fait', 2, 'Action terminée');
  return { v: 1, domains: DEFAULT_DOMAINS.map(x => ({ ...x })), actions, routines, activities, trackCats: [], trackTypes: [], logs: [], meta: { sample: true, createdAt: D.today(), lastReview: null } };
}

/* ---------- accès ---------- */
const byId = (list, id) => list.find(x => x.id === id);
const dom = id => db.domains.find(x => x.id === id);
const isActive = a => a.status === 'todo' || a.status === 'doing' || a.status === 'waiting';

/* ---------- logique actions ---------- */
function score(a) {
  if (!isActive(a)) return -1;
  const t = D.today();
  let s = a.crit ?? 50;
  if (a.deadline) {
    const n = D.diff(a.deadline, t);
    if (n < 0) s += 70 + Math.min(-n, 10); else if (n <= 3) s += 45; else if (n <= 7) s += 28; else if (n <= 14) s += 12;
  }
  const waiting = a.status === 'waiting';
  if (a.followup && D.diff(a.followup, t) <= 0) s += 20;
  if (waiting && (!a.followup || D.diff(a.followup, t) > 0)) s -= 60;
  return s + Math.min(a.postponed || 0, 5) * 3;
}

function todayBuckets(filtered = true) {
  const t = D.today(), act = db.actions.filter(isActive), mf = filtered ? ui.minutes : null;
  const fitsTime = x => !mf || (x.effort && x.effort <= mf);
  const inbox = act.filter(a => a.inbox), rest = act.filter(a => !a.inbox), seen = new Set();
  const take = fn => { const r = rest.filter(a => !seen.has(a.id) && fitsTime(a) && fn(a)).sort((x, y) => score(y) - score(x)); r.forEach(a => seen.add(a.id)); return r; };
  const late = take(a => a.deadline && a.deadline < t);
  const due = take(a => (a.followup && a.followup <= t) || a.deadline === t);
  const stuck = take(a => (a.postponed || 0) >= 3);
  const routines = db.routines.map(r => ({ r, s: rStats(r) })).filter(x => (x.s.state === 'late' || x.s.state === 'soon') && fitsTime(x.r))
    .sort((a, b) => (b.s.since / b.s.gap) - (a.s.since / a.s.gap));
  return { inbox, late, due, stuck, routines };
}
function doneThisWeek() {
  const from = D.add(D.today(), -6);
  return db.actions.filter(a => a.doneAt && a.doneAt >= from).length +
    db.activities.filter(x => x.type === 'fait' && x.routineId && x.date >= from).length;
}

/* ---------- logique routines ---------- */
function ruleText(r) {
  if (r.mode === 'freq') return `${r.n}× par ${r.per === 'an' ? 'an' : r.per}`;
  if (r.n === 1) return { jour: 'chaque jour', semaine: 'chaque semaine', mois: 'chaque mois', an: 'chaque an' }[r.unit];
  return `tous les ${r.n} ${r.unit === 'mois' ? 'mois' : r.unit + 's'}`;
}
function seasonText(r) {
  const m = [...r.months].sort((a, b) => a - b);
  if (m.length >= 12) return '';
  const contiguous = m.every((x, i) => i === 0 || x === m[i - 1] + 1);
  return contiguous ? `${MONTHS[m[0] - 1]} → ${MONTHS[m[m.length - 1] - 1]}` : `${m.length} mois/an`;
}
function runStart(r, t) {
  if (r.months.length >= 12) return null;
  const d = D.parse(t); let m = d.getMonth() + 1, y = d.getFullYear();
  for (let i = 0; i < 12; i++) {
    let pm = m - 1, py = y; if (pm === 0) { pm = 12; py--; }
    if (!r.months.includes(pm)) break;
    m = pm; y = py;
  }
  return `${y}-${pad(m)}-01`;
}
function periodStart(r, t) { return r.per === 'semaine' ? D.monday(t) : r.per === 'mois' ? D.monthStart(t) : t.slice(0, 4) + '-01-01'; }
function rStats(r) {
  const t = D.today();
  const dones = db.activities.filter(a => a.routineId === r.id && a.type === 'fait').map(a => a.date).sort();
  const last = dones.length ? dones[dones.length - 1] : null;
  const dormant = r.paused || (r.months.length < 12 && !r.months.includes(D.parse(t).getMonth() + 1));
  let ref = last || r.createdAt || t;
  const rs = runStart(r, t); if (rs && rs > ref) ref = rs;
  const since = Math.max(0, D.diff(t, ref));
  let gap, due;
  if (r.mode === 'interval') {
    due = r.unit === 'jour' ? D.add(ref, r.n) : r.unit === 'semaine' ? D.add(ref, 7 * r.n) : D.addMonths(ref, r.unit === 'mois' ? r.n : 12 * r.n);
    gap = Math.max(1, D.diff(due, ref));
  } else {
    gap = Math.max(1, Math.round({ semaine: 7, mois: 30, an: 365 }[r.per] / r.n)); due = D.add(ref, gap);
  }
  let pc = null, target = null;
  if (r.mode === 'freq') { const ps = periodStart(r, t); pc = dones.filter(x => x >= ps).length; target = r.n; }
  let state = 'ok';
  if (dormant) state = 'dormant';
  else if (pc !== null && pc >= target) state = 'done';
  else if (r.snoozeUntil && r.snoozeUntil > t) state = 'snoozed';
  else if (since > gap) state = 'late';
  else if (gap - since <= Math.min(gap * 0.25, 14)) state = 'soon';
  return { last, since, gap, due, pc, target, state, dones, dormant };
}
function stripCells(r, dones, n = 12) {
  const t = D.today(), weekly = (r.mode === 'freq' && r.per === 'semaine') || (r.mode === 'interval' && (r.unit === 'jour' || r.unit === 'semaine'));
  const target = r.mode === 'freq' && (r.per === 'semaine' || r.per === 'mois') ? r.n : 1, cells = [];
  for (let i = n - 1; i >= 0; i--) {
    let from, to;
    if (weekly) { from = D.add(D.monday(t), -7 * i); to = D.add(from, 6); }
    else { from = D.monthStart(D.addMonths(D.monthStart(t), -i)); to = D.add(D.addMonths(from, 1), -1); }
    const c = dones.filter(x => x >= from && x <= to).length;
    cells.push({ from, to, c, o: c ? Math.max(.4, Math.min(1, c / target)) : 0, cur: i === 0, weekly });
  }
  return cells;
}

/* ---------- séries : ☀ réussite / 🌙 échec ---------- */
const SERIES_MIN = 2; // une série ne s'affiche qu'à partir de 2 périodes de suite
function seriesGran(r) {
  if (r.mode === 'freq') return r.per === 'semaine' ? 'week' : r.per === 'mois' ? 'month' : 'year';
  const days = r.unit === 'jour' ? r.n : r.unit === 'semaine' ? 7 * r.n : r.unit === 'mois' ? 30 * r.n : 365 * r.n;
  return days <= 21 ? 'week' : 'month';
}
function seriesCells(gran, t, n) {
  const cells = [], y = D.parse(t).getFullYear();
  for (let i = n - 1; i >= 0; i--) {
    if (gran === 'week') { const from = D.add(D.monday(t), -7 * i); cells.push({ from, to: D.add(from, 6) }); }
    else if (gran === 'month') { const from = D.monthStart(D.addMonths(D.monthStart(t), -i)); cells.push({ from, to: D.add(D.addMonths(from, 1), -1) }); }
    else cells.push({ from: `${y - i}-01-01`, to: `${y - i}-12-31` });
  }
  return cells;
}
/* Une période est « réussie » si la règle est respectée à sa fin, « ratée » sinon.
   Hors saison, avant la création et périodes « passées » (skip) sont neutres : elles ne cassent rien. */
function rSeries(r, dones) {
  if (r.paused) return null;
  const t = D.today(), gran = seriesGran(r), N = gran === 'week' ? 104 : gran === 'month' ? 60 : 10;
  const cells = seriesCells(gran, t, N), start = r.createdAt || t, skips = r.skips || [];
  const res = cells.map((c, idx) => {
    if (c.to < start) return 'na';
    if (gran !== 'year' && r.months.length < 12 && !r.months.includes(D.parse(c.to).getMonth() + 1)) return 'off';
    const mid = c.to < t ? c.to : t;
    let ok;
    if (r.mode === 'freq') ok = dones.filter(x => x >= c.from && x <= c.to).length >= r.n;
    else {
      const prev = dones.filter(x => x <= mid), ref = prev.length ? prev[prev.length - 1] : start;
      const due = r.unit === 'jour' ? D.add(ref, r.n) : r.unit === 'semaine' ? D.add(ref, 7 * r.n) : D.addMonths(ref, r.unit === 'mois' ? r.n : 12 * r.n);
      ok = mid <= due;
    }
    if (ok) return 'ok';
    if (skips.some(s => s >= c.from && s <= c.to)) return 'skip';
    return idx === N - 1 ? 'open' : 'fail'; // la période en cours n'est pas encore un échec
  });
  const seq = [];
  for (let i = res.length - 1; i >= 0; i--) { if (res[i] === 'ok' || res[i] === 'fail') seq.push(res[i]); else if (res[i] === 'na') break; }
  if (!seq.length) return { kind: null, count: 0, gran };
  let count = 0; for (const v of seq) { if (v === seq[0]) count++; else break; }
  return { kind: seq[0], count, gran };
}
const GRAN_LABEL = { week: ['semaine', 'semaines'], month: ['mois', 'mois'], year: ['an', 'ans'] };
function seriesText(s) {
  if (!s || !s.kind || s.count < SERIES_MIN) return '';
  const u = GRAN_LABEL[s.gran][s.count > 1 ? 1 : 0];
  return s.kind === 'ok' ? `${s.count} ${u} de suite dans les clous` : `${s.count} ${u} de suite sans réaliser la routine`;
}
