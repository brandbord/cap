'use strict';
/* =====================================================================
   WEEKEND : le programme du prochain week-end, en deux onglets — corvées et trucs cool.
   Aucun lien avec les dates, rien à cocher : un vrai pense-bête, à remplir n'importe quel jour
   de la semaine. Commune aux deux profils, un seul fichier, même mécanique que Courses / Nos listes.
   ===================================================================== */
const WTYPES = [
  { id: 'corvees', label: 'Corvées', add: 'Une corvée…', empty: 'Rien à faire pour l\'instant.' },
  { id: 'cool', label: 'Trucs cool', add: 'Une idée sympa…', empty: 'Aucune idée pour l\'instant.' },
];
const WEEKEND_KEY = 'weekend.v1.commun';
const weekend = { data: null, snap: new Map(), colls: WTYPES.map(t => t.id) };
const wui = { tab: 'corvees', text: '', pending: false };
const wtype = id => WTYPES.find(t => t.id === id);

/* ---------- données ---------- */
function weekendLoad() {
  let d = readLS(WEEKEND_KEY);
  if (!d || !WTYPES.every(t => Array.isArray(d[t.id]))) { d = d || {}; d.v = 1; WTYPES.forEach(t => { d[t.id] = d[t.id] || []; }); }
  weekend.data = d; normalizeStore(weekend);
}
function weekendSave() {
  weekend.data.meta.savedAt = Date.now();
  trackStore(weekend);
  try { localStorage.setItem(WEEKEND_KEY, JSON.stringify(weekend.data)); } catch (e) { /* ignore */ }
  dbxSync.schedule('weekend');
}
function weekendAdopt(target) {
  weekend.data = target; normalizeStore(weekend);
  try { localStorage.setItem(WEEKEND_KEY, JSON.stringify(weekend.data)); } catch (e) { /* ignore */ }
  weekendRefresh();
}
const wItems = t => [...(weekend.data[t] || [])].sort((a, b) => (a.o || 0) - (b.o || 0) || a.id.localeCompare(b.id));
function wmutate(fn, msg) {
  const t = wui.tab, prev = JSON.stringify(weekend.data[t]);
  fn(); weekendSave(); weekendRefresh();
  if (msg) toast(msg, () => { weekend.data[t] = JSON.parse(prev); weekendSave(); weekendRefresh(); });
}
function wAddItems(t, text) {
  const parts = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  let o = Math.max(0, ...(weekend.data[t] || []).map(x => x.o || 0));
  parts.forEach(title => weekend.data[t].push({ id: uid(), title, by: hub.profile, createdAt: D.today(), o: ++o }));
  weekendSave(); return true;
}
function weekendTileBadge() {
  try {
    const parts = WTYPES.map(t => (weekend.data[t.id] || []).length).map((n, i) => n ? `${n} ${WTYPES[i].label.toLowerCase()}` : null).filter(Boolean);
    return `<span class="tbadge">${parts.length ? parts.join(' · ') : 'Rien de prévu'}</span>`;
  } catch (e) { return ''; }
}

/* ---------- rendu ---------- */
function wRowsHtml() {
  const items = wItems(wui.tab);
  if (!items.length) return `<li class="cempty"><b>${esc(wtype(wui.tab).empty)}</b>Ajoute une idée ci-dessus.</li>`;
  return items.map(it => `<li class="ci" data-id="${it.id}">
    <span class="lbullet"></span>
    <input class="ctitle" data-wid="${it.id}" value="${esc(it.title)}" autocomplete="off" aria-label="Titre">
    ${byTag(it.by)}
    <button type="button" class="iconbtn cdel" data-do="wDel" data-id="${it.id}" title="Retirer">${ic('x', 15)}</button></li>`).join('');
}
function weekendHtml() {
  return `<div class="hubwrap cw"><div class="cwrap">
    <header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button><h1>Weekend</h1><span class="sp"></span></header>
    <div class="seg ltabs">${WTYPES.map(t => `<button class="${wui.tab === t.id ? 'on' : ''}" data-do="wTab" data-v="${t.id}">${esc(t.label)}</button>`).join('')}</div>
    <div class="ci cadd"><span class="cplus">${ic('plus', 18)}</span>
      <input class="ctitle" id="w-add" placeholder="${esc(wtype(wui.tab).add)}" value="${esc(wui.text)}" autocomplete="off" enterkeyhint="done">
      <button type="button" class="btn primary sm cgo" data-do="wAdd">Ajouter</button></div>
    <ul class="citems" id="wlist">${wRowsHtml()}</ul>
    <footer class="hubfoot">${dbxBadge()}</footer></div></div>`;
}
function weekendRefresh() {
  if (hub.screen !== 'weekend') return;
  const ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains('ctitle') && ae.id !== 'w-add') { wui.pending = true; return; }
  const l = document.getElementById('wlist'); if (!l) return render();
  wui.pending = false;
  l.innerHTML = wRowsHtml();
  const f = document.querySelector('.hubfoot'); if (f) f.innerHTML = dbxBadge();
}

/* ---------- actions ---------- */
function wAddNow() {
  const inp = document.getElementById('w-add'), t = wui.tab;
  if (wAddItems(t, wui.text)) { wui.text = ''; if (inp) inp.value = ''; weekendRefresh(); }
  inp?.focus();
}
const weekendH = {
  wAdd: () => wAddNow(),
  wTab: el => { wui.tab = el.dataset.v; wui.text = ''; render(); },
  wDel: el => wmutate(() => { weekend.data[wui.tab] = weekend.data[wui.tab].filter(x => x.id !== el.dataset.id); }, 'Retiré'),
};

/* saisie : titre modifié en direct */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'w-add') { wui.text = el.value; return; }
  if (el.classList && el.classList.contains('ctitle') && el.dataset.wid) {
    const it = (weekend.data[wui.tab] || []).find(x => x.id === el.dataset.wid);
    if (it) { it.title = el.value; weekendSave(); }
  }
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (!(el.classList && el.classList.contains('ctitle') && el.dataset.wid)) return;
  const arr = weekend.data[wui.tab] || [], it = arr.find(x => x.id === el.dataset.wid);
  if (it && !it.title.trim()) { weekend.data[wui.tab] = arr.filter(x => x.id !== it.id); weekendSave(); } // titre vidé = élément retiré
  else if (it) { it.title = it.title.trim(); weekendSave(); }
  setTimeout(() => { if (wui.pending) weekendRefresh(); }, 0);
});
function weekendKey(e) {
  if (e.key === 'Enter' && e.target.id === 'w-add') { e.preventDefault(); wAddNow(); }
  else if (e.key === 'Enter' && e.target.classList?.contains('ctitle')) e.target.blur();
  else if (e.key === 'Escape') { if (/INPUT/.test(e.target.tagName)) e.target.blur(); else hubHome(); }
}
setInterval(() => { if (hub.screen === 'weekend' && !document.hidden) dbxSync.syncNow(['weekend']); }, 25000);
