'use strict';
/* =====================================================================
   COURSES : la liste de courses commune (Brandon + Julya).

   - Une simple liste à puces, dans l'ordre où on la saisit. À gauche un rond : on coche, l'article se barre.
     À droite, les logos de rayon : on peut en allumer un seul (ou aucun).
   - Le bouton « Ranger par rayon » remet la liste dans l'ordre du magasin (l'ordre des logos ci-dessous).
   - Un seul fichier partagé, /courses/commun.json : la fusion se fait article par article (le plus récent
     gagne), donc on peut cocher et ajouter en même temps depuis deux téléphones sans se saboter.
   ===================================================================== */
/* Ordre = parcours du magasin. Pour changer l'ordre, il suffit de déplacer une ligne. */
const CCATS = [
  { id: 'fruit', label: 'Fruits & légumes', icon: 'c-fruit', color: '#5f9a7a' },
  { id: 'viande', label: 'Viande & poisson', icon: 'c-viande', color: '#c2412d' },
  { id: 'frais', label: 'Frais (yaourt, fromage…)', icon: 'c-frais', color: '#5f7fa8' },
  { id: 'cereale', label: 'Céréales & épicerie', icon: 'c-cereale', color: '#b8951f' },
  { id: 'boisson', label: 'Boissons', icon: 'c-boisson', color: '#7a68b0' },
  { id: 'pain', label: 'Boulangerie', icon: 'c-pain', color: '#b8804a' },
  { id: 'surgele', label: 'Surgelés', icon: 'c-surgele', color: '#3f9ab8' },
  { id: 'maison', label: 'Maison & hygiène', icon: 'c-maison', color: '#8f8a80' },
];
Object.assign(ICONS, {
  'c-fruit': '<rect x="8.6" y="9.5" width="6.8" height="11.5" rx="3.4"/><path d="M12 9.5C12 6.2 8.6 4.4 5.5 3M12 9.5c0-3.3 3.4-5.1 6.5-6.5M12 9.5V2"/><path d="M10.6 21.5l-.7 1.2M13.4 21.5l.7 1.2"/>',
  'c-pain': '<rect x="-4.2" y="-11.4" width="8.4" height="22.8" rx="4.2" transform="translate(12 12) rotate(45)"/><path d="M-1.8 -6.8l3.6 2.2M-1.8 -1.6l3.6 2.2M-1.8 3.6l3.6 2.2" transform="translate(12 12) rotate(45)"/>',
  'c-viande': '<path d="M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23"/><path d="m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59"/>',
  'c-frais': '<path d="M8 2h8"/><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2"/><path d="M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/>',
  'c-cereale': '<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>',
  'c-surgele': '<path d="M2 12h20M12 2v20"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',
  'c-boisson': '<path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8"/><path d="M5 8h14"/><path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/><path d="m12 8 1-6h2"/>',
  'c-maison': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
});

/* ---------- mots-clés : suggèrent un rayon (jamais imposé) ----------
   Aucun logo n'est allumé d'office. Si le titre contient un mot connu, le logo du rayon s'allume en « suggestion » (pointillés).
   Un clic sur un logo (celui suggéré ou un autre) le remplace par un vrai choix. Si rien n'est choisi à l'ajout,
   l'article est rangé directement dans le rayon suggéré. Accents et pluriels sont ignorés. Une expression (« pain de mie »)
   l'emporte sur un simple mot, et « surgelé » l'emporte sur tout. */
const CKW = {
  fruit: 'fruit, legume, pomme, poire, banane, orange, citron, lime, clementine, mandarine, pamplemousse, fraise, framboise, cerise, raisin, peche, nectarine, abricot, prune, melon, pasteque, kiwi, ananas, mangue, avocat, myrtille, mure, figue, grenade, tomate, concombre, courgette, aubergine, poivron, carotte, poireau, oignon, echalote, ail, patate, pomme de terre, salade, laitue, mache, roquette, epinard, brocoli, chou, haricots verts, haricot vert, champignon, radis, betterave, celeri, fenouil, courge, potiron, potimarron, butternut, endive, persil, basilic, coriandre, menthe, ciboulette, gingembre, artichaut, asperge, navet, panais, herbes',
  viande: 'viande, poulet, dinde, boeuf, steak, hache, veau, porc, agneau, jambon, lardon, saucisse, chipolata, merguez, saucisson, bacon, poisson, saumon, cabillaud, colin, sole, crevette, moule, huitre, filet, escalope, cote, cotelette, gigot, roti, rosbif, canard, magret, foie, boudin, andouillette, chorizo, charcuterie, rillettes, knacki, truite, dorade, merlan, calamar, saint jacques, cuisse, aiguillette, paleron, entrecote, bavette, cordon bleu, nuggets, fruits de mer, blanc de poulet',
  frais: 'yaourt, yogourt, fromage, fromage blanc, lait, beurre, creme, creme fraiche, oeuf, mozzarella, emmental, comte, camembert, chevre, feta, parmesan, gruyere, roquefort, brie, mascarpone, ricotta, skyr, petit suisse, flan, dessert, margarine, tofu, houmous, raclette, reblochon, cheddar, boursin, kiri, vache qui rit, gorgonzola, mimolette, munster, cantal, pate feuilletee, pate brisee, pate a pizza',
  cereale: 'pates, spaghetti, tagliatelle, penne, coquillette, macaroni, lasagne, vermicelle, nouilles, riz, semoule, ble, boulgour, quinoa, couscous, lentille, pois chiche, haricots rouges, haricot rouge, haricots blancs, haricot blanc, flocons, avoine, muesli, cereale, corn flakes, granola, farine, sucre, sel, poivre, epice, huile, huile d olive, vinaigre, vinaigrette, moutarde, ketchup, mayonnaise, sauce, sauce tomate, coulis, concentre de tomate, conserve, boite, thon, sardine, maquereau, cassoulet, chocolat, biscuit, cookie, bonbon, cafe, the, tisane, infusion, confiture, miel, nutella, pate a tartiner, chips, cacahuete, noix, amande, noisette, compote, levure, bouillon, soupe, biscotte, olive, cornichon, mais, pop corn',
  boisson: 'jus d orange, jus de pomme, jus de fruits, jus de raisin, jus de citron, jus de legumes, eau, jus, soda, coca, cola, limonade, biere, vin, cidre, champagne, prosecco, whisky, vodka, rhum, gin, sirop, orangina, ice tea, perrier, evian, badoit, boisson, alcool, pastis, aperitif, apero, liqueur, kombucha, smoothie, schweppes, red bull, eau gazeuse, lait d avoine, lait d amande',
  pain: 'pain, baguette, croissant, pain au chocolat, chocolatine, brioche, viennoiserie, pain de mie, buns, ficelle, tourte, pain complet, patisserie, eclair, tarte, gateau, chausson, palmier, pain burger, pain hot dog',
  surgele: 'surgele, glace, sorbet, frites, pizza, poisson pane, beignet, gratin',
  maison: 'savon, shampoing, shampooing, dentifrice, brosse a dents, gel douche, deodorant, papier toilette, papier wc, pq, essuie tout, sopalin, mouchoir, lessive, adoucissant, liquide vaisselle, vaisselle, eponge, sac poubelle, poubelle, javel, eau de javel, nettoyant, detergent, produit menager, couche, lingette, coton, rasoir, mousse a raser, pile, ampoule, allumette, bougie, aluminium, alu, film alimentaire, papier cuisson, sac congelation, litiere, croquettes, tampon, serviette hygienique, protege slip, doliprane, pansement, parfum, creme hydratante, creme solaire, demaquillant, lave vitre, wc, pastille lave vaisselle',
};
const cnorm = t => String(t || '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let ckwIndex = null;
function ckwBuild() {
  const words = new Map(), phrases = [];
  for (const [cat, list] of Object.entries(CKW)) for (const w of list.split(',').map(x => cnorm(x).trim()).filter(Boolean)) {
    if (w.includes(' ')) phrases.push([w, cat]); else words.set(w, cat);
  }
  phrases.sort((a, b) => b[0].length - a[0].length);
  ckwIndex = { words, phrases };
}
/* Rayons suggérés pour un titre, dans l'ordre d'apparition des mots (sans doublon).
   Une expression (« pain au chocolat ») compte pour un seul mot-clé : ses mots ne suggèrent rien de plus.
   « surgelé » l'emporte sur tout : « poulet surgelé » ne suggère que les surgelés.
   Plusieurs rayons = titre ambigu (« jambon fromage ») : tous sont proposés, le premier est celui par défaut. */
function suggestCats(title) {
  if (!ckwIndex) ckwBuild();
  const t = ' ' + cnorm(title).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  if (t.length < 4) return [];
  const hits = [], taken = [], free = (a, z) => !taken.some(([x, y]) => a < y && z > x);
  for (const [ph, cat] of ckwIndex.phrases) {
    const i = t.indexOf(' ' + ph + ' '); if (i < 0) continue;
    const a = i + 1, z = a + ph.length; if (!free(a, z)) continue;
    taken.push([a, z]); hits.push({ pos: a, cat });
  }
  let pos = 1;
  for (const w of t.trim().split(' ')) {
    const z = pos + w.length, cat = ckwIndex.words.get(w) || (w.length > 3 ? ckwIndex.words.get(w.replace(/[sx]$/, '')) : undefined);
    if (cat && free(pos, z)) { if (w.startsWith('surgel')) return ['surgele']; hits.push({ pos, cat }); }
    pos = z + 1;
  }
  return [...new Set(hits.sort((x, y) => x.pos - y.pos).map(h => h.cat))];
}
const suggestCat = title => suggestCats(title)[0] || null; // le premier : celui rangé d'office
/* rayons suggérés affichés : seulement tant que rien n'est choisi (cat vide = « aucun rayon » voulu) */
const sugOf = it => (it.cat == null ? suggestCats(it.title) : []);
const cParts = text => text.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
const draftSug = () => { if (cui.draft != null) return []; const p = cParts(cui.text); return p.length === 1 ? suggestCats(p[0]) : []; };

const COURSES_KEY = 'courses.v1.commun';
const courses = { data: null, snap: new Map(), colls: ['items'] };
const cui = { text: '', draft: null, pending: false };
const ccat = id => CCATS.find(c => c.id === id);
const cOrder = id => { const i = CCATS.findIndex(c => c.id === id); return i < 0 ? 99 : i; };

/* ---------- données ---------- */
function coursesLoad() {
  let d = readLS(COURSES_KEY);
  if (!d || !Array.isArray(d.items)) d = { v: 1, items: [], tomb: {}, meta: {} };
  courses.data = d; normalizeStore(courses);
}
function coursesSave() {
  courses.data.meta.savedAt = Date.now();
  trackStore(courses);
  try { localStorage.setItem(COURSES_KEY, JSON.stringify(courses.data)); } catch (e) { /* ignore */ }
  dbxSync.schedule('courses');
}
function coursesAdopt(target) { // la fusion avec Dropbox est arrivée
  courses.data = target; normalizeStore(courses);
  try { localStorage.setItem(COURSES_KEY, JSON.stringify(courses.data)); } catch (e) { /* ignore */ }
  coursesRefresh();
}
/* Dans l'ordre de la liste (celui où on l'a saisie, ou rangée) */
const cItems = () => [...courses.data.items].sort((a, b) => (a.o || 0) - (b.o || 0) || a.id.localeCompare(b.id));
const cLeft = () => courses.data.items.filter(x => !x.done).length;
const cDone = () => courses.data.items.filter(x => x.done).length;
const cSub = () => { const n = cLeft(), d = cDone(); return n || d ? `${n} à prendre${d ? ` · ${d} coché${d > 1 ? 's' : ''}` : ''}` : ''; };
function coursesTileBadge() {
  try { const n = cLeft(); return n ? `<span class="tbadge hot">${n} à prendre</span>` : '<span class="tbadge">Liste vide</span>'; } catch (e) { return ''; }
}
/* modification avec annulation */
function cmutate(fn, msg) {
  const prev = JSON.stringify(courses.data.items);
  fn(); coursesSave(); coursesRefresh();
  if (msg) toast(msg, () => { courses.data.items = JSON.parse(prev); coursesSave(); coursesRefresh(); });
}
function cAddItems(text, cat) {
  const parts = cParts(text);
  if (!parts.length) return false;
  let o = Math.max(0, ...courses.data.items.map(x => x.o || 0));
  parts.forEach(t => courses.data.items.push({ id: uid(), title: t, cat: cat || suggestCat(t) || null, done: false, o: ++o, createdAt: D.today(), by: hub.profile }));
  coursesSave(); return true;
}

/* ---------- rendu ---------- */
function cCatsHtml(id, cur, sugs = []) {
  const c = ccat(cur), sc = ccat(sugs[0]), m = c || sc, multi = sugs.length > 1;
  const cls = x => cur === x.id ? 'on' : sugs.includes(x.id) ? `sug${multi ? ' multi' : ''}${sugs[0] === x.id ? ' first' : ''}` : '';
  const tip = x => esc(x.label) + (cur || !sugs.includes(x.id) ? '' : !multi ? ' : suggestion, clique pour valider' : sugs[0] === x.id ? ' : suggestion par défaut (premier mot), clique pour valider' : ' : autre possibilité, clique pour choisir');
  return `<span class="ccats">${CCATS.map(x => `<button type="button" class="ccat ${cls(x)}" style="--c:${x.color}" title="${tip(x)}" aria-pressed="${cur === x.id}" data-do="cCat" data-id="${id}" data-cat="${x.id}">${ic(x.icon, 19)}</button>`).join('')}</span>
    <button type="button" class="ccatm ${c ? 'on' : sc ? `sug first${multi ? ' multi' : ''}` : ''}" style="--c:${m ? m.color : 'var(--ink3)'}" title="Rayon${sc && !c ? ' : ' + esc(sugs.map(k => ccat(k).label).join(' ou ')) + ' (suggestion)' : ''}" data-do="cCatMenu" data-id="${id}">${ic(m ? m.icon : 'tag', 19)}</button>`;
}
function cListHtml() {
  const items = cItems();
  if (!items.length) return '<li class="cempty"><b>La liste est vide</b>Ajoute ton premier article ci-dessus (tu peux en saisir plusieurs d\'un coup, séparés par des virgules). Le logo de rayon est facultatif : il sert seulement à ranger la liste dans l\'ordre du magasin.</li>';
  return items.map(it => `<li class="ci ${it.done ? 'done' : ''}" data-id="${it.id}">
    <button type="button" class="cchk" data-do="cToggle" data-id="${it.id}" aria-label="${it.done ? 'Décocher' : 'Cocher'}" aria-pressed="${!!it.done}">${it.done ? ic('check', 15) : ''}</button>
    <input class="ctitle" data-cid="${it.id}" value="${esc(it.title)}" autocomplete="off" aria-label="Article">
    ${cCatsHtml(it.id, it.cat, sugOf(it))}
    <button type="button" class="iconbtn cdel" data-do="cDel" data-id="${it.id}" title="Retirer">${ic('x', 15)}</button></li>`).join('');
}
function coursesHtml() {
  return `<div class="hubwrap cw"><div class="cwrap">
    <header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button><h1>Courses</h1><span class="sub" id="csub">${cSub()}</span><span class="sp"></span>
      <button class="iconbtn" data-do="cCards" title="Cartes de fidélité du dossier Courses">${ic('cardId', 19)}</button>
      <button class="btn" data-do="cSort" title="Range la liste dans l'ordre du magasin, d'après les logos (les articles sans logo vont à la fin)">${ic('list', 15)}<span class="lbl">Ranger par rayon</span></button>
      <button class="btn" data-do="cClear" id="cclear" title="Retire de la liste les articles cochés"${cDone() ? '' : ' disabled'}>${ic('trash', 15)}<span class="lbl">Retirer les cochés</span></button></header>
    <div class="ci cadd"><span class="cplus">${ic('plus', 18)}</span>
      <input class="ctitle" id="c-add" placeholder="Ajouter un article…" value="${esc(cui.text)}" autocomplete="off" enterkeyhint="done">
      ${cCatsHtml('draft', cui.draft, draftSug())}<button type="button" class="btn primary sm cgo" data-do="cAdd">Ajouter</button></div>
    <ul class="citems" id="clist">${cListHtml()}</ul>
    <footer class="hubfoot" id="cfoot">${dbxBadge()}</footer></div></div>`;
}
/* rafraîchit la liste sans toucher au champ d'ajout ni à l'article en cours de saisie */
function coursesRefresh() {
  if (hub.screen !== 'courses') return;
  const ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains('ctitle') && ae.id !== 'c-add') { cui.pending = true; return; }
  const l = document.getElementById('clist'); if (!l) return render();
  cui.pending = false;
  l.innerHTML = cListHtml();
  const s = document.getElementById('csub'); if (s) s.textContent = cSub();
  const c = document.getElementById('cclear'); if (c) c.disabled = !cDone();
  const f = document.getElementById('cfoot'); if (f) f.innerHTML = dbxBadge();
  refreshDraftCats();
}
function refreshDraftCats() {
  const d = document.querySelector('.cadd'), go = d && d.querySelector('.cgo'); if (!go) return;
  d.querySelector('.ccats')?.remove(); d.querySelector('.ccatm')?.remove(); go.insertAdjacentHTML('beforebegin', cCatsHtml('draft', cui.draft, draftSug()));
}
function refreshRowCats(it) {
  const li = document.querySelector(`.ci[data-id="${it.id}"]`), del = li && li.querySelector('.cdel'); if (!del) return;
  li.querySelector('.ccats')?.remove(); li.querySelector('.ccatm')?.remove(); del.insertAdjacentHTML('beforebegin', cCatsHtml(it.id, it.cat, sugOf(it)));
}

/* ---------- actions ---------- */
const cItem = id => courses.data.items.find(x => x.id === id);
function cSetCat(id, cat) {
  if (id === 'draft') { cui.draft = cui.draft === cat ? null : cat; const a = document.getElementById('c-add'); coursesRefresh(); a?.focus(); return; }
  const it = cItem(id); if (!it) return;
  it.cat = it.cat === cat ? '' : cat; coursesSave(); coursesRefresh(); // re-clic : « aucun rayon », et plus de suggestion
}
function cNoCat(id) {
  if (id === 'draft') { cui.draft = null; refreshDraftCats(); return; }
  const it = cItem(id); if (!it || it.cat === '') return;
  it.cat = ''; coursesSave(); coursesRefresh();
}
function cAddNow() {
  const inp = document.getElementById('c-add');
  if (cAddItems(cui.text, cui.draft)) { cui.text = ''; cui.draft = null; if (inp) inp.value = ''; coursesRefresh(); }
  inp?.focus();
}
const coursesH = {
  cAdd: () => cAddNow(),
  cCards: () => openCartesFolder('courses'),
  cToggle: el => { const it = cItem(el.dataset.id); if (!it) return; it.done = !it.done; if (it.done) it.doneAt = D.today(); else delete it.doneAt; coursesSave(); coursesRefresh(); },
  cCat: el => cSetCat(el.dataset.id, el.dataset.cat),
  cCatMenu: el => {
    const id = el.dataset.id, draft = id === 'draft', it = draft ? null : cItem(id), cur = draft ? cui.draft : it?.cat, sugs = cur == null ? (draft ? draftSug() : suggestCats(it?.title)) : [];
    showMenu(...at(el), [{ label: 'Rayon' }, ...CCATS.map(c => ({ label: c.label + (sugs[0] === c.id ? (sugs.length > 1 ? ' (suggéré par défaut)' : ' (suggéré)') : sugs.includes(c.id) ? ' (suggéré aussi)' : ''), icon: c.icon, run: () => { if (cur !== c.id) cSetCat(id, c.id); } })),
      '-', { label: draft ? 'Automatique' : 'Aucun rayon', icon: 'x', run: () => cNoCat(id) }]);
  },
  cDel: el => cmutate(() => { courses.data.items = courses.data.items.filter(x => x.id !== el.dataset.id); }, 'Article retiré'),
  cClear: () => { const n = cDone(); if (n) cmutate(() => { courses.data.items = courses.data.items.filter(x => !x.done); }, `${n} article${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''}`); },
  cSort: () => {
    if (!courses.data.items.length) return;
    cmutate(() => {
      const rank = it => (it.done ? 1000 : 0) + cOrder(it.cat || sugOf(it)[0]);
      cItems().map((it, i) => ({ it, i })).sort((x, y) => rank(x.it) - rank(y.it) || x.i - y.i).forEach(({ it }, n) => { if (it.o !== n + 1) it.o = n + 1; });
    }, 'Rangé par rayon');
  },
};

/* saisie : article renommé, ajout au clavier */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'c-add') { cui.text = el.value; refreshDraftCats(); return; }
  if (el.classList && el.classList.contains('ctitle') && el.dataset.cid) { const it = cItem(el.dataset.cid); if (it) { it.title = el.value; coursesSave(); refreshRowCats(it); } }
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (!(el.classList && el.classList.contains('ctitle') && el.dataset.cid)) return;
  const it = cItem(el.dataset.cid);
  if (it && !it.title.trim()) { courses.data.items = courses.data.items.filter(x => x.id !== it.id); coursesSave(); } // titre vidé = article retiré
  else if (it) { it.title = it.title.trim(); coursesSave(); }
  setTimeout(() => { if (cui.pending) coursesRefresh(); else if (!it || !it.title) coursesRefresh(); }, 0);
});
function coursesKey(e) {
  if (e.key === 'Enter' && e.target.id === 'c-add') { e.preventDefault(); cAddNow(); }
  else if (e.key === 'Enter' && e.target.classList?.contains('ctitle')) e.target.blur();
  else if (e.key === 'Escape') { if (/INPUT/.test(e.target.tagName)) e.target.blur(); else hubHome(); }
}
/* la liste est partagée : on la rafraîchit régulièrement tant qu'elle est ouverte */
setInterval(() => { if (hub.screen === 'courses' && !document.hidden) dbxSync.syncNow(['courses']); }, 25000);
