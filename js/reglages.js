'use strict';
/* =====================================================================
   RÉGLAGES GÉNÉRAUX : un petit rouage discret, en bas à droite de tous les écrans.
   Ce qui concerne l'application entière (profil, apparence, Dropbox, copie de sécurité) vit ici ;
   les réglages propres à Cap et à Suivis (domaines, types de séance…) restent dans Cap.
   Le panneau est une fenêtre : elle se redessine seule quand l'état de la synchro ou le thème change.
   ===================================================================== */
let gearAdvOpen = false;
function gearPanelHtml() {
  return `<div class="gearpanel"><h3>Réglages</h3>
    ${profileCardHtml()}
    <section class="sec"><h2>Apparence<span class="why">propre à cet appareil</span></h2><div class="card" style="padding:16px">
      <div class="seg">${[['light', 'Clair'], ['dark', 'Sombre'], ['auto', 'Auto (système)']].map(([v, l]) => `<button class="${themePref() === v ? 'on' : ''}" data-do="theme" data-v="${v}">${l}</button>`).join('')}</div></div></section>
    ${dbxSettingsHtml()}
    <details class="gearadv"${gearAdvOpen ? ' open' : ''}><summary>Avancé</summary>
      <section class="sec"><h2>Sauvegarde automatique<span class="why">copie de Cap dans un fichier de ce PC</span></h2><div class="card" style="padding:16px">
        ${syncBadge()}
        <p class="hint" style="margin:10px 0 12px">${fileSync.st.state === 'ok' ? `Cap est recopié en continu dans <b>${esc(fileSync.st.name)}</b>.`
          : fileSync.supported ? 'Facultatif : Dropbox suffit pour retrouver tes données. Un fichier local ajoute une seconde copie, par exemple dans OneDrive.' : 'Ce navigateur ne permet pas l\'écriture dans un fichier.'}</p>
        ${fileSync.supported ? `<button class="btn" data-do="syncPick">${ic('download', 15)}${fileSync.st.state === 'none' ? 'Choisir le fichier de sauvegarde' : 'Changer de fichier'}</button>` : ''}</div></section>
      <section class="sec"><h2>Outils de Cap<span class="why">ne concernent pas Courses, Nos listes, Nous Deux…</span></h2><div class="card" style="padding:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" data-do="export">${ic('download', 15)}Exporter une copie</button>
        <button class="btn" data-do="import">${ic('upload', 15)}Importer</button>
        <button class="btn danger" data-do="reset">${ic('trash', 15)}Tout effacer</button>
        <input type="file" id="importFile" accept="application/json" hidden></div></section>
    </details>
    <div class="acts"><button class="btn" data-do="closeModal">Fermer</button></div></div>`;
}
function gearOpen() {
  const m = openModal(gearPanelHtml());
  document.activeElement?.blur?.(); // pas de clavier qui surgit sur téléphone
  return m;
}
/* redessine le panneau ouvert sans perdre la clé en cours de saisie ni la position */
function gearRefresh() {
  const box = document.querySelector('#modal .gearpanel'); if (!box) return;
  const ae = document.activeElement; if (ae && box.contains(ae) && ae.tagName === 'INPUT') return;
  const modal = box.closest('.modal'), sc = modal.scrollTop;
  gearAdvOpen = !!box.querySelector('.gearadv')?.open;
  modal.innerHTML = gearPanelHtml(); modal.scrollTop = sc;
}
/* le rouage lui-même : visible uniquement sur l'accueil */
function gearSync() {
  let b = document.getElementById('gearbtn');
  if (!b) {
    b = document.createElement('button'); b.id = 'gearbtn'; b.className = 'gearbtn'; b.type = 'button';
    b.dataset.do = 'gear'; b.title = 'Réglages de l\'application'; b.setAttribute('aria-label', 'Réglages de l\'application'); b.innerHTML = ic('gear', 18);
    document.body.appendChild(b);
  }
  b.hidden = hub.screen !== 'home'; // uniquement sur l'accueil des applications
  gearRefresh();
}
const gearH = { gear: () => gearOpen() };
document.addEventListener('toggle', e => { if (e.target.classList?.contains('gearadv')) gearAdvOpen = e.target.open; }, true);
