'use strict';
/* =====================================================================
   Synchronisation entre appareils via Dropbox.
   - Chaque appareil garde sa copie locale ; un fichier unique (/cap-donnees.json) dans le dossier
     d'application Dropbox sert de point commun.
   - Fusion élément par élément : chaque élément porte une date de modification (u), la plus récente gagne.
     Les suppressions sont tracées (tomb) pour ne pas « ressusciter » un élément supprimé ailleurs.
   - Connexion OAuth PKCE : aucun secret dans le code, seulement la clé d'app (publique) que tu saisis.
   ===================================================================== */
const COLLS = ['domains', 'actions', 'routines', 'activities', 'trackCats', 'trackTypes', 'logs'];
const CORE_KEYS = ['domains', 'actions', 'routines', 'activities']; // requis pour qu'un fichier soit reconnu comme des données Cap
let snap = new Map(); // id -> JSON de l'élément (sans u), pour détecter ce qui a changé depuis la dernière sauvegarde

function initSnap() {
  snap = new Map();
  for (const k of COLLS) for (const it of db[k] || []) { const { u, ...rest } = it; snap.set(it.id, JSON.stringify(rest)); }
}
/* Donne à un jeu de données chargé de l'extérieur tout ce dont la fusion a besoin */
function normalizeDb() {
  db.meta = db.meta || {}; db.tomb = db.tomb || {};
  const base = db.meta.savedAt || Date.now();
  for (const k of COLLS) (db[k] = db[k] || []).forEach(it => { if (!it.u) it.u = base; });
  initSnap();
}
/* Appelé à chaque sauvegarde : date les éléments modifiés, note les suppressions */
function trackChanges() {
  db.tomb = db.tomb || {};
  const now = Date.now(), cur = new Map();
  for (const k of COLLS) for (const it of db[k] || []) {
    const { u, ...rest } = it, s = JSON.stringify(rest);
    cur.set(it.id, s);
    if (snap.get(it.id) !== s || !it.u) it.u = now;
    if (db.tomb[it.id]) delete db.tomb[it.id]; // élément présent (recréé / annulation) : plus supprimé
  }
  for (const id of snap.keys()) if (!cur.has(id)) db.tomb[id] = now;
  snap = cur;
}

const TOMB_TTL = 90 * 864e5;
function mergeDb(a, b) {
  const out = { v: 1, tomb: {}, meta: {} }, tomb = {};
  for (const [id, ts] of [...Object.entries(a.tomb || {}), ...Object.entries(b.tomb || {})]) tomb[id] = Math.max(tomb[id] || 0, ts);
  const alive = new Set();
  for (const k of COLLS) {
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
  out.meta = { ...ma, ...mb, sample: !!(ma.sample && mb.sample), createdAt: cr[0] || null,
    lastReview: [ma.lastReview, mb.lastReview].filter(Boolean).sort().pop() || null, savedAt: Math.max(ma.savedAt || 0, mb.savedAt || 0) };
  return out;
}
const validDb = d => d && CORE_KEYS.every(k => Array.isArray(d[k]));

/* ---------------------------- Dropbox ---------------------------- */
const dbxSync = (() => {
  const st = { state: 'none', last: null, err: '' }; // none | syncing | ok | offline | needs | error
  const LS = { key: 'cap.dbx.key', tok: 'cap.dbx.tok', pk: 'cap.dbx.pkce' }, PATH = '/cap-donnees.json';
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const canOAuth = /^https?:$/.test(location.protocol);
  const connected = () => !!get(LS.tok);
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  let busy = false, again = false, timer = null;
  const authErr = () => Object.assign(new Error('auth'), { code: 'auth' });

  const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, '').slice(0, n); };
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ui_ = () => { if (typeof refreshSide === 'function' && document.querySelector('.side')) { if (ui.view === 'settings') render(); else refreshSide(); } };

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
      ui.view = 'settings'; toast('Dropbox connecté ✓');
    } catch (e) { toast('Échec de la connexion Dropbox (vérifie la clé et l\'adresse de redirection)'); }
    return true;
  }

  async function download(tok) {
    const r = await fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Dropbox-API-Arg': JSON.stringify({ path: PATH }) } });
    if (r.status === 401) throw authErr();
    if (r.status === 409) { const b = await r.text(); if (/not_found/.test(b)) return { data: null, text: '', rev: null }; throw new Error('dropbox: ' + b.slice(0, 120)); }
    if (!r.ok) throw new Error('http ' + r.status);
    let rev = null; try { rev = JSON.parse(r.headers.get('dropbox-api-result') || '{}').rev || null; } catch (e) { /* ignore */ }
    const text = await r.text(); let data = null; try { data = JSON.parse(text); } catch (e) { /* ignore */ }
    return { data, text, rev };
  }
  async function upload(tok, json, rev) {
    const arg = { path: PATH, mode: rev ? { '.tag': 'update', update: rev } : 'overwrite', mute: true };
    const r = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Dropbox-API-Arg': JSON.stringify(arg), 'Content-Type': 'application/octet-stream' }, body: json });
    if (r.status === 401) throw authErr();
    if (r.status === 409) { const b = await r.text(); if (/conflict/.test(b)) return 'conflict'; throw new Error('dropbox: ' + b.slice(0, 120)); }
    if (!r.ok) throw new Error('http ' + r.status);
    return 'ok';
  }
  function adopt(target) {
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.closest('#detail');
    db = target; normalizeDb(); ensureTrackDefaults();
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
    if (typing) refreshLight(); else render();
  }

  async function syncNow() {
    if (!connected()) return;
    if (busy) { again = true; return; }
    busy = true; st.state = 'syncing'; st.err = ''; ui_();
    try {
      const tok = await token();
      for (let i = 0; i < 4; i++) {
        const rem = await download(tok);
        let target = db;
        // des données d'exemple jamais touchées ne doivent jamais se mélanger aux vraies données : le distant l'emporte
        if (rem.data && validDb(rem.data)) target = db.meta?.sample ? rem.data : mergeDb(db, rem.data);
        const json = JSON.stringify(target);
        if (json !== JSON.stringify(db)) adopt(target);
        if (json === (rem.text || '').trim()) break;
        if ((await upload(tok, json, rem.rev)) === 'ok') break;
      }
      st.state = 'ok'; st.last = Date.now();
    } catch (e) {
      if (e.code === 'auth') st.state = 'needs';
      else if (!navigator.onLine || e instanceof TypeError) st.state = 'offline';
      else { st.state = 'error'; st.err = e.message; }
    }
    busy = false; ui_();
    if (again) { again = false; setTimeout(syncNow, 300); }
  }
  function schedule() { if (!connected()) return; clearTimeout(timer); timer = setTimeout(syncNow, 2500); }
  function disconnect() { put(LS.tok, null); st.state = 'none'; st.last = null; ui_(); }

  async function init() {
    if (!canOAuth) return;
    await handleCallback();
    if (!connected()) return ui_();
    st.state = 'syncing'; ui_(); syncNow();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
    window.addEventListener('online', syncNow);
    setInterval(() => { if (!document.hidden) syncNow(); }, 90000);
  }
  return { st, init, connect, disconnect, syncNow, schedule, connected, canOAuth, redirectUri, key: () => get(LS.key) || '' };
})();
