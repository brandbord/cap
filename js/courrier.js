'use strict';
/* =====================================================================
   BOÎTE AUX LETTRES : une lettre à la fois, dans chaque sens, plus un historique.
   Une seule boîte, mais une vue propre à chacun : le drapeau ne se lève que pour celui qui a une lettre
   à lire ; l'autre voit la même boîte, drapeau baissé. Pour écrire, il faut (1) que ta dernière lettre ait
   été lue par l'autre, et (2) ne pas avoir toi-même une lettre non lue qui t'attend — pas de messagerie,
   juste un mot de temps en temps, dans l'ordre. On ne sait jamais quand l'autre a lu la sienne : ça reste
   à elle (ou à lui), c'est plus charmant comme ça.
   Une lettre lue part dans l'historique (favoris possibles, suppression possible) avant que la case ne
   soit réutilisée pour la suivante. Un seul fichier commun, deux collections : même mécanique que Courses /
   Nos listes.
   ===================================================================== */
const COURRIER_MAX = 2000;
const COURRIER_KEY = 'courrier.v1.commun';
const courrier = { data: null, snap: new Map(), colls: ['letters', 'history'] };
const mailUi = { text: '', tab: 'box', favOnly: false };

/* ---------- données ---------- */
function ensureSlots(d) {
  PROFILES.forEach(p => { if (!d.letters.find(x => x.id === p.id)) d.letters.push({ id: p.id, text: '', sentAt: null, readAt: null }); });
  d.history = d.history || [];
}
function courrierLoad() {
  let d = readLS(COURRIER_KEY);
  if (!d || !Array.isArray(d.letters)) d = { v: 1, letters: [] };
  ensureSlots(d);
  courrier.data = d; normalizeStore(courrier);
}
function courrierSave() {
  courrier.data.meta.savedAt = Date.now();
  trackStore(courrier);
  try { localStorage.setItem(COURRIER_KEY, JSON.stringify(courrier.data)); } catch (e) { /* ignore */ }
  dbxSync.schedule('courrier');
}
function courrierAdopt(target) {
  courrier.data = target; normalizeStore(courrier); ensureSlots(courrier.data);
  try { localStorage.setItem(COURRIER_KEY, JSON.stringify(courrier.data)); } catch (e) { /* ignore */ }
  courrierRefresh();
}
const mySlot = () => courrier.data.letters.find(x => x.id === hub.profile);
const theirSlot = () => courrier.data.letters.find(x => x.id === otherProfile().id);
const hasMailForMe = () => { const s = theirSlot(); return !!(s && s.text && s.sentAt && !s.readAt); };
/* Pour écrire : (1) ma dernière lettre envoyée a été lue (ou je n'en ai pas envoyé), ET
   (2) je n'ai pas moi-même une lettre en attente, non ouverte, dans ma boîte. */
const canWriteLetter = () => {
  const mine = mySlot(), mineOk = !mine || !mine.text || !!mine.readAt;
  return mineOk && !hasMailForMe();
};
function flagUp() { try { return hasMailForMe(); } catch (e) { return false; } }

function mailRead() {
  const s = theirSlot();
  if (s && s.text && s.sentAt && !s.readAt) {
    s.readAt = Date.now();
    courrier.data.history.push({ id: uid(), from: s.id, text: s.text, sentAt: s.sentAt, readAt: s.readAt, fav: false });
    courrierSave();
  }
  courrierRefresh();
}
function mailSend() {
  const text = mailUi.text.trim();
  if (!text || !canWriteLetter()) return;
  const s = mySlot();
  s.text = text; s.sentAt = Date.now(); s.readAt = null;
  mailUi.text = '';
  courrierSave();
  toast('Lettre envoyée ✓');
  courrierRefresh();
}
function mailOpenBox() { hub.screen = 'courrier'; mailUi.tab = 'box'; render(); scrollTo(0, 0); dbxSync.syncNow(['courrier']); }
const courrierH = {
  mailOpenBox: () => mailOpenBox(), mailRead: () => mailRead(), mailSend: () => mailSend(),
  mailTab: el => { mailUi.tab = el.dataset.v; render(); },
  mailFavOnly: el => { mailUi.favOnly = el.dataset.v === '1'; render(); },
  mailFav: el => { const h = courrier.data.history.find(x => x.id === el.dataset.id); if (h) { h.fav = !h.fav; courrierSave(); render(); } },
  mailDelHist: el => {
    const prev = JSON.stringify(courrier.data.history);
    courrier.data.history = courrier.data.history.filter(x => x.id !== el.dataset.id);
    courrierSave(); render();
    toast('Lettre supprimée de l\'historique', () => { courrier.data.history = JSON.parse(prev); courrierSave(); render(); });
  },
};

/* ---------- rendu ---------- */
function mailboxBtn() {
  const up = flagUp();
  return `<button class="mailbtn ${up ? 'up' : ''}" data-do="mailOpenBox" title="${up ? 'Une lettre t’attend ❤' : 'Boîte aux lettres'}">${ic(up ? 'mailboxUp' : 'mailbox', 22)}${up ? '<i class="mdot"></i>' : ''}</button>`;
}
function letterCardHtml(who, text, sentAt, compact) {
  const p = profileOf(who), date = sentAt ? new Date(sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return `<div class="letter ${compact ? 'compact' : ''}"><div class="letter-from">De ${esc(p.name)}${date ? `<span class="letter-date">${esc(date)}</span>` : ''}</div>
    <div class="letter-body">${esc(text)}</div></div>`;
}
function boxHtml() {
  const theirs = theirSlot(), other = otherProfile(), unread = hasMailForMe(), writable = canWriteLetter();
  let inbox;
  if (theirs && theirs.text && theirs.sentAt) {
    inbox = unread
      ? `<div class="seal-wrap"><button class="seal" data-do="mailRead">
          <span class="seal-wax">♥</span><span class="seal-txt">Une lettre de ${esc(other.name)} t'attend<br><small>Touche le cachet pour l'ouvrir</small></span></button></div>`
      : letterCardHtml(theirs.id, theirs.text, theirs.sentAt);
  } else {
    inbox = `<div class="mail-empty">Rien dans ta boîte pour l'instant.</div>`;
  }
  const writeSection = writable
    ? `<div class="letter write"><textarea id="mail-ta" maxlength="${COURRIER_MAX}" placeholder="Écris à ${esc(other.name)}…">${esc(mailUi.text)}</textarea>
        <div class="mail-bar"><span class="mail-count">${mailUi.text.length} / ${COURRIER_MAX}</span><button class="btn primary sm" data-do="mailSend">Envoyer</button></div></div>`
    : unread
      ? `<div class="mail-wait">Tu as une lettre qui t'attend juste au-dessus : ouvre-la d'abord 💌</div>`
      : `<div class="mail-wait">Ta dernière lettre est encore scellée dans sa boîte. Patience, elle finira par l'ouvrir 💌</div>`;
  return `<section class="msec"><h2>Pour toi</h2>${inbox}</section>
    <section class="msec"><h2>Écrire à ${esc(other.name)}</h2>${writeSection}</section>`;
}
function historyHtml() {
  let items = [...courrier.data.history].sort((a, b) => b.readAt - a.readAt);
  if (mailUi.favOnly) items = items.filter(x => x.fav);
  const bar = `<div class="seg sm" style="margin:2px 0 16px">${[[0, 'Toutes'], [1, 'Favorites']].map(([v, l]) =>
    `<button class="${(mailUi.favOnly ? 1 : 0) === v ? 'on' : ''}" data-do="mailFavOnly" data-v="${v}">${l}</button>`).join('')}</div>`;
  if (!items.length) return bar + `<div class="mail-empty">${mailUi.favOnly ? 'Aucune lettre favorite pour l\'instant.' : 'Rien dans l\'historique pour l\'instant : les lettres y arrivent une fois lues.'}</div>`;
  return bar + `<div class="hist-list">${items.map(h => `<div class="hist-item">
      ${letterCardHtml(h.from, h.text, h.sentAt, true)}
      <div class="hist-act"><button class="iconbtn ${h.fav ? 'favon' : ''}" data-do="mailFav" data-id="${h.id}" title="${h.fav ? 'Retirer des favorites' : 'Marquer comme favorite'}">${ic('star', 16)}</button>
        <button class="iconbtn" data-do="mailDelHist" data-id="${h.id}" title="Supprimer">${ic('trash', 16)}</button></div></div>`).join('')}</div>`;
}
function courrierHtml() {
  const tabs = [['box', 'Boîte'], ['history', 'Historique' + (courrier.data.history.length ? ` (${courrier.data.history.length})` : '')]];
  return `<div class="hubwrap cw"><div class="cwrap mailwrap">
    <header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button><h1>Boîte aux lettres</h1><span class="sp"></span></header>
    <div class="seg mailtabs">${tabs.map(([v, l]) => `<button class="${mailUi.tab === v ? 'on' : ''}" data-do="mailTab" data-v="${v}">${l}</button>`).join('')}</div>
    ${mailUi.tab === 'box' ? boxHtml() : historyHtml()}</div></div>`;
}
function courrierRefresh() { if (hub.screen === 'courrier') render(); }

/* frappe : juste le compteur, pas de re-rendu (pour ne pas perdre le curseur) */
document.addEventListener('input', e => {
  if (e.target.id !== 'mail-ta') return;
  mailUi.text = e.target.value;
  const c = document.querySelector('.mail-count'); if (c) c.textContent = `${mailUi.text.length} / ${COURRIER_MAX}`;
});
function mailKey(e) {
  if (e.key === 'Escape') { if (document.activeElement?.id === 'mail-ta') document.activeElement.blur(); else hubHome(); }
}
setInterval(() => { if (hub.screen === 'courrier' && !document.hidden) dbxSync.syncNow(['courrier']); }, 25000);
