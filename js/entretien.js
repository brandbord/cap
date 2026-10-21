'use strict';
/* =====================================================================
   ENTRETIEN : maintenance long terme du matériel et de la maison (≠ les routines de ménage de Cap).
   - Deux sections : Appareils (lave-linge, chaudière…) et Maison (toiture, carrelage extérieur…).
   - Chaque élément : une fréquence (en mois, saisie en mois ou en ans), la date du dernier entretien,
     une description de l'entretien attendu, et une info libre (« livret dans le tiroir du garage, garantie 2028 »,
     « fragilité repérée au dernier contrôle »…).
   - Prochaine échéance = dernier entretien + fréquence ; jamais entretenu = à faire tout de suite.
   - La tuile du hub affiche une pastille avec le nombre d'éléments à faire (rien quand c'est 0).
   - Un seul fichier commun, comme Weekend / Nos listes. Les anciennes « catégories » de la v1.27 sont migrées
     (catégorie « Maison » → section Maison, le reste → Appareils ; l'ancienne note → description).
   ===================================================================== */
Object.assign(ICONS, {
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
});
const ENT_KEY = 'entretien.v1.commun';
const ENT_KINDS = [['app', 'Appareils'], ['house', 'Maison']];
const ENT_FREQS = [3, 6, 12, 24, 36, 60, 120]; // mois : proposés dans le formulaire, en plus d'une saisie libre
const ent = { data: null, snap: new Map(), colls: ['cats', 'items'] };
const eui = { tab: 'app', q: '' };

/* ---------- données ---------- */
/* anciens éléments (v1.27) : catégorie → section, note → description. Éléments de départ sans groupe : on leur en donne un
   (et on retire l'info qui n'était que le lieu). Idempotent. */
function entMigrate(d) {
  d.items.forEach(it => {
    if (it.kind !== 'app' && it.kind !== 'house') {
      const c = (d.cats || []).find(x => x.id === it.catId);
      it.kind = c && /maison/i.test(c.name) ? 'house' : 'app';
    }
    if (it.notes && it.desc == null) { it.desc = it.notes; delete it.notes; }
    const s = ENT_SEED.find(x => x[0] === it.id);
    if (s && it.group == null) { it.group = s[2]; if (it.info === ENT_SEED_OLDINFO[it.id]) it.info = s[6]; }
  });
}
/* Liste de départ (maison en semi-individuel), ajoutée une seule fois par appareil. Ids fixes : deux appareils ne créent pas de doublons
   à la synchro, et un élément supprimé (tomb) n'est pas recréé. [id, section, groupe, titre, fréquence en mois, entretien attendu, infos] */
const ENT_SEED_KEY = 'entretien.seed.v1';
const ENT_SEED_OLDINFO = { 'seed-vmc': 'Ventilation', 'seed-diff': 'Tableau électrique', 'seed-lavelinge': 'Salle de bain, cuisine', 'seed-chaudiere': 'Chauffage. Garder l\'attestation.',
  'seed-garage': 'Garage', 'seed-fumee': 'Pièces de vie', 'seed-gouttieres': 'Toiture', 'seed-veranda-nettoyage': 'Véranda', 'seed-terrasses': 'Terrasses',
  'seed-toiture': 'Toiture', 'seed-joints': 'Véranda, menuiseries', 'seed-murs': 'Cave, façade', 'seed-robinets': 'Eau', 'seed-arbres': 'Jardin' };
const ENT_SEED = [
  ['seed-chaudiere', 'app', 'Chauffage et eau chaude', 'Chaudière', 12, 'Entretien par un pro (obligatoire gaz et fioul).', 'Garder l\'attestation.'],
  ['seed-chauffeeau', 'app', 'Chauffage et eau chaude', 'Chauffe-eau', 24, 'Détartrer et contrôler l\'anode.', 'À faire tous les 2 à 3 ans.'],
  ['seed-diff', 'app', 'Électricité et sécurité', 'Disjoncteur différentiel', 6, 'Tester avec le bouton « test ».', 'Tableau électrique.'],
  ['seed-fumee', 'app', 'Électricité et sécurité', 'Détecteurs de fumée', 12, 'Changer la pile, ou l\'appareil au bout de 10 ans.', 'Pièces de vie.'],
  ['seed-vmc', 'app', 'Ventilation', 'Bouches de VMC', 6, 'Nettoyer les bouches (aspirateur, chiffon humide).', ''],
  ['seed-lavelinge', 'app', 'Électroménager', 'Lave-linge : siphons et filtre', 6, 'Nettoyer les siphons et le filtre du lave-linge.', 'Salle de bain, cuisine.'],
  ['seed-garage', 'app', 'Garage', 'Porte de garage', 12, 'Lubrifier la porte et vérifier les ressorts.', ''],
  ['seed-gouttieres', 'house', 'Toiture et gouttières', 'Gouttières', 6, 'Nettoyer : après la chute des feuilles, puis au printemps.', ''],
  ['seed-toiture', 'house', 'Toiture et gouttières', 'Toiture : inspection visuelle', 12, 'Depuis le sol : tuiles déplacées ou cassées, mousse.', ''],
  ['seed-mitoyen', 'house', 'Toiture et gouttières', 'Mur mitoyen et jonction de toiture avec le voisin', 12, 'Contrôler les infiltrations (gouttière partagée, solin de raccord).', 'Point sensible du semi-individuel : voir qui entretient quoi et privilégier une démarche concertée avec le voisin.'],
  ['seed-veranda-nettoyage', 'house', 'Véranda et menuiseries', 'Véranda : vitrage et rails', 6, 'Nettoyer vitrage et profilés, vider les rails de coulissants et les trous d\'évacuation.', ''],
  ['seed-joints', 'house', 'Véranda et menuiseries', 'Joints de véranda et de fenêtres', 12, 'Vérifier les joints, graisser la quincaillerie.', ''],
  ['seed-terrasses', 'house', 'Extérieur et jardin', 'Terrasses', 6, 'Nettoyer (mousse, algues, feuilles).', ''],
  ['seed-arbres', 'house', 'Extérieur et jardin', 'Arbres du jardin', 12, 'Inspecter les arbres.', ''],
  ['seed-murs', 'house', 'Murs et humidité', 'Murs : fissures et humidité', 12, 'Contrôler fissures, salpêtre, traces d\'eau, odeur de moisi.', 'Cave, façade.'],
  ['seed-robinets', 'house', 'Plomberie', 'Robinets d\'arrêt', 12, 'Manœuvrer le robinet d\'arrêt général et les robinets individuels (évite le blocage).', ''],
];
function entSeed(d) {
  let done = false; try { done = !!localStorage.getItem(ENT_SEED_KEY); } catch (e) { /* ignore */ }
  if (done) return false;
  ENT_SEED.forEach(([id, kind, group, title, freq, desc, info]) => {
    if (d.items.some(x => x.id === id) || (d.tomb && d.tomb[id])) return;
    d.items.push({ id, kind, group, title, freq, last: null, desc, info, by: null, createdAt: D.today() });
  });
  try { localStorage.setItem(ENT_SEED_KEY, '1'); } catch (e) { /* ignore */ }
  return true;
}
function entLoad() {
  let d = readLS(ENT_KEY);
  if (!d || !Array.isArray(d.items)) d = { v: 1, cats: [], items: [] };
  if (!Array.isArray(d.cats)) d.cats = [];
  entMigrate(d); const seeded = entSeed(d); ent.data = d; normalizeStore(ent);
  if (seeded) try { localStorage.setItem(ENT_KEY, JSON.stringify(ent.data)); } catch (e) { /* ignore */ }
}
function entSave() { ent.data.meta.savedAt = Date.now(); trackStore(ent); try { localStorage.setItem(ENT_KEY, JSON.stringify(ent.data)); } catch (e) { /* ignore */ } dbxSync.schedule('entretien'); }
function entAdopt(target) {
  ent.data = target; if (!Array.isArray(target.cats)) target.cats = []; if (!Array.isArray(target.items)) target.items = [];
  entMigrate(target); normalizeStore(ent); try { localStorage.setItem(ENT_KEY, JSON.stringify(ent.data)); } catch (e) { /* ignore */ } entRefresh();
}
const entItems = kind => ent.data.items.filter(it => !kind || it.kind === kind);
const entItem = id => ent.data.items.find(x => x.id === id);
/* prochaine échéance : jamais fait = maintenant */
const entNext = it => (it.last ? D.addMonths(it.last, it.freq) : D.today());
const entDays = it => D.diff(entNext(it), D.today());
const entState = it => { const n = entDays(it); return n <= 0 ? 'late' : n <= 30 ? 'soon' : 'ok'; };
const entDueCount = kind => { try { return entItems(kind).filter(it => entState(it) === 'late').length; } catch (e) { return 0; } };
const freqLabel = m => (m % 12 === 0 ? `${m / 12} an${m / 12 > 1 ? 's' : ''}` : `${m} mois`);
function entDo(id, date) {
  const it = entItem(id); if (!it) return;
  const prev = it.last; it.last = date || D.today(); entSave(); entRefresh();
  toast('Entretien noté ✓', () => { it.last = prev || null; entSave(); entRefresh(); });
}
/* pastille type notification sur l'icône de la tuile : le nombre d'éléments à faire, rien si 0 */
function entTileBubble() { const n = entDueCount(); return n ? `<span class="nbubble" title="${n} à entretenir">${n}</span>` : ''; }
function entTileBadge() {
  try {
    const n = entDueCount();
    return n ? `<span class="tbadge hot">${n} à entretenir</span>` : `<span class="tbadge">${entItems().length ? 'À jour' : 'Rien pour l\'instant'}</span>`;
  } catch (e) { return ''; }
}

/* ---------- rendu ---------- */
function entRowHtml(it, where) {
  const st = entState(it), n = entDays(it);
  const due = st === 'late' ? `<b class="entdue late">${it.last ? (n === 0 ? "aujourd'hui" : `en retard de ${-n} j`) : 'à faire'}</b>` : st === 'soon' ? `<b class="entdue soon">dans ${n} j</b>` : `<span class="entdue ok">dans ${n > 60 ? (n >= 700 ? Math.round(n / 365 * 10) / 10 + ' ans' : Math.round(n / 30) + ' mois') : n + ' j'}</span>`;
  return `<li class="ci entrow" data-id="${it.id}">
    <button type="button" class="entopen" data-do="entEdit" data-id="${it.id}">
      <span class="entmeta"><b>${esc(it.title)}</b><span class="muted">${where ? esc(`${it.kind === 'house' ? 'Maison' : 'Appareils'}${it.group ? ' · ' + it.group : ''}`) + ' · ' : ''}tous les ${freqLabel(it.freq)}${it.last ? ` · dernier : ${fmtDM(it.last)}` : ' · jamais fait'}</span>
        ${it.desc ? `<span class="entinfo">${esc(it.desc)}</span>` : ''}${it.info ? `<span class="entinfo note">${ic('note', 12)}${esc(it.info)}</span>` : ''}</span>
      ${due}</button>
    <button type="button" class="btn sm entok" data-do="entDo" data-id="${it.id}" title="Marquer fait aujourd'hui">${ic('check', 15)}</button></li>`;
}
const ENT_NOGROUP = 'Sans groupe';
function entBody() {
  const q = eui.q.trim().toLowerCase(), add = `<div style="padding:14px 0"><button class="btn primary sm" data-do="entNewItem">${ic('plus', 15)}Ajouter ${eui.tab === 'app' ? 'un appareil' : 'un élément de la maison'}</button></div>`;
  const byDue = (a, b) => entDays(a) - entDays(b) || a.title.localeCompare(b.title);
  if (q) { // recherche : tout, sections et groupes confondus
    const hit = entItems().filter(it => [it.title, it.group, it.desc, it.info].some(t => (t || '').toLowerCase().includes(q))).sort(byDue);
    return (hit.length ? `<ul class="citems entlist">${hit.map(it => entRowHtml(it, true)).join('')}</ul>` : `<div class="cempty"><b>Aucun résultat</b>Rien ne correspond à « ${esc(eui.q.trim())} ».</div>`) + add;
  }
  const items = entItems(eui.tab);
  if (!items.length) return `<div class="cempty"><b>Rien ici pour l'instant</b>${eui.tab === 'app' ? 'Ex : lave-linge, chaudière, VMC, déshumidificateur…' : 'Ex : toiture, carrelage extérieur, gouttières…'}</div>${add}`;
  const groups = new Map();
  items.forEach(it => { const g = (it.group || '').trim() || ENT_NOGROUP; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
  const names = [...groups.keys()].sort((a, b) => (a === ENT_NOGROUP) - (b === ENT_NOGROUP) || a.localeCompare(b));
  return names.map(g => {
    const list = groups.get(g).sort(byDue), n = list.filter(it => entState(it) === 'late').length;
    return `<section class="entgrp"><h2>${esc(g)}${n ? `<span class="nbubble inline">${n}</span>` : ''}</h2><ul class="citems entlist">${list.map(it => entRowHtml(it)).join('')}</ul></section>`;
  }).join('') + add;
}

/* ---------- écran ---------- */
function entHtml() {
  return `<div class="hubwrap cw"><div class="cwrap">
    <header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button><h1>Entretien</h1><span class="sp"></span></header>
    <div class="seg ltabs">${ENT_KINDS.map(([v, l]) => { const n = entDueCount(v); return `<button class="${eui.tab === v ? 'on' : ''}" data-do="entTab" data-v="${v}">${esc(l)}${n ? `<span class="nbubble inline">${n}</span>` : ''}</button>`; }).join('')}</div>
    <input class="in entq" id="ent-q" type="search" placeholder="Chercher un équipement ou un entretien…" value="${esc(eui.q)}" autocomplete="off">
    <div id="entbody">${entBody()}</div>
    <footer class="hubfoot">${dbxBadge()}</footer></div></div>`;
}
document.addEventListener('input', e => { // recherche : on ne redessine que la liste, pour garder le focus du champ
  if (e.target.id !== 'ent-q' || hub.screen !== 'entretien') return;
  eui.q = e.target.value; document.getElementById('entbody').innerHTML = entBody();
});
function entRefresh() { if (hub.screen === 'entretien') render(); }

/* ---------- modale ---------- */
function entItemModal(it) {
  const editing = !!it, kind = it?.kind || eui.tab, isApp = kind === 'app';
  const inYears = it && !ENT_FREQS.includes(it.freq) && it.freq % 12 === 0;
  const m = openModal(`<h3>${editing ? 'Modifier' : isApp ? 'Nouvel appareil' : 'Nouvel élément de la maison'}</h3>
    <div class="fld"><label>Quoi ?</label><input class="in" id="ei-t" placeholder="${isApp ? 'Ex : lave-vaisselle' : 'Ex : carrelage extérieur'}" value="${esc(it?.title || '')}" autocomplete="off"></div>
    <div class="fld"><label>Section</label><select class="in" id="ei-k">${ENT_KINDS.map(([v, l]) => `<option value="${v}" ${kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="fld"><label>Groupe</label><input class="in" id="ei-g" list="ei-gl" placeholder="Ex : Chauffage et eau chaude, Extérieur…" value="${esc(it?.group || '')}" autocomplete="off">
      <datalist id="ei-gl">${[...new Set(entItems().map(x => (x.group || '').trim()).filter(Boolean))].sort().map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>
    <div class="fld"><label>Tous les…</label><div class="freqpick" id="ei-f">${ENT_FREQS.map(m2 => `<button type="button" class="freqbtn ${it?.freq === m2 ? 'on' : ''}" data-v="${m2}">${freqLabel(m2)}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:8px"><input class="in" id="ei-fn" type="number" min="1" placeholder="Ou un autre nombre…" value="${it && !ENT_FREQS.includes(it.freq) ? (inYears ? it.freq / 12 : it.freq) : ''}" style="flex:1">
        <select class="in" id="ei-fu" style="width:auto"><option value="1">mois</option><option value="12" ${inYears ? 'selected' : ''}>ans</option></select></div></div>
    <div class="fld"><label>Dernier entretien</label><input class="in" type="date" id="ei-d" value="${it?.last || ''}"></div>
    <div class="fld"><label>Entretien attendu</label><textarea class="in notes" id="ei-n" rows="2" placeholder="${isApp ? 'Ex : détartrer, changer le filtre…' : 'Ex : refaire les jointures, contrôler les tuiles…'}">${esc(it?.desc || '')}</textarea></div>
    <div class="fld"><label>Infos</label><textarea class="in notes" id="ei-i" rows="3" placeholder="${isApp ? 'Ex : livret dans le tiroir du garage, garantie jusqu\'en 2028…' : 'Ex : fragilité repérée au dernier contrôle…'}">${esc(it?.info || '')}</textarea></div>
    <div class="acts">${editing ? `<button class="btn danger" id="ei-del" style="margin-right:auto">${ic('trash', 14)}Supprimer</button>` : ''}<button class="btn" data-do="closeModal">Annuler</button><button class="btn primary" id="ei-ok">${editing ? 'Enregistrer' : 'Créer'}</button></div>`);
  const pickF = m.querySelector('#ei-f');
  pickF.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pickF.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); m.querySelector('#ei-fn').value = ''; });
  m.querySelector('#ei-fn').addEventListener('input', () => pickF.querySelectorAll('button').forEach(x => x.classList.remove('on')));
  const ok = () => {
    const title = m.querySelector('#ei-t').value.trim(); if (!title) return m.querySelector('#ei-t').focus();
    const fBtn = pickF.querySelector('button.on'), fn = Math.round(+m.querySelector('#ei-fn').value * +m.querySelector('#ei-fu').value);
    const freq = fBtn ? +fBtn.dataset.v : (fn > 0 ? fn : null);
    if (!freq) return m.querySelector('#ei-fn').focus();
    const kind2 = m.querySelector('#ei-k').value, group = m.querySelector('#ei-g').value.trim(), last = m.querySelector('#ei-d').value || null, desc = m.querySelector('#ei-n').value.trim(), info = m.querySelector('#ei-i').value.trim();
    closeModal();
    if (editing) Object.assign(it, { title, kind: kind2, group, freq, last, desc, info });
    else ent.data.items.push({ id: uid(), title, kind: kind2, group, freq, last, desc, info, by: hub.profile, createdAt: D.today() });
    eui.tab = kind2; entSave(); render();
  };
  m.querySelector('#ei-ok').onclick = ok;
  m.querySelector('#ei-t').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  if (editing) m.querySelector('#ei-del').onclick = () => {
    closeModal(); ent.data.items = ent.data.items.filter(x => x.id !== it.id); entSave(); render();
    toast('Supprimé', () => { ent.data.items.push(it); entSave(); render(); });
  };
}

/* ---------- actions ---------- */
const entH = {
  entTab: el => { eui.tab = el.dataset.v; render(); scrollTo(0, 0); },
  entNewItem: () => entItemModal(null),
  entEdit: el => entItemModal(entItem(el.dataset.id)),
  entDo: el => entDo(el.dataset.id),
};
function entKey(e) {
  if (e.key === 'Escape') { if (document.getElementById('modal')) closeModal(); else hubHome(); }
}
setInterval(() => { if (hub.screen === 'entretien' && !document.hidden) dbxSync.syncNow(['entretien']); }, 25000);
