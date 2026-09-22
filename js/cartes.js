'use strict';
/* =====================================================================
   CARTES DE FIDÉLITÉ : rangées par dossier, communes par défaut, privatisables au cas par cas.
   - Dossiers : toujours communs (organisation partagée). « Non rangé » n'existe pas comme dossier réel,
     c'est juste l'absence de dossier (folderId: null). « Courses » est créé une fois pour toutes et ne se
     supprime pas, pour que le raccourci depuis l'appli Courses ne se casse jamais.
   - Confidentialité : une carte est commune par défaut. La privatiser la fait changer de fichier — elle part
     dans TON fichier perso (cartes/<profil>.json), jamais dans le commun : comme les actions perso de Cap,
     elle ne transite jamais par un fichier que l'autre synchronise. Reprendre « Commun » la renvoie dans
     cartes/commun.json, visible à nouveau des deux côtés.
   - Affichage en caisse : le code-barres est redessiné à partir du numéro stocké (bibliothèques JsBarcode /
     qrcode.js embarquées localement dans js/vendor, donc ça marche aussi sans réseau), toujours en noir sur
     blanc quel que soit le thème — un code-barres sur fond sombre ne scanne pas.
   - La saisie caméra (photographier le code-barres pour remplir le numéro) utilise l'API BarcodeDetector du
     navigateur, native à Chrome/Edge (donc au téléphone et au PC) : rien à télécharger. Si le navigateur ne
     la propose pas, on retombe simplement sur la saisie manuelle.
   ===================================================================== */
const FID_FORMATS = {
  code_128: { label: 'Code 128 (le plus courant)', jsb: 'CODE128' },
  ean_13: { label: 'EAN-13', jsb: 'EAN13' },
  ean_8: { label: 'EAN-8', jsb: 'EAN8' },
  upc_a: { label: 'UPC-A', jsb: 'UPC' },
  upc_e: { label: 'UPC-E', jsb: 'UPC' },
  code_39: { label: 'Code 39', jsb: 'CODE39' },
  itf: { label: 'ITF', jsb: 'ITF14' },
  qr_code: { label: 'QR code', jsb: null },
  text: { label: 'Texte seul (pas de code scannable)', jsb: null },
};
const FID_SCAN_FORMATS = ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'itf', 'qr_code'];
const FID_KEY = 'cartes.v1.commun', FID_PKEY = () => 'cartes.v1.' + hub.profile;
const fidC = { data: null, snap: new Map(), colls: ['folders', 'cards'] }; // commun : dossiers + cartes partagées
const fidP = { data: null, snap: new Map(), colls: ['cards'] };           // perso : mes cartes privatisées
const fidUi = { folder: 'all', show: null, scan: null, add: null };       // add/show/scan : id ou état de la modale en cours

/* ---------- données ---------- */
function fidLoad() {
  let dc = readLS(FID_KEY);
  if (!dc || !Array.isArray(dc.cards)) dc = { v: 1, folders: [], cards: [] };
  if (!Array.isArray(dc.folders)) dc.folders = [];
  if (!dc.folders.find(f => f.id === 'courses')) dc.folders.push({ id: 'courses', name: 'Courses', fixed: true, createdAt: D.today() });
  fidC.data = dc; normalizeStore(fidC);
  let dp = readLS(FID_PKEY());
  if (!dp || !Array.isArray(dp.cards)) dp = { v: 1, cards: [] };
  fidP.data = dp; normalizeStore(fidP);
}
function fidSaveC() { fidC.data.meta.savedAt = Date.now(); trackStore(fidC); try { localStorage.setItem(FID_KEY, JSON.stringify(fidC.data)); } catch (e) { /* ignore */ } dbxSync.schedule('cartes'); }
function fidSaveP() { fidP.data.meta.savedAt = Date.now(); trackStore(fidP); try { localStorage.setItem(FID_PKEY(), JSON.stringify(fidP.data)); } catch (e) { /* ignore */ } dbxSync.schedule('cartesPerso'); }
function fidAdoptC(target) {
  fidC.data = target; normalizeStore(fidC);
  if (!fidC.data.folders.find(f => f.id === 'courses')) fidC.data.folders.push({ id: 'courses', name: 'Courses', fixed: true, createdAt: D.today() });
  try { localStorage.setItem(FID_KEY, JSON.stringify(fidC.data)); } catch (e) { /* ignore */ } fidRefresh();
}
function fidAdoptP(target) { fidP.data = target; normalizeStore(fidP); try { localStorage.setItem(FID_PKEY(), JSON.stringify(fidP.data)); } catch (e) { /* ignore */ } fidRefresh(); }

const fidFolders = () => fidC.data.folders;
/* Vue assemblée : commun + mes cartes perso (jamais celles de l'autre : elles ne sont même pas dans mon fichier) */
const fidCards = () => [...fidC.data.cards.map(c => ({ ...c, private: false })), ...fidP.data.cards.map(c => ({ ...c, private: true }))]
  .sort((a, b) => (a.o || 0) - (b.o || 0) || a.id.localeCompare(b.id));
function fidFind(id) { const c = fidC.data.cards.find(x => x.id === id); return c ? { card: c, store: fidC, save: fidSaveC } : (() => { const p = fidP.data.cards.find(x => x.id === id); return p ? { card: p, store: fidP, save: fidSaveP } : null; })(); }

function fidAddCard({ store, number, format, folderId }) {
  store = store.trim(); number = number.trim();
  if (!store || !number) return null;
  let o = Math.max(0, ...fidC.data.cards.map(x => x.o || 0), ...fidP.data.cards.map(x => x.o || 0));
  const card = { id: uid(), store, number, format: format || 'code_128', folderId: folderId || null, by: hub.profile, createdAt: D.today(), o: ++o };
  fidC.data.cards.push(card); fidSaveC();
  return card;
}
function fidDelCard(id) {
  const f = fidFind(id); if (!f) return;
  const prevC = JSON.stringify(fidC.data.cards), prevP = JSON.stringify(fidP.data.cards);
  f.store.data.cards = f.store.data.cards.filter(x => x.id !== id);
  f.save();
  toast('Carte supprimée', () => { fidC.data.cards = JSON.parse(prevC); fidP.data.cards = JSON.parse(prevP); fidSaveC(); fidSaveP(); fidRefresh(); });
  fidRefresh();
}
function fidToggle(id, silent) {
  const f = fidFind(id); if (!f) return;
  const card = f.card, toPerso = f.store === fidC;
  (toPerso ? fidC : fidP).data.cards = (toPerso ? fidC : fidP).data.cards.filter(x => x.id !== id);
  (toPerso ? fidP : fidC).data.cards.push(card);
  fidSaveC(); fidSaveP();
  if (!silent) toast(toPerso ? 'Carte privatisée : elle n\'apparaît plus que pour toi' : 'Carte repassée en commun');
  fidRefresh();
}
function fidSetFolder(id, folderId) { const f = fidFind(id); if (!f) return; f.card.folderId = folderId || null; f.save(); fidRefresh(); }
function fidAddFolder(name) {
  name = name.trim(); if (!name) return null;
  const f = { id: uid(), name, createdAt: D.today() };
  fidC.data.folders.push(f); fidSaveC(); return f;
}
function fidDelFolder(id) {
  const f = fidFolders().find(x => x.id === id); if (!f || f.fixed) return;
  fidC.data.folders = fidC.data.folders.filter(x => x.id !== id);
  [...fidC.data.cards, ...fidP.data.cards].forEach(c => { if (c.folderId === id) c.folderId = null; });
  fidSaveC(); fidSaveP();
  if (fidUi.folder === id) fidUi.folder = 'all';
  toast('Dossier supprimé, ses cartes repassent en « Non rangé »');
  fidRefresh();
}
function fidTileBadge() {
  try { const n = fidCards().length; return `<span class="tbadge">${n ? `${n} carte${n > 1 ? 's' : ''}` : 'Aucune carte'}</span>`; } catch (e) { return ''; }
}
/* Ouvre l'appli directement sur un dossier — utilisé par le raccourci de Courses */
function openCartesFolder(folderId) { hub.screen = 'cartes'; fidUi.folder = folderId; fidUi.show = fidUi.add = fidUi.scan = null; render(); scrollTo(0, 0); dbxSync.syncNow(['cartes', 'cartesPerso']); }

/* ---------- rendu : liste ---------- */
function fidFolderChips() {
  const items = [['all', 'Toutes'], [null, 'Non rangé'], ...fidFolders().map(f => [f.id, f.name])];
  return `<div class="toolbar fchips">${items.map(([id, label]) => `<button class="chip ${fidUi.folder === id ? 'on' : ''}" ${id && id !== 'all' ? `data-folder="${id}"` : ''} data-do="fidFolder" data-v="${id ?? ''}">${esc(label)}</button>`).join('')}
    <button class="chip" data-do="fidNewFolder">${ic('plus', 13)}Nouveau dossier</button></div>`;
}
/* clic droit sur un dossier (sauf « Toutes » / « Non rangé ») : renommer ou supprimer */
document.addEventListener('contextmenu', e => {
  const chip = e.target.closest('[data-folder]'); if (!chip) return;
  e.preventDefault();
  const id = chip.dataset.folder, f = fidFolders().find(x => x.id === id); if (!f) return;
  const items = [{ label: f.name }, { label: 'Renommer…', icon: 'note', run: () => askText('Nom du dossier', f.name, n => { if (n && n.trim()) { f.name = n.trim(); fidSaveC(); render(); } }) }];
  if (!f.fixed) items.push('-', { label: 'Supprimer', icon: 'trash', danger: true, run: () => fidDelFolder(id) });
  else items.push({ label: 'Ce dossier ne se supprime pas (lié à Courses)' });
  showMenu(e.clientX, e.clientY, items);
});
function fidRowsHtml() {
  let items = fidCards();
  if (fidUi.folder !== 'all') items = items.filter(c => (c.folderId || null) === fidUi.folder);
  if (!items.length) return `<li class="cempty"><b>Rien ici</b>${fidUi.folder === 'all' ? 'Ajoute ta première carte avec le bouton ci-dessus.' : 'Aucune carte dans ce dossier.'}</li>`;
  return items.map(c => {
    const folder = fidFolders().find(f => f.id === c.folderId);
    return `<li class="ci fidrow" data-id="${c.id}">
      <button type="button" class="fidopen" data-do="fidShow" data-id="${c.id}"><span class="fidico">${ic('cardId', 18)}</span>
        <span class="fidmeta"><b>${esc(c.store)}</b><span class="muted">${folder ? esc(folder.name) : 'Non rangé'}${c.private ? ' · privée' : ''}</span></span></button>
      ${byTag(c.by)}
      <button type="button" class="iconbtn cdel" data-do="fidDel" data-id="${c.id}" title="Supprimer">${ic('trash', 15)}</button></li>`;
  }).join('');
}
function fidListHtml() {
  return `<header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button><h1>Cartes de fidélité</h1><span class="sp"></span>
      <button class="btn primary sm" data-do="fidNewCard">${ic('plus', 15)}Ajouter</button></header>
    ${fidFolderChips()}
    <ul class="citems" id="fidlist">${fidRowsHtml()}</ul>
    <footer class="hubfoot">${dbxBadge()}</footer>`;
}

/* ---------- rendu : affichage plein écran (caisse) ---------- */
function fidRenderCode(el, card) {
  const spec = FID_FORMATS[card.format] || FID_FORMATS.code_128;
  el.innerHTML = '';
  if (card.format === 'text' || !spec.jsb && card.format !== 'qr_code') {
    el.innerHTML = `<div class="fidnum-only">${esc(card.number)}</div>`; return;
  }
  try {
    if (card.format === 'qr_code') {
      const qr = qrcode(0, 'M'); qr.addData(card.number); qr.make();
      const img = document.createElement('img'); img.src = qr.createDataURL(8, 8); img.alt = 'QR code'; img.className = 'fidqr';
      el.appendChild(img);
    } else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.appendChild(svg);
      JsBarcode(svg, card.number, { format: spec.jsb, lineColor: '#000', background: '#fff', width: 2.4, height: 110, displayValue: false, margin: 10 });
    }
  } catch (e) { el.innerHTML = `<div class="fidnum-only">${esc(card.number)}</div><p class="hint">Ce numéro ne correspond pas au format choisi — affiché en texte seul.</p>`; }
}
function fidShowHtml(card) {
  return `<div class="fidshow">
    <button class="iconbtn fidclose" data-do="fidClose" title="Fermer">${ic('x', 22)}</button>
    <h2>${esc(card.store)}</h2>
    <div class="fidcode" id="fid-code"></div>
    <div class="fidnum">${esc(card.number)}</div>
    <div class="fidctl">
      <select class="in sm" id="fid-show-folder" data-id="${card.id}">${fidFolderOptions(card.folderId)}</select>
      <div class="seg scope"><button class="${!card.private ? 'on' : ''}" data-do="fidSetScope" data-id="${card.id}" data-v="0">Commune</button>
        <button class="${card.private ? 'on' : ''}" data-do="fidSetScope" data-id="${card.id}" data-v="1">${ic('users', 13)}Privée</button></div>
    </div>
  </div>`;
}

/* ---------- rendu : modale ajout / scan ---------- */
function fidFolderOptions(sel) {
  return `<option value="">Non rangé</option>${fidFolders().map(f => `<option value="${f.id}" ${sel === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}`;
}
const fidNewCardFormHtml = (folderSel) => `<h3>Nouvelle carte</h3>
    <div class="fld"><label>Magasin / enseigne</label><input class="in" id="fid-store" placeholder="Ex : Carrefour" autocomplete="off"></div>
    <div class="fld"><label>Numéro de carte</label><div class="linkadd"><input class="in" id="fid-num" placeholder="Tape le numéro…" autocomplete="off" style="flex:1 1 200px">
      <button class="btn" id="fid-scan-btn" type="button">${ic('camera', 15)}Scanner</button></div></div>
    <div class="fields" style="padding:0">
      <div class="fld"><label>Format</label><select class="in" id="fid-format">${Object.entries(FID_FORMATS).map(([k, v]) => `<option value="${k}" ${k === 'code_128' ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>
      <div class="fld"><label>Dossier</label><select class="in" id="fid-folder">${fidFolderOptions(folderSel)}</select></div>
    </div>
    <div class="fld"><label class="chk"><input type="checkbox" id="fid-priv"> Privée : ${esc(otherProfile().name)} ne la verra pas</label></div>
    <div class="acts"><button class="btn" data-do="closeModal">Annuler</button><button class="btn primary" id="fid-ok">Créer</button></div>`;
function fidNewCard() {
  const m = openModal(fidNewCardFormHtml(fidUi.folder !== 'all' ? fidUi.folder : null));
  wireNewCardForm(m);
}
/* (Ré)attache les handlers du formulaire — appelée à l'ouverture, et après un scan annulé ou réussi
   (le contenu de la modale est reconstruit à chaque fois, donc les anciens handlers ont disparu avec lui). */
function wireNewCardForm(m) {
  m.querySelector('#fid-scan-btn').onclick = () => fidScanStart(m);
  m.querySelector('#fid-ok').onclick = () => {
    const store = m.querySelector('#fid-store'), number = m.querySelector('#fid-num');
    if (!store.value.trim()) return store.focus();
    if (!number.value.trim()) return number.focus();
    const c = fidAddCard({ store: store.value, number: number.value, format: m.querySelector('#fid-format').value, folderId: m.querySelector('#fid-folder').value });
    if (c && m.querySelector('#fid-priv').checked) fidToggle(c.id, true);
    closeModal(); fidRefresh(); toast('Carte ajoutée ✓');
  };
}
/* Scan caméra : remplace le contenu de la modale par le flux vidéo, ferme tout seul dès qu'un code est lu */
let fidStream = null;
function fidStopScan() { if (fidStream) { fidStream.getTracks().forEach(t => t.stop()); fidStream = null; } }
async function fidScanStart(m) {
  if (!('BarcodeDetector' in window)) return toast('Scan non pris en charge par ce navigateur : saisis le numéro à la main');
  const body = m.querySelector('.modal'), folderSel = m.querySelector('#fid-folder')?.value || null;
  const restore = () => { body.innerHTML = fidNewCardFormHtml(folderSel); wireNewCardForm(m); };
  body.innerHTML = `<h3>Scanner une carte</h3><div class="fidscan"><video id="fid-video" playsinline muted></video><div class="fidscan-frame"></div></div>
    <p class="hint">Cadre le code-barres de la carte.</p><div class="acts"><button class="btn" id="fid-scan-cancel">Annuler</button></div>`;
  body.querySelector('#fid-scan-cancel').onclick = () => { fidStopScan(); restore(); };
  try {
    fidStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = body.querySelector('#fid-video'); video.srcObject = fidStream; await video.play();
    const supported = await BarcodeDetector.getSupportedFormats();
    const det = new BarcodeDetector({ formats: FID_SCAN_FORMATS.filter(f => supported.includes(f)) });
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    (async function loop() {
      if (!fidStream) return; // annulé entre-temps
      try {
        canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const res = await det.detect(canvas);
        if (res.length) {
          fidStopScan(); restore();
          m.querySelector('#fid-num').value = res[0].rawValue;
          m.querySelector('#fid-format').value = FID_FORMATS[res[0].format] ? res[0].format : 'code_128';
          toast('Code lu ✓');
          return;
        }
      } catch (e) { /* image pas encore prête, on réessaie */ }
      requestAnimationFrame(loop);
    })();
  } catch (e) {
    fidStopScan(); restore();
    toast(e.name === 'NotAllowedError' ? 'Caméra refusée : saisis le numéro à la main' : 'Caméra indisponible : saisis le numéro à la main');
  }
}
function fidNewFolder() {
  const m = openModal(`<h3>Nouveau dossier</h3><div class="fld"><label>Nom</label><input class="in" id="fid-fname" placeholder="Ex : Beauté, Sport…" autocomplete="off"></div>
    <div class="acts"><button class="btn" data-do="closeModal">Annuler</button><button class="btn primary" id="fid-fok">Créer</button></div>`);
  const ok = () => { const f = fidAddFolder(m.querySelector('#fid-fname').value); if (!f) return m.querySelector('#fid-fname').focus(); fidUi.folder = f.id; closeModal(); render(); };
  m.querySelector('#fid-fok').onclick = ok;
  m.querySelector('#fid-fname').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
}

/* ---------- écran ---------- */
function cartesHtml() {
  const showing = fidUi.show && fidCards().find(c => c.id === fidUi.show);
  return `<div class="hubwrap cw"><div class="cwrap">${showing ? fidShowHtml(showing) : fidListHtml()}</div></div>`;
}
function cartesAfterRender() {
  if (hub.screen !== 'cartes') return;
  const showing = fidUi.show && fidCards().find(c => c.id === fidUi.show);
  const box = document.getElementById('fid-code');
  if (showing && box) fidRenderCode(box, showing);
}
function fidRefresh() { if (hub.screen === 'cartes') render(); }
const cartesH = {
  fidFolder: el => { fidUi.folder = el.dataset.v || null; render(); },
  fidNewFolder: () => fidNewFolder(),
  fidNewCard: () => fidNewCard(),
  fidShow: el => { fidUi.show = el.dataset.id; render(); },
  fidClose: () => { fidUi.show = null; render(); },
  fidDel: el => fidDelCard(el.dataset.id),
  fidSetScope: el => { const c = fidCards().find(x => x.id === el.dataset.id); if (c && c.private !== (el.dataset.v === '1')) fidToggle(el.dataset.id); },
};
function cartesKey(e) {
  if (e.key === 'Escape') { if (fidUi.show) { fidUi.show = null; render(); } else hubHome(); }
}
document.addEventListener('change', e => {
  if (e.target.id !== 'fid-show-folder') return;
  fidSetFolder(e.target.dataset.id, e.target.value);
});
setInterval(() => { if (hub.screen === 'cartes' && !document.hidden) dbxSync.syncNow(['cartes', 'cartesPerso']); }, 25000);
