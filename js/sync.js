'use strict';
/* =====================================================================
   Synchronisation entre appareils via Dropbox.
   - Chaque appareil garde sa copie locale ; un fichier par profil et par appli (/cap/brandon.json, /cap/julya.json…,
     plus le fichier des codes /hub.json) dans le dossier d'application Dropbox sert de point commun.
     Les fichiers sont déclarés par hub.js (setSpecs) : ajouter une appli ou un fichier « commun » = ajouter une déclaration.
   - Fusion élément par élément : chaque élément porte une date de modification (u), la plus récente gagne.
     Les suppressions sont tracées (tomb) pour ne pas « ressusciter » un élément supprimé ailleurs.
   - Connexion OAuth PKCE : aucun secret dans le code, seulement la clé d'app (publique) que tu saisis.
   ===================================================================== */
const COLLS = ['domains', 'actions', 'routines', 'activities', 'trackCats', 'trackTypes', 'logs'];
const CORE_KEYS = ['domains', 'actions', 'routines', 'activities']; // requis pour qu'un fichier soit reconnu comme des données Cap

/* ---------------------------- stores : perso + commun ----------------------------
   Deux jeux de données synchronisés séparément :
     p = perso   (cap.v1.<profil>  ↔  Dropbox /cap/<profil>.json)  : tout ce qui est à moi (+ suivis, réglages)
     c = commun  (cap.v1.commun    ↔  Dropbox /cap/commun.json)   : actions / routines partagées (+ leurs activités)
   `db` est l'assemblage des deux, avec `shared: true` sur les éléments communs. Passer un élément en perso / commun
   = changer ce drapeau ; save() range alors l'élément dans l'autre fichier (et laisse une trace de suppression dans l'ancien).
   Les domaines sont recopiés dans les deux : la version la plus récente gagne, comme pour tout élément. */
const CKEY = 'cap.v1.commun';
const stores = { p: { data: null, snap: new Map() }, c: { data: null, snap: new Map() } };
let hidden = { actions: [], routines: [], activities: [] }; // éléments communs masqués : gardés à part, jamais perdus
const hideShared = () => { try { return localStorage.getItem('cap.hideShared.' + hub.profile) === '1'; } catch (e) { return false; } };
function setHideShared(v) {
  try { if (v) localStorage.setItem('cap.hideShared.' + hub.profile, '1'); else localStorage.removeItem('cap.hideShared.' + hub.profile); } catch (e) { /* ignore */ }
  assemble(); ui.sel = { actions: null, routines: null, activities: null }; render();
}

const freshDb = () => ({ v: 1, domains: DEFAULT_DOMAINS.map(x => ({ ...x })), actions: [], routines: [], activities: [], trackCats: [], trackTypes: [], logs: [],
  meta: { sample: false, fresh: true, createdAt: D.today(), lastReview: null } }); // « fresh » = jamais touchée : si Dropbox a déjà des données, elles l'emportent
const emptyCommun = p => ({ v: 1, domains: (p.domains || []).map(x => ({ ...x })), actions: [], routines: [], activities: [], trackCats: [], trackTypes: [], logs: [], tomb: {}, meta: { fresh: true } });

function initSnap(st) {
  st.snap = new Map();
  for (const k of st.colls || COLLS) for (const it of st.data[k] || []) { const { u, ...rest } = it; st.snap.set(it.id, JSON.stringify(rest)); }
}
/* Donne à un jeu de données chargé de l'extérieur tout ce dont la fusion a besoin */
function normalizeStore(st) {
  const d = st.data; d.meta = d.meta || {}; d.tomb = d.tomb || {};
  const base = d.meta.savedAt || Date.now();
  for (const k of st.colls || COLLS) (d[k] = d[k] || []).forEach(it => { if (!it.u) it.u = base; });
  initSnap(st);
}
/* Appelé à chaque sauvegarde : date les éléments modifiés, note les suppressions. Renvoie true si quelque chose a changé. */
function trackStore(st) {
  const d = st.data; d.tomb = d.tomb || {};
  const now = Date.now(), cur = new Map(); let changed = false;
  for (const k of st.colls || COLLS) for (const it of d[k] || []) {
    const { u, ...rest } = it, s = JSON.stringify(rest);
    cur.set(it.id, s);
    if (st.snap.get(it.id) !== s || !it.u) { it.u = now; changed = true; }
    if (d.tomb[it.id]) delete d.tomb[it.id]; // élément présent (recréé / annulation) : plus supprimé
  }
  for (const id of st.snap.keys()) if (!cur.has(id)) { d.tomb[id] = now; changed = true; }
  st.snap = cur;
  if (d.meta.fresh && [d.actions, d.routines, d.activities, d.logs].some(l => l && l.length)) delete d.meta.fresh; // plus une base vierge
  return changed;
}

/* db (assemblé) → p et c. Une activité suit son action / sa routine. */
function splitDb() {
  const P = stores.p.data, C = stores.c.data, sh = x => !!x.shared;
  const uniq = l => { const m = new Map(); l.forEach(x => { if (!m.has(x.id)) m.set(x.id, x); }); return [...m.values()]; };
  const parents = new Set([...db.actions, ...db.routines, ...hidden.actions, ...hidden.routines].filter(sh).map(x => x.id));
  const child = a => (a.actionId && parents.has(a.actionId)) || (a.routineId && parents.has(a.routineId));
  P.domains = db.domains; C.domains = db.domains;
  P.actions = db.actions.filter(x => !sh(x)); C.actions = uniq([...db.actions.filter(sh), ...hidden.actions]);
  P.routines = db.routines.filter(x => !sh(x)); C.routines = uniq([...db.routines.filter(sh), ...hidden.routines]);
  P.activities = db.activities.filter(x => !child(x)); C.activities = uniq([...db.activities.filter(child), ...hidden.activities]);
  P.trackCats = db.trackCats; P.trackTypes = db.trackTypes; P.logs = db.logs; P.meta = db.meta;
  for (const k of ['trackCats', 'trackTypes', 'logs']) C[k] = C[k] || [];
}
/* p + c → db. Un même élément présent dans les deux : le plus récent gagne. */
function assemble() {
  const P = stores.p.data, C = stores.c.data, hide = hideShared();
  const pick = k => {
    const m = new Map();
    for (const it of P[k] || []) m.set(it.id, [it, 'p']);
    for (const it of C[k] || []) { const cur = m.get(it.id); if (!cur || (it.u || 0) > (cur[0].u || 0)) m.set(it.id, [it, 'c']); }
    return [...m.values()];
  };
  hidden = { actions: [], routines: [], activities: [] };
  const out = {};
  for (const k of ['actions', 'routines', 'activities']) {
    out[k] = [];
    for (const [it, sc] of pick(k)) {
      if (sc === 'c') { if (k !== 'activities') it.shared = true; if (hide) { hidden[k].push(it); continue; } }
      else if (k !== 'activities') delete it.shared;
      out[k].push(it);
    }
  }
  const { tomb, ...rest } = P;
  db = { ...rest, domains: pick('domains').map(x => x[0]), actions: out.actions, routines: out.routines, activities: out.activities, meta: P.meta };
}
const readLS = k => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(stores.p.data)); localStorage.setItem(CKEY, JSON.stringify(stores.c.data)); } catch (e) { /* ignore */ }
}
function loadStores() {
  let P = readLS(KEY), C = readLS(CKEY), created = false;
  if (!P || !Array.isArray(P.actions)) { P = (hub.profile && hub.profile !== 'brandon') ? freshDb() : seed(); created = true; }
  P.meta = P.meta || {}; P.meta.createdAt = P.meta.createdAt || D.today();
  if (!C || !Array.isArray(C.actions)) { C = emptyCommun(P); created = true; }
  stores.p.data = P; stores.c.data = C;
  normalizeStore(stores.p); normalizeStore(stores.c);
  assemble();
  if (created) commit(false);
}
/* Range db dans les deux stores, dates / suppressions, sauvegarde locale, et planifie les synchros utiles. */
function commit(always) {
  splitDb();
  const cp = trackStore(stores.p), cc = trackStore(stores.c);
  persist();
  if (always || cp) dbxSync.schedule('cap');
  if (cc) dbxSync.schedule('commun');
}
/* Un fichier (p ou c) vient d'être remplacé par la fusion avec Dropbox */
function adoptStore(which, target) {
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.closest('#detail');
  stores[which].data = target; normalizeStore(stores[which]);
  assemble(); initSnap(stores.p); initSnap(stores.c); // les drapeaux « commun » viennent d'être posés : ce n'est pas une modification
  ensureTrackDefaults();
  commit(false); // range les éléments arrivés dans le bon fichier
  if (typing && hub.screen === 'cap') refreshLight(); else render();
}

const TOMB_TTL = 90 * 864e5;
function mergeDb(a, b, colls = COLLS) {
  const out = { v: 1, tomb: {}, meta: {} }, tomb = {};
  for (const [id, ts] of [...Object.entries(a.tomb || {}), ...Object.entries(b.tomb || {})]) tomb[id] = Math.max(tomb[id] || 0, ts);
  const alive = new Set();
  for (const k of colls) {
    const map = new Map();
    for (const it of a[k] || []) map.set(it.id, it);
    for (const it of b[k] || []) { const cur = map.get(it.id); if (!cur || (it.u || 0) > (cur.u || 0)) map.set(it.id, it); }
    out[k] = [...map.values()].filter(it => !(tomb[it.id] && tomb[it.id] >= (it.u || 0)));
    out[k].forEach(it => alive.add(it.id));
  }
  const now = Date.now();
  for (const [id, ts] of Object.entries(tomb)) if (!alive.has(id) && now - ts < TOMB_TTL) out.tomb[id] = ts;
  // clés inconnues (ajoutées par une version plus récente sur un autre appareil) : on les conserve, jamais on ne les perd
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) if (!(k in out) && k !== 'meta' && k !== 'tomb') out[k] = k in a ? a[k] : b[k];
  const ma = a.meta || {}, mb = b.meta || {}, cr = [ma.createdAt, mb.createdAt].filter(Boolean).sort();
  out.meta = { ...ma, ...mb, sample: !!(ma.sample && mb.sample), fresh: (ma.fresh && mb.fresh) || undefined, createdAt: cr[0] || null,
    lastReview: [ma.lastReview, mb.lastReview].filter(Boolean).sort().pop() || null, savedAt: Math.max(ma.savedAt || 0, mb.savedAt || 0) };
  return out;
}
const validDb = d => d && CORE_KEYS.every(k => Array.isArray(d[k]));

/* ---------------------------- Dropbox ---------------------------- */
const dbxSync = (() => {
  const st = { state: 'none', last: null, err: '' }; // none | syncing | ok | offline | needs | error
  const LS = { key: 'cap.dbx.key', tok: 'cap.dbx.tok', pk: 'cap.dbx.pkce' };
  /* Les fichiers à synchroniser : { id, path, legacyPath?, get, valid, merge, untouched, adopt, done? }.
     hub.js les déclare (fichier des codes + données de chaque appli, par profil). */
  let specs = [];
  const dirty = new Set();
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const canOAuth = /^https?:$/.test(location.protocol);
  const connected = () => !!get(LS.tok);
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  let busy = false, again = false, timer = null;
  const authErr = () => Object.assign(new Error('auth'), { code: 'auth' });

  const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, '').slice(0, n); };
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ui_ = () => {
    if (hub.screen === 'courses') return coursesRefresh();
    if (hub.screen !== 'cap') return render();
    if (typeof refreshSide === 'function' && document.querySelector('.side')) { if (ui.view === 'settings') render(); else refreshSide(); }
  };

  async function tokenReq(params) {
    const r = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: get(LS.key), ...params }) });
    if (r.status === 400 || r.status === 401) throw authErr();
    if (!r.ok) throw new Error('token ' + r.status);
    return r.json();
  }
  async function token() {
    const t = get(LS.tok); if (!t) throw authErr();
    if (Date.now() < t.exp) return t.access;
    const r = await tokenReq({ grant_type: 'refresh_token', refresh_token: t.refresh });
    put(LS.tok, { ...t, access: r.access_token, exp: Date.now() + r.expires_in * 1000 - 60000 });
    return r.access_token;
  }
  async function connect(key) {
    key = (key || '').trim(); if (!key || !canOAuth) return;
    put(LS.key, key);
    const verifier = rand(64), state = rand(16);
    put(LS.pk, { verifier, state });
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    location.href = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({ client_id: key, response_type: 'code', code_challenge: challenge,
      code_challenge_method: 'S256', token_access_type: 'offline', redirect_uri: redirectUri(), state });
  }
  async function handleCallback() {
    const p = new URLSearchParams(location.search);
    if (!p.has('code') && !p.has('error')) return false;
    const pk = get(LS.pk); history.replaceState(null, '', location.pathname + location.hash);
    if (p.get('error')) { toast('Connexion Dropbox refusée'); return true; }
    if (!pk || pk.state !== p.get('state')) { toast('Connexion Dropbox invalide, réessaie'); return true; }
    try {
      const r = await tokenReq({ grant_type: 'authorization_code', code: p.get('code'), code_verifier: pk.verifier, redirect_uri: redirectUri() });
      put(LS.tok, { access: r.access_token, refresh: r.refresh_token, exp: Date.now() + r.expires_in * 1000 - 60000 }); put(LS.pk, null);
      ui.view = 'settings'; hub.afterAuth = true; toast('Dropbox connecté ✓');
    } catch (e) { toast('Échec de la connexion Dropbox (vérifie la clé et l\'adresse de redirection)'); }
    return true;
  }

  async function download(tok, path) {
    const r = await fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Dropbox-API-Arg': JSON.stringify({ path }) } });
    if (r.status === 401) throw authErr();
    if (r.status === 409) { const b = await r.text(); if (/not_found/.test(b)) return { data: null, text: '', rev: null }; throw new Error('dropbox: ' + b.slice(0, 120)); }
    if (!r.ok) throw new Error('http ' + r.status);
    let rev = null; try { rev = JSON.parse(r.headers.get('dropbox-api-result') || '{}').rev || null; } catch (e) { /* ignore */ }
    const text = await r.text(); let data = null; try { data = JSON.parse(text); } catch (e) { /* ignore */ }
    return { data, text, rev };
  }
  async function upload(tok, path, json, rev) {
    const arg = { path, mode: rev ? { '.tag': 'update', update: rev } : 'overwrite', mute: true };
    const r = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Dropbox-API-Arg': JSON.stringify(arg), 'Content-Type': 'application/octet-stream' }, body: json });
    if (r.status === 401) throw authErr();
    if (r.status === 409) { const b = await r.text(); if (/conflict/.test(b)) return 'conflict'; throw new Error('dropbox: ' + b.slice(0, 120)); }
    if (!r.ok) throw new Error('http ' + r.status);
    return 'ok';
  }
  /* Synchronise un fichier : télécharge, fusionne, adopte le résultat, renvoie si besoin (4 essais en cas de conflit) */
  async function syncSpec(tok, sp) {
    for (let i = 0; i < 4; i++) {
      let rem = await download(tok, sp.path);
      // premier passage sous la nouvelle organisation : on reprend l'ancien fichier (laissé intact dans Dropbox)
      if (!rem.data && !rem.rev && sp.legacyPath) { const lg = await download(tok, sp.legacyPath); if (lg.data) rem = { data: lg.data, text: '', rev: null }; }
      const local = sp.get();
      let target = local;
      // des données jamais touchées (exemple / base vierge) ne se mélangent jamais aux vraies : le distant l'emporte
      if (rem.data && sp.valid(rem.data)) target = sp.untouched() ? rem.data : sp.merge(local, rem.data);
      const json = JSON.stringify(target);
      if (json !== JSON.stringify(local)) sp.adopt(target);
      if (json === (rem.text || '').trim()) break;
      if ((await upload(tok, sp.path, json, rem.rev)) === 'ok') break;
    }
  }
  /* ids : ne synchroniser que ces fichiers (après une modification) ; sinon tous */
  async function syncNow(ids) {
    if (!connected()) return;
    if (busy) { again = true; return; }
    if (!Array.isArray(ids)) ids = null;
    busy = true; st.state = 'syncing'; st.err = ''; ui_();
    let fail = null;
    try {
      const tok = await token();
      for (const sp of specs) {
        if (ids && !ids.includes(sp.id)) continue;
        try { await syncSpec(tok, sp); } catch (e) { if (e.code === 'auth') throw e; fail = fail || e; }
        sp.done?.();
      }
      if (fail) throw fail;
      st.state = 'ok'; st.last = Date.now();
    } catch (e) {
      if (e.code === 'auth') st.state = 'needs';
      else if (!navigator.onLine || e instanceof TypeError) st.state = 'offline';
      else { st.state = 'error'; st.err = e.message; }
      specs.forEach(sp => sp.done?.());
    }
    busy = false; ui_();
    if (again) { again = false; setTimeout(() => syncNow(), 300); }
  }
  function schedule(id = 'cap') {
    if (!connected()) return;
    dirty.add(id); clearTimeout(timer);
    timer = setTimeout(() => { const ids = [...dirty]; dirty.clear(); syncNow(ids); }, 2500);
  }
  function setSpecs(list) { specs = list; }
  function disconnect() { put(LS.tok, null); st.state = 'none'; st.last = null; ui_(); }

  async function init() {
    if (!canOAuth) return;
    await handleCallback();
    if (!connected()) return ui_();
    st.state = 'syncing'; ui_(); syncNow();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
    window.addEventListener('online', () => syncNow());
    setInterval(() => { if (!document.hidden) syncNow(); }, 90000);
  }
  return { st, init, connect, disconnect, syncNow, schedule, setSpecs, connected, canOAuth, redirectUri, key: () => get(LS.key) || '' };
})();
