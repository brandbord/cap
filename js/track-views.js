'use strict';
/* ================= SUIVIS : aperçu, saisie rapide, chrono ================= */
ui.app = 'cap';
ui.trk = { cat: null, type: null, weeks: 12, metric: null, table: false, jlimit: 45, jcat: null, jq: '' };
const TRACK_VIEWS = ['tdash', 'tjournal', 'tstats', 'tevo'];
const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f6f57';
const daysLeftInWeek = () => 7 - ((D.parse(D.today()).getDay() + 6) % 7);
const hasDemo = () => db.logs.some(l => l.demo);
const dayLabel = d => { const n = D.diff(D.today(), d); return n === 0 ? "Aujourd'hui" : n === 1 ? 'Hier' : fmtShort(d); };

/* ---------- chrono (propre à l'appareil) ---------- */
const timerKey = () => 'cap.timer.' + (hub.profile || '');
const timerGet = () => { try { return JSON.parse(localStorage.getItem(timerKey())); } catch (e) { return null; } };
const timerSet = v => { try { if (v) localStorage.setItem(timerKey(), JSON.stringify(v)); else localStorage.removeItem(timerKey()); } catch (e) { /* ignore */ } };
const clock = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
setInterval(() => { const t = timerGet(), el = document.querySelector('.timerv'); if (t && el) el.textContent = clock(Date.now() - t.start); }, 1000);
function timerStop() {
  const t = timerGet(); if (!t) return; timerSet(null);
  const min = Math.max(1, Math.round((Date.now() - t.start) / 60000));
  mutate(() => { addLog({ typeId: t.typeId, duration: min }); }, `Session de ${hmin(min)} enregistrée ✓`);
}
function timerHtml() {
  const t = timerGet(), ty = t && ttype(t.typeId);
  if (t && ty) {
    const c = tcat(ty.catId);
    return `<div class="tcard timer running" style="--c:${catColor(c)}"><div class="th"><span class="dot"></span>Session en cours · ${esc(ty.name)}</div>
      <div class="timerv">${clock(Date.now() - t.start)}</div><div class="tf"><button class="btn primary" data-do="timerStop">${ic('stop', 15)}Arrêter et noter</button>
      <button class="btn" data-do="timerCancel">Annuler</button></div></div>`;
  }
  const dur = db.trackTypes.filter(x => x.measures.length === 1 && x.measures[0] === 'duration');
  if (!dur.length) return '';
  return `<div class="tcard timer"><div class="th">${ic('timer', 15)}Chrono <span class="muted">une session de travail, sans y penser</span></div>
    <div class="tf" style="flex-wrap:wrap">${dur.map(x => `<button class="chip" data-do="timerStart" data-id="${x.id}"><span class="dot" style="--c:${catColor(tcat(x.catId))}"></span>${ic('play', 12)} ${esc(x.name)}</button>`).join('')}</div></div>`;
}

/* ---------- saisie rapide ---------- */
function qlogPreview(val) {
  const box = document.getElementById('qprev'); if (!box) return;
  const recent = [...new Map(db.logs.slice().sort((a, b) => b.date.localeCompare(a.date)).map(l => [l.typeId, l])).keys()].slice(0, 6).map(ttype).filter(Boolean);
  const chip = t => `<button class="chip" data-do="qpick" data-id="${t.id}"><span class="dot" style="--c:${catColor(tcat(t.catId))}"></span>${esc(t.name)}</button>`;
  if (!val.trim()) { box.innerHTML = `<span class="muted">Tape un type, puis ce que tu as fait : </span><em>trac 3x8</em> · <em>design 1h30</em> · <em>course 5km 28min</em> · <em>pompes 25 hier</em> `; return; }
  const p = parseQuick(val);
  if (!p.type) { box.innerHTML = `<span class="muted">Aucun type ne correspond à « ${esc(p.q)} ».</span> <button class="lnk" data-do="nav" data-view="settings">Créer un type dans les Réglages</button>`; return; }
  const t = p.type, c = tcat(t.catId), mm = Object.keys(p.v).length;
  const txt = fmtLog({ ...p.v });
  box.innerHTML = `<span class="qok"><span class="dot" style="--c:${catColor(c)}"></span><b>${esc(t.name)}</b> <span class="muted">${esc(c?.name || '')}</span> · ${mm ? esc(txt) : '<span class="muted">rien de mesuré</span>'} · <span class="muted">${dayLabel(p.date)}</span></span>
    ${!mm && t.measures.length ? `<span class="hint" style="display:inline"> Ajoute par ex. ${t.measures.includes('sets') ? '3x8' : t.measures.includes('duration') ? '45min' : t.measures.includes('distance') ? '5km' : '20'}</span>` : ''}
    ${p.cands.length > 1 ? `<div class="qch"><span class="muted">ou :</span>${p.cands.slice(1, 5).map(chip).join('')}</div>` : ''}`;
}
function qlogSubmit() {
  const inp = document.getElementById('qlog'); if (!inp || !inp.value.trim()) return;
  const p = parseQuick(inp.value);
  if (!p.type) return toast('Aucun type reconnu : tape le début du nom (ex. « trac »)');
  if (p.type.measures.length && !Object.keys(p.v).length) return toast(`Ajoute une mesure pour « ${p.type.name} » (ex. ${p.type.measures.includes('sets') ? '3x8' : '45min'})`);
  mutate(() => { addLog({ typeId: p.type.id, date: p.date, ...p.v }); }, `${p.type.name} noté ✓`);
}

/* ---------- carte d'une catégorie (objectif de la semaine) ---------- */
function catCard(c) {
  const mon = D.monday(D.today()), w = catWeek(c, mon), col = catColor(c);
  const prev = [7, 6, 5, 4, 3, 2, 1, 0].map(i => catWeek(c, D.add(mon, -7 * i)).value);
  const pct = c.goal ? w.value / c.goal : 0, done = c.goal && w.value >= c.goal, ps = paceState(c, w), left = c.goal ? c.goal - w.value : 0, dl = daysLeftInWeek();
  const line = !c.goal ? `<button class="lnk" data-do="nav" data-view="settings">Fixer un objectif</button>`
    : done ? `<span class="ok">${ic('check', 13)} Objectif atteint, bien joué</span>`
    : ps === 2 ? `<span class="late">${ic('clock', 13)} Il reste ${fmtGoal(c, left)} en ${dl} jour${dl > 1 ? 's' : ''} : c'est chaud</span>`
    : ps === 1 ? `<span class="warn">${ic('clock', 13)} À surveiller : encore ${fmtGoal(c, left)} d'ici dimanche</span>`
    : `<span class="muted">Encore ${fmtGoal(c, left)} d'ici dimanche</span>`;
  const big = !c.goal ? w.sessions : c.goalKind === 'minutes' ? hmin(w.value).replace(' ', '') : w.value;
  return `<div class="tcard" style="--c:${col}"><div class="th"><span class="dot" style="--c:${col}"></span>${esc(c.name)} ${trackBadge(c)}<span class="sp"></span>
      <button class="iconbtn" data-do="tlogCat" data-id="${c.id}" title="Ajouter une séance">${ic('plus', 16)}</button></div>
    <div class="tb">${ringHtml({ pct, color: col, size: 88, stroke: 8, big, small: c.goal ? `/ ${c.goalKind === 'minutes' ? hmin(c.goal).replace(' ', '') : c.goal}` : 'cette sem.', done })}
      <div class="tt2"><div class="lbl">${c.goal ? GOAL_KINDS[c.goalKind] : 'cette semaine'}</div>${line}<div class="sparkrow">${sparkSvg(prev, col)}<span class="muted">8 semaines</span></div></div></div></div>`;
}
function recordsHtml(scope = {}, limit = 6) {
  const rs = records(scope).sort((a, b) => (b.fresh - a.fresh) || b.date.localeCompare(a.date)).slice(0, limit);
  if (!rs.length) return '<div class="muted" style="padding:14px 16px">Tes records apparaîtront ici dès les premières séances.</div>';
  return rs.map(r => `<div class="rec"><span class="dot" style="--c:${catColor(tcat(r.t.catId))}"></span><div class="rn"><b>${esc(r.t.name)}</b><small>${r.label} · ${fmtDay(r.date)}</small></div>
    ${r.fresh ? `<span class="new">${ic('trophy', 13)} record</span>` : ''}<span class="rv">${r.text}</span></div>`).join('');
}
function lastLogsHtml(n = 8, cat = null, typeId = null) {
  const ls = logsOf({ catId: cat, typeId }).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, n);
  if (!ls.length) return '<div class="muted" style="padding:14px 16px">Aucune séance pour l\'instant.</div>';
  return ls.map(l => { const t = logType(l), c = logCat(l);
    return `<div class="jrow" data-do="logEdit" data-id="${l.id}"><span class="dot" style="--c:${catColor(c)}"></span><div class="jn"><b>${esc(t?.name || 'Type supprimé')}</b><small>${dayLabel(l.date)}${l.note ? ' · ' + esc(l.note) : ''}</small></div><span class="jv">${esc(fmtLog(l))}</span></div>`; }).join('');
}
function shareHtml(days) {
  const from = D.add(D.today(), -(days - 1)), rows = db.trackCats.map(c => { const ls = logsOf({ catId: c.id, from }); return { c, min: ls.reduce((s, l) => s + (l.duration || 0), 0), n: ls.length, days: new Set(ls.map(l => l.date)).size }; }).filter(r => r.n);
  if (!rows.length) return '<div class="muted" style="padding:14px 16px">Rien sur cette période.</div>';
  // on compare des jours actifs : c'est la seule mesure que toutes les catégories ont (le sport n'a pas toujours de durée)
  const val = r => r.days, max = Math.max(1, ...rows.map(val));
  return `<div style="padding:8px 16px 14px">${rows.sort((a, b) => val(b) - val(a)).map(r => `<div class="brow" style="grid-template-columns:110px 1fr 96px"><div class="bl"><span class="dot" style="--c:${catColor(r.c)}"></span>${esc(r.c.name)}</div>
    <div class="bbar"><i style="width:${Math.round(100 * val(r) / max)}%;background:${catColor(r.c)}"></i></div><div class="bv"><b>${r.days} j actif${r.days > 1 ? 's' : ''}</b><small>${r.min ? hmin(r.min) + ' notées' : r.n + ' entrée' + (r.n > 1 ? 's' : '')}</small></div></div>`).join('')}</div>`;
}
function heatCounts(scope) { const m = new Map(); logsOf(scope).forEach(l => m.set(l.date, (m.get(l.date) || 0) + 1)); return m; }
const heatWeeks = () => (matchMedia('(max-width:760px)').matches ? 26 : 52);

/* ---------- Aperçu ---------- */
function viewTDash() {
  const empty = !db.logs.length;
  return `<div class="body"><div class="scroll today">
    ${hasDemo() ? `<div class="banner">${ic('note', 16)}Séances d'exemple affichées pour juger l'interface.<button data-do="clearDemo">Les supprimer</button></div>` : ''}
    <div class="capture qlog">${ic('plus', 18)}<input id="qlog" placeholder="${matchMedia('(max-width:760px)').matches ? 'trac 3x8 · design 1h30' : 'Ajouter une séance : trac 3x8 · design 1h30 · course 5km 28min…  (Entrée)'}" autocomplete="off" enterkeyhint="done"></div>
    <div class="qprev" id="qprev"></div>
    <div class="tcards">${db.trackCats.map(catCard).join('')}${timerHtml()}</div>
    ${empty ? `<div class="empty card" style="margin-top:8px"><b>Prêt à démarrer ?</b>Note ta première séance ci-dessus, ou lance des séances d'exemple pour voir les graphiques.<br><br><button class="btn primary" data-do="demoLogs">Voir avec des séances d'exemple</button></div>` : `
    <div class="tgrid" style="margin-top:6px"><div class="tcol">
      <section class="sec"><h2>Activité<span class="why">chaque case = un jour, plus c'est foncé, plus tu as noté de séances</span></h2><div class="card" style="padding:14px 16px">${heatmapSvg({ counts: heatCounts({}), color: accent(), weeks: heatWeeks() })}</div></section>
      <section class="sec"><h2>Dernières séances<span class="why">clique pour modifier</span></h2><div class="card">${lastLogsHtml(7)}</div></section>
    </div><div class="tcol right">
      <section class="sec"><h2>Records<span class="why">tes meilleurs chiffres</span></h2><div class="card">${recordsHtml({}, 7)}</div></section>
      <section class="sec"><h2>Répartition<span class="why">30 derniers jours</span></h2><div class="card">${shareHtml(30)}</div></section>
    </div></div>`}
  </div></div>`;
}

/* ---------- Bandeau d'anneaux sur l'accueil de Cap ---------- */
function trackStripHtml() {
  const cats = db.trackCats.filter(c => c.goal);
  if (!cats.length || !db.logs.length) return '';
  const mon = D.monday(D.today());
  return `<div class="tstrip" data-do="appSwitch" title="Ouvrir Suivis"><span class="lbl2">${ic('target', 15)}Cette semaine</span>
    ${cats.map(c => { const w = catWeek(c, mon), done = w.value >= c.goal, ps = paceState(c, w), col = catColor(c);
      return `<div class="tchip ${done ? 'okc' : ps === 2 ? 'latec' : ps === 1 ? 'warnc' : ''}">${ringHtml({ pct: w.value / c.goal, color: col, size: 34, stroke: 4, big: '', done })}
        <div><b>${esc(c.name)}</b><small>${c.goalKind === 'minutes' ? `${hmin(w.value)} / ${hmin(c.goal)}` : `${w.value} / ${c.goal} ${c.goalKind === 'days' ? 'j' : 'séance' + (c.goal > 1 ? 's' : '')}`}${ps === 2 && !done ? ' · en retard' : ''}</small></div></div>`; }).join('')}
    <span class="go">Suivis ${ic('right', 14)}</span></div>`;
}
