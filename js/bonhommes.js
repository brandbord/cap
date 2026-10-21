'use strict';
/* =====================================================================
   NOS BONHOMMES : un petit avatar pour Brandon, un pour Julya, façon tamagotchi (version douce).
   - Chacun personnalise le sien (peau, cheveux, couleur du haut, silhouette de mince à rond, accessoire).
   - On nourrit et on câline celui de l'autre (jamais le sien). Rien n'est stocké comme « jauge » : on garde
     seulement des gestes (un repas, un câlin…), datés, et la faim / la joie se calculent à partir d'eux.
     Deux appareils ne s'écrasent donc jamais : chaque geste est un élément à part, qui ne change plus.
   - Quand une lettre t'attend, ton bonhomme te fait signe de la main (accueil + écran des bonhommes).
   - Un seul fichier commun (bonhommes/commun.json), deux collections : looks (1 par personne, écrit par
     son propriétaire seulement) et acts (les gestes, purgés au bout de 5 jours).
   ===================================================================== */
Object.assign(ICONS, {
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
});

const BON_KEY = 'bonhommes.v1.commun', BON_COLLS = ['looks', 'acts'];
/* Les deux barres perdent 30 points par jour. Un niveau (≤ 100) tombe à 0 en ~3,4 jours : on garde donc les gestes 5 jours, pas plus. */
const BON_DECAY = 30 / 864e5, BON_WINDOW_MS = 4 * 864e5, BON_KEEP_MS = 5 * 864e5, BON_START = 70, BON_FOOD_K = 0.5; // la nourriture pèse deux fois moins que l'affection
const BON_FOODS = [
  { id: 'pomme', e: '🍎', n: 'une pomme', fill: 22, joy: 6 }, { id: 'fraise', e: '🍓', n: 'des fraises', fill: 14, joy: 12 },
  { id: 'croissant', e: '🥐', n: 'un croissant', fill: 28, joy: 14 }, { id: 'salade', e: '🥗', n: 'une salade', fill: 32, joy: 4 },
  { id: 'pizza', e: '🍕', n: 'une pizza', fill: 45, joy: 16 }, { id: 'burger', e: '🍔', n: 'un burger', fill: 48, joy: 14 },
  { id: 'sushi', e: '🍣', n: 'des sushis', fill: 38, joy: 16 }, { id: 'cookie', e: '🍪', n: 'un cookie', fill: 16, joy: 18 },
  { id: 'glace', e: '🍦', n: 'une glace', fill: 12, joy: 22 }, { id: 'gateau', e: '🍰', n: 'un gâteau', fill: 24, joy: 24 },
];
const BON_CARE = {
  hug: { e: '🤗', label: 'Câlin', verb: 'a fait un câlin à', joy: 35 },
  kiss: { e: '😘', label: 'Bisou', verb: 'a fait un bisou à', joy: 25 },
};
const BON_SKIN = ['#fbd9bf', '#f1c19b', '#d9a07a', '#b87b55', '#8a5a3b'];
const BON_HAIRC = ['#2b1f1a', '#6b4226', '#b5762e', '#e0b050', '#c0392b', '#8a8f99'];
const BON_SHIRT = ['#c4552f', '#5f7fa8', '#5a8a63', '#cf8a1c', '#b3477e', '#4a4f63', '#e9e1d3'];
const BON_HAIRS = ['Court', 'Long', 'Chignon', 'Frisé', 'Chauve'];
const BON_BODIES = ['Mince', 'Normal', 'Rond'];
const BON_ACCS = ['Aucun', 'Lunettes', 'Bonnet', 'Nœud', 'Couronne'];
const BON_DEFAULT = { brandon: { skin: 1, hair: 0, hairC: 1, shirt: 0, body: 1, acc: 0 }, julya: { skin: 1, hair: 2, hairC: 0, shirt: 1, body: 1, acc: 0 } };

const bon = { data: null, snap: new Map(), colls: BON_COLLS };
const bonUi = { edit: false, fx: null };

/* ---------- données ---------- */
function bonLoad() {
  let d = readLS(BON_KEY);
  if (!d || !Array.isArray(d.looks)) d = { v: 1, looks: [], acts: [] };
  if (!Array.isArray(d.acts)) d.acts = [];
  bon.data = d; normalizeStore(bon);
  if (!d.meta.createdAt) d.meta.createdAt = new Date().toISOString(); // départ de la faim ; à la fusion, la plus ancienne date l'emporte
}
function bonSave() {
  const now = Date.now();
  bon.data.acts = bon.data.acts.filter(a => now - a.at < BON_KEEP_MS);
  bon.data.meta.savedAt = now;
  trackStore(bon);
  try { localStorage.setItem(BON_KEY, JSON.stringify(bon.data)); } catch (e) { /* ignore */ }
  dbxSync.schedule('bonhommes');
}
function bonAdopt(target) {
  if (!Array.isArray(target.acts)) target.acts = [];
  bon.data = target; normalizeStore(bon);
  if (!bon.data.meta.createdAt) bon.data.meta.createdAt = new Date().toISOString();
  try { localStorage.setItem(BON_KEY, JSON.stringify(bon.data)); } catch (e) { /* ignore */ }
  if (hub.screen === 'bonhommes' || hub.screen === 'home') render();
}

/* ---------- état d'un bonhomme (calculé, jamais stocké) ---------- */
const bonFood = id => BON_FOODS.find(f => f.id === id);
const bonClamp = n => Math.max(0, Math.min(100, n));
function bonLook(pid) {
  const it = bon.data.looks.find(x => x.id === 'look.' + pid);
  return { ...(BON_DEFAULT[pid] || BON_DEFAULT.brandon), ...(it || {}) };
}
function bonPal(pid) {
  /* On rejoue les gestes dans l'ordre : chaque barre baisse de 30 points par jour, chaque geste la relève (plafond 100). */
  const now = Date.now(), anchor = Date.parse(bon.data.meta.createdAt) || now, t0 = Math.max(anchor, now - BON_WINDOW_MS);
  let sat = anchor >= t0 ? BON_START : 0, joy = sat, t = t0;
  const fade = to => { to = Math.max(t, to); const d = (to - t) * BON_DECAY; sat = Math.max(0, sat - d); joy = Math.max(0, joy - d); t = to; };
  const acts = bon.data.acts.filter(a => a.to === pid && a.at >= t0).sort((x, y) => x.at - y.at);
  for (const a of acts) {
    fade(a.at);
    const f = a.kind === 'food' ? bonFood(a.food) : null;
    if (f) { sat += f.fill * BON_FOOD_K; joy += f.joy * BON_FOOD_K; } else if (BON_CARE[a.kind]) joy += BON_CARE[a.kind].joy;
    sat = bonClamp(sat); joy = bonClamp(joy);
  }
  fade(now);
  return { pid, look: bonLook(pid), sat, joy, mood: sat < 25 ? 'sad' : joy >= 60 ? 'happy' : 'ok' };
}
function bonAct(kind, extra) {
  const to = otherProfile().id;
  bon.data.acts.push({ id: uid(), to, by: hub.profile, kind, at: Date.now(), ...extra });
  const love = kind !== 'food' && bonPal(to).joy >= 99.5; // joie déjà au plafond après ce geste : yeux en cœur
  bonUi.fx = { to, e: extra?.food ? bonFood(extra.food).e : BON_CARE[kind].e, t: Date.now(), dur: love ? 2400 : 1700, love };
  setTimeout(() => { bonUi.fx = null; if (hub.screen === 'bonhommes') render(); }, bonUi.fx.dur + 50);
  bonSave(); render();
}
const bonTileBadge = () => {
  try {
    const o = bonPal(otherProfile().id);
    return o.mood === 'sad' ? `<span class="tbadge hot">${esc(otherProfile().name)} a faim !</span>` : '<span class="tbadge">Tout va bien</span>';
  } catch (e) { return ''; }
};

/* ---------- dessin ---------- */
function palSvg(look, o = {}) {
  const skin = BON_SKIN[look.skin] || BON_SKIN[1], hc = BON_HAIRC[look.hairC] || BON_HAIRC[0], sh = BON_SHIRT[look.shirt] || BON_SHIRT[0];
  const bw = [20, 27, 35][look.body] ?? 27, mood = o.mood || 'ok', ink = '#2a2521';
  const sx = 60 + bw - 3, lx = 60 - bw + 3, hs = look.hair;
  const hairBack = hs === 1 ? `<path d="M31 54C27 16 93 16 89 54L92 92C75 98 45 98 28 92Z" fill="${hc}"/>` : '';
  const hairFront = {
    0: `<path d="M33 49C31 22 52 18 62 20C80 20 90 32 87 49C84 40 76 33 60 33C46 33 38 40 33 49Z" fill="${hc}"/>`,
    1: `<path d="M33 52C30 22 50 17 62 19C84 20 92 34 87 52C85 40 76 30 60 32C44 32 36 40 33 52Z" fill="${hc}"/>`,
    2: `<path d="M33 49C31 22 52 18 62 20C80 20 90 32 87 49C84 40 76 33 60 33C46 33 38 40 33 49Z" fill="${hc}"/><circle cx="60" cy="14" r="10" fill="${hc}"/>`,
    3: [[37, 36, 9], [47, 27, 10], [60, 23, 10], [73, 27, 10], [83, 36, 9]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${hc}"/>`).join(''),
    4: '',
  }[hs] || '';
  const love = !!o.love;
  const brows = mood === 'sad' ? `<path d="M44 44L54 47M76 44L66 47" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>` : '';
  const eyes = love
    ? `<g class="bn-heart" fill="#e0457b"><path d="M50 60C41 53 43 46 47 46C49 46 50 48 50 49C50 48 51 46 53 46C57 46 59 53 50 60Z"/><path d="M70 60C61 53 63 46 67 46C69 46 70 48 70 49C70 48 71 46 73 46C77 46 79 53 70 60Z"/></g>`
    : mood === 'happy'
    ? `<path d="M45 54Q50 47 55 54M65 54Q70 47 75 54" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`
    : `<g class="bn-eyes"><circle cx="50" cy="53" r="3.2" fill="${ink}"/><circle cx="70" cy="53" r="3.2" fill="${ink}"/></g>`;
  const mouth = o.eat && !love ? `<ellipse class="bn-chew" cx="60" cy="65" rx="5" ry="4" fill="#8a3b3b"/>`
    : (mood === 'happy' || love) ? `<path d="M49 61Q60 76 71 61Z" fill="#8a3b3b" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`
    : mood === 'sad' ? `<path d="M52 69Q60 62 68 69" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<path d="M52 63Q60 69 68 63" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  const acc = [
    '',
    `<g fill="rgba(255,255,255,.25)" stroke="${ink}" stroke-width="2"><circle cx="50" cy="53" r="8"/><circle cx="70" cy="53" r="8"/><path d="M58 53H62" fill="none"/></g>`,
    `<path d="M32 40C32 12 88 12 88 40Z" fill="#c4552f"/><rect x="30" y="36" width="60" height="9" rx="4.5" fill="#a8431f"/><circle cx="60" cy="11" r="5.5" fill="#e9e1d3"/>`,
    `<g fill="#b3477e"><path d="M82 24L96 16V34Z"/><path d="M82 24L68 16V34Z"/><circle cx="82" cy="25" r="4"/></g>`,
    `<path d="M40 26L43 8L52 19L60 6L68 19L77 8L80 26Z" fill="#e8b930" stroke="#b98a12" stroke-width="1.5" stroke-linejoin="round"/>`,
  ][look.acc] || '';
  const cheeks = (mood === 'happy' || love) ? '<circle cx="42" cy="62" r="4.5" fill="#f08a8a" opacity=".5"/><circle cx="78" cy="62" r="4.5" fill="#f08a8a" opacity=".5"/>' : '';
  const legX = bw * 0.5, size = o.size || 140;
  return `<svg class="bn-svg" width="${size}" height="${Math.round(size * 1.25)}" viewBox="0 0 120 150" role="img" aria-label="Bonhomme">
    <ellipse cx="60" cy="144" rx="${bw + 6}" ry="5" fill="rgba(0,0,0,.12)"/>
    <g class="bn-bob">
      <rect x="${60 - legX - 6}" y="116" width="12" height="22" rx="6" fill="#4a5068"/><rect x="${60 + legX - 6}" y="116" width="12" height="22" rx="6" fill="#4a5068"/>
      <ellipse cx="${60 - legX}" cy="139" rx="8" ry="4.5" fill="#2a2521"/><ellipse cx="${60 + legX}" cy="139" rx="8" ry="4.5" fill="#2a2521"/>
      <path d="M${lx} 86L${lx - 9} 110" stroke="${sh}" stroke-width="9" stroke-linecap="round"/><circle cx="${lx - 9}" cy="111" r="4.8" fill="${skin}"/>
      <rect x="${60 - bw}" y="74" width="${bw * 2}" height="52" rx="${Math.min(bw, 26)}" fill="${sh}"/>
      <g class="bn-arm ${o.wave ? 'wave' : ''}" style="transform-origin:${sx}px 86px"><path d="M${sx} 86L${sx + 9} 110" stroke="${sh}" stroke-width="9" stroke-linecap="round"/><circle cx="${sx + 9}" cy="111" r="4.8" fill="${skin}"/></g>
      ${hairBack}
      <circle cx="33" cy="54" r="4.5" fill="${skin}"/><circle cx="87" cy="54" r="4.5" fill="${skin}"/>
      <circle cx="60" cy="50" r="27" fill="${skin}"/>
      ${cheeks}${brows}${eyes}${mouth}
      ${hairFront}${acc}
    </g></svg>`;
}

/* ---------- rendu ---------- */
const bonAgo = t => {
  const m = Math.round((Date.now() - t) / 6e4);
  return m < 1 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : 'hier';
};
const bonSay = (p, mail, other) => (mail ? `Une lettre de ${other} t'attend !` : p.mood === 'sad' ? 'J\'ai faim…' : p.mood === 'happy' ? 'Je suis aux anges !' : 'Ça va bien 🙂');
const bonGauge = (label, v, cls) => `<div class="bn-gauge"><span>${label}</span><b><i class="${cls}" style="width:${Math.round(v)}%"></i></b></div>`;

function palCard(p, isMe) {
  const prof = profileOf(p.pid), mail = isMe && flagUp(), fx = bonUi.fx && bonUi.fx.to === p.pid && Date.now() - bonUi.fx.t < bonUi.fx.dur ? bonUi.fx : null;
  const say = isMe ? bonSay(p, mail, otherProfile().name) : bonSay(p, false);
  return `<div class="bn-card ${isMe ? 'me' : ''}">
    <button class="bn-bubble ${mail ? 'mail' : ''}" ${mail ? 'data-do="mailOpenBox"' : 'tabindex="-1"'}>${esc(say)}${mail ? ' ✉' : ''}</button>
    <div class="bn-stage">${palSvg(p.look, { mood: p.mood, wave: mail, eat: !!(fx && bonFoodByEmoji(fx.e)), love: !!(fx && fx.love) })}${fx ? `<span class="bn-fx">${fx.e}</span>` : ''}</div>
    <b class="bn-name" style="color:${prof.color}">${esc(prof.name)}${isMe ? ' <small>(toi)</small>' : ''}</b>
    ${bonGauge('Ventre', p.sat, 'g-fill')}${bonGauge('Joie', p.joy, 'g-joy')}
    ${isMe ? `<button class="btn sm" data-do="bonEdit">${bonUi.edit ? 'Terminé' : 'Personnaliser'}</button>` : ''}</div>`;
}
const bonFoodByEmoji = e => BON_FOODS.find(f => f.e === e);

function bonTray() {
  const o = otherProfile(), p = bonPal(o.id), full = p.sat >= 90;
  return `<section class="msec"><h2>Nourrir et câliner ${esc(o.name)}</h2>
    <div class="bn-tray">${BON_FOODS.map(f => `<button class="bn-food" data-do="bonFeed" data-f="${f.id}" title="Donner ${f.n}" ${full ? 'disabled' : ''}>${f.e}</button>`).join('')}</div>
    ${full ? `<p class="hint" style="margin:8px 0 0">${esc(o.name)} n'a plus faim pour l'instant.</p>` : ''}
    <div class="bn-tray care">${Object.entries(BON_CARE).map(([k, c]) => `<button class="btn" data-do="bonCare" data-k="${k}">${c.e} ${c.label}</button>`).join('')}</div></section>`;
}
function bonEditor() {
  const L = bonLook(hub.profile), sw = (key, arr) => `<div class="bn-sws">${arr.map((c, i) =>
    `<button class="bn-sw ${L[key] === i ? 'on' : ''}" data-do="bonSet" data-k="${key}" data-v="${i}" style="background:${c}" aria-label="Couleur ${i + 1}"></button>`).join('')}</div>`;
  const seg = (key, arr) => `<div class="seg sm">${arr.map((l, i) => `<button class="${L[key] === i ? 'on' : ''}" data-do="bonSet" data-k="${key}" data-v="${i}">${l}</button>`).join('')}</div>`;
  const row = (t, body) => `<div class="bn-row"><span>${t}</span>${body}</div>`;
  return `<section class="msec"><h2>Mon bonhomme</h2>
    ${row('Peau', sw('skin', BON_SKIN))}${row('Cheveux', seg('hair', BON_HAIRS))}${row('Couleur', sw('hairC', BON_HAIRC))}
    ${row('Haut', sw('shirt', BON_SHIRT))}${row('Silhouette', seg('body', BON_BODIES))}${row('Accessoire', seg('acc', BON_ACCS))}</section>`;
}
function bonJournal() {
  const acts = [...bon.data.acts].sort((a, b) => b.at - a.at).slice(0, 6);
  if (!acts.length) return '';
  return `<section class="msec"><h2>Récemment</h2><ul class="bn-log">${acts.map(a => {
    const by = profileOf(a.by), to = profileOf(a.to), f = a.kind === 'food' ? bonFood(a.food) : null;
    const what = f ? `a donné ${f.n} ${f.e} à` : `${BON_CARE[a.kind]?.verb || 'a pensé à'}`;
    return `<li><b style="color:${by.color}">${esc(by.id === hub.profile ? 'Toi' : by.name)}</b> ${what} <b style="color:${to.color}">${esc(to.id === hub.profile ? 'toi' : to.name)}</b><em>${bonAgo(a.at)}</em></li>`;
  }).join('')}</ul></section>`;
}
function bonHtml() {
  const me = bonPal(hub.profile), ot = bonPal(otherProfile().id);
  return `<div class="hubwrap cw"><div class="cwrap bnwrap">
    <header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button><h1>Nos bonhommes</h1><span class="sp"></span></header>
    <div class="bn-pals">${palCard(me, true)}${palCard(ot, false)}</div>
    ${bonUi.edit ? bonEditor() : bonTray()}${bonJournal()}</div></div>`;
}
/* Accueil : ton bonhomme, qui te fait signe quand une lettre t'attend */
function bonHomeHtml() {
  try {
    const me = bonPal(hub.profile), mail = flagUp(), say = mail ? `Une lettre de ${otherProfile().name} t'attend !` : bonSay(me, false);
    return `<button class="bn-home ${mail ? 'mail' : ''}" ${mail ? 'data-do="mailOpenBox"' : 'data-do="hubOpen" data-app="bonhommes"'}>
      ${palSvg(me.look, { mood: me.mood, wave: mail, size: 72 })}<span class="bn-bubble">${esc(say)}${mail ? ' ✉' : ''}</span></button>`;
  } catch (e) { return ''; }
}

const bonH = {
  bonEdit: () => { bonUi.edit = !bonUi.edit; render(); },
  bonSet: el => {
    const id = 'look.' + hub.profile;
    let it = bon.data.looks.find(x => x.id === id);
    if (!it) { it = { id, who: hub.profile, ...bonLook(hub.profile) }; bon.data.looks.push(it); }
    it[el.dataset.k] = +el.dataset.v;
    bonSave(); render();
  },
  bonFeed: el => {
    const f = bonFood(el.dataset.f), o = otherProfile();
    if (!f) return;
    if (bonPal(o.id).sat >= 90) return toast(`${o.name} n'a plus faim`);
    bonAct('food', { food: f.id });
  },
  bonCare: el => { if (BON_CARE[el.dataset.k]) bonAct(el.dataset.k); },
};
function bonKey(e) { if (e.key === 'Escape') hubHome(); }
setInterval(() => { if (['bonhommes', 'home'].includes(hub.screen) && !document.hidden) dbxSync.syncNow(['bonhommes']); }, 25000);
