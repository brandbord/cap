'use strict';
/* =====================================================================
   HUB : profils (Brandon / Julya) + écran d'accueil des applications.

   - Un profil reste ouvert sur l'appareil ; le code à 4 chiffres n'est demandé qu'à la première ouverture.
     C'est un verrou de courtoisie, pas de la sécurité forte : seules des empreintes (jamais le code) sont
     stockées, dans le fichier /hub.json du Dropbox, pour que les codes suivent d'un appareil à l'autre.
   - Chaque appli a ses données dans ses fichiers, par profil (ici /cap/brandon.json, /cap/julya.json).
     Chaque appli a aussi un fichier « commun » (/cap/commun.json ; plus tard /courses/commun.json…), déclaré
     comme les autres (hubSpec / capSpec / communSpec) : la synchro (sync.js) est générique.
   - Écrans : boot (rien) → login (choix du profil + code) → home (tuiles des applis) → <appli>.
     Changer de profil recharge la page : aucune donnée d'un profil ne reste en mémoire pour l'autre.
   ===================================================================== */
const PROFILES = [{ id: 'brandon', name: 'Brandon', color: '#c4552f' }, { id: 'julya', name: 'Julya', color: '#5f7fa8' }];
const APPS = [
  { id: 'cap', name: 'Cap', tag: 'ma vie, en clair', icon: 'target', ready: true },
  { id: 'courses', name: 'Courses', tag: 'la liste de courses', icon: 'cart', ready: true },
  { id: 'listes', name: 'Nos listes', tag: 'destinations, musique…', icon: 'star', ready: true },
  { id: 'mois', name: 'Mois', tag: 'fruits, légumes & jardin de saison', icon: 'calendar', ready: true },
];
const HUB_KEY = 'cap.hub', SESSION_KEY = 'cap.session';

Object.assign(ICONS, {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  backspace: '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><path d="m18 9-6 6M12 9l6 6"/>',
  mailbox: '<path d="M4 20V11a6 6 0 0 1 12 0v9H4Z"/><path d="M7.5 20v1.6M12.5 20v1.6"/>',
  mailboxUp: '<path d="M4 20V11a6 6 0 0 1 12 0v9H4Z"/><path d="M7.5 20v1.6M12.5 20v1.6"/><path d="M17.4 20V8.5"/><path d="m17.4 8.5 4 1.7-4 1.7Z"/>',
});

const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

const hub = {
  screen: 'boot',            // boot | login | home | cap (| courses, listes… plus tard)
  profile: null,
  data: { v: 1, pins: {} },  // { pins: { profil: { h: empreinte, u: date } } } : synchronisé via /hub.json
  synced: false,             // le fichier des codes a été lu au moins une fois
  afterAuth: false,          // retour de la connexion Dropbox
  pick: null, step: 'enter', entry: '', first: '', err: '', busy: false, changing: false,
  name: () => (PROFILES.find(p => p.id === hub.profile) || {}).name || '',
};
const profileOf = id => PROFILES.find(p => p.id === id);
const hasPin = id => !!(hub.data.pins || {})[id];

/* ---------- code ---------- */
async function pinHash(profile, pin) {
  const s = `cap|${profile}|${pin}`;
  if (globalThis.crypto?.subtle) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return 'x' + h.toString(16);
}
function mergeHub(a, b) {
  const pins = { ...(a.pins || {}) };
  for (const [id, r] of Object.entries(b.pins || {})) if (!pins[id] || (r.u || 0) > (pins[id].u || 0)) pins[id] = r;
  return { v: 1, pins };
}
const hubWaiting = () => hub.step === 'new' && !hub.changing && dbxSync.canOAuth && dbxSync.connected() && !hub.synced; // ne pas créer un code avant d'avoir lu celui de Dropbox

/* ---------- fichiers Dropbox ---------- */
const hubSpec = () => ({
  id: 'hub', path: '/hub.json', get: () => hub.data, valid: d => d && typeof d.pins === 'object', merge: mergeHub, untouched: () => false,
  adopt: d => { hub.data = d; lsSet(HUB_KEY, d); }, done: () => { hub.synced = true; },
});
const capSpec = p => ({
  id: 'cap', path: `/cap/${p}.json`, legacyPath: p === 'brandon' ? '/cap-donnees.json' : null, get: () => stores.p.data, valid: validDb, merge: mergeDb,
  untouched: () => !!(stores.p.data.meta?.sample || stores.p.data.meta?.fresh), adopt: d => adoptStore('p', d),
});
const communSpec = () => ({ // actions / routines partagées entre Brandon et Julya
  id: 'commun', path: '/cap/commun.json', get: () => stores.c.data, valid: validDb, merge: mergeDb,
  untouched: () => !!stores.c.data.meta?.fresh, adopt: d => adoptStore('c', d),
});
const coursesSpec = () => ({ // liste de courses commune (un seul fichier, pour ne jamais se gêner avec Cap)
  id: 'courses', path: '/courses/commun.json', get: () => courses.data, valid: d => d && Array.isArray(d.items), merge: (a, b) => mergeDb(a, b, ['items']),
  untouched: () => false, adopt: d => coursesAdopt(d),
});
const listesSpec = () => ({ // destinations de rêve, musique… communes (un seul fichier, plusieurs collections)
  id: 'listes', path: '/listes/commun.json', get: () => listes.data, valid: d => d && LTYPES.every(t => Array.isArray(d[t.id])), merge: (a, b) => mergeDb(a, b, LTYPES.map(t => t.id)),
  untouched: () => false, adopt: d => listesAdopt(d),
});
const courrierSpec = () => ({ // la boîte aux lettres : deux cases fixes (une par expéditeur) + l'historique des lettres lues
  id: 'courrier', path: '/courrier/commun.json', get: () => courrier.data, valid: d => d && Array.isArray(d.letters), merge: (a, b) => mergeDb(a, b, ['letters', 'history']),
  untouched: () => false, adopt: d => courrierAdopt(d),
});
// Mois (fruits/légumes de saison, jardin, lune) n'a pas de fichier : contenu de référence, pareil pour tous, sans synchro.

/* ---------- messages d'accueil de Julya (un tirage à chaque ouverture) ----------
   Construits par combinaison (formule d'accueil × petit nom) pour couvrir des centaines de variantes en
   français, en turc et en mélange des deux, plutôt que taper des centaines de lignes à la main (plus sûr
   pour l'orthographe turque). « chichi » — notre mot doux qui ne veut rien dire — reste rare : un seul petit
   nom parmi tous les autres. Deux phrases sont à nous : notre tout premier souvenir, et notre mantra.
   Rares elles aussi, et toujours en rose, pour rester spéciales. */
const LOVE_OPENERS = ['Bonjour', 'Bienvenue', 'Coucou', 'Salut', 'Bonsoir', 'Re-coucou', 'Hey', 'Merhaba', 'Selam', 'Günaydın', 'Hoş geldin', 'İyi akşamlar'];
const LOVE_NAMES = [
  'mon amour', 'mon cœur', 'ma belle', 'ma puce', 'ma douce', 'mon trésor', 'ma vie', 'ma chérie', 'mon ange', 'mon bébé', 'ma reine', 'mon soleil', 'ma chichi',
  'aşkım', 'canım', 'sevgilim', 'meleğim', 'güzelim', 'hayatım', 'tatlım', 'ruhum',
];
const LOVE_EXTRA = [ // phrases entières, telles quelles (moins fréquentes que les combinaisons)
  'Bienvenue mon amour, j\'espère que tu aimes ma chichi application',
  'Bonjour ma chichi',
  'Chichi appli te dit bonjour, mon cœur',
  'Aşkım, bienvenue sur ta chichi appli',
  'Bonjour mon cœur, prête à checker tes trucs ?',
  'Merhaba canım, hoş geldin',
  'Coucou ma chichi, contente de te voir',
];
const LOVE_SPECIAL = [ // notre premier souvenir, et notre mantra : rares, toujours en rose
  'Benim bebeğim, dünyanın en güzel kadınsın',
  'Everything is fine',
];
function pickLoveMessage() {
  const r = Math.random();
  if (r < 0.04) return { text: LOVE_SPECIAL[Math.floor(Math.random() * LOVE_SPECIAL.length)], special: true };
  if (r < 0.08) return { text: LOVE_EXTRA[Math.floor(Math.random() * LOVE_EXTRA.length)], special: false };
  return { text: `${LOVE_OPENERS[Math.floor(Math.random() * LOVE_OPENERS.length)]} ${LOVE_NAMES[Math.floor(Math.random() * LOVE_NAMES.length)]}`, special: false };
}

/* ---------- démarrage / entrée dans un profil ---------- */
async function hubBoot() {
  hub.data = lsGet(HUB_KEY) || { v: 1, pins: {} };
  if (!hub.data.pins) hub.data.pins = {};
  dbxSync.setSpecs([hubSpec()]);
  setTimeout(() => { if (!hub.synced) { hub.synced = true; if (hub.screen === 'login') render(); } }, 8000);
  await dbxSync.init(); // gère aussi le retour de la connexion Dropbox
  const p = lsGet(SESSION_KEY);
  if (profileOf(p)) hubEnter(p); else { hub.screen = 'login'; render(); }
}
function hubEnter(p) {
  hub.profile = p; hub.pick = null; hub.entry = ''; lsSet(SESSION_KEY, p);
  KEY = 'cap.v1.' + p;
  if (p === 'brandon' && !localStorage.getItem(KEY)) { // les données d'avant les profils deviennent celles de Brandon (l'ancienne clé reste, par sécurité)
    try { const old = localStorage.getItem('cap.v1'); if (old) localStorage.setItem(KEY, old); } catch (e) { /* ignore */ }
  }
  load(); ensureTrackDefaults(); coursesLoad(); listesLoad(); courrierLoad();
  hub.loveMsg = p === 'julya' ? pickLoveMessage() : null; // un seul tirage pour toute la session : ne change pas en changeant d'écran
  const h = location.hash;
  hub.screen = 'home';
  if (/~track/.test(h)) { ui.app = 'track'; hub.screen = 'cap'; }
  if (/~demo/.test(h) && !hasDemo()) { seedDemoLogs(); save(); }
  const [v, sel] = h.slice(1).split('~')[0].split('+'); // lien direct : #routines ou #actions+sel
  if (TITLES[v]) { ui.view = v; hub.screen = 'cap'; if (TRACK_VIEWS.includes(v)) ui.app = 'track'; if (sel && ui.sel[v] === null && COLL[v]) ui.sel[v] = coll(v)[0]?.id ?? null; }
  if (hub.afterAuth) { hub.afterAuth = false; hub.screen = 'cap'; ui.view = 'settings'; }
  dbxSync.setSpecs([hubSpec(), capSpec(p), communSpec(), coursesSpec(), listesSpec(), courrierSpec()]);
  render();
  fileSync.init();
  dbxSync.syncNow();
}

/* ---------- actions ---------- */
function hubPick(id) { hub.pick = id; hub.step = hasPin(id) ? 'enter' : 'new'; hub.entry = hub.first = hub.err = ''; render(); }
function hubBack() {
  hub.entry = hub.first = hub.err = '';
  if (hub.changing) { hub.changing = false; hub.pick = null; hub.screen = 'cap'; } else hub.pick = null;
  render();
}
function hubDigit(d) {
  if (hub.busy || hub.entry.length >= 4 || hubWaiting() || !/^\d$/.test(d)) return;
  hub.err = ''; hub.entry += d; render();
  if (hub.entry.length === 4) hubSubmit();
}
function hubDel() { if (hub.busy) return; hub.entry = hub.entry.slice(0, -1); hub.err = ''; render(); }
async function hubSubmit() {
  hub.busy = true;
  const p = hub.pick, code = hub.entry, h = await pinHash(p, code);
  hub.busy = false;
  if (hub.step === 'enter') {
    if (hub.data.pins[p]?.h === h) return hubEnter(p);
    hub.entry = ''; hub.err = 'Code incorrect'; return render();
  }
  if (hub.step === 'new') { hub.first = code; hub.entry = ''; hub.step = 'confirm'; return render(); }
  if (code !== hub.first) { hub.entry = hub.first = ''; hub.step = 'new'; hub.err = 'Les deux codes ne correspondent pas, on recommence'; return render(); }
  hub.data.pins[p] = { h, u: Date.now() }; lsSet(HUB_KEY, hub.data); dbxSync.schedule('hub');
  if (hub.changing) { hub.changing = false; hub.pick = null; hub.entry = hub.first = ''; hub.screen = 'cap'; render(); return toast('Code modifié ✓'); }
  hubEnter(p);
}
function hubOpen(app) {
  if (!APPS.find(a => a.id === app && a.ready)) return;
  hub.screen = app; render(); scrollTo(0, 0);
  if (app === 'courses' || app === 'listes') dbxSync.syncNow([app]); // listes partagées : on les met à jour à l'ouverture
}
function hubHome() { closeModal(); closeMenu(); hub.screen = 'home'; render(); }
function hubSwitch() { lsSet(SESSION_KEY, null); location.href = location.pathname; }
function hubChangePin() { hub.screen = 'login'; hub.pick = hub.profile; hub.changing = true; hub.step = 'new'; hub.entry = hub.first = hub.err = ''; render(); }
function hubKeydown(e) {
  if (hub.screen === 'courses') return coursesKey(e);
  if (hub.screen === 'listes') return listesKey(e);
  if (hub.screen === 'mois') return moisKey(e);
  if (hub.screen === 'courrier') return mailKey(e);
  if (hub.screen !== 'login' || !hub.pick || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^\d$/.test(e.key)) hubDigit(e.key);
  else if (e.key === 'Backspace') hubDel();
  else if (e.key === 'Escape') hubBack();
}

/* ---------- rendu ---------- */
const avatar = (p, sm) => `<span class="av ${sm ? 'sm' : ''}" style="--c:${p.color}">${esc(p.name[0])}</span>`;

function loginHtml() {
  if (!hub.pick) {
    const dbx = !dbxSync.canOAuth ? '' : dbxSync.connected()
      ? `<div class="lgdbx">${dbxBadge()}</div>`
      : `<details class="lgdbx"><summary>Première fois sur cet appareil ? Connecter Dropbox</summary>
          <p class="hint">Colle la clé d'app Dropbox : tes profils, codes et données arriveront tout seuls. Sinon, choisis ton nom : tout restera sur cet appareil.</p>
          <div class="linkadd"><input class="in" id="dbx-key" placeholder="Clé d'app Dropbox" value="${esc(dbxSync.key())}" autocomplete="off"><button class="btn primary" data-do="dbxConnect">Connecter</button></div></details>`;
    return `<div class="hubwrap"><div class="lg"><div class="lgbrand">${ic('grid', 20)}<b>Nos applis</b></div><h1>Qui es-tu ?</h1>
      <div class="who">${PROFILES.map(p => `<button class="whobtn" data-do="hubPick" data-id="${p.id}">${avatar(p)}<b>${esc(p.name)}</b></button>`).join('')}</div>${dbx}</div></div>`;
  }
  const p = profileOf(hub.pick), wait = hubWaiting();
  const title = { enter: `Bonjour ${p.name}`, new: hub.changing ? 'Nouveau code' : 'Choisis ton code', confirm: 'Confirme ton code' }[hub.step];
  const sub = wait ? 'Connexion à Dropbox…' : { enter: 'Ton code à 4 chiffres', new: '4 chiffres à retenir. Il ne sera demandé qu\'une fois sur cet appareil.', confirm: 'Retape le même code.' }[hub.step];
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return `<div class="hubwrap"><div class="lg pin">
    <button class="btn sm lgback" data-do="hubBack">${ic('left', 14)}Retour</button>
    ${avatar(p)}<h1>${title}</h1><p class="lgsub">${sub}</p>
    <div class="dots ${hub.err ? 'shake' : ''}">${[0, 1, 2, 3].map(i => `<i class="${i < hub.entry.length ? 'on' : ''}"></i>`).join('')}</div>
    <p class="lgerr" role="alert">${esc(hub.err)}</p>
    <div class="pad ${wait ? 'off' : ''}">${keys.map(k => k === '' ? '<span></span>' : `<button type="button" data-do="hubKey" data-k="${k}" aria-label="${k === 'del' ? 'Effacer' : k}">${k === 'del' ? ic('backspace', 22) : k}</button>`).join('')}</div></div></div>`;
}
function capTileBadge() {
  try {
    const b = todayBuckets(false), late = db.routines.filter(r => rStats(r).state === 'late').length, n = b.inbox.length + b.late.length + b.due.length + late;
    return n ? `<span class="tbadge hot">${n} à voir aujourd'hui</span>` : '<span class="tbadge">Rien d\'urgent</span>';
  } catch (e) { return ''; }
}
function homeHtml() {
  const p = profileOf(hub.profile), h = new Date().getHours(), hello = h < 6 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const love = hub.profile === 'julya' && hub.loveMsg;
  const tile = a => `<button class="atile ${a.ready ? '' : 'later'}" ${a.ready ? `data-do="hubOpen" data-app="${a.id}"` : 'disabled'}>
    <span class="tico">${ic(a.icon, 28)}</span><b>${esc(a.name)}</b><span class="ttag">${esc(a.tag)}</span>${a.ready ? { cap: capTileBadge, courses: coursesTileBadge, listes: listesTileBadge, mois: moisTileBadge }[a.id]?.() ?? '' : '<span class="tbadge">Bientôt</span>'}</button>`;
  return `<div class="hubwrap"><div class="hh">
    <header class="hubtop"><div><h1 class="${love ? `love${love.special ? ' special' : ''}` : ''}">${love ? esc(love.text) : `${hello}, ${esc(p.name)}`}</h1><span class="sub">${esc(date[0].toUpperCase() + date.slice(1))}</span></div><span class="sp"></span>
      ${mailboxBtn()}<button class="iconbtn" data-do="themeToggle" title="Thème clair / sombre">${ic(isDark() ? 'sun' : 'moon', 18)}</button>
      <button class="btn" data-do="hubSwitch" title="Changer de profil">${avatar(p, true)}<span class="lbl">Changer de profil</span></button></header>
    <div class="atiles">${APPS.map(tile).join('')}</div>
    <footer class="hubfoot">${dbxBadge()}</footer></div></div>`;
}
function hubRender() {
  const app = document.getElementById('app');
  app.className = 'hubmode'; document.documentElement.dataset.app = 'cap';
  app.innerHTML = { login: loginHtml, home: homeHtml, courses: coursesHtml, listes: listesHtml, mois: moisHtml, courrier: courrierHtml }[hub.screen]?.() ?? '';
}
function profileSettingsHtml() {
  const p = profileOf(hub.profile);
  return `<section class="sec"><h2>Profil<span class="why">cet appareil reste ouvert sur ton profil</span></h2><div class="card" style="padding:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    ${avatar(p, true)}<b>${esc(p.name)}</b><span style="flex:1"></span>
    <button class="btn" data-do="hubChangePin">${ic('lock', 15)}Changer mon code</button><button class="btn" data-do="hubSwitch">${ic('users', 15)}Changer de profil</button></div></section>
    <section class="sec"><h2>Éléments communs<span class="why">actions et routines partagées avec ${esc(otherProfile().name)}</span></h2><div class="card" style="padding:16px">
      <div class="seg">${[[0, 'Visibles'], [1, 'Masqués']].map(([v, l]) => `<button class="${(hideShared() ? 1 : 0) === v ? 'on' : ''}" data-do="hideShared" data-v="${v}">${l}</button>`).join('')}</div>
      <p class="hint" style="margin:10px 0 0">Masqués : tu ne vois plus que ton perso (rien n'est supprimé, ${esc(otherProfile().name)} continue de tout voir). Réglage propre à cet appareil. Pour partager ou reprendre un élément : bouton <b>Perso / Commun</b> dans sa fiche, ou clic droit.</p></div></section>`;
}
