import Phaser from 'phaser';
import { VEHICLES, Upgrades, WeaponType, WEAPONS, WEAPON_KEYS } from '../GameData';
import SoundManager from '../SoundManager';
import Juice from '../Juice';
import Environment from '../Environment';
import Settings from '../Settings';
import Ui, { UI } from '../Ui';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';
import { resetRunState, getRun, setRun } from '../RunState';
import SaveData from '../SaveData';
import { buildEntityTextures } from '../EntityTextures';
import { buildVehicleTexture, buildTurretTextures, TURRET_DX } from '../VehicleTextures';
import HudController from '../HudController';
import BossController, { BossHost } from '../BossController';
import { t } from '../i18n';
import {
  ROAD_TOP, ROAD_BOTTOM, ROAD_CENTER, BOSS_CONFIG, BOSS_ORDER,
} from '../World';
import type { BossType, ZombieType, ComponentKey } from '../World';

// Spazio di design: l'altezza è fissa (H), la larghezza varia col formato (designW,
// più ampia in 16:9). La camera in zoom adatta tutto alla risoluzione nativa — vedi Config.ts.
const H = 600;
const VEHICLE_X = 150;
const SCROLL_SPEED = 240;
const BASE_FUEL_DRAIN = 2.2;
const MAX_FUEL = 100;
const BULLET_SPEED = 680;
const STRIPE_W = 48, STRIPE_GAP = 82;
const ATTACH_DAMAGE_INTERVAL = 1600;
const ATTACH_DAMAGE_AMOUNT = 14;
const MISSION_DIST = 18000;
const GIANT_SPAWN_INTERVAL = 22000;
const BOSS_TRIGGER = 0.82; // % missione a cui appare il boss
const COMBO_WINDOW = 2500;  // ms: finestra per mantenere la catena di uccisioni
const DASH_COOLDOWN = 5000; // ms: ricarica dello scatto anti-aggancio
const DASH_GRACE = 350;     // ms: dopo lo scatto nessun nuovo zombi si aggrappa
// ── Sovraccarico (Overdrive, A3): risorsa attiva caricata dalla combo, spesa col tasto F. Vedi BALANCE §1. ──
const OVERDRIVE_MAX = 100;        // soglia della barra piena
const OVERDRIVE_DURATION = 3000;  // ms: durata del Sovraccarico una volta attivato
const OVERDRIVE_FIRE_MULT = 2;    // ×cadenza di fuoco durante il Sovraccarico
const OVERDRIVE_SHOCK_DMG = 6;    // danno dell'onda d'urto frontale all'attivazione
const OVERDRIVE_CHARGE_BASE = 2;  // carica base per ogni uccisione
const OVERDRIVE_CHARGE_COMBO = 2; // carica aggiuntiva = questo × moltiplicatore combo, per uccisione
// ── Caricatore (A2): avvicinamento lento → telegrafo → carica orizzontale sulla corsia. Vedi BALANCE §5. ──
const CHARGER_TRIGGER_X = 360;    // distanza dal veicolo a cui scatta il telegrafo
const CHARGER_TELEGRAPH = 700;    // ms di impennata prima della carica
const CHARGER_CHARGE_SPEED = 420; // velocità della carica (oltre lo scorrimento del mondo)
// ── Sputatore (A2): nemico a distanza, lancia bile sulla corsia del veicolo. Vedi BALANCE §5. ──
const SPITTER_FIRE_INTERVAL = 2000;   // ms tra uno sputo e l'altro
const SPITTER_PROJECTILE_SPEED = 260; // velocità del proiettile tossico (lento → schivabile)
// ── Hazard di corsia (A1): ostacoli su strada da schivare; le taniche tendono alla loro corsia. ──
const HAZARD_SPAWN_INTERVAL = 4500; // ms tra un ostacolo e l'altro
const OIL_SLOW_DURATION = 1500;     // ms di controllo verticale ridotto dopo l'olio
const OIL_SLOW_MULT = 0.5;          // moltiplicatore della velocità verticale durante l'olio
// ── Mira col mouse (combat reboot): la torretta punta il puntatore; i colpi danno knockback. ──
const MAX_AIM = Phaser.Math.DegToRad(82); // arco frontale di mira (±82° da destra)
const KNOCK = 220;        // impulso di rinculo dei colpi (px/s, decade) — solo game-feel
const KNOCK_DECAY = 0.84; // decadimento del rinculo per frame
// ── Densità "orda" (combat reboot): sferzate periodiche di nemici oltre allo spawn regolare. ──
const SURGE_INTERVAL = 11500; // ms tra una sferzata e l'altra
const SURGE_BASE = 4;         // chiamate di spawn extra per sferzata (cresce con la missione, ognuna può essere uno sciame)

interface EnvConfig {
  name: string;
  bgColor: number; skyColor: number; groundColor: number;
  roadColor: number; lineColor: number; shoulderColor: number;
  grade: number; gradeAlpha: number; // viraggio cromatico (MULTIPLY) per il mood
  // ── materia + luce della strada (opzionali; default derivati via mixColor in Environment) ──
  crackColor?: number;  // crepe asfalto
  patchColor?: number;  // toppe/rappezzi
  emissive?: number;    // 1 accento saturo a terra (pozze/bagliori). Default = lineColor
  hazeColor?: number;   // foschia all'orizzonte (gradiente cielo). Default = mix(sky, grade)
}

const ENVIRONMENTS: EnvConfig[] = [
  { name: 'region.city',        bgColor: 0x12121e, skyColor: 0x16161e, groundColor: 0x1a1610, roadColor: 0x2a2a2a, lineColor: 0xddcc00, shoulderColor: 0x1e1e22, grade: 0x8fa6c8, gradeAlpha: 0.42, emissive: 0xffcc33, hazeColor: 0x2a2a3a },
  { name: 'region.highway',     bgColor: 0x14120e, skyColor: 0x1c180e, groundColor: 0x141208, roadColor: 0x323028, lineColor: 0xaaaa44, shoulderColor: 0x201e16, grade: 0xc8bc86, gradeAlpha: 0.40, emissive: 0xccbb55, hazeColor: 0x33301f },
  { name: 'region.desert',      bgColor: 0x1e1006, skyColor: 0x2e1a08, groundColor: 0x1e1408, roadColor: 0x4a3a1a, lineColor: 0xddaa00, shoulderColor: 0x2a2010, grade: 0xffba60, gradeAlpha: 0.48, emissive: 0xffb24a, hazeColor: 0x4a2c12 },
  { name: 'region.forest',      bgColor: 0x040c04, skyColor: 0x040c04, groundColor: 0x020802, roadColor: 0x141c10, lineColor: 0x66cc22, shoulderColor: 0x0a100a, grade: 0x74c084, gradeAlpha: 0.46, emissive: 0x6cff3a, hazeColor: 0x0c2410 },
  { name: 'region.industrial',  bgColor: 0x0e0a08, skyColor: 0x120e0a, groundColor: 0x0c0806, roadColor: 0x1c1a18, lineColor: 0xff6600, shoulderColor: 0x181410, grade: 0xc89a5a, gradeAlpha: 0.44, emissive: 0xff7722, hazeColor: 0x2a1810 },
  { name: 'region.military',    bgColor: 0x080e06, skyColor: 0x0c1008, groundColor: 0x080e06, roadColor: 0x202818, lineColor: 0x88bb44, shoulderColor: 0x101608, grade: 0x9ab074, gradeAlpha: 0.42, emissive: 0x99cc55, hazeColor: 0x162012 },
  { name: 'region.finalCity',   bgColor: 0x0c0612, skyColor: 0x100618, groundColor: 0x0c0612, roadColor: 0x180c22, lineColor: 0xcc44ff, shoulderColor: 0x140a1a, grade: 0xb074d8, gradeAlpha: 0.48, emissive: 0xcc44ff, hazeColor: 0x240a36 },
];

interface ZombieStats { speed: number; hp: number; scale: number; damage: number; score: number; }
export interface ComponentData { health: number; label: string; baseColor: number; fill?: Phaser.GameObjects.Rectangle; }
interface AttachedZombie {
  sprite: Phaser.GameObjects.Sprite;
  slotIndex: number; comp: ComponentKey; hp: number; timer: number;
}

const ZOMBIE_STATS: Record<ZombieType, ZombieStats> = {
  common:  { speed: 70,  hp: 1,  scale: 1.0,  damage: 8,  score: 10 },
  runner:  { speed: 210, hp: 1,  scale: 0.82, damage: 5,  score: 15 },
  armored: { speed: 45,  hp: 4,  scale: 1.25, damage: 20, score: 35 },
  jumper:  { speed: 160, hp: 2,  scale: 0.9,  damage: 12, score: 20 },
  giant:   { speed: 30,  hp: 12, scale: 2.2,  damage: 35, score: 80 },
  toxic:   { speed: 55,  hp: 2,  scale: 1.1,  damage: 10, score: 25 },
  charger: { speed: 60,  hp: 3,  scale: 1.1,  damage: 30, score: 40 },
  spitter: { speed: 40,  hp: 2,  scale: 1.0,  damage: 12, score: 30 },
};

// Personalità di movimento per tipo.
//  amp/spd/lean = rollio · pow = forma d'onda (>1 pesante che indugia, <1 agile che frusta)
//  stomp = tonfo verticale · wob = respiro (squash) · home/turn = inseguimento e virata
//  fx/fxEvery = emissione VFX procedurali
interface ZombieMotion {
  amp: number; spd: number; lean: number; pow: number;
  stomp: number; wob: number; home: number; turn: number;
  fx: boolean; fxEvery: number;
}
const ZOMBIE_MOTION: Record<ZombieType, ZombieMotion> = {
  common:  { amp: 0.09, spd: 4.0,  lean:  0.00, pow: 1.0,  stomp: 0,   wob: 0,    home: 14, turn: 0.05, fx: false, fxEvery: 0   },
  runner:  { amp: 0.13, spd: 11.0, lean: -0.22, pow: 0.55, stomp: 0,   wob: 0,    home: 60, turn: 0.18, fx: true,  fxEvery: 100 },
  armored: { amp: 0.05, spd: 2.6,  lean:  0.00, pow: 1.6,  stomp: 1.2, wob: 0,    home: 0,  turn: 0,    fx: false, fxEvery: 0   },
  jumper:  { amp: 0.10, spd: 9.0,  lean:  0.00, pow: 0.5,  stomp: 0,   wob: 0,    home: 0,  turn: 0,    fx: false, fxEvery: 0   },
  giant:   { amp: 0.04, spd: 2.0,  lean:  0.00, pow: 1.6,  stomp: 1.8, wob: 0.03, home: 0,  turn: 0,    fx: true,  fxEvery: 360 },
  toxic:   { amp: 0.13, spd: 2.2,  lean:  0.00, pow: 1.0,  stomp: 0,   wob: 0.05, home: 16, turn: 0.05, fx: true,  fxEvery: 220 },
  charger: { amp: 0.05, spd: 3.0,  lean:  0.00, pow: 1.4,  stomp: 1.0, wob: 0,    home: 0,  turn: 0,    fx: false, fxEvery: 0   },
  spitter: { amp: 0.06, spd: 2.4,  lean:  0.00, pow: 1.0,  stomp: 0,   wob: 0.04, home: 0,  turn: 0,    fx: false, fxEvery: 0   },
};

const SPAWN_POOL: ZombieType[] = [
  'common', 'common', 'common', 'common',
  'runner', 'runner',
  'armored',
  'jumper',
  'toxic', 'toxic',
  'charger',
  'spitter',
];

const ATTACH_SLOTS: Array<{ dx: number; dy: number; comp: ComponentKey }> = [
  { dx:  42, dy:   0, comp: 'armor'  },
  { dx:   5, dy: -16, comp: 'wheels' },
  { dx:   5, dy:  16, comp: 'wheels' },
  { dx: -40, dy:   0, comp: 'engine' },
  { dx:  20, dy: -13, comp: 'turret' },
  { dx:  20, dy:  13, comp: 'turret' },
];

export default class GameScene extends Phaser.Scene implements BossHost {
  vehicle!: Phaser.Physics.Arcade.Sprite;
  zombies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private fuelCans!: Phaser.Physics.Arcade.Group;
  toxicClouds!: Phaser.Physics.Arcade.Group;
  private spitProjectiles!: Phaser.Physics.Arcade.Group; // proiettili dello Sputatore (A2)
  private hazards!: Phaser.Physics.Arcade.Group;         // ostacoli di corsia (A1)
  private oilUntil = 0;                                   // controllo verticale ridotto finché now < oilUntil
  private lastHazardY = ROAD_CENTER;                      // corsia dell'ultimo hazard (bias taniche)

  private attachedZombies: AttachedZombie[] = [];
  private components!: Record<ComponentKey, ComponentData>;
  private stripes: Phaser.GameObjects.Rectangle[] = [];

  private health = 100;
  private maxHealth = 100;
  private fuel = MAX_FUEL;
  private maxFuel = MAX_FUEL;
  private score = 0;
  private distance = 0;
  private alive = true;
  private missionDone = false;

  private vehicleKey = 'civilian_car';
  private vehicleFireMult = 1.0;
  private vehicleSpeedMult = 1.0;
  private vehicleArmorBonus = 0;
  private upgrades: Upgrades = {};
  private activeSurvivors: string[] = [];

  private mechanicTimer = 0;
  private soldierTimer = 0;
  private lowFuelWarned = false; // evita di ripetere l'allarme carburante ogni frame (AU5)
  private giantTimer = 0;
  private envIndex = 0;
  private missionNumber = 1; // numero di missione corrente (per scaling NG+ e vittoria di ciclo)

  private hud!: HudController;

  private currentWeapon: WeaponType = 'mg';
  private ownedWeapons: WeaponType[] = ['mg'];
  private rockets!: Phaser.Physics.Arcade.Group;

  sfx: SoundManager | null = null;
  private grain: Phaser.GameObjects.TileSprite | null = null;
  environment: Environment | null = null;
  private frozen = false;

  // Sottosistema boss (stato + gruppi + barra HP) — vedi BossController.
  private boss!: BossController;

  // Debug
  private debugGod = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private cycleKey!: Phaser.Input.Keyboard.Key;
  private fKey!: Phaser.Input.Keyboard.Key; // Sovraccarico (Overdrive, A3)
  private numberKeys: Phaser.Input.Keyboard.Key[] = [];

  // Mira col mouse (combat reboot): torretta rotante (overlay) + mirino + rinculo.
  private aimAngle = 0;
  private aimX = DESIGN_W;
  private aimY = ROAD_CENTER;
  private readonly _aim = new Phaser.Math.Vector2();
  private turret!: Phaser.GameObjects.Image;
  private crosshair!: Phaser.GameObjects.Image;
  private recoil = 0;
  private turretDx = 8; // offset x del perno torretta per il veicolo corrente (vedi TURRET_DX)
  private lastHitSfxAt = 0; // throttle del suono di colpo (evita cacofonia a fuoco rapido)

  private combo = 0;
  private comboTimer = 0;
  private dashReadyAt = 0;
  private dashGraceUntil = 0;

  // Sovraccarico (Overdrive, A3): carica 0..OVERDRIVE_MAX dalla combo; attivo finché now < overdriveActiveUntil.
  private overdrive = 0;
  private overdriveActiveUntil = 0;
  private overdriveGlow: Phaser.GameObjects.Image | null = null;

  private lastFire = 0;
  private spawnTimer = 0;
  private spawnInterval = 2100;
  private surgeTimer = SURGE_INTERVAL;

  /** Larghezza dello spazio di design (800 in 4:3, maggiore in 16:9 → più strada). */
  designW = DESIGN_W;

  constructor() { super({ key: 'GameScene' }); }

  create() {
    // Camera in zoom: lo spazio di design riempie la risoluzione nativa scelta.
    this.designW = setupCamera(this).designW;
    this.vehicleKey        = getRun(this.registry, 'vehicle')       ?? 'civilian_car';
    this.activeSurvivors   = getRun(this.registry, 'survivors')     ?? [];
    this.upgrades          = getRun(this.registry, 'upgrades')      ?? {};
    const missionNum: number = getRun(this.registry, 'missionNumber') ?? 1;
    this.missionNumber = missionNum;
    const savedComp        = getRun(this.registry, 'components')    ?? null;

    const vData = VEHICLES[this.vehicleKey];
    this.maxHealth       = 100 + vData.healthBonus;
    this.health          = this.maxHealth;
    this.vehicleFireMult = vData.fireMult * (this.upgrades.turret ? 1.25 : 1.0);
    this.vehicleSpeedMult= vData.speedMult * (this.upgrades.engine ? 1.15 : 1.0);
    this.vehicleArmorBonus = vData.armorBonus + (this.upgrades.armor ? 20 : 0);
    this.maxFuel         = MAX_FUEL + (this.upgrades.fuelTank ? 30 : 0);
    this.fuel            = this.maxFuel;

    this.score = 0;
    this.distance = 0;
    this.alive = true;
    this.missionDone = false;
    this.spawnInterval = Math.max(330, 1350 - (missionNum - 1) * 80); // densità "orda": più stretto di prima
    this.spawnTimer = 0;
    this.surgeTimer = SURGE_INTERVAL;
    this.stripes = [];
    this.attachedZombies = [];
    this.mechanicTimer = 0;
    this.soldierTimer = 0;
    this.giantTimer = GIANT_SPAWN_INTERVAL;
    this.lowFuelWarned = false;
    this.envIndex = (missionNum - 1) % ENVIRONMENTS.length;
    this.currentWeapon = getRun(this.registry, 'currentWeapon') ?? 'mg';
    this.ownedWeapons  = getRun(this.registry, 'ownedWeapons')  ?? ['mg'];
    if (!this.ownedWeapons.includes(this.currentWeapon)) this.currentWeapon = this.ownedWeapons[0] ?? 'mg';
    this.combo = 0; this.comboTimer = 0;
    this.dashReadyAt = 0; this.dashGraceUntil = 0;
    this.overdrive = 0; this.overdriveActiveUntil = 0; this.overdriveGlow = null;
    this.oilUntil = 0; this.lastHazardY = ROAD_CENTER;
    this.aimAngle = 0; this.aimX = this.designW; this.aimY = ROAD_CENTER; this.recoil = 0;
    this.turretDx = TURRET_DX[this.vehicleKey] ?? 8;
    this.boss = new BossController(this); // stato boss fresco + gruppi fisici (usati da buildColliders)

    const def = { engine: 100, wheels: 100, tank: 100, turret: 100, armor: 100 };
    const c = savedComp ?? def;
    this.components = {
      // label = chiave i18n (risolta dall'HUD): così un re-build dopo il cambio lingua la ri-traduce.
      engine: { health: c.engine, label: 'comp.engine', baseColor: 0x44cc44 },
      wheels: { health: c.wheels, label: 'comp.wheels', baseColor: 0x44aa88 },
      tank:   { health: c.tank,   label: 'comp.tank',   baseColor: 0xff8800 },
      turret: { health: c.turret, label: 'comp.turret', baseColor: 0x8899ff },
      armor:  { health: c.armor,  label: 'comp.armor',  baseColor: 0x6688bb },
    };

    this.buildTextures();
    this.buildWorld();
    this.buildVehicle();
    this.buildAim();
    this.buildGroups();
    this.buildColliders();
    this.buildHUD(missionNum);
    this.buildInput();

    const fuelDelay = this.activeSurvivors.includes('explorer') ? 5000 : 7500;
    this.time.addEvent({ delay: fuelDelay, callback: this.spawnFuelCan, callbackScope: this, loop: true });
    this.time.addEvent({ delay: HAZARD_SPAWN_INTERVAL, callback: this.spawnHazard, callbackScope: this, loop: true });

    // Audio
    const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (webAudio?.context) {
      this.sfx = new SoundManager(webAudio.context);
      this.sfx.setVolume(Settings.volume);
      this.sfx.startEngine();
    }
    // Ritorno dalle impostazioni (pausa ESC): riallinea il volume e riavvia il motore — ma SOLO se
    // la partita è ancora in corso, così un RESUME residuo non riaccende il motore "da morto"
    // (coerente con openPauseSettings, che già controlla alive/missionDone).
    const onResume = () => {
      if (!this.alive || this.missionDone) return;
      this.sfx?.setVolume(Settings.volume);
      this.sfx?.startEngine();
    };
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);

    // Allo SHUTDOWN: ferma il motore E rimuovi il listener RESUME. Phaser NON ripulisce i listener
    // utente su scene.events allo shutdown: con scene.restart() (game over/fine missione) create()
    // viene rieseguito e, senza off(), ogni RESUME si accumulerebbe → startEngine() chiamato N volte
    // su istanze SoundManager stale. Registrato con .once perché lo SHUTDOWN avviene una sola volta.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sfx?.dispose(); // ferma il motore E scollega master+limiter (no nodi orfani a ogni restart, AU7)
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
    });

    // Juice: overlay filmico (opzionale) + entrata in dissolvenza
    this.frozen = false;
    // Garantisce le texture del juice (fx_light) anche con overlay disattivato: muzzleFlash/bloom e
    // l'alone del Sovraccarico (A3) le usano a prescindere da screenFx.
    Juice.buildTextures(this);
    this.grain = Settings.screenFx ? Juice.addOverlay(this) : null;
    Juice.fadeIn(this);
  }

  update(time: number, delta: number) {
    if (!this.alive || this.missionDone) {
      // SPACE = "ricomincia" SOLO al game over. A fine missione lo SPACE è già gestito
      // dal listener dedicato (→ ShopScene) in triggerMissionComplete(): senza questo
      // guard lo stesso tasto farebbe partire ANCHE scene.restart(), che riesegue create()
      // (nuovo SoundManager + startEngine) e rianima la GameScene dietro al negozio.
      if (!this.alive && Phaser.Input.Keyboard.JustDown(this.spaceKey)) Juice.fadeAndRun(this, () => this.scene.restart());
      return;
    }
    if (this.frozen) return;            // hit-stop: tutto fermo, grana di pellicola inclusa (REG3)
    Juice.jitterGrain(this.grain);
    const dt = delta / 1000;

    // Celebrazione di vittoria del boss (~2.2s, boss.defeated): mondo CONGELATO → solo visuale, niente
    // movimento/spawn/danni/avanzamento. Risolve due regressioni: (REG1) la distanza a fine duello è già
    // oltre MISSION_DIST, quindi senza questo ritorno updateDistance chiamerebbe subito
    // triggerMissionComplete() tagliando la schermata "BOSS SCONFITTO"; (REG2) gli zombi residui non si
    // muovono né si agganciano più sopra l'overlay. La fine missione resta gestita dal delayedCall di kill().
    if (this.boss.defeated) {
      this.crosshair.setVisible(false); // niente mirino sopra l'overlay "BOSS SCONFITTO"
      this.updateStripes(dt);
      this.environment?.update(dt, this.vehicle.x, this.vehicle.y);
      this.cleanOffScreen();
      this.updateHUD();
      return;
    }

    this.updateVehicle(dt);
    this.updateAim();
    this.updateFiring(time);
    this.updateWeaponSwitch();
    this.updateDash(time);
    this.updateOverdrive(time);
    this.updateCombo(delta);
    this.updateFuel(dt);
    this.updateDistance(dt);
    this.updateZombieSpawning(delta);
    this.updateGiantSpawning(delta);
    this.boss.update(delta);
    this.updateZombieMotion(time, delta);
    this.updateAttachedZombies(delta);
    this.checkBulletsVsAttached();
    this.updateToxicClouds(delta);
    this.updateSurvivorEffects(delta, time);
    this.updateStripes(dt);
    this.environment?.update(dt, this.vehicle.x, this.vehicle.y);
    this.cleanOffScreen();
    this.updateHUD();
  }

  // ─── Textures ────────────────────────────────────────────────────────────────

  private buildTextures() {
    buildVehicleTexture(this, this.vehicleKey);
    buildEntityTextures(this);
  }

  // ─── World & entities ────────────────────────────────────────────────────────

  private buildWorld() {
    const env = ENVIRONMENTS[this.envIndex];

    // Sfondo + fasce
    this.add.rectangle(this.designW/2, H/2, this.designW, H, env.bgColor);
    this.add.rectangle(this.designW/2, ROAD_TOP / 2, this.designW, ROAD_TOP, env.skyColor);
    this.add.rectangle(this.designW/2, (ROAD_BOTTOM + H) / 2, this.designW, H - ROAD_BOTTOM, env.groundColor);

    // Strada di base (rettangolo piatto + spallette esterne): l'asfalto tileato
    // dell'Environment la copre, le spallette restano come terza fascia del ciglio.
    this.add.rectangle(this.designW/2, ROAD_CENTER, this.designW, ROAD_BOTTOM - ROAD_TOP, env.roadColor);
    this.add.rectangle(this.designW/2, ROAD_TOP    - 10, this.designW, 16, env.shoulderColor);
    this.add.rectangle(this.designW/2, ROAD_BOTTOM + 10, this.designW, 16, env.shoulderColor);

    // Ambiente & Strada (docs/ART_BIBLE_AMBIENTE.md): profondità (parallasse far/near),
    // superficie (asfalto tileato + ciglio rumble), illuminazione (gradiente cielo,
    // luce di carreggiata, fari) e memoria (decal dinamici).
    this.environment = new Environment(
      this,
      { W: this.designW, H, roadTop: ROAD_TOP, roadBottom: ROAD_BOTTOM, roadCenter: ROAD_CENTER, scrollSpeed: SCROLL_SPEED },
      env, this.envIndex,
    );

    // Strisce di corsia ambientate: colore della linea d'ambiente, consumate, qualche dash "mancante"
    const count = Math.ceil(this.designW / STRIPE_GAP) + 3;
    for (let i = 0; i < count; i++) {
      const worn = (i % 6 === 4);
      const a = worn ? 0.06 : 0.20 + (i % 3) * 0.08;
      const r = this.add.rectangle(i * STRIPE_GAP, ROAD_CENTER, STRIPE_W, 4, env.lineColor, a).setDepth(1);
      this.stripes.push(r);
    }

    // Color grading: viraggio cromatico del mood (MULTIPLY su tutto il gameplay, sotto HUD/vignetta)
    // Color grading a tutto schermo: pinnato (scrollFactor 0) → dimensioni NATIVE del canvas,
    // non lo spazio di design (gli oggetti scrollFactor 0 non subiscono lo zoom della camera).
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, env.grade)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setAlpha(env.gradeAlpha)
      .setScrollFactor(0)
      .setDepth(16);

    // Banner nome ambiente (scompare dopo 2.5s)
    const envLabel = Ui.text(this, this.designW / 2, ROAD_TOP - 28, t(env.name).toUpperCase(), {
      fontSize: '16px', color: UI.white, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(18).setAlpha(0);
    this.tweens.add({
      targets: envLabel,
      alpha: { from: 0, to: 1 }, y: ROAD_TOP - 36,
      duration: 400, ease: 'Power2', yoyo: false,
      onComplete: () => {
        this.time.delayedCall(1600, () =>
          this.tweens.add({ targets: envLabel, alpha: 0, duration: 500, onComplete: () => envLabel.destroy() }));
      },
    });
  }

  private buildVehicle() {
    this.vehicle = this.physics.add.sprite(VEHICLE_X, ROAD_CENTER, `vehicle_${this.vehicleKey}`);
    this.vehicle.setScale(1 / OVERSAMPLE); // texture sovracampionata → torna a scala design
    (this.vehicle.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(false);
    (this.vehicle.body as Phaser.Physics.Arcade.Body).setSize(72, 22);
    this.vehicle.setDepth(10);
  }

  private buildGroups() {
    this.zombies         = this.physics.add.group();
    this.bullets         = this.physics.add.group();
    this.rockets         = this.physics.add.group();
    this.fuelCans        = this.physics.add.group();
    this.toxicClouds     = this.physics.add.group();
    this.spitProjectiles = this.physics.add.group();
    this.hazards         = this.physics.add.group();
    // I gruppi del boss (corpo + proiettili) sono creati dal BossController in create().
  }

  private buildColliders() {
    this.physics.add.overlap(this.bullets, this.zombies,
      (b,z) => this.onBulletHitZombie(b as Phaser.Physics.Arcade.Sprite, z as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.zombies,
      (_v,z) => this.onVehicleHitZombie(z as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.fuelCans,
      (_v,f) => this.onCollectFuel(f as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.toxicClouds,
      (_v,c) => this.onVehicleHitCloud(c as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.spitProjectiles,
      (_v,p) => this.onSpitHitVehicle(p as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.hazards,
      (_v,h) => this.onHazardHit(h as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.rockets, this.zombies,
      (r,z) => this.onRocketHitZombie(r as Phaser.Physics.Arcade.Sprite, z as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.bullets, this.boss.group,
      (b,boss) => this.boss.onBulletHit(b as Phaser.Physics.Arcade.Sprite, boss as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.rockets, this.boss.group,
      (r,boss) => this.boss.onRocketHit(r as Phaser.Physics.Arcade.Sprite, boss as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.boss.group,
      (_v,boss) => this.boss.onVehicleHit(boss as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.boss.projectiles,
      (_v,p) => this.boss.onProjectileHitVehicle(p as Phaser.Physics.Arcade.Sprite));
  }

  private buildHUD(missionNum: number) {
    this.hud = new HudController(this, this.designW);
    this.hud.build(this.hudOpts(missionNum));
  }

  /** Opzioni di costruzione dell'HUD dallo stato corrente (riusate da build e re-build lingua). */
  private hudOpts(missionNum: number) {
    return {
      missionNum, missionDist: MISSION_DIST,
      components: this.components,
      activeSurvivors: this.activeSurvivors,
      ownedWeapons: this.ownedWeapons,
      currentWeapon: this.currentWeapon,
      debugGod: this.debugGod,
      onSelectWeapon: (k: WeaponType) => this.selectWeapon(k), // selettore HUD cliccabile (U3)
    };
  }

  /**
   * Ridisegna l'HUD nella lingua corrente. Chiamato da SettingsScene quando si cambia lingua
   * mentre la partita è in pausa: l'HUD vive in questa scena (congelata sotto l'overlay) e non
   * verrebbe altrimenti ri-tradotto. `build()` ripulisce gli oggetti vecchi; `updateHUD()` ripopola
   * subito i valori (in pausa l'update per-frame non gira).
   */
  refreshLanguage() {
    if (!this.hud) return;
    this.hud.build(this.hudOpts(this.missionNumber));
    this.updateHUD();
    if (this.boss.spawned && this.boss.active) this.boss.refreshLanguage();
  }

  private buildInput() {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.spaceKey = this.input.keyboard!.addKey(KC.SPACE);
    this.shiftKey = this.input.keyboard!.addKey(KC.SHIFT);
    this.cycleKey = this.input.keyboard!.addKey(KC.Q);
    this.fKey = this.input.keyboard!.addKey(KC.F); // Sovraccarico (Overdrive, A3)
    this.wKey = this.input.keyboard!.addKey(KC.W); // movimento anche con W/S (G8, come da GAME_DESIGN §2)
    this.sKey = this.input.keyboard!.addKey(KC.S);
    this.numberKeys = [KC.ONE, KC.TWO, KC.THREE, KC.FOUR, KC.FIVE]
      .map(k => this.input.keyboard!.addKey(k));

    // ESC: metti in pausa e apri le impostazioni
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.openPauseSettings());

    // Tasti debug
    kb.on('keydown-ZERO', () => this.scene.start('DebugScene'));
    kb.on('keydown-G', () => {
      this.debugGod = !this.debugGod;
      if (this.debugGod) this.fuel = this.maxFuel;
      this.hud.setDebug(this.debugGod); // evento discreto: non più aggiornato per-frame
    });
    kb.on('keydown-B', () => { if (this.alive && !this.boss.spawned) this.boss.spawn(); });
    kb.on('keydown-N', () => { if (this.alive && !this.missionDone) this.triggerMissionComplete(); });
    kb.on('keydown-H', () => { this.health = this.maxHealth; this.fuel = this.maxFuel;
      (Object.keys(this.components) as ComponentKey[]).forEach(k => this.components[k].health = 100); });
  }

  /** Pausa la partita e apre le Impostazioni in overlay (ESC le richiude e riprende). */
  /** Torretta rotante (overlay sopra il veicolo: ruotare il corpo cambierebbe la hitbox) + mirino. */
  private buildAim() {
    buildTurretTextures(this); // torretta per arma: aim_turret_<weapon> (vedi VehicleTextures)
    if (!this.textures.exists('aim_crosshair')) {
      const g = this.make.graphics({ add: false } as object) as Phaser.GameObjects.Graphics & { generateTexture(k: string, w: number, h: number): void };
      g.lineStyle(2, 0x88ccff, 0.95); g.strokeCircle(12, 12, 9);
      g.lineBetween(12, 0, 12, 6); g.lineBetween(12, 18, 12, 24);
      g.lineBetween(0, 12, 6, 12); g.lineBetween(18, 12, 24, 12);
      g.fillStyle(0xff5555, 1); g.fillCircle(12, 12, 1.6);
      g.generateTexture('aim_crosshair', 24, 24);
      g.destroy();
    }
    this.turret = this.add.image(this.vehicle.x + this.turretDx, this.vehicle.y, this.turretTex())
      .setScale(1 / OVERSAMPLE).setOrigin(0.11, 0.5).setDepth(11);
    this.crosshair = this.add.image(this.aimX, this.aimY, 'aim_crosshair').setDepth(50);
  }

  /** Chiave texture della torretta per l'arma corrente (aim_turret_<weapon>). */
  private turretTex(): string { return 'aim_turret_' + this.currentWeapon; }

  /** Mira: puntatore → spazio design (la camera è in zoom) → angolo torretta clampato all'arco frontale. */
  private updateAim() {
    const p = this.input.activePointer;
    this.cameras.main.getWorldPoint(p.x, p.y, this._aim);
    this.aimX = this._aim.x; this.aimY = this._aim.y;
    const ox = this.vehicle.x + this.turretDx, oy = this.vehicle.y;
    const raw = Math.atan2(this.aimY - oy, this.aimX - ox);
    this.aimAngle = Phaser.Math.Clamp(raw, -MAX_AIM, MAX_AIM);
    const rec = this.recoil; this.recoil = Math.max(0, this.recoil - 0.6);
    this.turret.setPosition(ox - Math.cos(this.aimAngle) * rec, oy - Math.sin(this.aimAngle) * rec).setRotation(this.aimAngle);
    this.crosshair.setPosition(this.aimX, this.aimY);
  }

  private openPauseSettings() {
    if (!this.alive || this.missionDone) return; // non in game over / fine missione
    if (this.scene.isPaused()) return;            // già in pausa
    this.sfx?.stopEngine();                        // silenzia il motore durante la pausa
    this.scene.pause();
    this.scene.launch('SettingsScene', { from: 'GameScene' });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  private updateVehicle(dt: number) {
    const body = this.vehicle.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0,0);
    const vSpeed = this.getEffectiveVerticalSpeed();
    if (this.cursors.up?.isDown   || this.wKey.isDown) body.setVelocityY(-vSpeed);
    if (this.cursors.down?.isDown || this.sKey.isDown) body.setVelocityY(vSpeed);
    this.vehicle.y = Phaser.Math.Clamp(this.vehicle.y, ROAD_TOP+22, ROAD_BOTTOM-22);
    const lean = body.velocity.y > 0 ? 4 : body.velocity.y < 0 ? -4 : 0;
    this.vehicle.angle = Phaser.Math.Linear(this.vehicle.angle, lean, 0.12);

    const engineLoad = (this.components.engine.health / 100) *
                       Math.max(0.3, 1 - this.attachedZombies.length * 0.15);
    this.sfx?.setEngineLoad(engineLoad);
  }

  private updateFiring(time: number) {
    // Fuoco col MOUSE (tieni premuto) o SPAZIO, verso il mirino. Il mouse NON spara se è sopra un
    // elemento UI cliccabile (es. selettore armi dell'HUD): altrimenti cliccare l'HUD farebbe partire un colpo.
    const mouseFire = this.input.activePointer.isDown &&
      this.input.hitTestPointer(this.input.activePointer).length === 0;
    if ((mouseFire || this.spaceKey.isDown) && time - this.lastFire > this.getEffectiveCooldown()) {
      this.lastFire = time;
      this.fireWeapon();
    }
  }

  // ─── Cambio arma a runtime ─────────────────────────────────────────────────
  private updateWeaponSwitch() {
    for (let i = 0; i < this.numberKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.numberKeys[i])) this.selectWeapon(WEAPON_KEYS[i]);
    }
    if (Phaser.Input.Keyboard.JustDown(this.cycleKey) && this.ownedWeapons.length > 1) {
      const cur = this.ownedWeapons.indexOf(this.currentWeapon);
      this.selectWeapon(this.ownedWeapons[(cur + 1) % this.ownedWeapons.length]);
    }
  }

  private selectWeapon(key: WeaponType) {
    if (!this.ownedWeapons.includes(key) || key === this.currentWeapon) return;
    this.currentWeapon = key;
    setRun(this.registry, 'currentWeapon', key);
    this.turret?.setTexture(this.turretTex()); // la torretta cambia forma con l'arma
    this.hud.setWeapon(key); // nome + selettore + pop cosmetico
  }

  // ─── Scatto / scrollata anti-aggancio ──────────────────────────────────────
  private updateDash(time: number) {
    if (Phaser.Input.Keyboard.JustDown(this.shiftKey) && time >= this.dashReadyAt) this.performDash(time);
  }

  private performDash(time: number) {
    this.dashReadyAt    = time + DASH_COOLDOWN;
    this.dashGraceUntil = time + DASH_GRACE;

    // Stacca e sbalza via tutti gli zombi aggrappati (solo visivo: nessun punteggio)
    const thrown = this.attachedZombies.length;
    for (const az of this.attachedZombies) {
      this.spawnHitParticles(az.sprite.x, az.sprite.y);
      this.tweens.add({
        targets: az.sprite,
        x: az.sprite.x - 130, y: az.sprite.y + Phaser.Math.Between(-40, 40),
        angle: Phaser.Math.Between(-260, 260), alpha: 0,
        duration: 340, ease: 'Cubic.easeIn',
        onComplete: () => az.sprite.destroy(),
      });
    }
    this.attachedZombies = [];

    // Juice: lampo + tinta + shake (niente rotazione/scala del corpo fisico → hitbox invariata)
    this.vehicle.setTint(0xaaddff);
    this.time.delayedCall(140, () => { if (this.vehicle?.active) this.vehicle.clearTint(); });
    Juice.muzzleFlash(this, this.vehicle.x, this.vehicle.y, 0x88ccff);
    this.cameras.main.shake(thrown > 0 ? 160 : 90, 0.008);
    this.sfx?.playImpact();
  }

  // ─── Sovraccarico / Overdrive (A3) ──────────────────────────────────────────
  /** True mentre il Sovraccarico è attivo (≈OVERDRIVE_DURATION dall'attivazione). */
  private overdriveOn(): boolean { return this.time.now < this.overdriveActiveUntil; }

  private updateOverdrive(time: number) {
    // Attivazione: tasto F a barra piena e non già attivo.
    if (Phaser.Input.Keyboard.JustDown(this.fKey) && !this.overdriveOn() && this.overdrive >= OVERDRIVE_MAX) {
      this.activateOverdrive(time);
      return;
    }
    // Alone "vivo" che segue il veicolo durante il Sovraccarico; rimosso quando finisce.
    if (this.overdriveOn()) {
      this.overdriveGlow?.setPosition(this.vehicle.x, this.vehicle.y).setAlpha(0.30 + 0.22 * Math.sin(time / 55));
    } else if (this.overdriveGlow) {
      this.overdriveGlow.destroy();
      this.overdriveGlow = null;
    }
  }

  private activateOverdrive(time: number) {
    this.overdriveActiveUntil = time + OVERDRIVE_DURATION;

    // Onda d'urto: sbalza via gli aggrappati (come lo scatto) e danneggia i nemici davanti al veicolo.
    for (const az of this.attachedZombies) {
      this.spawnHitParticles(az.sprite.x, az.sprite.y);
      this.tweens.add({
        targets: az.sprite,
        x: az.sprite.x - 130, y: az.sprite.y + Phaser.Math.Between(-40, 40),
        angle: Phaser.Math.Between(-260, 260), alpha: 0,
        duration: 340, ease: 'Cubic.easeIn', onComplete: () => az.sprite.destroy(),
      });
    }
    this.attachedZombies = [];
    for (const z of this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!z.active) continue;
      const dx = z.x - this.vehicle.x;
      if (dx < -10 || dx > 240) continue; // solo il cono frontale
      const zt = z.getData('type') as ZombieType;
      const hp = (z.getData('hp') as number) - OVERDRIVE_SHOCK_DMG;
      if (hp <= 0) {
        this.addKillScore(ZOMBIE_STATS[zt].score);
        this.killBurst(zt, z.x, z.y);
        if (zt === 'toxic') this.spawnToxicCloud(z.x, z.y);
        if (zt === 'charger') this.tweens.killTweensOf(z);
        z.destroy();
      } else {
        z.setData('hp', hp);
        z.setTint(0xffffff);
        this.time.delayedCall(80, () => { if (z?.active) z.clearTint(); });
      }
    }
    // Azzera la barra DOPO l'onda d'urto: le kill via addKillScore qui sopra la ricaricavano appena spesa.
    this.overdrive = 0;

    // Alone additivo che accompagna il veicolo per tutta la durata (mosso in updateOverdrive).
    this.overdriveGlow = this.add.image(this.vehicle.x, this.vehicle.y, 'fx_light')
      .setTint(0xffd24a).setScale(2.6).setAlpha(0.4).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);

    Juice.flash(this, 0xffdd55, 0.28, 160);
    Juice.bloomBurst(this, this.vehicle.x + 44, this.vehicle.y, 0xffcc33, 3.2, 320);
    Juice.lightFlash(this, this.vehicle.x, this.vehicle.y, 0xffd24a, 5, 360);
    this.cameras.main.shake(220, 0.01);
    this.sfx?.playOverdrive();

    const banner = Ui.text(this, this.designW / 2, ROAD_TOP - 28, t('game.overdriveOn'), {
      fontSize: '20px', color: UI.gold, fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(25).setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, y: ROAD_TOP - 36, duration: 220, yoyo: true, hold: 520, onComplete: () => banner.destroy() });
  }

  // ─── Combo / moltiplicatore di punteggio ───────────────────────────────────
  private updateCombo(delta: number) {
    if (this.combo <= 0) return;
    this.comboTimer -= delta;
    if (this.comboTimer <= 0) { this.combo = 0; this.comboTimer = 0; }
  }

  private comboMultiplier(): number {
    // ×5 ogni 3 kill consecutivi (era ogni 5 → x5 quasi irraggiungibile, G3). Vedi BALANCE §2.
    return Phaser.Math.Clamp(1 + Math.floor((this.combo - 1) / 3), 1, 5);
  }

  /**
   * Moltiplicatore di difficoltà "new game+" (G2/B4): cresce di 0.2 a ogni ciclo completo di 7 regioni
   * (missioni 1–7 = ×1.0, 8–14 = ×1.2, 15–21 = ×1.4, …). Scala HP **e danno** di nemici e boss così il
   * late-game non si appiattisce quando il giocatore è ormai forte. Vedi BALANCE §5.
   */
  private difficultyMult(): number {
    return 1 + 0.2 * Math.floor((this.missionNumber - 1) / 7);
  }

  /**
   * HP di base scalati per la difficoltà NG+ (B4). Math.ceil — non round — così anche i nemici da 1 HP
   * (comune/corridore, ~60% del pool) scalano davvero: con round, round(1×1.2)=1 li lasciava invariati.
   */
  private scaledHp(base: number): number {
    return Math.max(1, Math.ceil(base * this.difficultyMult()));
  }

  /** Danno da contatto scalato per la difficoltà NG+ (B4: prima il danno non scalava affatto). */
  private scaledDamage(type: ZombieType): number {
    return Math.round(ZOMBIE_STATS[type].damage * this.difficultyMult());
  }

  /** Aggiunge punteggio da un'uccisione applicando il moltiplicatore combo. */
  addKillScore(base: number) {
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    this.score += base * this.comboMultiplier();
    // Carica il Sovraccarico (A3): più alta la combo, più in fretta si riempie la barra.
    this.overdrive = Math.min(OVERDRIVE_MAX, this.overdrive + OVERDRIVE_CHARGE_BASE + OVERDRIVE_CHARGE_COMBO * this.comboMultiplier());
    if (this.combo >= 2) this.hud.popCombo();
  }

  private updateFuel(dt: number) {
    if (this.debugGod) { this.fuel = this.maxFuel; return; }
    // Niente consumo durante il duello col boss (mondo congelato) né la celebrazione (G7 / X4):
    // col carburante che drena su un avanzamento fermo si poteva fare game over a metà boss.
    if (this.boss.active || this.boss.defeated) return;
    this.fuel -= this.getEffectiveFuelDrain() * dt;
    // Allarme sonoro quando il carburante scende sotto il 25% (una volta sola, isteresi al 30% — AU5).
    const fuelPct = this.fuel / this.maxFuel;
    if (fuelPct < 0.25 && !this.lowFuelWarned) { this.lowFuelWarned = true; this.sfx?.playLowFuel(); }
    else if (fuelPct >= 0.30) { this.lowFuelWarned = false; }
    if (this.fuel <= 0) { this.fuel = 0; this.endGame(t('game.over.fuel')); }
  }

  private updateDistance(dt: number) {
    this.distance += SCROLL_SPEED * dt;
    if (!this.boss.spawned && this.distance >= MISSION_DIST * BOSS_TRIGGER) {
      this.boss.spawn();
      // Ambient sospeso nel duello (coerente con fuel/spawn): via hazard e proiettili residui, niente malus olio.
      this.hazards.clear(true, true);
      this.spitProjectiles.clear(true, true);
      this.oilUntil = 0;
    }
    if (this.boss.active) return;
    if (this.distance >= MISSION_DIST) this.triggerMissionComplete();
  }

  private updateZombieSpawning(delta: number) {
    if (this.boss.active || this.boss.defeated) return;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnZombie();
      this.spawnInterval = Math.max(290, this.spawnInterval - 3);
      this.spawnTimer = this.spawnInterval;
    }
    // Sferzata: ogni SURGE_INTERVAL un'orda extra (ritmo a picchi, come l'arena).
    this.surgeTimer -= delta;
    if (this.surgeTimer <= 0) {
      this.surgeTimer = SURGE_INTERVAL;
      const n = Math.min(7, SURGE_BASE + Math.floor((this.missionNumber - 1) / 2));
      for (let i = 0; i < n; i++) this.spawnZombie();
    }
  }

  private updateGiantSpawning(delta: number) {
    if (this.boss.active || this.boss.defeated) return; // niente gigante durante la celebrazione di vittoria (X6)
    this.giantTimer -= delta;
    if (this.giantTimer <= 0) {
      this.spawnGiant();
      this.giantTimer = GIANT_SPAWN_INTERVAL;
    }
  }

  private updateAttachedZombies(delta: number) {
    for (let i = this.attachedZombies.length - 1; i >= 0; i--) {
      const az = this.attachedZombies[i];
      if (!az.sprite.active) { this.attachedZombies.splice(i,1); continue; }
      const slot = ATTACH_SLOTS[az.slotIndex];
      az.sprite.x = this.vehicle.x + slot.dx;
      az.sprite.y = this.vehicle.y + slot.dy;
      az.timer -= delta;
      if (az.timer <= 0) {
        az.timer = ATTACH_DAMAGE_INTERVAL;
        this.damageComponent(az.comp, ATTACH_DAMAGE_AMOUNT);
        az.sprite.setTint(0xff0000);
        this.time.delayedCall(100, () => { if (az.sprite?.active) az.sprite.setTint(0xff8800); });
        this.cameras.main.shake(60, 0.004);
      }
    }
  }

  private checkBulletsVsAttached() {
    if (this.attachedZombies.length === 0) return;
    for (const bullet of this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!bullet.active) continue;
      for (let i = this.attachedZombies.length - 1; i >= 0; i--) {
        const az = this.attachedZombies[i];
        if (Phaser.Math.Distance.Between(bullet.x,bullet.y,az.sprite.x,az.sprite.y) < 22) {
          this.killBullet(bullet);
          az.hp--;
          if (az.hp <= 0) {
            this.addKillScore(5);
            this.spawnHitParticles(az.sprite.x, az.sprite.y);
            this.sfx?.playZombieKill();
            az.sprite.destroy();
            this.attachedZombies.splice(i,1);
          } else {
            this.playHitSfx();
            az.sprite.setTint(0xffffff);
            this.time.delayedCall(80, () => { if (az.sprite?.active) az.sprite.setTint(0xff8800); });
          }
          break;
        }
      }
    }
  }

  private updateToxicClouds(delta: number) {
    for (const cloud of this.toxicClouds.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!cloud.active) continue;
      const timer = (cloud.getData('timer') as number) - delta;
      cloud.setData('timer', timer);
      cloud.setAlpha(Math.max(0.1, timer / 3000));
      if (timer <= 0) cloud.destroy();
    }
  }

  private updateSurvivorEffects(delta: number, _time: number) {
    if (this.activeSurvivors.includes('medic')) {
      this.health = Math.min(this.maxHealth, this.health + 0.3 * delta / 1000);
    }
    if (this.activeSurvivors.includes('mechanic')) {
      this.mechanicTimer += delta;
      if (this.mechanicTimer >= 5000) {
        this.mechanicTimer = 0;
        const keys = Object.keys(this.components) as ComponentKey[];
        const damaged = keys.filter(k => this.components[k].health < 100)
                            .sort((a,b) => this.components[a].health - this.components[b].health);
        if (damaged.length > 0) {
          this.components[damaged[0]].health = Math.min(100, this.components[damaged[0]].health + 8);
        }
      }
    }
    if (this.activeSurvivors.includes('soldier')) {
      this.soldierTimer += delta;
      if (this.soldierTimer >= 1600) { // G9: cadenza quasi raddoppiata (era 3000) → contributo reale
        this.soldierTimer = 0;
        const targetY = this.getNearestZombieY();
        this.fireAutoShot(targetY);
      }
    }
  }

  private updateStripes(dt: number) {
    const totalW = this.stripes.length * STRIPE_GAP;
    this.stripes.forEach(s => {
      s.x -= SCROLL_SPEED * dt;
      if (s.x < -(STRIPE_W/2)) s.x += totalW;
    });
  }

  private updateHUD() {
    this.hud.update({
      health: this.health, maxHealth: this.maxHealth,
      fuel: this.fuel, maxFuel: this.maxFuel,
      score: this.score, distance: this.distance,
      attachedCount: this.attachedZombies.length,
      combo: this.combo, comboMult: this.comboMultiplier(),
      overdrive: this.overdrive, overdriveMax: OVERDRIVE_MAX, overdriveActive: this.overdriveOn(),
      dashReadyAt: this.dashReadyAt, now: this.time.now,
      components: this.components,
    });
  }

  private cleanOffScreen() {
    const clean = (g: Phaser.Physics.Arcade.Group, l: number, r: number) =>
      (g.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(s => { if (s.active && (s.x<l||s.x>r)) s.destroy(); });
    clean(this.zombies,    -100, this.designW+100);
    clean(this.fuelCans,   -80,  this.designW+80);
    clean(this.toxicClouds,-80,  this.designW+80);
    clean(this.spitProjectiles, -40, this.designW+60);
    clean(this.hazards,    -80,  this.designW+80);
    // Razzi: ora viaggiano anche in diagonale (mira) → cull su TUTTI i lati, non solo X.
    (this.rockets.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(s => {
      if (s.active && (s.x < -20 || s.x > this.designW + 60 || s.y < -40 || s.y > H + 40)) s.destroy();
    });
    clean(this.boss.projectiles, -80,  this.designW+80);
    // Bullets: vanno in ogni direzione (mira) → cull su tutti i bordi + gittata per-proiettile (lanciafiamme corto).
    (this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(s => {
      if (!s.active) return;
      const sx = (s.getData('sx') as number) ?? 0, sy = (s.getData('sy') as number) ?? 0;
      const maxDist = (s.getData('maxDist') as number) ?? 9999;
      if (s.x < -40 || s.x > this.designW + 40 || s.y < -40 || s.y > H + 40 ||
          Phaser.Math.Distance.Between(sx, sy, s.x, s.y) > maxDist) this.killBullet(s);
    });
  }

  // ─── Spawning ────────────────────────────────────────────────────────────────

  // Hit-stop: congela il gioco per pochi ms sugli impatti forti (vende il "peso")
  hitStop(ms: number) {
    if (this.frozen || !this.alive || this.missionDone) return;
    this.frozen = true;
    this.physics.pause();
    this.time.delayedCall(ms, () => { this.frozen = false; this.physics.resume(); });
  }

  // Personalità di movimento: rollio con forma d'onda, tonfo, respiro, virata + VFX
  private updateZombieMotion(time: number, delta: number) {
    const t = time / 1000;
    for (const z of this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!z.active) continue;
      const type = (z.getData('type') as ZombieType) ?? 'common';
      const m = ZOMBIE_MOTION[type] ?? ZOMBIE_MOTION.common;
      const ph = (z.getData('rockPhase') as number) ?? 0;

      // Rollio con forma d'onda (pesante indugia agli estremi · agile frusta per il centro)
      const s = Math.sin(t * m.spd + ph);
      z.rotation = m.lean + Math.sign(s) * Math.pow(Math.abs(s), m.pow) * m.amp;

      // Tonfo verticale del passo pesante (offset reversibile, niente accumulo)
      if (m.stomp > 0) {
        const prev = (z.getData('bob') as number) ?? 0;
        const bob = -Math.abs(Math.cos(t * m.spd + ph)) * m.stomp;
        z.y += bob - prev;
        z.setData('bob', bob);
      }

      // Respiro / gonfiore (squash-stretch del volume) — SOLO visivo.
      if (m.wob > 0) {
        const base = ZOMBIE_STATS[type].scale / OVERSAMPLE;
        const w = Math.sin(t * m.spd * 0.7 + ph) * m.wob;
        z.setScale(base * (1 + w), base * (1 - w));
        // In Arcade il body scala con lo sprite: compenso la dimensione-sorgente in proporzione
        // inversa così la hitbox effettiva resta invariata (X8 — coerente con "effetti vivi = solo
        // visivi"). Sorgenti base = quelle passate a setBodySize allo spawn (gigante 38×50, toxic 20×28).
        const bw = type === 'giant' ? 38 : 20;
        const bh = type === 'giant' ? 50 : 28;
        (z.body as Phaser.Physics.Arcade.Body).setSize(bw / (1 + w), bh / (1 - w));
      }

      // Inseguimento verticale con virata graduale (agile scatta · lento deriva)
      if (m.home > 0 && !z.getData('entering')) {
        const body = z.body as Phaser.Physics.Arcade.Body;
        const targetVy = Phaser.Math.Clamp(this.vehicle.y - z.y, -1, 1) * m.home;
        body.setVelocityY(Phaser.Math.Linear(body.velocity.y, targetVy, m.turn));
        z.y = Phaser.Math.Clamp(z.y, ROAD_TOP + 12, ROAD_BOTTOM - 12);
      }

      // VFX procedurali "fire-and-forget", emissione throttellata
      if (m.fx) {
        let fxT = ((z.getData('fxT') as number) ?? Math.random() * m.fxEvery) - delta;
        if (fxT <= 0) { this.emitZombieFx(z, type); fxT = m.fxEvery; }
        z.setData('fxT', fxT);
      }

      // Caricatore (A2): logica di carica (avvicinamento → telegrafo → scatto sulla corsia).
      if (type === 'charger') this.updateChargerMotion(z, time);
      // Sputatore (A2): artiglieria tossica — spara bile sulla corsia a intervalli.
      if (type === 'spitter') this.updateSpitterMotion(z, time, delta);

      // Knockback decadente dei colpi (combat reboot): solo posizione, non tocca le velocità del motion.
      const kx = (z.getData('kx') as number) ?? 0, ky = (z.getData('ky') as number) ?? 0;
      if (kx !== 0 || ky !== 0) {
        z.x += kx * delta / 1000; z.y += ky * delta / 1000;
        z.y = Phaser.Math.Clamp(z.y, ROAD_TOP + 12, ROAD_BOTTOM - 12); // non spingerlo fuori corsia (mira su/giù)
        const dDecay = Math.pow(KNOCK_DECAY, delta / 16.67);           // decadimento indipendente dal frame-rate
        z.setData('kx', kx * dDecay); z.setData('ky', ky * dDecay);
      }
    }
  }

  /** Caricatore (A2): avvicinamento lento → impennata di telegrafo → carica orizzontale sulla corsia. */
  private updateChargerMotion(z: Phaser.Physics.Arcade.Sprite, time: number) {
    if (z.getData('entering') || this.boss.active) return; // niente nuove cariche durante il duello col boss
    const body = z.body as Phaser.Physics.Arcade.Body;
    const state = (z.getData('chargeState') as string) ?? 'approach';
    if (state === 'approach') {
      if (z.x - this.vehicle.x < CHARGER_TRIGGER_X) {
        z.setData('chargeState', 'telegraph').setData('chargeAt', time + CHARGER_TELEGRAPH);
        body.setVelocityX(-SCROLL_SPEED * 0.4);                    // si impenna, quasi fermo rispetto alla strada
        z.setTint(0xffcc44);
        this.tweens.add({ targets: z, scaleY: (ZOMBIE_STATS.charger.scale / OVERSAMPLE) * 1.18, duration: 130, yoyo: true, repeat: 2 });
      }
    } else if (state === 'telegraph') {
      if (time >= (z.getData('chargeAt') as number)) {
        z.setData('chargeState', 'charging');
        this.tweens.killTweensOf(z);
        z.clearTint().setScale(ZOMBIE_STATS.charger.scale / OVERSAMPLE);
        body.setVelocityX(-(CHARGER_CHARGE_SPEED + SCROLL_SPEED));  // scatto orizzontale rapido
        body.setVelocityY(Phaser.Math.Clamp(this.vehicle.y - z.y, -1, 1) * 260); // punta la corsia del veicolo
        this.spawnHitParticles(z.x, z.y);
        this.sfx?.playImpact();
      }
    } else {
      z.y = Phaser.Math.Clamp(z.y, ROAD_TOP + 12, ROAD_BOTTOM - 12);
    }
  }

  /** Sputatore (A2): spara un proiettile di bile verso il veicolo a cadenza fissa (solo se davanti e on-screen). */
  private updateSpitterMotion(z: Phaser.Physics.Arcade.Sprite, _time: number, delta: number) {
    if (z.getData('entering') || this.boss.active) return; // niente nuovi sputi durante il duello col boss
    let ft = ((z.getData('fireTimer') as number) ?? SPITTER_FIRE_INTERVAL) - delta;
    if (ft <= 0 && z.x < this.designW && z.x > this.vehicle.x + 80) {
      ft = SPITTER_FIRE_INTERVAL;
      this.spitterFire(z);
    }
    z.setData('fireTimer', ft);
  }

  private spitterFire(z: Phaser.Physics.Arcade.Sprite) {
    const p = this.spitProjectiles.create(z.x - 8, z.y - 4, 'toxic_cloud') as Phaser.Physics.Arcade.Sprite;
    p.setScale(0.5).setDepth(8).setTint(0x9dff5a);
    const dx = this.vehicle.x - p.x, dy = this.vehicle.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / len) * SPITTER_PROJECTILE_SPEED, (dy / len) * SPITTER_PROJECTILE_SPEED);
    body.setSize(36, 36);                       // texture 50 × scala 0.5 → hitbox effettiva ~18px
    this.spawnHitParticles(z.x - 8, z.y);
    this.sfx?.playToxicSizzle();
  }

  private onSpitHitVehicle(p: Phaser.Physics.Arcade.Sprite) {
    if (!p.active) return;
    p.destroy();
    this.dealDamage(this.scaledDamage('spitter'));
    this.damageComponent('armor', 6);
    this.sfx?.playImpact();
    this.vehicle.setTint(0x66ff66);
    this.time.delayedCall(120, () => { if (this.vehicle?.active && this.alive) this.vehicle.clearTint(); });
  }

  // Emette particelle che si auto-distruggono in base al tipo (vapore, melma, scia, polvere)
  private emitZombieFx(z: Phaser.Physics.Arcade.Sprite, type: ZombieType) {
    if (type === 'toxic') {
      const p = this.add.image(z.x + Phaser.Math.Between(-6, 6), z.y - 6, 'particle')
        .setTint(0x4cff3a).setAlpha(0.5).setScale(0.7).setDepth(8);
      this.tweens.add({ targets: p, y: p.y - 22, scale: 1.6, alpha: 0, duration: 900, onComplete: () => p.destroy() });
      if (Math.random() < 0.4) {
        const d = this.add.image(z.x + Phaser.Math.Between(-8, 8), z.y + 10, 'particle')
          .setTint(0x2cbb2a).setScale(0.5).setDepth(8);
        this.tweens.add({ targets: d, y: d.y + 16, scaleX: 0.3, scaleY: 1.2, alpha: 0, duration: 500, onComplete: () => d.destroy() });
      }
    } else if (type === 'runner') {
      const ghost = this.add.image(z.x, z.y, 'zombie_runner')
        .setScale(z.scaleX, z.scaleY).setRotation(z.rotation).setAlpha(0.26).setTint(0xff7744).setDepth(8);
      this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
    } else if (type === 'giant') {
      // Passo pesante: polvere calciata da ENTRAMBI i piedi, a due strati (zolla scura +
      // foschia chiara) e trascinata indietro (il gigante avanza verso sinistra).
      for (const fx of [-13, 11]) {
        const px = z.x + fx + Phaser.Math.Between(-4, 4), py = z.y + 30;
        const d = this.add.image(px, py, 'particle').setTint(0x4a3d2c).setAlpha(0.6).setScale(0.9).setDepth(8);
        this.tweens.add({ targets: d, x: px + 12, y: py - 5, scale: 2.3, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => d.destroy() });
        const h = this.add.image(px, py - 2, 'particle').setTint(0x6a5a44).setAlpha(0.38).setScale(0.6).setDepth(8);
        this.tweens.add({ targets: h, y: py - 16, scale: 1.5, alpha: 0, duration: 720, onComplete: () => h.destroy() });
      }
      // A rotazione: goccia di sangue dalla ferita ventrale OPPURE bagliore degli occhi.
      const r = Math.random();
      if (r < 0.45) {
        const bx = z.x + Phaser.Math.Between(-6, 6), by = z.y + 8;
        const drop = this.add.image(bx, by, 'particle').setTint(0x6e1410).setScale(0.4).setDepth(10);
        this.tweens.add({ targets: drop, y: by + 26, scaleX: 0.25, scaleY: 1.4, alpha: 0, duration: 520, ease: 'Quad.easeIn', onComplete: () => drop.destroy() });
      } else if (r < 0.78) {
        // Pulsazione emissiva degli occhi rossi (alone additivo che sboccia e svanisce) → "vivo".
        const gl = this.add.image(z.x - 2, z.y - 30, 'particle')
          .setTint(0xff3018).setAlpha(0).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(10);
        this.tweens.add({ targets: gl, alpha: 0.5, scale: 1.15, duration: 180, yoyo: true, onComplete: () => gl.destroy() });
      }
    }
  }

  // Scintille metalliche (proiettile che rimbalza sulla corazza)
  emitSparks(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, sp = Phaser.Math.Between(20, 60);
      const p = this.add.image(x, y, 'particle').setTint(0xfff2a0).setScale(0.35).setDepth(14);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * sp, y: y + Math.sin(a) * sp, alpha: 0, scale: 0.05, duration: 220, onComplete: () => p.destroy() });
    }
  }

  private spawnZombie() {
    const type = SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
    const stats = ZOMBIE_STATS[type];

    if (type === 'jumper') {
      const fromTop = Math.random() < 0.5;
      const startY  = fromTop ? ROAD_TOP - 30 : ROAD_BOTTOM + 30;
      const targetY = Phaser.Math.Between(ROAD_TOP + 22, ROAD_BOTTOM - 22);
      const z = this.zombies.create(this.designW + 30, startY, 'zombie_jumper') as Phaser.Physics.Arcade.Sprite;
      z.setScale(stats.scale / OVERSAMPLE).setData('hp', this.scaledHp(stats.hp)).setData('type', 'jumper');
      z.setData('rockPhase', Math.random() * 6.28).setData('entering', true);
      z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9).setBodySize(20,28);
      z.play('walk_jumper'); z.anims.setProgress(Math.random());
      this.tweens.add({ targets: z, y: targetY, duration: 500, ease: 'Sine.easeOut',
        onComplete: () => { if (z.active) z.setData('entering', false); } });
      return;
    }

    const baseY = Phaser.Math.Between(ROAD_TOP+22, ROAD_BOTTOM-22);
    // Sciami: i fodder arrivano in gruppo (densità "orda"); i tipi speciali restano singoli.
    const count = (type === 'common' || type === 'runner') ? Phaser.Math.Between(1, 3)
                : type === 'toxic' ? Phaser.Math.Between(1, 2) : 1;
    for (let i = 0; i < count; i++) {
      const y = Phaser.Math.Clamp(baseY + i*28*(Math.random()>0.5?1:-1), ROAD_TOP+22, ROAD_BOTTOM-22);
      const z = this.zombies.create(this.designW+30+i*20, y, `zombie_${type}`) as Phaser.Physics.Arcade.Sprite;
      z.setScale(stats.scale / OVERSAMPLE).setData('hp', this.scaledHp(stats.hp)).setData('type', type);
      z.setData('rockPhase', Math.random() * 6.28);
      z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9).setBodySize(20,28);
      z.play(`walk_${type}`); z.anims.setProgress(Math.random());
    }
  }

  private spawnGiant() {
    const z = this.zombies.create(this.designW + 60, ROAD_CENTER, 'zombie_giant') as Phaser.Physics.Arcade.Sprite;
    z.setScale(ZOMBIE_STATS.giant.scale / OVERSAMPLE).setData('hp', this.scaledHp(ZOMBIE_STATS.giant.hp)).setData('type', 'giant');
    z.setData('rockPhase', Math.random() * 6.28);
    z.setVelocityX(-(ZOMBIE_STATS.giant.speed + SCROLL_SPEED)).setDepth(9).setBodySize(38,50);
    z.play('walk_giant'); z.anims.setProgress(Math.random());
    const warn = Ui.text(this, this.designW - 60, H/2, t('game.giantWarn'), {
      fontSize: '22px', color: '#ff4400', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: warn, alpha: 0, y: H/2 - 50, duration: 1600, onComplete: () => warn.destroy() });
  }

  private spawnFuelCan() {
    if (!this.alive || this.missionDone) return;
    // A1: ~40% delle taniche escono nella corsia di un hazard recente → "su o giù?" diventa rischio/ricompensa.
    const y = Math.random() < 0.4
      ? Phaser.Math.Clamp(this.lastHazardY + Phaser.Math.Between(-20, 20), ROAD_TOP + 22, ROAD_BOTTOM - 22)
      : Phaser.Math.Between(ROAD_TOP + 22, ROAD_BOTTOM - 22);
    const f = this.fuelCans.create(this.designW + 20, y, 'fuel_can') as Phaser.Physics.Arcade.Sprite;
    // Texture sovracampionata (OS_G) → torna a scala design; hitbox invariata (frame×scala = 22×26).
    f.setVelocityX(-SCROLL_SPEED).setDepth(6).setScale(1 / OVERSAMPLE);
  }

  // ─── Hazard di corsia (A1) ───────────────────────────────────────────────────
  private spawnHazard() {
    if (!this.alive || this.missionDone || this.boss.active || this.boss.defeated) return;
    const r = Math.random();
    const kind = r < 0.4 ? 'wreck' : r < 0.75 ? 'oil' : 'mine';
    const y = Phaser.Math.Between(ROAD_TOP + 24, ROAD_BOTTOM - 24);
    const h = this.hazards.create(this.designW + 30, y, `hazard_${kind}`) as Phaser.Physics.Arcade.Sprite;
    // Texture sovracampionata (OS_G) → torna a scala design; hitbox = frame×scala (auto).
    h.setVelocityX(-SCROLL_SPEED).setScale(1 / OVERSAMPLE).setDepth(kind === 'oil' ? 5 : 7).setData('kind', kind);
    this.lastHazardY = y;
  }

  private onHazardHit(h: Phaser.Physics.Arcade.Sprite) {
    if (!h.active || this.boss.active || this.boss.defeated || this.missionDone || !this.alive) return;
    const kind = h.getData('kind') as string;
    const hx = h.x, hy = h.y;
    h.destroy();
    if (kind === 'oil') {
      // Perdita di controllo temporanea (nessun danno): la vettura "scivola" e sterza male per un istante.
      this.oilUntil = this.time.now + OIL_SLOW_DURATION;
      this.vehicle.setTint(0x6688aa);
      this.time.delayedCall(180, () => { if (this.vehicle?.active && this.alive) this.vehicle.clearTint(); });
      this.cameras.main.shake(120, 0.006);
      this.sfx?.playImpact();
      this.environment?.addDecal('skid', hx, hy);
    } else if (kind === 'mine') {
      this.dealDamage(15);
      this.damageComponent('engine', 10);
      Juice.lightFlash(this, hx, hy, 0xff8a33, 4);
      this.cameras.main.shake(220, 0.014);
      this.hitStop(40);
      this.sfx?.playExplosion();
      this.environment?.addDecal('scorch', hx, hy);
    } else { // wreck
      this.dealDamage(20);
      this.damageComponent('armor', 15);
      this.cameras.main.shake(240, 0.016);
      this.hitStop(40);
      this.sfx?.playImpact();
      this.environment?.addDecal('debris', hx, hy);
    }
  }

  private fireWeapon() {
    const w = WEAPONS[this.currentWeapon];
    const a = this.aimAngle;                                   // verso il mirino (combat reboot)
    const len = 30, ox = this.vehicle.x + this.turretDx, oy = this.vehicle.y;
    const mx = ox + Math.cos(a) * len, my = oy + Math.sin(a) * len; // bocca della canna
    const FAR = 9999;                                          // gittata "infinita" (cull a bordo schermo)
    switch (this.currentWeapon) {
      case 'mg':
      case 'rifle':
        this.spawnBullet(mx, my, a, w.damage, w.speed, w.color, FAR);
        break;
      case 'double_mg': {
        // Due linee parallele, offset PERPENDICOLARE alla mira (±14) — vedi BALANCE §7.
        const px = -Math.sin(a) * 14, py = Math.cos(a) * 14;
        this.spawnBullet(mx + px, my + py, a, w.damage, w.speed, w.color, FAR);
        this.spawnBullet(mx - px, my - py, a, w.damage, w.speed, w.color, FAR);
        break;
      }
      case 'flamethrower':
        // Sventaglio breve attorno alla mira; gittata = range dell'arma (BALANCE §7).
        this.spawnBullet(mx, my, a + Phaser.Math.FloatBetween(-0.12, 0.12), w.damage, w.speed, w.color, w.range);
        break;
      case 'rockets':
        this.spawnRocket(mx, my, a);
        break;
    }
    this.recoil = 4;
    if (this.currentWeapon !== 'flamethrower') Juice.muzzleFlash(this, mx, my, w.color);
    this.sfx?.playShot();
  }

  private spawnBullet(x: number, y: number, angle: number, damage: number, speed: number, color: number, maxDist: number) {
    // Object pooling (P1): riusa un proiettile "morto" del gruppo invece di allocarne uno nuovo a ogni
    // colpo. killBullet() lo restituisce al pool (disableBody) invece di distruggerlo → niente churn GC.
    const b = this.bullets.get(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
    if (!b) return;
    b.enableBody(true, x, y, true, true);
    // Texture sovracampionata (OS_G) → scala design; hitbox auto = 18×5. Ruota lo sprite nella direzione di volo.
    // Depth 12: SOPRA veicolo (10) e torretta (11) → la bocca può stare sul corpo del mezzo senza che il colpo
    // sparisca "sotto" il veicolo (con la mira la canna arretrata punta sopra la scocca).
    b.setScale(1 / OVERSAMPLE).setDepth(12).setTint(color).setRotation(angle);
    this.physics.velocityFromRotation(angle, speed, (b.body as Phaser.Physics.Arcade.Body).velocity);
    b.setData('damage', damage);
    b.setData('ang', angle);           // per il knockback
    b.setData('sx', x); b.setData('sy', y); b.setData('maxDist', maxDist); // cull a distanza (gittata armi)
  }

  /** Restituisce un proiettile al pool (P1): corpo disabilitato + sprite nascosto/disattivato,
   *  così `bullets.get()` può riusarlo. Sostituisce `destroy()`. Usato anche dal boss via BossHost. */
  killBullet(b: Phaser.Physics.Arcade.Sprite) {
    b.disableBody(true, true);
  }

  private spawnRocket(x: number, y: number, angle: number) {
    const r = this.rockets.create(x, y, 'rocket') as Phaser.Physics.Arcade.Sprite;
    r.setScale(1 / OVERSAMPLE).setDepth(12).setRotation(angle); // sopra veicolo/torretta (come i proiettili)
    this.physics.velocityFromRotation(angle, WEAPONS.rockets.speed, (r.body as Phaser.Physics.Arcade.Body).velocity);
    // body in unità design: source ×OVERSAMPLE compensa lo scale 1/OVERSAMPLE → 22×8.
    (r.body as Phaser.Physics.Arcade.Body).setSize(22 * OVERSAMPLE, 8 * OVERSAMPLE);
  }

  private fireAutoShot(y: number) {
    // Sopravvissuto Soldato: colpo automatico orizzontale verso la corsia del nemico più vicino.
    this.spawnBullet(this.vehicle.x + this.turretDx, y, 0, 1, BULLET_SPEED, 0x00ffff, 9999);
    this.sfx?.playShot();
  }

  private getNearestZombieY(): number {
    let nearest = this.vehicle.y, minDist = Infinity;
    for (const z of this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!z.active) continue;
      const d = Math.abs(z.x - this.vehicle.x);
      if (d < minDist) { minDist = d; nearest = z.y; }
    }
    return nearest;
  }

  // ─── Collision handlers ──────────────────────────────────────────────────────

  /** Suono di colpo con throttle: evita cacofonia a fuoco rapido / più colpi nello stesso frame. */
  private playHitSfx() {
    if (this.time.now - this.lastHitSfxAt < 45) return;
    this.lastHitSfxAt = this.time.now;
    this.sfx?.playHit();
  }

  private onBulletHitZombie(bullet: Phaser.Physics.Arcade.Sprite, zombie: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !zombie.active) return;
    const dmg = (bullet.getData('damage') as number) ?? 1;
    this.killBullet(bullet);
    const type = zombie.getData('type') as ZombieType;
    if (type === 'armored') this.emitSparks(zombie.x, zombie.y);
    // Knockback (game-feel "peso"): spinta lungo il colpo, scalata sugli HP (i tank quasi non rinculano).
    const ka = (bullet.getData('ang') as number) ?? 0;
    const kf = Phaser.Math.Clamp(2 / ZOMBIE_STATS[type].hp, 0.18, 1);
    zombie.setData('kx', ((zombie.getData('kx') as number) ?? 0) + Math.cos(ka) * KNOCK * kf);
    zombie.setData('ky', ((zombie.getData('ky') as number) ?? 0) + Math.sin(ka) * KNOCK * kf);
    const hp   = (zombie.getData('hp') as number) - dmg;
    if (hp <= 0) {
      this.addKillScore(ZOMBIE_STATS[type].score);
      this.killBurst(type, zombie.x, zombie.y);
      this.environment?.addDecal('blood', zombie.x, zombie.y);
      this.sfx?.playZombieKill();
      if (type === 'toxic') this.spawnToxicCloud(zombie.x, zombie.y);
      if (type === 'giant') this.cameras.main.shake(200, 0.012); // il burst gore del gigante è già più ricco (n=10)
      if (type === 'charger') this.tweens.killTweensOf(zombie); // niente tween di telegrafo orfano (A2)
      zombie.destroy();
    } else {
      this.playHitSfx(); // feedback "l'ho preso" sul nemico che sopravvive
      zombie.setData('hp', hp);
      zombie.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (!zombie?.active) return;
        // Non cancellare la tinta gialla di telegrafo del Caricatore: è il segnale di carica imminente (A2).
        if (zombie.getData('type') === 'charger' && zombie.getData('chargeState') === 'telegraph') zombie.setTint(0xffcc44);
        else zombie.clearTint();
      });
    }
  }

  private onVehicleHitZombie(zombie: Phaser.Physics.Arcade.Sprite) {
    if (!zombie.active) return;
    const type = zombie.getData('type') as ZombieType;

    // Sovraccarico (A3): il veicolo è un ariete → il contatto uccide senza danneggiare i componenti
    // (e senza nube auto-inflitta speronando un tossico: l'ariete plana pulito).
    if (this.overdriveOn()) {
      this.addKillScore(ZOMBIE_STATS[type].score);
      this.killBurst(type, zombie.x, zombie.y);
      if (type === 'giant') { this.cameras.main.shake(180, 0.01); this.hitStop(40); this.sfx?.playExplosion(); }
      else this.sfx?.playZombieKill();
      if (type === 'charger') this.tweens.killTweensOf(zombie);
      this.environment?.addDecal('blood', zombie.x, zombie.y);
      zombie.destroy();
      return;
    }

    switch (type) {
      case 'runner':
        zombie.destroy();
        this.damageComponent('armor', 10);
        this.dealDamage(this.scaledDamage('runner'));
        this.cameras.main.shake(80, 0.005);
        this.sfx?.playImpact();
        this.environment?.addDecal('skid', zombie.x, zombie.y);
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

      case 'armored':
        zombie.destroy();
        this.damageComponent('armor', 18);
        this.damageComponent('engine', 8);
        this.dealDamage(this.scaledDamage('armored'));
        this.cameras.main.shake(200, 0.014);
        this.sfx?.playImpact();
        this.environment?.addDecal('skid', zombie.x, zombie.y);
        this.environment?.addDecal('debris', zombie.x, zombie.y);
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

      case 'charger':
        // Bruto incornante (A2): se non l'hai schivato, l'impatto è pesante.
        zombie.destroy();
        this.damageComponent('armor', 22);
        this.damageComponent('engine', 10);
        this.dealDamage(this.scaledDamage('charger'));
        this.cameras.main.shake(280, 0.02);
        this.hitStop(45);
        this.sfx?.playImpact();
        this.environment?.addDecal('skid', zombie.x, zombie.y);
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

      case 'giant': {
        const gx = zombie.x, gy = zombie.y;
        this.addKillScore(ZOMBIE_STATS.giant.score); // speronarlo lo uccide → premia come ucciderlo a colpi (X5)
        zombie.destroy();
        this.damageComponent('armor', 30);
        this.damageComponent('engine', 20);
        this.damageComponent('wheels', 20);
        this.dealDamage(this.scaledDamage('giant'));
        this.cameras.main.shake(400, 0.025);
        this.hitStop(50);
        this.killBurst('giant', gx, gy);
        this.sfx?.playExplosion();
        this.environment?.addDecal('skid', gx, gy);
        this.environment?.addDecal('debris', gx, gy);
        this.environment?.addDecal('blood', gx, gy);
        break;
      }

      case 'jumper':
        if (this.attachedZombies.length < ATTACH_SLOTS.length) {
          this.attachZombie(zombie, true);
        } else {
          zombie.destroy();
          this.dealDamage(this.scaledDamage('jumper'));
          this.damageComponent('turret', 15);
          this.sfx?.playImpact();
        }
        break;

      case 'toxic':
        zombie.destroy();
        this.spawnToxicCloud(zombie.x, zombie.y);
        this.dealDamage(this.scaledDamage('toxic'));
        this.damageComponent('armor', 8);
        this.sfx?.playImpact();
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

      case 'spitter':
        zombie.destroy();
        this.spawnToxicCloud(zombie.x, zombie.y);
        this.dealDamage(this.scaledDamage('spitter'));
        this.damageComponent('armor', 8);
        this.sfx?.playImpact();
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

      default: // common
        if (this.attachedZombies.length < ATTACH_SLOTS.length) {
          this.attachZombie(zombie, false);
        } else {
          zombie.destroy();
          this.dealDamage(this.scaledDamage('common'));
          this.damageComponent('armor', 5);
          this.cameras.main.shake(60, 0.004);
          this.sfx?.playImpact();
          this.environment?.addDecal('blood', zombie.x, zombie.y);
        }
        break;
    }
  }

  private onRocketHitZombie(rocket: Phaser.Physics.Arcade.Sprite, zombie: Phaser.Physics.Arcade.Sprite) {
    if (!rocket.active || !zombie.active) return;
    const rx = rocket.x, ry = rocket.y;
    rocket.destroy();

    const AOE = 90;
    const dmg = WEAPONS.rockets.damage;
    for (const z of this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!z.active) continue;
      if (Phaser.Math.Distance.Between(rx, ry, z.x, z.y) > AOE) continue;
      const hp = (z.getData('hp') as number) - dmg;
      if (hp <= 0) {
        const zt = z.getData('type') as ZombieType;
        this.addKillScore(ZOMBIE_STATS[zt].score);
        this.killBurst(zt, z.x, z.y);
        if (zt === 'toxic') this.spawnToxicCloud(z.x, z.y);
        z.destroy();
      } else {
        z.setData('hp', hp);
        z.setTint(0xffffff);
        this.time.delayedCall(80, () => { if (z?.active) z.clearTint(); });
      }
    }
    for (let i = this.attachedZombies.length - 1; i >= 0; i--) {
      const az = this.attachedZombies[i];
      if (Phaser.Math.Distance.Between(rx, ry, az.sprite.x, az.sprite.y) <= AOE) {
        az.hp -= dmg;
        if (az.hp <= 0) {
          this.addKillScore(5); // come checkBulletsVsAttached: uccidere un aggrappato dà punti/combo (REG8)
          this.spawnHitParticles(az.sprite.x, az.sprite.y);
          az.sprite.destroy();
          this.attachedZombies.splice(i, 1);
        }
      }
    }
    this.spawnHitParticles(rx, ry);
    this.spawnHitParticles(rx + 8, ry - 8);
    this.environment?.addDecal('scorch', rx, ry);
    Juice.lightFlash(this, rx, ry, 0xff8a33, 4);
    this.sfx?.playExplosion();
    this.cameras.main.shake(130, 0.009);
    this.hitStop(30);
  }

  private onCollectFuel(can: Phaser.Physics.Arcade.Sprite) {
    if (!can.active) return;
    can.destroy();
    this.fuel = Math.min(this.maxFuel, this.fuel + 30);
    this.sfx?.playFuelPickup();
    this.vehicle.setTint(0x88ff88);
    this.time.delayedCall(200, () => { if (this.vehicle?.active) this.vehicle.clearTint(); });
  }

  private onVehicleHitCloud(cloud: Phaser.Physics.Arcade.Sprite) {
    if (!cloud.active) return;
    const lastDmg = (cloud.getData('lastDmg') as number) ?? 0;
    if (this.time.now - lastDmg > 500) {
      cloud.setData('lastDmg', this.time.now);
      this.dealDamage(3);
      this.damageComponent('tank', 3);
      this.sfx?.playToxicSizzle();
      this.vehicle.setTint(0x44ff44);
      this.time.delayedCall(150, () => { if (this.vehicle?.active) this.vehicle.clearTint(); });
    }
  }

  // ─── Attachment system ───────────────────────────────────────────────────────

  private attachZombie(zombie: Phaser.Physics.Arcade.Sprite, prefTurret: boolean) {
    // Subito dopo lo scatto il veicolo "respinge": nessun nuovo aggancio per un istante.
    if (this.time.now < this.dashGraceUntil) { this.spawnHitParticles(zombie.x, zombie.y); zombie.destroy(); return; }
    const usedSlots = this.attachedZombies.map(az => az.slotIndex);
    let slotIndex: number;
    if (prefTurret) {
      slotIndex = ATTACH_SLOTS.findIndex((s,i) => s.comp==='turret' && !usedSlots.includes(i));
      if (slotIndex === -1) slotIndex = ATTACH_SLOTS.findIndex((_,i) => !usedSlots.includes(i));
    } else {
      slotIndex = ATTACH_SLOTS.findIndex((_,i) => !usedSlots.includes(i));
    }
    if (slotIndex === -1) return;

    const slot = ATTACH_SLOTS[slotIndex];
    const type = zombie.getData('type') as ZombieType;
    const hp   = zombie.getData('hp') as number;
    zombie.destroy();

    const sprite = this.add.sprite(this.vehicle.x+slot.dx, this.vehicle.y+slot.dy, `zombie_${type}`);
    sprite.setScale(0.68 / OVERSAMPLE).setDepth(11).setTint(type==='jumper' ? 0xffcc00 : 0xff8800);
    sprite.play(`walk_${type}`); sprite.anims.setProgress(Math.random());
    this.tweens.add({ targets: sprite, scaleX: 0.84 / OVERSAMPLE, scaleY: 0.84 / OVERSAMPLE, yoyo: true, duration: 110, repeat: 1 });
    this.attachedZombies.push({ sprite, slotIndex, comp: slot.comp, hp, timer: ATTACH_DAMAGE_INTERVAL });
    this.cameras.main.shake(70, 0.005);
    this.sfx?.playZombieAttach();
  }

  // ─── Toxic cloud ─────────────────────────────────────────────────────────────

  spawnToxicCloud(x: number, y: number) {
    const cloud = this.toxicClouds.create(x, y, 'toxic_cloud') as Phaser.Physics.Arcade.Sprite;
    cloud.setVelocityX(-SCROLL_SPEED);
    cloud.setData('timer', 3000).setData('lastDmg', 0);
    cloud.setDepth(7).setScale(1.5);
    (cloud.body as Phaser.Physics.Arcade.Body).setSize(36, 36);
  }

  // ─── Component damage system ─────────────────────────────────────────────────

  damageComponent(key: ComponentKey, amount: number) {
    if (this.debugGod || this.boss.defeated || this.missionDone || !this.alive) return; // invulnerabile a fine run / celebrazione vittoria
    const comp = this.components[key];
    comp.health = Math.max(0, comp.health - amount);
    if (key === 'engine' && comp.health <= 0) this.endGame(t('game.over.engine'));
  }

  dealDamage(amount: number) {
    if (this.debugGod || this.boss.defeated || this.missionDone || !this.alive) return; // invulnerabile a fine run / celebrazione vittoria (X4)
    const armorPct = this.components.armor.health / 100;
    const bonus = this.vehicleArmorBonus / 100;
    const base  = armorPct<=0 ? 2.5 : armorPct<0.3 ? 1.8 : armorPct<0.6 ? 1.3 : 1.0;
    const mult  = Math.max(0.5, base - bonus);
    const dealt = Math.round(amount * mult);
    this.health = Math.max(0, this.health - dealt);
    this.hud.flashHealthBar();
    if (this.health <= 0) this.endGame(t('game.over.vehicle'));
    else this.flashVehicleDamage(dealt); // se è game over, ci pensa endGame a tingere il veicolo
  }

  /**
   * Reazione del veicolo al danno (l'evento negativo che il giocatore deve "sentire"): tinta
   * rossa breve sul corpo + lampo rosso ai bordi schermo, con intensità scalata sull'entità del
   * colpo. Solo visivo: niente shake qui (lo gestiscono già i rami di collisione). Vedi art bible
   * zombi §VFX ("VFX + suono + feedback schermo nello stesso frame, niente azione muta").
   */
  private flashVehicleDamage(dealt: number) {
    if (this.vehicle?.active) {
      this.vehicle.setTint(0xff4422);
      this.time.delayedCall(120, () => { if (this.vehicle?.active && this.alive) this.vehicle.clearTint(); });
    }
    const intensity = Phaser.Math.Clamp(0.10 + dealt * 0.018, 0.10, 0.30);
    Juice.flash(this, 0xff1111, intensity, 110);
  }

  private getEffectiveVerticalSpeed(): number {
    const w = 0.15 + 0.85 * (this.components.wheels.health / 100);
    const a = Math.max(0.3, 1 - this.attachedZombies.length * 0.12);
    const oil = this.time.now < this.oilUntil ? OIL_SLOW_MULT : 1; // A1: olio → controllo verticale ridotto
    return 230 * this.vehicleSpeedMult * w * a * oil;
  }

  private getEffectiveCooldown(): number {
    if (this.components.turret.health <= 0) return 99999;
    const base = WEAPONS[this.currentWeapon].cooldown;
    const od = this.overdriveOn() ? OVERDRIVE_FIRE_MULT : 1; // Sovraccarico: cadenza moltiplicata (A3)
    return (base / this.vehicleFireMult / od) * (1 + (1 - this.components.turret.health/100) * 1.4);
  }

  private getEffectiveFuelDrain(): number {
    return BASE_FUEL_DRAIN * (1 + (1 - this.components.tank.health / 100) * 2);
  }

  // ─── Mission complete ────────────────────────────────────────────────────────

  /** Distrugge gli zombi aggrappati e svuota l'array: niente sprite orfani né timer pendenti a fine run (X3). */
  private clearAttachedZombies() {
    this.attachedZombies.forEach(az => az.sprite.destroy());
    this.attachedZombies = [];
    // Fine run: spegni il Sovraccarico e rimuovi l'alone (niente sprite/timer orfani, A3).
    this.overdriveActiveUntil = 0;
    this.overdriveGlow?.destroy();
    this.overdriveGlow = null;
  }

  triggerMissionComplete() {
    if (this.missionDone) return;
    this.missionDone = true;

    const earned = Math.floor(this.score / 8);
    setRun(this.registry, 'money',         (getRun(this.registry, 'money') ?? 0) + earned);
    setRun(this.registry, 'missionNumber', (getRun(this.registry, 'missionNumber') ?? 1) + 1);
    setRun(this.registry, 'lastScore',     this.score);
    setRun(this.registry, 'components', {
      engine: this.components.engine.health,
      wheels: this.components.wheels.health,
      tank:   this.components.tank.health,
      turret: this.components.turret.health,
      armor:  this.components.armor.health,
    });

    this.sfx?.playMissionComplete();
    this.sfx?.stopEngine();
    this.zombies.setVelocityX(0); this.zombies.setVelocityY(0); // anche Y per il Caricatore in carica (A2)
    this.fuelCans.setVelocityX(0);
    this.bullets.setVelocityX(0); this.bullets.setVelocityY(0);
    this.crosshair?.setVisible(false); this.turret?.setVisible(false); // niente mirino sopra l'overlay di fine missione
    this.spitProjectiles.setVelocityX(0); this.spitProjectiles.setVelocityY(0);
    this.hazards.setVelocityX(0);
    this.clearAttachedZombies();

    // Record persistente (G5) + rilevamento fine-ciclo (G6): completare le 7 regioni è una "vittoria",
    // poi il gioco continua in endless+ con lo scaling NG+ (G2).
    SaveData.record(this.missionNumber, this.score);
    const cycleComplete = this.missionNumber % 7 === 0;
    const cycleNum = this.missionNumber / 7;
    if (cycleComplete) Juice.flash(this, 0xffee44, 0.35, 220);

    const cx = this.designW/2, cy = H/2;
    Ui.box(this, cx,cy,500,260,{ fill:UI.black, fillAlpha:0.9, radius:16, stroke: cycleComplete ? 0xffcc22 : UI.greenSig, strokeAlpha:0.5 }).setDepth(30);
    Ui.text(this, cx,cy-95, cycleComplete ? t('game.victoryCycle', { n: cycleNum }) : t('game.missionComplete'),{
      fontSize: cycleComplete ? '28px' : '32px', color: cycleComplete ? UI.gold : UI.green, fontStyle:'bold',
      stroke: cycleComplete ? '#665500' : '#006600', strokeThickness:4,
    }).setOrigin(0.5).setDepth(31);
    if (cycleComplete) {
      Ui.text(this, cx,cy-66,t('game.allRegions'),{fontSize:'12px',color:UI.greenSoft}).setOrigin(0.5).setDepth(31);
    }
    Ui.text(this, cx,cy-48,t('game.scoreLine', { n: this.score }),{fontSize:'20px',color:UI.white}).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy-14,t('game.distanceLine', { n: Math.floor(this.distance/100) }),{fontSize:'16px',color:UI.blueInfo}).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy+20,t('game.coinsEarned', { n: earned }),{fontSize:'18px',color:UI.gold}).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy+55,t('game.coinsTotal', { n: (getRun(this.registry, 'money') ?? 0) }),{fontSize:'15px',color:UI.goldDim}).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy+82,t('game.toShop'),{fontSize:'13px',color:UI.faint}).setOrigin(0.5).setDepth(31);
    this.addMenuReturn(cx, cy+108);

    this.time.delayedCall(600, () => {
      this.input.keyboard?.once('keydown-SPACE', () => Juice.go(this, 'ShopScene'));
      this.input.keyboard?.once('keydown-M', () => Juice.go(this, 'MenuScene'));
    });
  }

  /** Voce cliccabile "Torna al menu" per le schermate di fine partita. */
  private addMenuReturn(x: number, y: number) {
    const link = Ui.text(this, x, y, t('game.toMenu'), {
      fontSize: '13px', color: '#7788aa',
    }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true });
    link.on('pointerover', () => link.setColor('#aaccff'));
    link.on('pointerout',  () => link.setColor('#7788aa'));
    link.on('pointerdown', () => Juice.go(this, 'MenuScene'));
  }

  // ─── Game over ───────────────────────────────────────────────────────────────

  private endGame(reason: string) {
    if (!this.alive) return;
    this.alive = false;

    SaveData.record(this.missionNumber, this.score); // aggiorna il record prima dell'azzeramento (G5)

    // Reset tutto al game over (default centralizzati in RunState).
    resetRunState(this.registry);

    this.sfx?.playGameOver();
    this.sfx?.stopEngine();
    this.vehicle.setTint(0xff2200);
    this.crosshair?.setVisible(false); this.turret?.setVisible(false); // niente mirino sopra "GAME OVER"
    this.cameras.main.shake(500, 0.018);
    this.zombies.setVelocityX(0); this.zombies.setVelocityY(0); // anche Y: il Caricatore in carica ha velocityY persistente (A2)
    this.bullets.setVelocityX(0); this.bullets.setVelocityY(0); // anche Y: i colpi mirati hanno velocità diagonale
    this.fuelCans.setVelocityX(0);
    this.boss.projectiles.setVelocityX(0); // niente proiettili boss sospesi sopra l'overlay (X9)
    this.boss.group.setVelocityX(0);
    this.spitProjectiles.setVelocityX(0); this.spitProjectiles.setVelocityY(0);
    this.hazards.setVelocityX(0);
    this.clearAttachedZombies(); // niente sprite/timer orfani sul veicolo congelato (X3)

    this.time.delayedCall(700, () => {
      const cx = this.designW/2, cy = H/2;
      Ui.box(this, cx,cy,440,260,{ fill:UI.black, fillAlpha:0.88, radius:16, stroke:UI.redCrit, strokeAlpha:0.55 }).setDepth(30);
      Ui.text(this, cx,cy-80,t('game.gameOver'),{
        fontSize:'50px', color:'#ff3333', fontStyle:'bold',
        stroke:'#880000', strokeThickness:5,
      }).setOrigin(0.5).setDepth(31);
      Ui.text(this, cx,cy-28,reason,{fontSize:'16px',color:UI.redSoft}).setOrigin(0.5).setDepth(31);
      Ui.text(this, cx,cy+10,t('game.scoreLine', { n: this.score }),{fontSize:'22px',color:UI.white}).setOrigin(0.5).setDepth(31);
      Ui.text(this, cx,cy+42,t('game.distanceLine', { n: Math.floor(this.distance/100) }),{fontSize:'16px',color:UI.blueInfo}).setOrigin(0.5).setDepth(31);
      // Comunica che il game over azzera tutto il progresso (prima era silenzioso — U8).
      Ui.text(this, cx,cy+68,t('game.progressReset'),{fontSize:'12px',color:UI.amberSoft}).setOrigin(0.5).setDepth(31);
      Ui.text(this, cx,cy+92,t('game.restart'),{fontSize:'14px',color:UI.faint}).setOrigin(0.5).setDepth(31);
      this.addMenuReturn(cx, cy+116);
      this.input.keyboard?.once('keydown-M', () => Juice.go(this, 'MenuScene'));
    });
  }

  // ─── Boss system ─────────────────────────────────────────────────────────────

  spawnZombieAt(type: ZombieType, x: number, y: number) {
    const stats = ZOMBIE_STATS[type];
    const z = this.zombies.create(
      x, Phaser.Math.Clamp(y, ROAD_TOP + 22, ROAD_BOTTOM - 22), `zombie_${type}`
    ) as Phaser.Physics.Arcade.Sprite;
    z.setScale(stats.scale / OVERSAMPLE).setData('hp', this.scaledHp(stats.hp)).setData('type', type);
    z.setData('rockPhase', Math.random() * 6.28);
    z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9);
    (z.body as Phaser.Physics.Arcade.Body).setSize(20, 28);
    z.play(`walk_${type}`); z.anims.setProgress(Math.random());
  }

  // ─── Visual FX ───────────────────────────────────────────────────────────────

  spawnHitParticles(x: number, y: number) {
    for (let i = 0; i < Phaser.Math.Between(3,5); i++) {
      const p = this.add.image(x,y,'particle').setDepth(15).setScale(0.5);
      const angle = Math.random() * Math.PI * 2;
      const spd = Phaser.Math.Between(40, 120);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle)*spd*0.4, y: y + Math.sin(angle)*spd*0.4,
        alpha: 0, scale: 0.1, duration: 330, ease: 'Power2',
        onComplete: () => p.destroy(),
      });
    }
  }

  /**
   * Schizzo di morte COLORATO per tipo (l'uccisione è l'evento più frequente: deve comunicare
   * COSA hai ucciso, non un generico scoppietto arancione). Rosso-sangue per la carne, verde-melma
   * per il tossico, scintille metalliche per il corazzato — coerente coi colori-firma (art bible
   * zombi). Impulso verso SINISTRA (controproiettile) per dare "punch" direzionale. La texture
   * 'particle' è bianco-calda → si tinge pulita. Fire-and-forget.
   */
  private killBurst(type: ZombieType, x: number, y: number) {
    // [chiaro, scuro] per tipo
    const palette: Record<ZombieType, [number, number]> = {
      common:  [0xcc1a1a, 0x6e1410],
      runner:  [0xcc1a1a, 0x6e1410],
      jumper:  [0xcc1a1a, 0x6e1410],
      giant:   [0xb31818, 0x540c0a],
      toxic:   [0x6cff3a, 0x2cbb2a],
      armored: [0x9aa7b5, 0x5f6b78],
      charger: [0xb31818, 0x540c0a],
      spitter: [0x6cff3a, 0x2cbb2a],
    };
    const [c1, c2] = palette[type];
    const n = type === 'giant' ? 10 : Phaser.Math.Between(4, 6);
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, 'particle').setDepth(15)
        .setScale(Phaser.Math.FloatBetween(0.35, 0.6))
        .setTint(i % 2 === 0 ? c1 : c2);
      const a = Math.PI + Phaser.Math.FloatBetween(-1.1, 1.1); // emisfero sinistro (opposto al proiettile)
      const sp = Phaser.Math.Between(50, 150);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * sp,
        y: y + Math.sin(a) * sp * 0.7 + Phaser.Math.Between(-10, 22),
        alpha: 0, scale: 0.06,
        duration: 300 + Phaser.Math.Between(-60, 120),
        ease: 'Quad.easeOut', onComplete: () => p.destroy(),
      });
    }
    // Morte del bruto: oltre al gore, alone rosso emissivo (accento-firma) + schegge d'osso/sangue
    // più grandi e rotanti. Tutto fire-and-forget → nessun impatto sul gameplay.
    if (type === 'giant') {
      Juice.lightFlash(this, x, y, 0xff2a10, 6, 360);
      Juice.bloomBurst(this, x, y, 0xff3018, 3, 300);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI + Phaser.Math.FloatBetween(-1.3, 1.3);
        const sp = Phaser.Math.Between(60, 130);
        const chunk = this.add.image(x, y, 'particle').setDepth(15)
          .setScale(Phaser.Math.FloatBetween(0.7, 1.1)).setTint(i % 2 ? 0xd9c8a0 : 0x6e2a26);
        this.tweens.add({
          targets: chunk,
          x: x + Math.cos(a) * sp, y: y + Math.sin(a) * sp * 0.7 + Phaser.Math.Between(10, 30),
          angle: Phaser.Math.Between(-280, 280), alpha: 0, scale: 0.1,
          duration: 560 + Phaser.Math.Between(-80, 120), ease: 'Quad.easeOut', onComplete: () => chunk.destroy(),
        });
      }
    }
  }
}
