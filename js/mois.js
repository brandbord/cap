'use strict';
/* =====================================================================
   MOIS : fruits & légumes de saison, et idées jardin, pour le mois affiché.
   Contenu de référence, pareil pour les deux profils, calculé depuis la date du jour — pas de fichier,
   pas de synchro, pas de saisie : ça marche même hors ligne. Flèches pour parcourir les autres mois.
   Calendrier indicatif (climat tempéré, France) : à ajuster si besoin, c'est juste un point de départ.
   ===================================================================== */
const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MOIS_DATA = [
  { fruits: ['Pomme', 'Poire', 'Clémentine', 'Mandarine', 'Orange', 'Kiwi', 'Pamplemousse', 'Banane'],
    legumes: ['Poireau', 'Potiron', 'Panais', 'Céleri-rave', 'Chou', 'Endive', 'Carotte', 'Topinambour'],
    jardin: ['Protéger les plantes fragiles du gel', 'Tailler les arbres fruitiers à noyau, hors gel', 'Préparer les graines pour les semis à venir', 'Aérer la terre dès que le sol le permet'] },
  { fruits: ['Pomme', 'Poire', 'Clémentine', 'Orange', 'Kiwi', 'Banane'],
    legumes: ['Poireau', 'Endive', 'Chou', 'Céleri-rave', 'Panais', 'Épinard', 'Carotte', 'Topinambour'],
    jardin: ['Débuter les semis sous abri (tomates, poivrons)', 'Tailler la vigne et les rosiers', 'Planter l\'ail et les échalotes', 'Nettoyer les massifs avant le printemps'] },
  { fruits: ['Pomme', 'Poire', 'Kiwi', 'Rhubarbe', 'Citron'],
    legumes: ['Épinard', 'Radis', 'Carotte', 'Petit pois', 'Navet', 'Blette'],
    jardin: ['Semer radis, carottes et petits pois en pleine terre', 'Planter les pommes de terre', 'Diviser les touffes de vivaces', 'Installer les tuteurs pour les prochaines plantations'] },
  { fruits: ['Fraise', 'Rhubarbe', 'Pomme', 'Kiwi', 'Citron'],
    legumes: ['Asperge', 'Radis', 'Épinard', 'Petit pois', 'Artichaut', 'Fève', 'Blette'],
    jardin: ['Semer haricots et courgettes sous abri', 'Repiquer les plants de tomates au chaud', 'Arroser régulièrement les jeunes semis', 'Surveiller les dernières gelées'] },
  { fruits: ['Fraise', 'Rhubarbe', 'Cerise', 'Abricot'],
    legumes: ['Asperge', 'Radis', 'Petit pois', 'Artichaut', 'Fève', 'Laitue', 'Épinard'],
    jardin: ['Planter tomates, courgettes et concombres en pleine terre', 'Installer le paillage', 'Surveiller les limaces sur les jeunes pousses', 'Semer les fleurs annuelles'] },
  { fruits: ['Cerise', 'Abricot', 'Fraise', 'Framboise', 'Melon', 'Pêche'],
    legumes: ['Courgette', 'Petit pois', 'Haricot vert', 'Laitue', 'Concombre', 'Betterave'],
    jardin: ['Arroser tôt le matin ou en soirée', 'Tailler les haies une première fois', 'Récolter régulièrement pour stimuler la production', 'Surveiller les pucerons'] },
  { fruits: ['Abricot', 'Pêche', 'Nectarine', 'Melon', 'Framboise', 'Myrtille', 'Cerise', 'Prune'],
    legumes: ['Tomate', 'Courgette', 'Concombre', 'Haricot vert', 'Aubergine', 'Poivron', 'Betterave'],
    jardin: ['Arroser en soirée pour limiter l\'évaporation', 'Récolter tomates et courgettes au fur et à mesure', 'Pailler pour garder l\'humidité', 'Prévoir l\'arrosage pendant les vacances'] },
  { fruits: ['Pêche', 'Nectarine', 'Prune', 'Melon', 'Figue', 'Mûre'],
    legumes: ['Tomate', 'Aubergine', 'Poivron', 'Courgette', 'Maïs', 'Haricot vert', 'Concombre'],
    jardin: ['Poursuivre la récolte régulière', 'Bouturer les plantes aromatiques', 'Semer les légumes d\'automne (épinard, mâche)', 'Surveiller l\'arrosage en cas de forte chaleur'] },
  { fruits: ['Raisin', 'Figue', 'Prune', 'Pomme', 'Poire', 'Mûre', 'Noisette'],
    legumes: ['Tomate', 'Courge', 'Potimarron', 'Poireau', 'Chou', 'Carotte', 'Betterave'],
    jardin: ['Semer les engrais verts', 'Planter les bulbes de printemps en fin de mois', 'Récolter les courges avant les premières gelées', 'Nettoyer les massifs fanés'] },
  { fruits: ['Pomme', 'Poire', 'Coing', 'Raisin', 'Noix', 'Châtaigne', 'Figue'],
    legumes: ['Courge', 'Potiron', 'Potimarron', 'Chou', 'Poireau', 'Carotte', 'Panais', 'Céleri-rave'],
    jardin: ['Planter arbres et arbustes, c\'est la bonne saison', 'Ramasser les feuilles mortes pour le compost', 'Planter l\'ail d\'hiver et les oignons', 'Protéger les plantes sensibles au froid'] },
  { fruits: ['Pomme', 'Poire', 'Coing', 'Kiwi', 'Noix', 'Châtaigne', 'Clémentine'],
    legumes: ['Potiron', 'Courge', 'Chou', 'Poireau', 'Panais', 'Céleri-rave', 'Topinambour', 'Épinard'],
    jardin: ['Continuer les plantations d\'arbres et arbustes', 'Rentrer ou protéger les plantes en pot', 'Tailler les arbres fruitiers à pépins', 'Nettoyer et ranger les outils de jardin'] },
  { fruits: ['Pomme', 'Poire', 'Clémentine', 'Mandarine', 'Kiwi', 'Orange'],
    legumes: ['Poireau', 'Potiron', 'Chou', 'Céleri-rave', 'Endive', 'Panais', 'Topinambour'],
    jardin: ['Protéger les plantes fragiles du gel', 'Planifier les cultures de l\'année prochaine', 'Commander les graines pour le printemps', 'Pailler les massifs pour l\'hiver'] },
];
/* Un mot de turc par mois, avec sa traduction (Julya a déjà les bases : au-delà de « bonjour, ça va »).
   Indice aligné sur MOIS_DATA (0 = janvier). */
const MOT_MOIS = [
  { mot: 'Ocak', sens: 'Poêle, foyer — et c\'est aussi le nom de ce mois en turc !' },
  { mot: 'Huzur', sens: 'Paix intérieure, sérénité' },
  { mot: 'Bahar', sens: 'Printemps' },
  { mot: 'Yağmur', sens: 'Pluie' },
  { mot: 'Kelebek', sens: 'Papillon' },
  { mot: 'Güneş', sens: 'Soleil' },
  { mot: 'Deniz', sens: 'Mer' },
  { mot: 'Yıldız', sens: 'Étoile — les étoiles filantes d\'août' },
  { mot: 'Rüzgar', sens: 'Vent' },
  { mot: 'Yaprak', sens: 'Feuille' },
  { mot: 'Şükür', sens: 'Gratitude' },
  { mot: 'Kar', sens: 'Neige' },
];

/* ---------- phases de la lune (approximation astronomique, sans service externe) ----------
   Cycle synodique moyen (29,53059 j) depuis une nouvelle lune de référence connue (6 janvier 2000, 18h14 UTC).
   Précis à quelques heures près : largement suffisant pour un repère visuel, pas un calendrier d'observation. */
const MOON_SYNODIC = 29.530588853, MOON_REF_JD = 2451550.1;
const toJD = d => d.getTime() / 86400000 + 2440587.5;
const fromJD = jd => new Date((jd - 2440587.5) * 86400000);
function moonEventsForMonth(year, month) {
  const start = new Date(year, month, 1), end = new Date(year, month + 1, 1);
  const k0 = Math.floor((toJD(start) - MOON_REF_JD) / MOON_SYNODIC) - 1;
  const phases = [[0, 'Nouvelle lune', '🌑'], [0.25, 'Premier quartier', '🌓'], [0.5, 'Pleine lune', '🌕'], [0.75, 'Dernier quartier', '🌗']];
  const events = [];
  for (let k = k0; k < k0 + 3; k++) {
    const base = MOON_REF_JD + k * MOON_SYNODIC;
    phases.forEach(([frac, label, icon]) => {
      const d = fromJD(base + frac * MOON_SYNODIC);
      if (d >= start && d < end) events.push({ d, label, icon });
    });
  }
  return events.sort((a, b) => a.d - b.d);
}

let moisOff = 0; // décalage par rapport au mois actuel (0 = ce mois-ci)
const moisIdx = () => (((new Date().getMonth() + moisOff) % 12) + 12) % 12;
function moisTileBadge() { return `<span class="tbadge">${MOIS_NOMS[new Date().getMonth()]}</span>`; }

function moisHtml() {
  const i = moisIdx(), d = MOIS_DATA[i], cur = moisOff === 0;
  const jcolor = DEFAULT_DOMAINS.find(x => x.id === 'jardin')?.color || 'var(--ok)';
  const chips = (list, cls) => `<div class="mchips">${list.map(x => `<span class="mchip ${cls}">${esc(x)}</span>`).join('')}</div>`;
  const mot = MOT_MOIS[i];
  const moon = moonEventsForMonth(new Date().getFullYear(), new Date().getMonth() + moisOff);
  return `<div class="hubwrap cw"><div class="cwrap mwrap">
    <header class="chead"><button class="iconbtn" data-do="hubHome" title="Retour aux applications">${ic('left', 20)}</button>
      <button class="iconbtn" data-do="moisNav" data-v="-1" title="Mois précédent">${ic('left', 16)}</button>
      <h1>${MOIS_NOMS[i]}</h1>
      <button class="iconbtn" data-do="moisNav" data-v="1" title="Mois suivant">${ic('right', 16)}</button>
      <span class="sub">${cur ? 'Ce mois-ci' : ''}</span><span class="sp"></span>
      ${!cur ? `<button class="btn sm" data-do="moisNav" data-v="0">${ic('calendar', 14)}Ce mois-ci</button>` : ''}</header>
    <section class="msec motsec"><h2>Mot du mois <span class="motflag">turc</span></h2><div class="motword">${esc(mot.mot)}</div><div class="motsens">${esc(mot.sens)}</div></section>
    <section class="msec"><h2>Fruits de saison</h2>${chips(d.fruits, 'fruit')}</section>
    <section class="msec"><h2>Légumes de saison</h2>${chips(d.legumes, 'legume')}</section>
    <section class="msec" style="--c:${jcolor}"><h2>Au jardin ce mois-ci</h2><ul class="mtips">${d.jardin.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="msec"><h2>Phases de la lune</h2><ul class="mmoon">${moon.length ? moon.map(x => `<li><span class="mmicon">${x.icon}</span>${x.label}<b>${x.d.getDate()}</b></li>`).join('') : '<li class="muted">Pas de nouvelle donnée ce mois-ci</li>'}</ul></section>
    <p class="hint">Calendrier indicatif pour un climat tempéré (France) et phases lunaires approximatives (à quelques heures près) — juste un repère, pas un calendrier d'observation.</p>
  </div></div>`;
}
const moisH = { moisNav: el => { const v = +el.dataset.v; moisOff = v === 0 ? 0 : moisOff + v; render(); } };
function moisKey(e) {
  if (e.key === 'ArrowLeft') moisH.moisNav({ dataset: { v: '-1' } });
  else if (e.key === 'ArrowRight') moisH.moisNav({ dataset: { v: '1' } });
  else if (e.key === 'Escape') hubHome();
}
