'use strict';
/* Sauvegarde automatique dans un vrai fichier (File System Access API, Edge/Chrome).
   Le fichier est choisi une seule fois ; ensuite chaque modification y est recopiée en silence.
   Le navigateur (localStorage) reste la source de travail : le fichier est un miroir + filet de sécurité. */
const fileSync = (() => {
  const st = { state: 'none', name: '' }; // none | ok | needs | error | unsupported
  const supported = 'showSaveFilePicker' in window;
  if (!supported) st.state = 'unsupported';
  let handle = null, timer = null, writing = false, again = false, asked = false;

  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open('cap-fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const kv = async (mode, fn) => {
    const d = await idb();
    return new Promise((res, rej) => { const tx = d.transaction('kv', mode), q = fn(tx.objectStore('kv')); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); });
  };
  const hkey = () => 'handle.' + (hub.profile || 'brandon'); // un fichier de sauvegarde par profil
  const valid = d => d && ['actions', 'domains', 'routines', 'activities'].every(k => Array.isArray(d[k]));
  const refresh = () => { if (typeof render !== 'function' || !document.getElementById('app').firstChild || hub.screen !== 'cap') return; if (ui.view === 'settings') render(); else refreshSide(); };
  const readFile = async () => { const t = await (await handle.getFile()).text(); return t.trim() ? JSON.parse(t) : null; };

  async function write() {
    if (!handle || st.state !== 'ok') return;
    if (writing) { again = true; return; }
    writing = true;
    try {
      do {
        again = false;
        const w = await handle.createWritable();
        await w.write(JSON.stringify(db, null, 1)); await w.close();
      } while (again);
    } catch (e) { st.state = 'error'; refresh(); }
    writing = false;
  }
  function schedule() { if (st.state !== 'ok') return; clearTimeout(timer); timer = setTimeout(write, 400); }

  function adopt(d) {
    COLLS.forEach(k => { d[k] = d[k] || []; }); d.meta = d.meta || {}; db = d; save(); ensureTrackDefaults();
    ui.sel = { actions: null, routines: null, activities: null }; render();
  }
  async function sync() {
    st.state = 'ok';
    try {
      const d = await readFile();
      if (valid(d) && ((d.meta?.savedAt || 0) > (db.meta?.savedAt || 0) || db.meta?.sample)) { adopt(d); toast(`Données chargées depuis ${st.name}`); }
      else await write();
    } catch (e) { st.state = 'error'; }
    refresh();
  }
  async function remember(h) { handle = h; st.name = h.name; try { await kv('readwrite', s => s.put(h, hkey())); } catch (e) { /* ignore */ } }

  async function init() {
    if (!supported) return;
    try {
      let h = await kv('readonly', s => s.get(hkey()));
      if (!h && hub.profile === 'brandon') h = await kv('readonly', s => s.get('handle')); // fichier choisi avant les profils
      if (!h) return refresh();
      handle = h; st.name = h.name;
      if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') await sync(); else { st.state = 'needs'; refresh(); }
    } catch (e) { st.state = 'none'; refresh(); }
  }
  async function connect() {
    if (!supported) return;
    try {
      const h = await showSaveFilePicker({ suggestedName: `cap-donnees-${hub.profile || 'brandon'}.json`, types: [{ description: 'Données Cap', accept: { 'application/json': ['.json'] } }] });
      await remember(h); st.state = 'ok';
      const d = await readFile().catch(() => null);
      if (valid(d) && (d.actions.length + d.routines.length) > 0 &&
        confirm(`Ce fichier contient déjà des données (${d.actions.length} actions, ${d.routines.length} routines).\n\nOK = charger le fichier à la place des données actuelles\nAnnuler = écraser le fichier avec les données actuelles`)) adopt(d);
      else await write();
      toast('Sauvegarde automatique activée ✓');
    } catch (e) { if (e.name !== 'AbortError') st.state = 'error'; }
    refresh();
  }
  async function reconnect() {
    try { if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') await sync(); else refresh(); } catch (e) { st.state = 'error'; refresh(); }
  }
  /* premier clic de la session : redemande l'accès au fichier (le navigateur exige un geste de l'utilisateur) */
  document.addEventListener('pointerdown', () => { if (st.state === 'needs' && !asked) { asked = true; reconnect(); } }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && st.state === 'ok') { clearTimeout(timer); write(); } });

  return { st, supported, schedule, init, connect, reconnect };
})();
