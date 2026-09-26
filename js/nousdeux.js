'use strict';
/* =====================================================================
   NOUS DEUX : mieux se connaître. Un profil pour Brandon, un pour Julya ; on passe de l'un à l'autre
   depuis n'importe quel compte (tout est visible et modifiable des deux côtés), sauf les idées secrètes.
   - Rubriques : plats préférés, goûts (par catégorie), cadeaux souhaités, tailles / mensurations, santé, soins.
   - Commun (nousdeux/commun.json) : plats, goûts, souhaits + « fiches » (tailles, santé, soins). Une fiche
     est un couple (rubrique, personne, champ) dont l'id est déterministe : deux appareils qui modifient
     deux champs différents ne s'écrasent jamais.
   - Perso (nousdeux/<profil>.json) : les idées secrètes que je note pour l'autre. Elles ne transitent jamais
     par le fichier commun, et l'autre n'a aucun écran pour les voir.
   ===================================================================== */
Object.assign(ICONS, {
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
});

const ND_KEY = 'nousdeux.v1.commun', ND_PKEY = () => 'nousdeux.v1.' + hub.profile;
const ND_SEX = { brandon: 'm', julya: 'f' };
const ND_TABS = [
  { id: 'plats', label: 'Plats' }, { id: 'gouts', label: 'Goûts' }, { id: 'cadeaux', label: 'Cadeaux' },
  { id: 'tailles', label: 'Tailles' }, { id: 'sante', label: 'Santé' }, { id: 'soins', label: 'Soins & parfums' },
];
const ND_LIKES = [
  { id: 'resto', label: 'Restos & lieux', add: 'Un resto, un endroit…' }, { id: 'boisson', label: 'Boissons', add: 'Une boisson, un café, un cocktail…' },
  { id: 'douceur', label: 'Douceurs & snacks', add: 'Une gourmandise…' }, { id: 'style', label: 'Couleurs & styles', add: 'Une couleur, un style…' },
  { id: 'marque', label: 'Marques', add: 'Une marque…' }, { id: 'film', label: 'Films & séries', add: 'Un film, une série…' },
  { id: 'livre', label: 'Livres', add: 'Un livre, un auteur…' },
];
/* Champs proposés d'office : [clé, libellé, exemple]. Le reste se crée à la demande (« Ajouter une rubrique »). */
const ND_FIELDS = {
  tailles: {
    m: [['Vêtements', [['haut', 'Haut (T-shirt, chemise)', 'M'], ['pull', 'Pull / veste', 'L'], ['pantalon', 'Pantalon', '40'], ['jambe', 'Longueur de jambe', '32'],
      ['sous', 'Sous-vêtements', 'M'], ['ceinture', 'Ceinture', '95 cm']]],
      ['Accessoires', [['pointure', 'Pointure', '43'], ['bague', 'Bague', '64'], ['tete', 'Tour de tête', '58 cm'], ['gants', 'Gants', 'L']]],
      ['Mensurations', [['hauteur', 'Taille (hauteur)', '180 cm'], ['poitrine', 'Tour de poitrine', ''], ['taille', 'Tour de taille', ''], ['hanches', 'Tour de hanches', ''],
      ['cou', 'Tour de cou', ''], ['manche', 'Longueur de manche', '']]]],
    f: [['Vêtements', [['haut', 'Haut', 'S'], ['pull', 'Pull / veste', 'S'], ['robe', 'Robe', '38'], ['pantalon', 'Pantalon / jean', '38'],
      ['soutif', 'Soutien-gorge', '85B'], ['sous', 'Culottes', 'S'], ['collant', 'Collants', '2'], ['maillot', 'Maillot de bain', '38']]],
      ['Accessoires', [['pointure', 'Pointure', '38'], ['bague', 'Bague', '52'], ['gants', 'Gants', 'S']]],
      ['Mensurations', [['hauteur', 'Taille (hauteur)', '165 cm'], ['poitrine', 'Tour de poitrine', ''], ['taille', 'Tour de taille', ''], ['hanches', 'Tour de hanches', '']]]],
  },
  sante: { '*': [['', [['sang', 'Groupe sanguin', 'A+'], ['allergies', 'Allergies', ''], ['traitement', 'Traitements en cours', ''], ['medecin', 'Médecin traitant', ''],
    ['urgence', 'Personne à prévenir', ''], ['autre', 'Autres infos utiles', '']]]] },
  soins: {
    m: [['', [['parfum', 'Parfum', ''], ['deo', 'Déodorant', ''], ['douche', 'Gel douche', ''], ['shampoing', 'Shampoing', ''], ['rasage', 'Rasage / barbe', ''],
      ['visage', 'Soin visage', ''], ['corps', 'Soin du corps', ''], ['dents', 'Dentifrice', '']]]],
    f: [['', [['parfum', 'Parfum', ''], ['deo', 'Déodorant', ''], ['douche', 'Gel douche', ''], ['shampoing', 'Shampoing / après-shampoing', ''], ['visage', 'Soin visage', ''],
      ['corps', 'Soin du corps', ''], ['maquillage', 'Maquillage', ''], ['vernis', 'Vernis', ''], ['dents', 'Dentifrice', '']]]],
  },
};
const ND_COLLS_C = ['foods', 'likes', 'wishes', 'fields'], ND_COLLS_P = ['secrets'];
const nd = { c: { data: null, snap: new Map(), colls: ND_COLLS_C }, p: { data: null, snap: new Map(), colls: ND_COLLS_P } };
const ndui = { tab: 'plats', who: null, cat: 'resto', text: {}, pending: false };

/* ---------- données ---------- */
function ndLoad() {
  let dc = readLS(ND_KEY);
  if (!dc) dc = { v: 1 };
  ND_COLLS_C.forEach(k => { if (!Array.isArray(dc[k])) dc[k] = []; });
  nd.c.data = dc; normalizeStore(nd.c);
  let dp = readLS(ND_PKEY());
  if (!dp) dp = { v: 1 };
  ND_COLLS_P.forEach(k => { if (!Array.isArray(dp[k])) dp[k] = []; });
  nd.p.data = dp; normalizeStore(nd.p);
  ndui.who = hub.profile;
}
function ndSaveC() { nd.c.data.meta.savedAt = Date.now(); trackStore(nd.c); try { localStorage.setItem(ND_KEY, JSON.stringify(nd.c.data)); } catch (e) { /* ignore */ } dbxSync.schedule('nousdeux'); }
function ndSaveP() { nd.p.data.meta.savedAt = Date.now(); trackStore(nd.p); try { localStorage.setItem(ND_PKEY(), JSON.stringify(nd.p.data)); } catch (e) { /* ignore */ } dbxSync.schedule('nousdeuxPerso'); }
function ndAdoptC(target) { nd.c.data = target; ND_COLLS_C.forEach(k => { if (!Array.isArray(target[k])) target[k] = []; }); normalizeStore(nd.c); try { localStorage.setItem(ND_KEY, JSON.stringify(target)); } catch (e) { /* ignore */ } ndRefresh(); }
function ndAdoptP(target) { nd.p.data = target; ND_COLLS_P.forEach(k => { if (!Array.isArray(target[k])) target[k] = []; }); normalizeStore(nd.p); try { localStorage.setItem(ND_PKEY(), JSON.stringify(target)); } catch (e) { /* ignore */ } ndRefresh(); }
const ndSt = c => (c === 'secrets' ? nd.p : nd.c);
const ndSave = c => (c === 'secrets' ? ndSaveP() : ndSaveC());
const ndOf = who => profileOf(who) || PROFILES[0];
const ndIsMe = () => ndui.who === hub.profile;
const ndSorted = a => a.sort((x, y) => (x.o || 0) - (y.o || 0) || x.id.localeCompare(y.id));
function ndItems(c) {
  const all = ndSt(c).data[c] || [];
  if (c === 'secrets') return ndSorted(all.filter(x => x.about === ndui.who));
  if (c === 'likes') return ndSorted(all.filter(x => x.who === ndui.who && x.cat === ndui.cat));
  return ndSorted(all.filter(x => x.who === ndui.who));
}
function ndAddItems(c, text) {
  const parts = text.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  const arr = ndSt(c).data[c];
  let o = Math.max(0, ...arr.map(x => x.o || 0));
  parts.forEach(title => {
    const it = { id: uid(), title, o: ++o, by: hub.profile, createdAt: D.today() };
    if (c === 'secrets') { it.about = ndui.who; it.done = false; } else it.who = ndui.who;
    if (c === 'likes') it.cat = ndui.cat;
    arr.push(it);
  });
  ndSave(c); return true;
}
function ndTileBadge() {
  try {
    const n = nd.c.data.wishes.length;
    return `<span class="tbadge">${n ? `${n} idée${n > 1 ? 's' : ''} cadeau` : 'Vide pour l\'instant'}</span>`;
  } catch (e) { return ''; }
}

/* fiches (tailles / santé / soins) */
const ndFid = (sec, who, key) => `${sec}.${who}.${key}`;
const ndFind = (sec, who, key) => nd.c.data.fields.find(f => f.id === ndFid(sec, who, key));
function ndSetField(sec, key, val, label) {
  let f = ndFind(sec, ndui.who, key);
  if (!f) { if (!val.trim()) return; f = { id: ndFid(sec, ndui.who, key), sec, who: ndui.who, key, val: '' }; if (label) f.label = label; nd.c.data.fields.push(f); }
  f.val = val; ndSaveC();
}
function ndGroups(sec) {
  const d = ND_FIELDS[sec], base = d['*'] || d[ND_SEX[ndui.who] || 'm'];
  const custom = nd.c.data.fields.filter(f => f.sec === sec && f.who === ndui.who && f.label).sort((a, b) => (a.u || 0) - (b.u || 0));
  return { base, custom };
}

/* ---------- rendu ---------- */
const ndPossess = (mine, name) => (ndIsMe() ? mine : name);
function ndListBlock(c, { title, hint, placeholder, empty, check }) {
  const items = ndItems(c);
  const rows = items.length ? items.map(it => `<li class="ci ${it.done ? 'done' : ''}" data-id="${it.id}">
    ${check ? `<button type="button" class="cchk" data-do="ndToggle" data-c="${c}" data-id="${it.id}" aria-label="Acheté" aria-pressed="${!!it.done}">${it.done ? ic('check', 15) : ''}</button>` : '<span class="lbullet"></span>'}
    <input class="ctitle" data-c="${c}" data-nid="${it.id}" value="${esc(it.title)}" autocomplete="off" aria-label="Titre">
    <button type="button" class="iconbtn cdel" data-do="ndDel" data-c="${c}" data-id="${it.id}" title="Retirer">${ic('x', 15)}</button></li>`).join('')
    : `<li class="cempty"><b>${esc(empty)}</b>Ajoute-en une ci-dessus.</li>`;
  return `<section class="ndsec">${title ? `<h2 class="ndh">${esc(title)}</h2>` : ''}${hint ? `<p class="hint ndhint">${hint}</p>` : ''}
    <div class="ci cadd"><span class="cplus">${ic('plus', 18)}</span>
      <input class="ctitle" id="nd-add-${c}" placeholder="${esc(placeholder)}" value="${esc(ndui.text[c] || '')}" autocomplete="off" enterkeyhint="done">
      <button type="button" class="btn primary sm cgo" data-do="ndAdd" data-c="${c}">Ajouter</button></div>
    <ul class="citems">${rows}</ul></section>`;
}
function ndFieldsBlock(sec, placeholderAdd) {
  const { base, custom } = ndGroups(sec);
  const row = (key, label, ph, custom_) => {
    const f = ndFind(sec, ndui.who, key), id = `ndf-${sec}-${key}`;
    return `<div class="ci ndf"><label class="ndlab" for="${id}">${esc(label)}</label>
      <input class="ctitle ndval" id="${id}" data-sec="${sec}" data-key="${key}" data-lbl="${custom_ ? esc(label) : ''}" value="${esc(f ? f.val : '')}" placeholder="${esc(ph || '—')}" autocomplete="off" aria-label="${esc(label)}">
      ${custom_ ? `<button type="button" class="iconbtn cdel" data-do="ndDelField" data-id="${esc(f.id)}" title="Retirer">${ic('x', 15)}</button>` : ''}</div>`;
  };
  const groups = base.map(([g, list]) => `<section class="ndsec">${g ? `<h2 class="ndh">${esc(g)}</h2>` : ''}<div class="citems">${list.map(([k, l, ph]) => row(k, l, ph, false)).join('')}</div></section>`).join('');
  const extra = `<section class="ndsec"><h2 class="ndh">Autres</h2>${custom.length ? `<div class="citems">${custom.map(f => row(f.key, f.label, '', true)).join('')}</div>` : ''}
    <div class="ci cadd"><span class="cplus">${ic('plus', 18)}</span>
      <input class="ctitle" id="nd-newf" placeholder="${esc(placeholderAdd)}" value="${esc(ndui.text.newf || '')}" autocomplete="off" enterkeyhint="done">
      <button type="button" class="btn primary sm cgo" data-do="ndAddField">Ajouter</button></div></section>`;
  return groups + extra;
}
function ndBody() {
  const w = ndOf(ndui.who), me = ndIsMe(), n = w.name;
  if (ndui.tab === 'plats') return ndListBlock('foods', { title: ndPossess('Mes plats préférés', `Plats préférés de ${n}`), placeholder: 'Un plat, une recette…', empty: 'Aucun plat pour l\'instant' });
  if (ndui.tab === 'gouts') {
    const cat = ND_LIKES.find(l => l.id === ndui.cat) || ND_LIKES[0];
    const chips = `<div class="ndchips">${ND_LIKES.map(l => `<button type="button" class="chip ${l.id === cat.id ? 'on' : ''}" data-do="ndCat" data-v="${l.id}">${esc(l.label)}</button>`).join('')}</div>`;
    return chips + ndListBlock('likes', { placeholder: cat.add, empty: 'Rien dans cette catégorie pour l\'instant' });
  }
  if (ndui.tab === 'cadeaux') {
    const wishes = ndListBlock('wishes', { title: ndPossess('Mes envies', `Les envies de ${n}`), hint: me ? `${esc(otherProfile().name)} peut les voir.` : '', placeholder: 'Un cadeau souhaité…', empty: 'Aucune envie pour l\'instant' });
    const secrets = me ? '' : ndListBlock('secrets', { title: `Idées secrètes pour ${n}`, hint: 'Tu es la seule personne à voir cette liste.', placeholder: 'Une idée à garder pour toi…', empty: 'Aucune idée pour l\'instant', check: true });
    return wishes + secrets;
  }
  if (ndui.tab === 'tailles') return ndFieldsBlock('tailles', 'Autre mesure (ex. Casque de vélo)…');
  if (ndui.tab === 'sante') return ndFieldsBlock('sante', 'Autre info (ex. Mutuelle)…');
  return ndFieldsBlock('soins', 'Autre produit (ex. Crème mains)…');
}
function ndHtml() {
  const whoSeg = `<div class="seg ndwho">${PROFILES.map(p => `<button class="${ndui.who === p.id ? 'on' : ''}" data-do="ndWho" data-v="${p.id}" style="--c:${p.color}"><i class="ndav" style="--c:${p.color}">${esc(p.name[0])}</i>${esc(p.name)}</button>`).join('')}</div>`;
  return `<div class="hubwrap cw"><div class="cwrap ndwrap">
    <header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button><h1>Nous Deux</h1><span class="sp"></span></header>
    ${whoSeg}
    <div class="seg ndtabs">${ND_TABS.map(t => `<button class="${ndui.tab === t.id ? 'on' : ''}" data-do="ndTab" data-v="${t.id}">${esc(t.label)}</button>`).join('')}</div>
    <div id="ndbody">${ndBody()}</div>
    <footer class="hubfoot">${dbxBadge()}</footer></div></div>`;
}
/* rafraîchit sans toucher au champ en cours de saisie */
function ndRefresh() {
  if (hub.screen !== 'nd') return;
  const ae = document.activeElement;
  if (ae && ae.matches && ae.matches('#app input')) { ndui.pending = true; return; }
  ndui.pending = false; render();
}

/* ---------- actions ---------- */
function ndAddNow(c) {
  if (ndAddItems(c, ndui.text[c] || '')) { ndui.text[c] = ''; render(); }
  document.getElementById('nd-add-' + c)?.focus();
}
function ndAddFieldNow() {
  const sec = ndui.tab, label = (ndui.text.newf || '').trim();
  if (!label) return;
  const key = 'x' + uid();
  nd.c.data.fields.push({ id: ndFid(sec, ndui.who, key), sec, who: ndui.who, key, label, val: '' });
  ndSaveC(); ndui.text.newf = ''; render();
  document.getElementById(`ndf-${sec}-${key}`)?.focus();
}
const ndH = {
  ndWho: el => { ndui.who = el.dataset.v; render(); },
  ndTab: el => { ndui.tab = el.dataset.v; render(); scrollTo(0, 0); },
  ndCat: el => { ndui.cat = el.dataset.v; render(); },
  ndAdd: el => ndAddNow(el.dataset.c),
  ndAddField: () => ndAddFieldNow(),
  ndToggle: el => {
    const it = ndSt(el.dataset.c).data[el.dataset.c].find(x => x.id === el.dataset.id); if (!it) return;
    it.done = !it.done; ndSave(el.dataset.c); render();
  },
  ndDel: el => {
    const c = el.dataset.c, arr = ndSt(c).data[c], it = arr.find(x => x.id === el.dataset.id); if (!it) return;
    ndSt(c).data[c] = arr.filter(x => x.id !== it.id); ndSave(c); render();
    toast('Retiré', () => { ndSt(c).data[c].push(it); ndSave(c); render(); });
  },
  ndDelField: el => {
    const it = nd.c.data.fields.find(x => x.id === el.dataset.id); if (!it) return;
    nd.c.data.fields = nd.c.data.fields.filter(x => x.id !== it.id); ndSaveC(); render();
    toast('Retiré', () => { nd.c.data.fields.push(it); ndSaveC(); render(); });
  },
};

document.addEventListener('input', e => {
  if (hub.screen !== 'nd') return;
  const el = e.target;
  if (el.id === 'nd-newf') { ndui.text.newf = el.value; return; }
  if (el.id?.startsWith('nd-add-')) { ndui.text[el.id.slice(7)] = el.value; return; }
  if (el.dataset.sec) { ndSetField(el.dataset.sec, el.dataset.key, el.value, el.dataset.lbl || ''); return; }
  if (el.dataset.nid) { const it = ndSt(el.dataset.c).data[el.dataset.c].find(x => x.id === el.dataset.nid); if (it) { it.title = el.value; ndSave(el.dataset.c); } }
});
document.addEventListener('focusout', e => {
  if (hub.screen !== 'nd') return;
  const el = e.target;
  if (el.dataset?.nid) {
    const c = el.dataset.c, arr = ndSt(c).data[c], it = arr.find(x => x.id === el.dataset.nid);
    if (it && !it.title.trim()) { ndSt(c).data[c] = arr.filter(x => x.id !== it.id); ndSave(c); ndui.pending = true; }
    else if (it) { it.title = it.title.trim(); ndSave(c); }
  } else if (el.dataset?.sec && !el.dataset.lbl && !el.value.trim()) {
    const f = ndFind(el.dataset.sec, ndui.who, el.dataset.key);
    if (f) { nd.c.data.fields = nd.c.data.fields.filter(x => x.id !== f.id); ndSaveC(); }
  }
  setTimeout(() => { if (ndui.pending) ndRefresh(); }, 0);
});
function ndKey(e) {
  const t = e.target;
  if (e.key === 'Enter' && t.id?.startsWith('nd-add-')) { e.preventDefault(); ndAddNow(t.id.slice(7)); }
  else if (e.key === 'Enter' && t.id === 'nd-newf') { e.preventDefault(); ndAddFieldNow(); }
  else if (e.key === 'Enter' && t.matches?.('#app input')) t.blur();
  else if (e.key === 'Escape') { if (/INPUT/.test(t.tagName)) t.blur(); else hubHome(); }
}
setInterval(() => { if (hub.screen === 'nd' && !document.hidden) dbxSync.syncNow(['nousdeux', 'nousdeuxPerso']); }, 25000);
