/**
 * Dizionario ITALIANO — locale canonica e di default (vedi i18n.ts).
 * Contiene OGNI chiave: le altre lingue fanno fallback qui. Quando aggiungi una
 * stringa al gioco, aggiungi prima la chiave qui, poi traducila negli altri file.
 *
 * Convenzione segnaposto: `{nome}` (riempito da t(key, params)). Simboli (★ ▸ ● ↯ ⚠ …)
 * fanno parte dello stile UI e restano identici in tutte le lingue.
 */
const it: Record<string, string> = {
  // ── Comune ───────────────────────────────────────────────────────────────────
  'common.settings': 'IMPOSTAZIONI',

  // ── Menu (titolo) ──────────────────────────────────────────────────────────────
  'menu.hint': 'Premi  INVIO  per iniziare  ·  clic per scegliere',
  'menu.record': 'RECORD  ·  Missione max {mission}  ·  Punteggio max {score}',
  'menu.continue': 'CONTINUA',
  'menu.newGame': 'NUOVA PARTITA',
  'menu.newGameWarn': 'azzera il progresso attuale',

  // ── Impostazioni ────────────────────────────────────────────────────────────────
  'settings.paused': '❚❚  PAUSA  ·  ESC per riprendere',
  'settings.volume': 'VOLUME AUDIO',
  'settings.muted': 'Muto',
  'settings.mute': '🔇  Muto',
  'settings.screenFx': 'EFFETTI SCHERMO',
  'settings.screenFxDesc': 'Vignetta · grana · scanline CRT',
  'settings.fxOn': 'ATTIVI',
  'settings.fxOff': 'DISATTIVI',
  'settings.resolution': 'RISOLUZIONE',
  'settings.resolutionDesc': 'Nativa · adattata allo schermo',
  'settings.resFromMenu': 'dal menu principale',
  'settings.fullscreen': 'SCHERMO INTERO',
  'settings.fullscreenDesc': 'Riempie tutto lo schermo',
  'settings.fsOn': 'ATTIVO',
  'settings.fsOff': 'ATTIVA',
  'settings.colorblind': 'DALTONISMO',
  'settings.colorblindDesc': 'Barre di stato blu/giallo (no rosso↔verde)',
  'settings.cbOn': 'ATTIVO',
  'settings.cbOff': 'DISATTIVO',
  'settings.language': 'LINGUA',
  'settings.languageDesc': 'Lingua dei testi',
  'settings.resume': '▶  RIPRENDI  ·  ESC',
  'settings.back': '◂  INDIETRO',
  'settings.exitToMenu': 'Esci al menu principale',

  // ── Negozio / Garage ─────────────────────────────────────────────────────────────
  'shop.title': 'GARAGE  —  Fine Missione {n}',
  'shop.money': '★ {n} monete',
  'shop.nextMission': 'Missione successiva: {n}',
  'shop.upgrades': 'POTENZIAMENTI',
  'shop.missing': 'manca {n}★',
  'shop.weapons': 'ARMI',
  'shop.activeWeapon': '● ATTIVA',
  'shop.activeVehicle': '● ATTIVO',
  'shop.use': 'Usa',
  'shop.buy': 'COMPRA',
  'shop.locked': 'BLOCCATO',
  'shop.weaponDesc': '▸ {desc}',
  'shop.survivors': 'SOPRAVVISSUTI',
  'shop.inVehicle': 'Nel veicolo:',
  'shop.survivorName': '• {name}',
  'shop.recruit': 'Recluta (scegli 1):',
  'shop.noneAvailable': 'Nessuno disponibile',
  'shop.recruited': 'GIÀ RECLUTATO',
  'shop.free': 'GRATIS',
  'shop.vehicles': 'VEICOLI',
  'shop.continue': 'CONTINUA  ▶',

  // ── Voci negozio (potenziamenti) ─────────────────────────────────────────────────
  'item.repair.label': 'Ripara tutto',
  'item.repair.desc': 'Tutti i componenti tornano al 100%',
  'item.armor.label': 'Corazza rinforzata',
  'item.armor.desc': 'Danno ricevuto ridotto (-20%)',
  'item.engine.label': 'Motore potenziato',
  'item.engine.desc': 'Velocità verticale +15%',
  'item.turret.label': 'Torretta migliorata',
  'item.turret.desc': 'Cadenza di fuoco +25%',
  'item.fuelTank.label': 'Serbatoio extra',
  'item.fuelTank.desc': 'Carburante massimo +30',

  // ── HUD di gioco ─────────────────────────────────────────────────────────────────
  'hud.health': 'SALUTE',
  'hud.fuel': 'CARBURANTE',
  'hud.score': 'PUNTEGGIO: {n}',
  'hud.mission': 'MISS.{n}',
  'hud.dash': '↯ SCATTO',
  'hud.dashCooldown': '↯ {n}s',
  'hud.overdrive': 'SOVRACCARICO',
  'hud.overdriveReady': 'PRONTO ▶F',
  'hud.overdriveActive': 'ATTIVO!',
  'hud.route': 'PERCORSO',
  'hud.km': '{n} km',
  'hud.kmTarget': '/ {n} km',
  'hud.combo': 'COMBO {n}',
  'hud.comboMult': 'COMBO {n}  ×{m}',
  'hud.attached': '[{n} aggrappati]',
  'hud.godMode': '◆ GOD MODE  (G off · B boss · N fine · H ripara)',
  'hud.controls': '↑↓/WS Muovi · SPAZIO Spara · 1-5/Q Arma · SHIFT Scatto · F Sovracc.',
  'hud.debugHint': '0=Debug',

  // ── Componenti del veicolo (HUD) ─────────────────────────────────────────────────
  'comp.engine': 'MOTORE',
  'comp.wheels': 'RUOTE',
  'comp.tank': 'SERBAT.',
  'comp.turret': 'TORR.',
  'comp.armor': 'CORAZZA',

  // ── Regioni / ambienti ───────────────────────────────────────────────────────────
  'region.city': 'Città Distrutta',
  'region.highway': 'Autostrada Abbandonata',
  'region.desert': 'Deserto',
  'region.forest': 'Foresta Infestata',
  'region.industrial': 'Zona Industriale',
  'region.military': 'Base Militare',
  'region.finalCity': 'Città Finale',

  // ── Gioco: esiti e avvisi ────────────────────────────────────────────────────────
  'game.giantWarn': '⚠ GIGANTE!',
  'game.overdriveOn': '⚡ SOVRACCARICO!',
  'game.over.fuel': 'Carburante esaurito!',
  'game.over.engine': 'Motore distrutto!',
  'game.over.vehicle': 'Veicolo distrutto!',
  'game.victoryCycle': '🏆 VITTORIA · Ciclo {n}',
  'game.missionComplete': 'MISSIONE COMPLETATA!',
  'game.allRegions': 'Hai completato le 7 regioni! Continua in endless+',
  'game.scoreLine': 'Punteggio: {n}',
  'game.distanceLine': 'Distanza: {n} km',
  'game.coinsEarned': 'Monete guadagnate: +{n}',
  'game.coinsTotal': 'Totale: {n}',
  'game.toShop': '[ SPAZIO ] per il negozio',
  'game.toMenu': '[ M ]  Torna al menu',
  'game.gameOver': 'GAME OVER',
  'game.progressReset': 'Progressione azzerata — si riparte dalla Missione 1',
  'game.restart': '[ SPAZIO ] per ricominciare',

  // ── Boss ─────────────────────────────────────────────────────────────────────────
  'boss.warn': '⚠  {name}  ⚠',
  'boss.fury': '⚠ FURIA',
  'boss.defeated': 'BOSS SCONFITTO!  +{n} monete',
  'boss.mega_mutant.name': 'Mega Mutante',
  'boss.giant_worm.name': 'Verme Gigante',
  'boss.armored_colossus.name': 'Colosso Corazzato',
  'boss.radioactive_beast.name': 'Bestia Radioattiva',

  // ── Veicoli (nomi) ───────────────────────────────────────────────────────────────
  'vehicle.civilian_car.name': 'Auto Civile',
  'vehicle.pickup.name': 'Pickup',
  'vehicle.armored_van.name': 'Furgone Blindato',
  'vehicle.military_suv.name': 'SUV Militare',
  'vehicle.armored_truck.name': 'Camion Corazzato',
  'vehicle.heavy_military.name': 'Mezzo Pesante',
  'vehicle.experimental.name': 'Veicolo Sper.',

  // ── Armi (nomi + descrizioni) ────────────────────────────────────────────────────
  'weapon.mg.name': 'Mitragliatrice',
  'weapon.mg.desc': 'Arma base',
  'weapon.double_mg.name': 'Doppia MG',
  'weapon.double_mg.desc': 'Due linee parallele larghe',
  'weapon.rifle.name': 'Fucile Auto',
  'weapon.rifle.desc': 'Cadenza alta, danno doppio',
  'weapon.rockets.name': 'Razzi',
  'weapon.rockets.desc': 'Esplosione AoE r=90px',
  'weapon.flamethrower.name': 'Lanciafiamme',
  'weapon.flamethrower.desc': 'Corto raggio, DPS altissimo',

  // ── Sopravvissuti (nomi + abilità; i numeri arrivano via params) ──────────────────
  'survivor.mechanic.name': 'Meccanico',
  'survivor.mechanic.ability': 'Ripara {hp}hp al comp. peggiore ogni {s}s',
  'survivor.medic.name': 'Medico',
  'survivor.medic.ability': 'Rigenera {hp} salute al secondo',
  'survivor.soldier.name': 'Soldato',
  'survivor.soldier.ability': 'Torretta auto ogni {s} secondi',
  'survivor.explorer.name': 'Esploratore',
  'survivor.explorer.ability': 'Taniche appaiono ogni {s}s (vs {base}s)',

  // ── Modalità debug ───────────────────────────────────────────────────────────────
  'debug.title': 'MODALITÀ DEBUG — Galleria Modelli & Test',
  'debug.subtitle': "Clicca un veicolo o un'arma per provarlo · pulsanti in basso per i test",
  'debug.vehicles': 'VEICOLI  (clicca = prova)',
  'debug.zombies': 'ZOMBI',
  'debug.bosses': 'BOSS  (modelli dedicati)',
  'debug.bossStats': 'HP {hp} · ★{reward}',
  'debug.objects': 'PROIETTILI & OGGETTI',
  'debug.weapons': 'ARMI  (clicca = prova)',
  'debug.add5000': '★ +5000 monete',
  'debug.allWeapons': '🔫 Tutte le armi',
  'debug.allVehicles': '🚗 Tutti i veicoli',
  'debug.recruitAll': '👥 Recluta tutti',
  'debug.toastCoins': '+5000 monete',
  'debug.toastWeapons': 'Armi sbloccate',
  'debug.toastVehicles': 'Veicoli sbloccati',
  'debug.toastSurvivors': 'Sopravvissuti reclutati',
  'debug.newGame': '▶ NUOVA PARTITA (reset)',
  'debug.shop': '🛒 NEGOZIO',
  'debug.toGame': '↩ TORNA AL GIOCO',

  // ── Zombi (etichette galleria debug) ─────────────────────────────────────────────
  'zombie.common': 'Comune',
  'zombie.runner': 'Corridore',
  'zombie.armored': 'Corazzato',
  'zombie.jumper': 'Saltatore',
  'zombie.toxic': 'Tossico',
  'zombie.giant': 'Gigante',

  // ── Oggetti (etichette galleria debug) ───────────────────────────────────────────
  'obj.bullet': 'Proiettile',
  'obj.rocket': 'Razzo',
  'obj.fuel_can': 'Tanica',
  'obj.particle': 'Particella',
  'obj.toxic_cloud': 'Nube tox.',
};

export default it;
