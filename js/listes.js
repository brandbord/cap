'use strict';
/* =====================================================================
   NOS LISTES : destinations de rêve, musique — communes aux deux profils.
   Même mécanique que Courses (un seul fichier partagé, fusion élément par élément), généralisée à
   plusieurs collections : LTYPES décrit chaque onglet. Ajouter un 3e type de liste plus tard = une
   entrée de plus ici, rien d'autre à toucher.
   ===================================================================== */
const LTYPES = [
  { id: 'destinations', label: 'Destinations de rêve', add: 'Une destination…', empty: 'Aucune destination pour l\'instant', check: true, checkLabel: 'Visité' },
  { id: 'musique', label: 'Musique', add: 'Un titre, un artiste…', empty: 'Aucune musique pour l\'instant', check: false },
];
const LISTES_KEY = 'listes.v1.commun';
const listes = { data: null, snap: new Map(), colls: LTYPES.map(t => t.id) };
const lui = { tab: 'destinations', text: '', filterBy: null, filterDone: null, pending: false };
const ltype = id => LTYPES.find(t => t.id === id);

/* ---------- données ---------- */
function listesLoad() {
  let d = readLS(LISTES_KEY);
  if (!d || !LTYPES.every(t => Array.isArray(d[t.id]))) { d = d || {}; d.v = 1; LTYPES.forEach(t => { d[t.id] = d[t.id] || []; }); }
  listes.data = d; normalizeStore(listes);
}
function listesSave() {
  listes.data.meta.savedAt = Date.now();
  trackStore(listes);
  try { localStorage.setItem(LISTES_KEY, JSON.stringify(listes.data)); } catch (e) { /* ignore */ }
  dbxSync.schedule('listes');
}
function listesAdopt(target) { // la fusion avec Dropbox est arrivée
  listes.data = target; normalizeStore(listes);
  try { localStorage.setItem(LISTES_KEY, JSON.stringify(listes.data)); } catch (e) { /* ignore */ }
  listesRefresh();
}
const lItems = t => [...(listes.data[t] || [])].sort((a, b) => (a.o || 0) - (b.o || 0) || a.id.localeCompare(b.id));
function lmutate(fn, msg) {
  const t = lui.tab, prev = JSON.stringify(listes.data[t]);
  fn(); listesSave(); listesRefresh();
  if (msg) toast(msg, () => { listes.data[t] = JSON.parse(prev); listesSave(); listesRefresh(); });
}
function lAddItems(t, text) {
  const parts = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  let o = Math.max(0, ...(listes.data[t] || []).map(x => x.o || 0));
  parts.forEach(title => listes.data[t].push({ id: uid(), title, done: false, by: hub.profile, createdAt: D.today(), o: ++o }));
  listesSave(); return true;
}
function listesTileBadge() {
  try {
    const parts = LTYPES.map(t => (listes.data[t.id] || []).length).map((n, i) => n ? `${n} ${LTYPES[i].label.toLowerCase()}` : null).filter(Boolean);
    return `<span class="tbadge">${parts.length ? parts.join(' · ') : 'Vide pour l\'instant'}</span>`;
  } catch (e) { return ''; }
}

/* ---------- rendu ---------- */
const byTag = by => { const p = profileOf(by); return p ? `<span class="lby" style="--c:${p.color}" title="Ajouté par ${esc(p.name)}">${esc(p.name[0])}</span>` : ''; };
function lFilterBar() {
  const t = ltype(lui.tab);
  const segBy = `<div class="seg">${[[null, 'Tous'], ...PROFILES.map(p => [p.id, p.name])].map(([v, l]) =>
    `<button class="${lui.filterBy === v ? 'on' : ''}" data-do="lFilterBy" data-v="${v || ''}">${esc(l)}</button>`).join('')}</div>`;
  const segDone = t.check ? `<div class="seg">${[[null, 'Toutes'], [0, 'À faire'], [1, t.checkLabel + 's']].map(([v, l]) =>
    `<button class="${lui.filterDone === v ? 'on' : ''}" data-do="lFilterDone" data-v="${v == null ? '' : v}">${l}</button>`).join('')}</div>` : '';
  return `<div class="toolbar" id="lfilterbar">${segDone}${segBy}</div>`;
}
function lRowsHtml() {
  const t = ltype(lui.tab);
  let items = lItems(t.id);
  if (lui.filterBy) items = items.filter(x => x.by === lui.filterBy);
  if (t.check && lui.filterDone != null) items = items.filter(x => !!x.done === !!lui.filterDone);
  if (!items.length) return `<li class="cempty"><b>${esc(t.empty)}</b>Ajoute-la ci-dessus.</li>`;
  return items.map(it => `<li class="ci ${it.done ? 'done' : ''}" data-id="${it.id}">
    ${t.check ? `<button type="button" class="cchk" data-do="lToggle" data-id="${it.id}" aria-label="${it.done ? 'Marquer à faire' : t.checkLabel}" aria-pressed="${!!it.done}">${it.done ? ic('check', 15) : ''}</button>` : '<span class="lbullet"></span>'}
    <input class="ctitle" data-lid="${it.id}" value="${esc(it.title)}" autocomplete="off" aria-label="Titre">
    ${byTag(it.by)}
    <button type="button" class="iconbtn cdel" data-do="lDel" data-id="${it.id}" title="Retirer">${ic('x', 15)}</button></li>`).join('');
}
function listesHtml() {
  return `<div class="hubwrap cw"><div class="cwrap">
    <header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button><h1>Nos listes</h1><span class="sp"></span></header>
    <div class="seg ltabs">${LTYPES.map(t => `<button class="${lui.tab === t.id ? 'on' : ''}" data-do="lTab" data-v="${t.id}">${esc(t.label)}</button>`).join('')}</div>
    <div class="ci cadd"><span class="cplus">${ic('plus', 18)}</span>
      <input class="ctitle" id="l-add" placeholder="${esc(ltype(lui.tab).add)}" value="${esc(lui.text)}" autocomplete="off" enterkeyhint="done">
      <button type="button" class="btn primary sm cgo" data-do="lAdd">Ajouter</button></div>
    ${lFilterBar()}
    <ul class="citems" id="llist">${lRowsHtml()}</ul>
    <footer class="hubfoot">${dbxBadge()}</footer></div></div>`;
}
/* rafraîchit la liste sans toucher au champ en cours de saisie */
function listesRefresh() {
  if (hub.screen !== 'listes') return;
  const ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains('ctitle') && ae.id !== 'l-add') { lui.pending = true; return; }
  const l = document.getElementById('llist'); if (!l) return render();
  lui.pending = false;
  l.innerHTML = lRowsHtml();
  const fb = document.getElementById('lfilterbar'); if (fb) fb.outerHTML = lFilterBar();
  const f = document.querySelector('.hubfoot'); if (f) f.innerHTML = dbxBadge();
}

/* ---------- actions ---------- */
function lAddNow() {
  const inp = document.getElementById('l-add'), t = lui.tab;
  if (lAddItems(t, lui.text)) { lui.text = ''; if (inp) inp.value = ''; listesRefresh(); }
  inp?.focus();
}
const listesH = {
  lAdd: () => lAddNow(),
  lTab: el => { lui.tab = el.dataset.v; lui.filterBy = null; lui.filterDone = null; lui.text = ''; render(); },
  lToggle: el => {
    const it = (listes.data[lui.tab] || []).find(x => x.id === el.dataset.id); if (!it) return;
    it.done = !it.done; if (it.done) it.doneAt = D.today(); else delete it.doneAt;
    listesSave(); listesRefresh();
  },
  lDel: el => lmutate(() => { listes.data[lui.tab] = listes.data[lui.tab].filter(x => x.id !== el.dataset.id); }, 'Retiré'),
  lFilterBy: el => { lui.filterBy = el.dataset.v || null; listesRefresh(); },
  lFilterDone: el => { lui.filterDone = el.dataset.v === '' ? null : +el.dataset.v; listesRefresh(); },
};

/* saisie : titre modifié en direct */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'l-add') { lui.text = el.value; return; }
  if (el.classList && el.classList.contains('ctitle') && el.dataset.lid) {
    const it = (listes.data[lui.tab] || []).find(x => x.id === el.dataset.lid);
    if (it) { it.title = el.value; listesSave(); }
  }
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (!(el.classList && el.classList.contains('ctitle') && el.dataset.lid)) return;
  const arr = listes.data[lui.tab] || [], it = arr.find(x => x.id === el.dataset.lid);
  if (it && !it.title.trim()) { listes.data[lui.tab] = arr.filter(x => x.id !== it.id); listesSave(); } // titre vidé = élément retiré
  else if (it) { it.title = it.title.trim(); listesSave(); }
  setTimeout(() => { if (lui.pending) listesRefresh(); }, 0);
});
function listesKey(e) {
  if (e.key === 'Enter' && e.target.id === 'l-add') { e.preventDefault(); lAddNow(); }
  else if (e.key === 'Enter' && e.target.classList?.contains('ctitle')) e.target.blur();
  else if (e.key === 'Escape') { if (/INPUT/.test(e.target.tagName)) e.target.blur(); else hubHome(); }
}
setInterval(() => { if (hub.screen === 'listes' && !document.hidden) dbxSync.syncNow(['listes']); }, 25000);
