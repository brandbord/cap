'use strict';
/* =====================================================================
   SUIVIS : ce que je fais vraiment (sport, sessions de travail...)
   Données : db.trackCats (catégories + objectif hebdo), db.trackTypes (types de séance = mots-clés
   + mesures), db.logs (séances). Tout passe par la même synchro que Cap.
   ===================================================================== */
const MEASURES = {
  sets: { label: 'Séries', unit: '' }, reps: { label: 'Répétitions', unit: 'reps' }, weight: { label: 'Poids', unit: 'kg' },
  duration: { label: 'Durée', unit: 'min' }, distance: { label: 'Distance', unit: 'km' },
};
const GOAL_KINDS = { days: 'jours actifs / semaine', sessions: 'séances / semaine', minutes: 'temps / semaine' };
/* Couleurs de catégories validées (contraste, daltonisme) en clair ; variantes pour le mode sombre */
const DARK_MAP = { '#cf6a3f': '#d9714a', '#4f7fb8': '#5f92d6', '#b58519': '#b28628' };
const DEFAULT_CATS = [
  { id: 'c-sport', name: 'Sport', color: '#cf6a3f', goalKind: 'days', goal: 3, routineId: null },
  { id: 'c-sdk', name: 'Projet SDK', color: '#4f7fb8', goalKind: 'minutes', goal: 240, routineId: null },
  { id: 'c-aurum', name: 'Projet Aurum', color: '#b58519', goalKind: 'minutes', goal: 300, routineId: null },
];
const DEFAULT_TYPES = [
  { id: 't-pompes', catId: 'c-sport', name: 'Pompes', keywords: 'pushup push', measures: ['sets', 'reps'] },
  { id: 't-tractions', catId: 'c-sport', name: 'Tractions', keywords: 'pullup', measures: ['sets', 'reps', 'weight'] },
  { id: 't-gainage', catId: 'c-sport', name: 'Gainage', keywords: 'planche', measures: ['duration'] },
  { id: 't-course', catId: 'c-sport', name: 'Course', keywords: 'running footing', measures: ['distance', 'duration'] },
  { id: 't-sdk', catId: 'c-sdk', name: 'Session de travail', keywords: 'sdk code dev', measures: ['duration'] },
  { id: 't-au-design', catId: 'c-aurum', name: 'Session design', keywords: 'aurum', measures: ['duration'] },
  { id: 't-au-histoire', catId: 'c-aurum', name: 'Session histoire', keywords: 'aurum scenario', measures: ['duration'] },
  { id: 't-au-vibe', catId: 'c-aurum', name: 'Session vibe coding', keywords: 'aurum code', measures: ['duration'] },
];

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const tcat = id => byId(db.trackCats, id), ttype = id => byId(db.trackTypes, id);
const catColor = c => (c ? (isDark() ? DARK_MAP[c.color] || c.color : c.color) : '#8a8073');
const logType = l => ttype(l.typeId), logCat = l => { const t = ttype(l.typeId); return t ? tcat(t.catId) : null; };
const hmin = m => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`; };
const nf = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR');

/* Crée une seule fois (ids fixes = fusion idempotente entre appareils) les catégories de départ */
function ensureTrackDefaults() {
  if (db.meta.trackInit) return;
  const mine = hub.profile === 'brandon' ? null : new Set(['c-sport']); // les projets SDK / Aurum sont ceux de Brandon : les autres profils partent du sport seulement
  DEFAULT_CATS.filter(c => !mine || mine.has(c.id)).forEach(c => { if (!tcat(c.id)) db.trackCats.push({ ...c }); });
  DEFAULT_TYPES.filter(t => !mine || mine.has(t.catId)).forEach(t => { if (!ttype(t.id)) db.trackTypes.push({ ...t }); });
  const sp = db.routines.find(r => /sport/i.test(r.title)), c = tcat('c-sport');
  if (sp && c && !c.routineId) c.routineId = sp.id;
  db.meta.trackInit = true; save();
}

/* ---------- saisie rapide : « trac 3x8 », « design 1h30 hier », « course 5km 28min » ---------- */
function matchTypes(q) {
  const n = norm(q); if (!n) return [];
  const recent = {}; db.logs.forEach(l => { if (!recent[l.typeId] || l.date > recent[l.typeId]) recent[l.typeId] = l.date; });
  return db.trackTypes.map(t => {
    const name = norm(t.name), hay = `${name} ${norm(t.keywords)}`, words = hay.split(/\s+/);
    const sc = name.startsWith(n) ? 3 : words.some(w => w.startsWith(n)) ? 2 : hay.includes(n) ? 1 : 0;
    return { t, sc, r: recent[t.id] || '' };
  }).filter(x => x.sc).sort((a, b) => b.sc - a.sc || b.r.localeCompare(a.r)).map(x => x.t);
}
function parseMeasures(rest, type) {
  let s = ' ' + norm(rest).replace(',', '.') + ' ', date = D.today();
  if (/\bavant-hier\b/.test(s)) { date = D.add(date, -2); s = s.replace(/\bavant-hier\b/, ' '); }
  else if (/\bhier\b/.test(s)) { date = D.add(date, -1); s = s.replace(/\bhier\b/, ' '); }
  const dm = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (dm) { const y = new Date().getFullYear(); date = `${y}-${pad(+dm[2])}-${pad(+dm[1])}`; if (date > D.today()) date = `${y - 1}-${pad(+dm[2])}-${pad(+dm[1])}`; s = s.replace(dm[0], ' '); }
  const v = {}, take = (re, fn) => { s = s.replace(re, (...m) => { fn(...m.slice(1)); return ' '; }); };
  take(/(\d+)\s*[x*×]\s*(\d+)/, (a, b) => { v.sets = +a; v.reps = +b; });
  take(/(\d+(?:\.\d+)?)\s*km/, a => { v.distance = +a; });
  take(/(\d+(?:\.\d+)?)\s*kg/, a => { v.weight = +a; });
  take(/(\d+)\s*h\s*(\d+)?/, (h, m) => { v.duration = +h * 60 + (+m || 0); });
  take(/(\d+)\s*(?:min|mn|')/, m => { v.duration = +m; });
  const nums = s.match(/\d+(?:\.\d+)?/g) || [];
  const free = ['reps', 'duration', 'distance', 'weight'].filter(m => (type?.measures || []).includes(m) && !(m in v));
  nums.forEach((n, i) => { if (free[i]) v[free[i]] = +n; });
  return { v, date };
}
function parseQuick(str) {
  const toks = str.trim().split(/\s+/).filter(Boolean), i = toks.findIndex(t => /^\d|^hier$|^avant-hier$/i.test(t));
  const q = (i < 0 ? toks : toks.slice(0, i)).join(' '), rest = i < 0 ? '' : toks.slice(i).join(' ');
  const cands = matchTypes(q), type = cands[0] || null;
  return { q, rest, cands, type, ...(type ? parseMeasures(rest, type) : { v: {}, date: D.today() }) };
}
const fmtLog = (l, t = logType(l)) => {
  const p = [];
  if (l.sets && l.reps) p.push(`${l.sets} × ${l.reps}`); else if (l.reps) p.push(`${l.reps} reps`);
  if (l.weight) p.push(`${nf(l.weight)} kg`);
  if (l.distance) p.push(`${nf(l.distance)} km`);
  if (l.duration) p.push(hmin(l.duration));
  return p.join(' · ') || 'fait';
};

/* ---------- écriture (avec pont vers les routines) ---------- */
function bridgeSync(catId, date) {
  const c = tcat(catId); if (!c || !c.routineId || !byId(db.routines, c.routineId)) return;
  const has = db.logs.some(l => l.date === date && logCat(l)?.id === catId);
  const acts = db.activities.filter(x => x.fromLog && x.routineId === c.routineId && x.date === date);
  if (has && !acts.length) { newActivity({ type: 'fait', routineId: c.routineId, date, text: 'via Suivis', fromLog: true }); byId(db.routines, c.routineId).snoozeUntil = null; }
  if (!has) acts.forEach(x => db.activities.splice(db.activities.indexOf(x), 1));
}
function addLog(o) {
  const l = { id: uid(), typeId: o.typeId, date: o.date || D.today(), note: o.note || '', createdAt: D.today() };
  ['duration', 'reps', 'sets', 'weight', 'distance'].forEach(k => { if (o[k] != null && o[k] !== '' && !isNaN(o[k])) l[k] = +o[k]; });
  if (o.demo) l.demo = true;
  db.logs.push(l); if (!l.demo) bridgeSync(logCat(l)?.id, l.date); // les exemples ne doivent jamais toucher tes vraies routines
  return l;
}
function updateLog(id, patch) {
  const l = byId(db.logs, id), before = [logCat(l)?.id, l.date];
  Object.assign(l, patch);
  ['duration', 'reps', 'sets', 'weight', 'distance'].forEach(k => { if (l[k] == null || l[k] === '' || isNaN(l[k])) delete l[k]; });
  bridgeSync(before[0], before[1]); bridgeSync(logCat(l)?.id, l.date);
}
function removeLog(id) {
  const l = byId(db.logs, id), cid = logCat(l)?.id, d = l.date;
  db.logs.splice(db.logs.indexOf(l), 1); bridgeSync(cid, d);
}

/* ---------- agrégats ---------- */
const logsOf = (f = {}) => db.logs.filter(l => (!f.catId || logCat(l)?.id === f.catId) && (!f.typeId || l.typeId === f.typeId) && (!f.from || l.date >= f.from) && (!f.to || l.date <= f.to));
function catWeek(c, mon) {
  const ls = logsOf({ catId: c.id, from: mon, to: D.add(mon, 6) });
  const days = new Set(ls.map(l => l.date)).size, minutes = ls.reduce((s, l) => s + (l.duration || 0), 0);
  return { ls, days, minutes, sessions: ls.length, value: c.goalKind === 'days' ? days : c.goalKind === 'sessions' ? ls.length : minutes };
}
const fmtGoal = (c, v) => (c.goalKind === 'minutes' ? hmin(v) : c.goalKind === 'days' ? `${v} j` : `${v} séance${v > 1 ? 's' : ''}`);
/* « ai-je du retard sur mon objectif ? » : 0 = ok/atteint, 1 = à surveiller, 2 = en retard */
function paceState(c, w) {
  if (!c.goal) return 0;
  if (w.value >= c.goal) return 0;
  const daysLeft = 7 - ((D.parse(D.today()).getDay() + 6) % 7), left = c.goal - w.value; // aujourd'hui inclus
  const perDay = c.goalKind === 'minutes' ? 90 : 1; // ce qu'on peut raisonnablement faire en un jour
  return left > daysLeft * perDay ? 2 : left > daysLeft * perDay * 0.6 && daysLeft <= 4 ? 1 : 0;
}
function catSeries(c) {
  const t = D.today(), cur = D.monday(t), first = logsOf({ catId: c.id }).map(l => l.date).sort()[0];
  if (!first) return null;
  const seq = [];
  for (let m = cur; m >= D.monday(first); m = D.add(m, -7)) {
    const w = catWeek(c, m), ok = c.goal ? w.value >= c.goal : w.sessions >= 1;
    if (ok) seq.push('ok'); else if (m !== cur) seq.push('fail');
  }
  if (!seq.length) return null;
  let count = 0; for (const v of seq) { if (v === seq[0]) count++; else break; }
  return { kind: seq[0], count, gran: 'week' };
}
const trackBadge = c => { const s = catSeries(c), tx = seriesText(s);
  return tx ? `<span class="ser ${s.kind === 'ok' ? 'sun' : 'moon'}" title="${tx}">${ic(s.kind === 'ok' ? 'sun' : 'moon', 13)}${s.count}</span>` : ''; };

/* Métriques disponibles pour une portée (catégorie / type) */
const METRICS = {
  days: { label: 'Jours actifs', bar: true, val: ls => new Set(ls.map(l => l.date)).size, fmt: v => `${v} j` },
  sessions: { label: 'Entrées', bar: true, val: ls => ls.length, fmt: v => `${v}` },
  minutes: { label: 'Temps', bar: true, val: ls => ls.reduce((s, l) => s + (l.duration || 0), 0), fmt: v => hmin(v), has: l => l.duration },
  volume: { label: 'Répétitions totales', bar: true, val: ls => ls.reduce((s, l) => s + (l.reps ? (l.sets || 1) * l.reps : 0), 0), fmt: v => `${v} reps`, has: l => l.reps },
  maxreps: { label: 'Meilleure série (reps)', bar: false, val: ls => Math.max(0, ...ls.map(l => l.reps || 0)) || null, fmt: v => `${v} reps`, has: l => l.reps },
  maxweight: { label: 'Poids max', bar: false, val: ls => Math.max(0, ...ls.map(l => l.weight || 0)) || null, fmt: v => `${nf(v)} kg`, has: l => l.weight },
  distance: { label: 'Distance', bar: true, val: ls => ls.reduce((s, l) => s + (l.distance || 0), 0), fmt: v => `${nf(v)} km`, has: l => l.distance },
};
const metricsFor = scope => { const ls = logsOf(scope); return Object.keys(METRICS).filter(k => !METRICS[k].has || ls.some(METRICS[k].has)); };
function weekly(scope, metric, n) {
  const cur = D.monday(D.today()), out = [], M = METRICS[metric];
  for (let i = n - 1; i >= 0; i--) {
    const from = D.add(cur, -7 * i), to = D.add(from, 6), ls = logsOf({ ...scope, from, to });
    out.push({ from, to, value: M.bar ? M.val(ls) : (ls.length ? M.val(ls) : null), n: ls.length, cur: i === 0 });
  }
  return out;
}
/* Records personnels par type */
function records(scope = {}) {
  const out = [], now = D.monday(D.today());
  db.trackTypes.filter(t => (!scope.catId || t.catId === scope.catId) && (!scope.typeId || t.id === scope.typeId)).forEach(t => {
    const ls = logsOf({ typeId: t.id }); if (!ls.length) return;
    const best = (label, f, fmt) => {
      let b = null, prev = 0;
      ls.forEach(l => { const v = f(l); if (v > 0 && (!b || v > b.v)) b = { v, date: l.date }; if (v > 0 && l.date < now && v > prev) prev = v; });
      if (b) out.push({ t, label, v: b.v, text: fmt(b.v), date: b.date, fresh: b.date >= now && prev > 0 && b.v > prev });
    };
    if (t.measures.includes('reps')) { best('Meilleure série', l => l.reps || 0, v => `${v} reps`); best('Volume d\'une séance', l => (l.reps ? (l.sets || 1) * l.reps : 0), v => `${v} reps`); }
    if (t.measures.includes('weight')) best('Poids max', l => l.weight || 0, v => `${nf(v)} kg`);
    if (t.measures.includes('distance')) best('Plus longue distance', l => l.distance || 0, v => `${nf(v)} km`);
    if (t.measures.includes('duration')) best('Plus longue durée', l => l.duration || 0, v => hmin(v));
  });
  return out;
}
const recordsThisWeek = () => records().filter(r => r.fresh);

/* ---------- séances d'exemple (une seule fois, sur demande) ---------- */
function seedDemoLogs() {
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cur = D.monday(D.today()), N = 14;
  for (let w = N - 1; w >= 0; w--) {
    const mon = D.add(cur, -7 * w), p = (N - 1 - w) / (N - 1);
    const day = k => D.add(mon, k), ok = d => d <= D.today();
    const sportDays = w === 6 || w === 5 ? [1] : [0, 2, 4].concat(rnd() > .6 ? [5] : []);
    sportDays.forEach((k, i) => { if (!ok(day(k))) return;
      addLog({ typeId: 't-pompes', date: day(k), sets: 3, reps: Math.round(14 + p * 12 + rnd() * 2), demo: true });
      if (i % 2 === 0) addLog({ typeId: 't-tractions', date: day(k), sets: 3, reps: Math.round(4 + p * 5 + rnd()), weight: p > .6 ? 5 : 0, demo: true });
      if (i === 1) addLog({ typeId: 't-course', date: day(k), distance: Math.round((3 + p * 3 + rnd()) * 10) / 10, duration: Math.round(20 + p * 12), demo: true }); });
    [0, 1, 3, 4].forEach(k => { if (ok(day(k)) && rnd() > .25) addLog({ typeId: 't-sdk', date: day(k), duration: Math.round((50 + rnd() * 90) / 5) * 5, demo: true }); });
    [1, 3, 5, 6].forEach(k => { if (ok(day(k)) && rnd() > .45) addLog({ typeId: ['t-au-design', 't-au-histoire', 't-au-vibe'][Math.floor(rnd() * 3)], date: day(k), duration: Math.round((40 + rnd() * 100) / 5) * 5, demo: true }); });
  }
}
