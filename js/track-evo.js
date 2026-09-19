'use strict';
/* =====================================================================
   SUIVIS · ÉVOLUTION : UNE statistique à la fois, parmi celles qui ont du sens pour la sélection.
   Une mesure = (valeur d'une entrée) + (façon d'agréger : somme, maximum, moyenne).
   ===================================================================== */
const repsFmt = v => `${nf(v, 0)} reps`;
const paceFmt = v => `${Math.floor(v)}'${String(Math.round((v % 1) * 60) % 60).padStart(2, '0')}/km`;
const EM = {
  // Musculation / répétitions : une seule sorte d'exercice à la fois (comparer des pompes et des tractions n'a pas de sens)
  total_reps: { label: 'Répétitions totales', hint: 'séries × répétitions : 3 × 12 = 36', kind: 'sum', single: true, of: l => (l.reps ? (l.sets || 1) * l.reps : null), fmt: repsFmt },
  best_set: { label: 'Meilleure série', hint: 'le plus de répétitions d\'un coup', kind: 'max', single: true, of: l => l.reps || null, fmt: repsFmt },
  avg_set: { label: 'Reps par série (moyenne)', hint: 'la taille habituelle de tes séries', kind: 'avg', single: true, of: l => l.reps || null, fmt: v => `${nf(v, 1)} reps` },
  sets: { label: 'Nombre de séries', hint: 'combien de séries au total', kind: 'sum', single: true, of: l => (l.reps ? (l.sets || 1) : null), fmt: v => `${nf(v, 0)} séries` },
  sets_per: { label: 'Séries par séance', hint: 'ton volume de travail habituel', kind: 'avg', single: true, of: l => (l.reps ? (l.sets || 1) : null), fmt: v => `${nf(v, 1)} séries` },
  load: { label: 'Charge soulevée', hint: 'poids × répétitions × séries', kind: 'sum', single: true, of: l => (l.weight && l.reps ? l.weight * l.reps * (l.sets || 1) : null), fmt: v => `${nf(v, 0)} kg` },
  max_weight: { label: 'Poids max', hint: 'la charge la plus lourde', kind: 'max', single: true, of: l => l.weight || null, fmt: v => `${nf(v)} kg` },
  e1rm: { label: 'Force estimée (1RM)', hint: 'poids × (1 + reps ÷ 30) : ta charge maximale théorique', kind: 'max', single: true, of: l => (l.weight && l.reps ? l.weight * (1 + l.reps / 30) : null), fmt: v => `${nf(v)} kg` },
  // Temps et distance : valables pour n'importe quel type
  minutes: { label: 'Temps total', hint: 'somme des durées notées', kind: 'sum', of: l => l.duration || null, fmt: v => hmin(v), tick: v => hmin(v) },
  longest: { label: 'Plus longue durée', hint: 'ta plus longue séance', kind: 'max', of: l => l.duration || null, fmt: v => hmin(v), tick: v => hmin(v) },
  avg_min: { label: 'Durée moyenne', hint: 'durée habituelle d\'une séance', kind: 'avg', of: l => l.duration || null, fmt: v => hmin(v), tick: v => hmin(v) },
  distance: { label: 'Distance totale', hint: 'somme des kilomètres', kind: 'sum', single: true, of: l => l.distance || null, fmt: v => `${nf(v)} km` },
  longest_dist: { label: 'Plus longue distance', hint: 'ta plus longue sortie', kind: 'max', single: true, of: l => l.distance || null, fmt: v => `${nf(v)} km` },
  pace: { label: 'Allure moyenne', hint: 'minutes par kilomètre (plus bas = plus rapide)', kind: 'avg', single: true, lowerBetter: true, of: l => (l.distance && l.duration ? l.duration / l.distance : null), fmt: paceFmt },
  // Régularité : pour tout le monde
  days: { label: 'Jours actifs', hint: 'jours où tu as noté quelque chose', kind: 'days', of: () => 1, fmt: v => `${v} j` },
  entries: { label: 'Nombre d\'entrées', hint: 'combien de fois tu as noté', kind: 'count', of: () => 1, fmt: v => `${v}` },
};
const KIND_WORD = { sum: 'Total', max: 'Record', avg: 'Moyenne', days: 'Total', count: 'Total' };
const GRAN = { day: ['Par séance', 'séance', 'Séance du'], week: ['Par semaine', 'semaine', 'Sem. du'], month: ['Par mois', 'mois', ''] };

/* Statistiques disponibles : celles pour lesquelles au moins une entrée a la donnée ; sans type choisi, seules les mesures comparables entre types */
function evoMetrics(scope) {
  const ls = logsOf(scope), multi = !scope.typeId;
  return Object.keys(EM).filter(k => (!multi || !EM[k].single) && (k === 'days' || k === 'entries' ? ls.length > 0 : ls.some(l => EM[k].of(l) != null)));
}
/* Valeur d'un ensemble d'entrées pour une mesure (null s'il n'y a rien à mesurer) */
function evoValue(m, ls) {
  const M = EM[m];
  if (M.kind === 'days') return new Set(ls.map(l => l.date)).size || null;
  if (M.kind === 'count') return ls.length || null;
  const v = ls.map(M.of).filter(x => x != null);
  if (!v.length) return null;
  return M.kind === 'sum' ? v.reduce((a, b) => a + b, 0) : M.kind === 'max' ? Math.max(...v) : v.reduce((a, b) => a + b, 0) / v.length;
}
/* Découpe en séances (jours), semaines ou mois. Les périodes sans donnée valent 0 pour les sommes, « vide » pour les records et moyennes. */
function evoBuckets(scope, m, gran, weeks) {
  const M = EM[m], t = D.today(), from = D.add(D.monday(t), -7 * (weeks - 1)), ls = logsOf({ ...scope, from }).sort((a, b) => a.date.localeCompare(b.date));
  const zero = M.kind === 'sum' || M.kind === 'days' || M.kind === 'count', out = [];
  const push = (key, from, to, label, tip, cur) => { const g = ls.filter(l => l.date >= from && l.date <= to), v = evoValue(m, g); out.push({ key, from, to, label, tip, cur, n: g.length, value: v == null && zero ? 0 : v }); };
  if (gran === 'day') {
    [...new Set(ls.map(l => l.date))].forEach(d => push(d, d, d, fmtDay(d), `Séance du ${fmtDay(d)}`, d === t));
  } else if (gran === 'month') {
    for (let s = D.monthStart(from); s <= t; s = D.monthStart(D.addMonths(s, 1))) {
      const e = D.add(D.addMonths(s, 1), -1), dt = D.parse(s);
      push(s, s, e, MONTHS[dt.getMonth()] + (dt.getMonth() === 0 ? ' ' + dt.getFullYear() : ''), dt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), s === D.monthStart(t));
    }
  } else {
    for (let s = from; s <= t; s = D.add(s, 7)) push(s, s, D.add(s, 6), fmtDay(s), `Sem. du ${fmtDay(s)}`, s === D.monday(t));
  }
  return out;
}
/* Cumul (uniquement pour les sommes) */
function evoCumulative(data) { let run = 0; return data.map(d => ({ ...d, value: (run += d.value || 0) })); }

/* Bilan de la période et comparaison avec la période précédente de même durée */
function evoSummary(scope, m, weeks) {
  const M = EM[m], t = D.today(), from = D.add(D.monday(t), -7 * (weeks - 1)), pf = D.add(from, -7 * weeks), pt = D.add(from, -1);
  const cur = evoValue(m, logsOf({ ...scope, from })), prev = evoValue(m, logsOf({ ...scope, from: pf, to: pt }));
  let delta = null;
  if (cur != null && prev != null && prev > 0) delta = (cur - prev) / prev * 100;
  const good = delta == null || Math.abs(delta) < 0.5 ? 0 : ((delta > 0) !== !!M.lowerBetter ? 1 : -1);
  return { cur, prev, delta, good };
}
/* Le type le plus travaillé récemment : point de départ intelligent de l'onglet */
function topType(weeks = 12) {
  const from = D.add(D.monday(D.today()), -7 * (weeks - 1)), n = {};
  logsOf({ from }).forEach(l => { n[l.typeId] = (n[l.typeId] || 0) + 1; });
  const id = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
  return id && ttype(id) ? ttype(id) : null;
}
function defaultEvoMetric(scope, mets) {
  const t = scope.typeId && ttype(scope.typeId), pref = t
    ? [t.measures.includes('reps') ? 'total_reps' : null, t.measures.includes('distance') ? 'distance' : null, t.measures.includes('duration') ? 'minutes' : null, 'days']
    : ['minutes', 'days'];
  return pref.find(m => m && mets.includes(m)) || mets[0] || 'days';
}
