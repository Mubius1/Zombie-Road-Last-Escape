import Phaser from 'phaser';
import { VEHICLES, Upgrades, WeaponType, WEAPONS, WEAPON_KEYS } from '../GameData';
import SoundManager from '../SoundManager';
import Juice from '../Juice';
import Environment from '../Environment';
import Settings from '../Settings';
import Ui, { UI } from '../Ui';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';
import { resetRunState } from '../RunState';
import { buildEntityTextures } from '../EntityTextures';
import { buildVehicleTexture } from '../VehicleTextures';
import HudController from '../HudController';
import BossController, { BossHost } from '../BossController';

// Spazio di design: l'altezza è fissa (H), la larghezza varia col formato (designW,
// più ampia in 16:9). La camera in zoom adatta tutto alla risoluzione nativa — vedi Config.ts.
const H = 600;
export const ROAD_TOP = 155, ROAD_BOTTOM = 445, ROAD_CENTER = 300;
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

export type BossType = 'mega_mutant' | 'giant_worm' | 'armored_colossus' | 'radioactive_beast';

export interface BossConfig {
  name: string; hp: number; speed: number; scaleX: number; scaleY: number;
  tint: number; bodyW: number; bodyH: number; reward: number;
}

// Ogni boss ha la propria texture `boss_<tipo>` (vedi buildEntityTextures + Art Bible §6.7).
// scaleX/scaleY adattano la cornice dedicata; bodyW/bodyH sono ricalcolati così che la
// HITBOX effettiva nel mondo (bodyW·scaleX/OVERSAMPLE × bodyH·scaleY/OVERSAMPLE) resti
// IDENTICA al precedente riuso del Gigante → bilanciamento invariato. `tint` non colora più
// lo sprite (palette cotta nella texture): è l'accento emissivo "firma" usato nei VFX (morte).
export const BOSS_CONFIG: Record<BossType, BossConfig> = {
  mega_mutant:       { name: 'Mega Mutante',      hp: 80,  speed: 55, scaleX: 2.4, scaleY: 2.6, tint: 0xff4030, bodyW: 56,  bodyH: 71, reward: 400 },
  giant_worm:        { name: 'Verme Gigante',      hp: 110, speed: 40, scaleX: 2.0, scaleY: 2.0, tint: 0xff7722, bodyW: 152, bodyH: 34, reward: 500 },
  armored_colossus:  { name: 'Colosso Corazzato',  hp: 150, speed: 28, scaleX: 2.5, scaleY: 2.8, tint: 0xffcc22, bodyW: 62,  bodyH: 80, reward: 650 },
  radioactive_beast: { name: 'Bestia Radioattiva', hp: 95,  speed: 50, scaleX: 2.2, scaleY: 2.3, tint: 0x7dff4a, bodyW: 59,  bodyH: 66, reward: 450 },
};

export const BOSS_ORDER: BossType[] = ['mega_mutant', 'giant_worm', 'armored_colossus', 'radioactive_beast'];

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
  { name: 'Città Distrutta',        bgColor: 0x12121e, skyColor: 0x16161e, groundColor: 0x1a1610, roadColor: 0x2a2a2a, lineColor: 0xddcc00, shoulderColor: 0x1e1e22, grade: 0x8fa6c8, gradeAlpha: 0.42, emissive: 0xffcc33, hazeColor: 0x2a2a3a },
  { name: 'Autostrada Abbandonata', bgColor: 0x14120e, skyColor: 0x1c180e, groundColor: 0x141208, roadColor: 0x323028, lineColor: 0xaaaa44, shoulderColor: 0x201e16, grade: 0xc8bc86, gradeAlpha: 0.40, emissive: 0xccbb55, hazeColor: 0x33301f },
  { name: 'Deserto',                bgColor: 0x1e1006, skyColor: 0x2e1a08, groundColor: 0x1e1408, roadColor: 0x4a3a1a, lineColor: 0xddaa00, shoulderColor: 0x2a2010, grade: 0xffba60, gradeAlpha: 0.48, emissive: 0xffb24a, hazeColor: 0x4a2c12 },
  { name: 'Foresta Infestata',      bgColor: 0x040c04, skyColor: 0x040c04, groundColor: 0x020802, roadColor: 0x141c10, lineColor: 0x66cc22, shoulderColor: 0x0a100a, grade: 0x74c084, gradeAlpha: 0.46, emissive: 0x6cff3a, hazeColor: 0x0c2410 },
  { name: 'Zona Industriale',       bgColor: 0x0e0a08, skyColor: 0x120e0a, groundColor: 0x0c0806, roadColor: 0x1c1a18, lineColor: 0xff6600, shoulderColor: 0x181410, grade: 0xc89a5a, gradeAlpha: 0.44, emissive: 0xff7722, hazeColor: 0x2a1810 },
  { name: 'Base Militare',          bgColor: 0x080e06, skyColor: 0x0c1008, groundColor: 0x080e06, roadColor: 0x202818, lineColor: 0x88bb44, shoulderColor: 0x101608, grade: 0x9ab074, gradeAlpha: 0.42, emissive: 0x99cc55, hazeColor: 0x162012 },
  { name: 'Città Finale',           bgColor: 0x0c0612, skyColor: 0x100618, groundColor: 0x0c0612, roadColor: 0x180c22, lineColor: 0xcc44ff, shoulderColor: 0x140a1a, grade: 0xb074d8, gradeAlpha: 0.48, emissive: 0xcc44ff, hazeColor: 0x240a36 },
];

export type ZombieType = 'common' | 'runner' | 'armored' | 'jumper' | 'giant' | 'toxic';
export type ComponentKey = 'engine' | 'wheels' | 'tank' | 'turret' | 'armor';

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
};

const SPAWN_POOL: ZombieType[] = [
  'common', 'common', 'common', 'common',
  'runner', 'runner',
  'armored',
  'jumper',
  'toxic', 'toxic',
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
  private giantTimer = 0;
  private envIndex = 0;

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
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private cycleKey!: Phaser.Input.Keyboard.Key;
  private numberKeys: Phaser.Input.Keyboard.Key[] = [];

  private combo = 0;
  private comboTimer = 0;
  private dashReadyAt = 0;
  private dashGraceUntil = 0;

  private lastFire = 0;
  private spawnTimer = 0;
  private spawnInterval = 2100;

  /** Larghezza dello spazio di design (800 in 4:3, maggiore in 16:9 → più strada). */
  designW = DESIGN_W;

  constructor() { super({ key: 'GameScene' }); }

  create() {
    // Camera in zoom: lo spazio di design riempie la risoluzione nativa scelta.
    this.designW = setupCamera(this).designW;
    this.vehicleKey        = this.registry.get('vehicle')       ?? 'civilian_car';
    this.activeSurvivors   = this.registry.get('survivors')     ?? [];
    this.upgrades          = this.registry.get('upgrades')      ?? {};
    const missionNum: number = this.registry.get('missionNumber') ?? 1;
    const savedComp        = this.registry.get('components')    ?? null;

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
    this.spawnInterval = Math.max(700, 2100 - (missionNum - 1) * 80);
    this.spawnTimer = 0;
    this.stripes = [];
    this.attachedZombies = [];
    this.mechanicTimer = 0;
    this.soldierTimer = 0;
    this.giantTimer = GIANT_SPAWN_INTERVAL;
    this.envIndex = (missionNum - 1) % ENVIRONMENTS.length;
    this.currentWeapon = this.registry.get('currentWeapon') ?? 'mg';
    this.ownedWeapons  = this.registry.get('ownedWeapons')  ?? ['mg'];
    if (!this.ownedWeapons.includes(this.currentWeapon)) this.currentWeapon = this.ownedWeapons[0] ?? 'mg';
    this.combo = 0; this.comboTimer = 0;
    this.dashReadyAt = 0; this.dashGraceUntil = 0;
    this.boss = new BossController(this); // stato boss fresco + gruppi fisici (usati da buildColliders)

    const def = { engine: 100, wheels: 100, tank: 100, turret: 100, armor: 100 };
    const c = savedComp ?? def;
    this.components = {
      engine: { health: c.engine, label: 'MOTORE',  baseColor: 0x44cc44 },
      wheels: { health: c.wheels, label: 'RUOTE',   baseColor: 0x44aa88 },
      tank:   { health: c.tank,   label: 'SERBAT.', baseColor: 0xff8800 },
      turret: { health: c.turret, label: 'TORR.',   baseColor: 0x8899ff },
      armor:  { health: c.armor,  label: 'CORAZZA', baseColor: 0x6688bb },
    };

    this.buildTextures();
    this.buildWorld();
    this.buildVehicle();
    this.buildGroups();
    this.buildColliders();
    this.buildHUD(missionNum);
    this.buildInput();

    const fuelDelay = this.activeSurvivors.includes('explorer') ? 5000 : 7500;
    this.time.addEvent({ delay: fuelDelay, callback: this.spawnFuelCan, callbackScope: this, loop: true });

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
      this.sfx?.stopEngine();
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
    });

    // Juice: overlay filmico (opzionale) + entrata in dissolvenza
    this.frozen = false;
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
    Juice.jitterGrain(this.grain);
    if (this.frozen) return;
    const dt = delta / 1000;
    this.updateVehicle(dt);
    this.updateFiring(time);
    this.updateWeaponSwitch();
    this.updateDash(time);
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
    const envLabel = Ui.text(this, this.designW / 2, ROAD_TOP - 28, env.name.toUpperCase(), {
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
    this.hud.build({
      missionNum, missionDist: MISSION_DIST,
      components: this.components,
      activeSurvivors: this.activeSurvivors,
      ownedWeapons: this.ownedWeapons,
      currentWeapon: this.currentWeapon,
      debugGod: this.debugGod,
    });
  }

  private buildInput() {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.spaceKey = this.input.keyboard!.addKey(KC.SPACE);
    this.shiftKey = this.input.keyboard!.addKey(KC.SHIFT);
    this.cycleKey = this.input.keyboard!.addKey(KC.Q);
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
    if (this.cursors.up?.isDown)   body.setVelocityY(-vSpeed);
    if (this.cursors.down?.isDown) body.setVelocityY(vSpeed);
    this.vehicle.y = Phaser.Math.Clamp(this.vehicle.y, ROAD_TOP+22, ROAD_BOTTOM-22);
    const lean = body.velocity.y > 0 ? 4 : body.velocity.y < 0 ? -4 : 0;
    this.vehicle.angle = Phaser.Math.Linear(this.vehicle.angle, lean, 0.12);

    const engineLoad = (this.components.engine.health / 100) *
                       Math.max(0.3, 1 - this.attachedZombies.length * 0.15);
    this.sfx?.setEngineLoad(engineLoad);
  }

  private updateFiring(time: number) {
    if (this.spaceKey.isDown && time - this.lastFire > this.getEffectiveCooldown()) {
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
    this.registry.set('currentWeapon', key);
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

  // ─── Combo / moltiplicatore di punteggio ───────────────────────────────────
  private updateCombo(delta: number) {
    if (this.combo <= 0) return;
    this.comboTimer -= delta;
    if (this.comboTimer <= 0) { this.combo = 0; this.comboTimer = 0; }
  }

  private comboMultiplier(): number {
    return Phaser.Math.Clamp(1 + Math.floor((this.combo - 1) / 5), 1, 5);
  }

  /** Aggiunge punteggio da un'uccisione applicando il moltiplicatore combo. */
  addKillScore(base: number) {
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    this.score += base * this.comboMultiplier();
    if (this.combo >= 2) this.hud.popCombo();
  }

  private updateFuel(dt: number) {
    if (this.debugGod) { this.fuel = this.maxFuel; return; }
    if (this.boss.defeated) return; // niente consumo durante la celebrazione di vittoria (X4: nessun game over post-vittoria)
    this.fuel -= this.getEffectiveFuelDrain() * dt;
    if (this.fuel <= 0) { this.fuel = 0; this.endGame('Carburante esaurito!'); }
  }

  private updateDistance(dt: number) {
    this.distance += SCROLL_SPEED * dt;
    if (!this.boss.spawned && this.distance >= MISSION_DIST * BOSS_TRIGGER) {
      this.boss.spawn();
    }
    if (this.boss.active) return;
    if (this.distance >= MISSION_DIST) this.triggerMissionComplete();
  }

  private updateZombieSpawning(delta: number) {
    if (this.boss.active || this.boss.defeated) return;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnZombie();
      this.spawnInterval = Math.max(500, this.spawnInterval - 3);
      this.spawnTimer = this.spawnInterval;
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
          bullet.destroy();
          az.hp--;
          if (az.hp <= 0) {
            this.addKillScore(5);
            this.spawnHitParticles(az.sprite.x, az.sprite.y);
            az.sprite.destroy();
            this.attachedZombies.splice(i,1);
          } else {
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
      if (this.soldierTimer >= 3000) {
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
    clean(this.rockets,         -20,  this.designW+60);
    clean(this.boss.projectiles, -80,  this.designW+80);
    // Bullets respect per-projectile maxX (lanciafiamme ha range breve)
    (this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(s => {
      if (!s.active) return;
      const maxX = (s.getData('maxX') as number) ?? this.designW + 40;
      if (s.x < -20 || s.x > maxX) s.destroy();
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
    }
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
      const d = this.add.image(z.x + Phaser.Math.Between(-14, 14), z.y + 28, 'particle')
        .setTint(0x6a5a44).setAlpha(0.5).setScale(1).setDepth(8);
      this.tweens.add({ targets: d, y: d.y - 4, scale: 2, alpha: 0, duration: 600, onComplete: () => d.destroy() });
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
      z.setScale(stats.scale / OVERSAMPLE).setData('hp', stats.hp).setData('type', 'jumper');
      z.setData('rockPhase', Math.random() * 6.28).setData('entering', true);
      z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9).setBodySize(20,28);
      z.play('walk_jumper'); z.anims.setProgress(Math.random());
      this.tweens.add({ targets: z, y: targetY, duration: 500, ease: 'Sine.easeOut',
        onComplete: () => { if (z.active) z.setData('entering', false); } });
      return;
    }

    const baseY = Phaser.Math.Between(ROAD_TOP+22, ROAD_BOTTOM-22);
    const count = type === 'common' && Math.random() < 0.25 ? Phaser.Math.Between(2,3) : 1;
    for (let i = 0; i < count; i++) {
      const y = Phaser.Math.Clamp(baseY + i*28*(Math.random()>0.5?1:-1), ROAD_TOP+22, ROAD_BOTTOM-22);
      const z = this.zombies.create(this.designW+30+i*20, y, `zombie_${type}`) as Phaser.Physics.Arcade.Sprite;
      z.setScale(stats.scale / OVERSAMPLE).setData('hp', stats.hp).setData('type', type);
      z.setData('rockPhase', Math.random() * 6.28);
      z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9).setBodySize(20,28);
      z.play(`walk_${type}`); z.anims.setProgress(Math.random());
    }
  }

  private spawnGiant() {
    const z = this.zombies.create(this.designW + 60, ROAD_CENTER, 'zombie_giant') as Phaser.Physics.Arcade.Sprite;
    z.setScale(ZOMBIE_STATS.giant.scale / OVERSAMPLE).setData('hp', ZOMBIE_STATS.giant.hp).setData('type', 'giant');
    z.setData('rockPhase', Math.random() * 6.28);
    z.setVelocityX(-(ZOMBIE_STATS.giant.speed + SCROLL_SPEED)).setDepth(9).setBodySize(38,50);
    z.play('walk_giant'); z.anims.setProgress(Math.random());
    const warn = Ui.text(this, this.designW - 60, H/2, '⚠ GIGANTE!', {
      fontSize: '22px', color: '#ff4400', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: warn, alpha: 0, y: H/2 - 50, duration: 1600, onComplete: () => warn.destroy() });
  }

  private spawnFuelCan() {
    if (!this.alive || this.missionDone) return;
    const f = this.fuelCans.create(this.designW+20, Phaser.Math.Between(ROAD_TOP+22, ROAD_BOTTOM-22), 'fuel_can') as Phaser.Physics.Arcade.Sprite;
    // Texture sovracampionata (OS_G) → torna a scala design; hitbox invariata (frame×scala = 22×26).
    f.setVelocityX(-SCROLL_SPEED).setDepth(6).setScale(1 / OVERSAMPLE);
  }

  private fireWeapon() {
    const w = WEAPONS[this.currentWeapon];
    const vx = this.vehicle.x + 50, vy = this.vehicle.y;
    switch (this.currentWeapon) {
      case 'mg':
      case 'rifle':
        this.spawnBullet(vx, vy, w.damage, w.speed, w.color, this.designW + 40);
        break;
      case 'double_mg':
        // Due linee distanziate (±14) per coprire più corsia — vedi BALANCE §7.
        this.spawnBullet(vx, vy - 14, w.damage, w.speed, w.color, this.designW + 40);
        this.spawnBullet(vx, vy + 14, w.damage, w.speed, w.color, this.designW + 40);
        break;
      case 'flamethrower':
        // Danno derivato dalla tabella WEAPONS (non più cablato a 1) → ribilanciabile da BALANCE §7.
        this.spawnBullet(vx, vy + Phaser.Math.Between(-6, 6), w.damage, w.speed, w.color, vx - 50 + w.range);
        break;
      case 'rockets':
        this.spawnRocket(vx, vy);
        break;
    }
    if (this.currentWeapon !== 'flamethrower') Juice.muzzleFlash(this, vx, vy, w.color);
    this.sfx?.playShot();
  }

  private spawnBullet(x: number, y: number, damage: number, speed: number, color: number, maxX: number) {
    const b = this.bullets.create(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite;
    // Texture sovracampionata (OS_G) → torna a scala design; hitbox auto = 18×5 invariata.
    b.setScale(1 / OVERSAMPLE).setVelocityX(speed).setDepth(8).setTint(color);
    b.setData('damage', damage);
    b.setData('maxX', maxX);
  }

  private spawnRocket(x: number, y: number) {
    const r = this.rockets.create(x, y, 'rocket') as Phaser.Physics.Arcade.Sprite;
    r.setScale(1 / OVERSAMPLE).setVelocityX(WEAPONS.rockets.speed).setDepth(8);
    // body in unità design: source ×OVERSAMPLE compensa lo scale 1/OVERSAMPLE → 22×8.
    (r.body as Phaser.Physics.Arcade.Body).setSize(22 * OVERSAMPLE, 8 * OVERSAMPLE);
  }

  private fireAutoShot(y: number) {
    this.spawnBullet(this.vehicle.x + 50, y, 1, BULLET_SPEED, 0x00ffff, this.designW + 40);
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

  private onBulletHitZombie(bullet: Phaser.Physics.Arcade.Sprite, zombie: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !zombie.active) return;
    const dmg = (bullet.getData('damage') as number) ?? 1;
    bullet.destroy();
    const type = zombie.getData('type') as ZombieType;
    if (type === 'armored') this.emitSparks(zombie.x, zombie.y);
    const hp   = (zombie.getData('hp') as number) - dmg;
    if (hp <= 0) {
      this.addKillScore(ZOMBIE_STATS[type].score);
      this.killBurst(type, zombie.x, zombie.y);
      this.environment?.addDecal('blood', zombie.x, zombie.y);
      this.sfx?.playZombieKill();
      if (type === 'toxic') this.spawnToxicCloud(zombie.x, zombie.y);
      if (type === 'giant') this.cameras.main.shake(200, 0.012); // il burst gore del gigante è già più ricco (n=10)
      zombie.destroy();
    } else {
      zombie.setData('hp', hp);
      zombie.setTint(0xffffff);
      this.time.delayedCall(80, () => { if (zombie?.active) zombie.clearTint(); });
    }
  }

  private onVehicleHitZombie(zombie: Phaser.Physics.Arcade.Sprite) {
    if (!zombie.active) return;
    const type = zombie.getData('type') as ZombieType;

    switch (type) {
      case 'runner':
        zombie.destroy();
        this.damageComponent('armor', 10);
        this.dealDamage(ZOMBIE_STATS.runner.damage);
        this.cameras.main.shake(80, 0.005);
        this.sfx?.playImpact();
        this.environment?.addDecal('skid', zombie.x, zombie.y);
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

      case 'armored':
        zombie.destroy();
        this.damageComponent('armor', 18);
        this.damageComponent('engine', 8);
        this.dealDamage(ZOMBIE_STATS.armored.damage);
        this.cameras.main.shake(200, 0.014);
        this.sfx?.playImpact();
        this.environment?.addDecal('skid', zombie.x, zombie.y);
        this.environment?.addDecal('debris', zombie.x, zombie.y);
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

      case 'giant': {
        const gx = zombie.x, gy = zombie.y;
        this.addKillScore(ZOMBIE_STATS.giant.score); // speronarlo lo uccide → premia come ucciderlo a colpi (X5)
        zombie.destroy();
        this.damageComponent('armor', 30);
        this.damageComponent('engine', 20);
        this.damageComponent('wheels', 20);
        this.dealDamage(ZOMBIE_STATS.giant.damage);
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
          this.dealDamage(ZOMBIE_STATS.jumper.damage);
          this.damageComponent('turret', 15);
          this.sfx?.playImpact();
        }
        break;

      case 'toxic':
        zombie.destroy();
        this.spawnToxicCloud(zombie.x, zombie.y);
        this.dealDamage(ZOMBIE_STATS.toxic.damage);
        this.damageComponent('armor', 8);
        this.sfx?.playImpact();
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

      default: // common
        if (this.attachedZombies.length < ATTACH_SLOTS.length) {
          this.attachZombie(zombie, false);
        } else {
          zombie.destroy();
          this.dealDamage(ZOMBIE_STATS.common.damage);
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
    if (this.debugGod || this.boss.defeated) return; // invulnerabile durante la celebrazione di vittoria
    const comp = this.components[key];
    comp.health = Math.max(0, comp.health - amount);
    if (key === 'engine' && comp.health <= 0) this.endGame('Motore distrutto!');
  }

  dealDamage(amount: number) {
    if (this.debugGod || this.boss.defeated) return; // invulnerabile durante la celebrazione di vittoria (X4)
    const armorPct = this.components.armor.health / 100;
    const bonus = this.vehicleArmorBonus / 100;
    const base  = armorPct<=0 ? 2.5 : armorPct<0.3 ? 1.8 : armorPct<0.6 ? 1.3 : 1.0;
    const mult  = Math.max(0.5, base - bonus);
    const dealt = Math.round(amount * mult);
    this.health = Math.max(0, this.health - dealt);
    this.hud.flashHealthBar();
    if (this.health <= 0) this.endGame('Veicolo distrutto!');
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
    return 230 * this.vehicleSpeedMult * w * a;
  }

  private getEffectiveCooldown(): number {
    if (this.components.turret.health <= 0) return 99999;
    const base = WEAPONS[this.currentWeapon].cooldown;
    return (base / this.vehicleFireMult) * (1 + (1 - this.components.turret.health/100) * 1.4);
  }

  private getEffectiveFuelDrain(): number {
    return BASE_FUEL_DRAIN * (1 + (1 - this.components.tank.health / 100) * 2);
  }

  // ─── Mission complete ────────────────────────────────────────────────────────

  /** Distrugge gli zombi aggrappati e svuota l'array: niente sprite orfani né timer pendenti a fine run (X3). */
  private clearAttachedZombies() {
    this.attachedZombies.forEach(az => az.sprite.destroy());
    this.attachedZombies = [];
  }

  triggerMissionComplete() {
    if (this.missionDone) return;
    this.missionDone = true;

    const earned = Math.floor(this.score / 8);
    this.registry.set('money',         (this.registry.get('money') ?? 0) + earned);
    this.registry.set('missionNumber', (this.registry.get('missionNumber') ?? 1) + 1);
    this.registry.set('lastScore',     this.score);
    this.registry.set('components', {
      engine: this.components.engine.health,
      wheels: this.components.wheels.health,
      tank:   this.components.tank.health,
      turret: this.components.turret.health,
      armor:  this.components.armor.health,
    });

    this.sfx?.playMissionComplete();
    this.sfx?.stopEngine();
    this.zombies.setVelocityX(0);
    this.fuelCans.setVelocityX(0);
    this.clearAttachedZombies();

    const cx = this.designW/2, cy = H/2;
    Ui.box(this, cx,cy,500,260,{ fill:UI.black, fillAlpha:0.9, radius:16, stroke:UI.greenSig, strokeAlpha:0.45 }).setDepth(30);
    Ui.text(this, cx,cy-95,'MISSIONE COMPLETATA!',{
      fontSize:'32px', color:UI.green, fontStyle:'bold',
      stroke:'#006600', strokeThickness:4,
    }).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy-48,`Punteggio: ${this.score}`,{fontSize:'20px',color:UI.white}).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy-14,`Distanza: ${Math.floor(this.distance/100)} km`,{fontSize:'16px',color:UI.blueInfo}).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy+20,`Monete guadagnate: +${earned}`,{fontSize:'18px',color:UI.gold}).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy+55,`Totale: ${(this.registry.get('money') ?? 0)}`,{fontSize:'15px',color:UI.goldDim}).setOrigin(0.5).setDepth(31);
    Ui.text(this, cx,cy+82,'[ SPAZIO ] per il negozio',{fontSize:'13px',color:UI.faint}).setOrigin(0.5).setDepth(31);
    this.addMenuReturn(cx, cy+108);

    this.time.delayedCall(600, () => {
      this.input.keyboard?.once('keydown-SPACE', () => Juice.go(this, 'ShopScene'));
      this.input.keyboard?.once('keydown-M', () => Juice.go(this, 'MenuScene'));
    });
  }

  /** Voce cliccabile "Torna al menu" per le schermate di fine partita. */
  private addMenuReturn(x: number, y: number) {
    const t = Ui.text(this, x, y, '[ M ]  Torna al menu', {
      fontSize: '13px', color: '#7788aa',
    }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#aaccff'));
    t.on('pointerout',  () => t.setColor('#7788aa'));
    t.on('pointerdown', () => Juice.go(this, 'MenuScene'));
  }

  // ─── Game over ───────────────────────────────────────────────────────────────

  private endGame(reason: string) {
    if (!this.alive) return;
    this.alive = false;

    // Reset tutto al game over (default centralizzati in RunState).
    resetRunState(this.registry);

    this.sfx?.playGameOver();
    this.sfx?.stopEngine();
    this.vehicle.setTint(0xff2200);
    this.cameras.main.shake(500, 0.018);
    this.zombies.setVelocityX(0);
    this.bullets.setVelocityX(0);
    this.fuelCans.setVelocityX(0);
    this.boss.projectiles.setVelocityX(0); // niente proiettili boss sospesi sopra l'overlay (X9)
    this.boss.group.setVelocityX(0);
    this.clearAttachedZombies(); // niente sprite/timer orfani sul veicolo congelato (X3)

    this.time.delayedCall(700, () => {
      const cx = this.designW/2, cy = H/2;
      Ui.box(this, cx,cy,440,260,{ fill:UI.black, fillAlpha:0.88, radius:16, stroke:UI.redCrit, strokeAlpha:0.55 }).setDepth(30);
      Ui.text(this, cx,cy-80,'GAME OVER',{
        fontSize:'50px', color:'#ff3333', fontStyle:'bold',
        stroke:'#880000', strokeThickness:5,
      }).setOrigin(0.5).setDepth(31);
      Ui.text(this, cx,cy-28,reason,{fontSize:'16px',color:UI.redSoft}).setOrigin(0.5).setDepth(31);
      Ui.text(this, cx,cy+10,`Punteggio: ${this.score}`,{fontSize:'22px',color:UI.white}).setOrigin(0.5).setDepth(31);
      Ui.text(this, cx,cy+44,`Distanza: ${Math.floor(this.distance/100)} km`,{fontSize:'16px',color:UI.blueInfo}).setOrigin(0.5).setDepth(31);
      Ui.text(this, cx,cy+78,'[ SPAZIO ] per ricominciare',{fontSize:'14px',color:UI.faint}).setOrigin(0.5).setDepth(31);
      this.addMenuReturn(cx, cy+104);
      this.input.keyboard?.once('keydown-M', () => Juice.go(this, 'MenuScene'));
    });
  }

  // ─── Boss system ─────────────────────────────────────────────────────────────

  spawnZombieAt(type: ZombieType, x: number, y: number) {
    const stats = ZOMBIE_STATS[type];
    const z = this.zombies.create(
      x, Phaser.Math.Clamp(y, ROAD_TOP + 22, ROAD_BOTTOM - 22), `zombie_${type}`
    ) as Phaser.Physics.Arcade.Sprite;
    z.setScale(stats.scale / OVERSAMPLE).setData('hp', stats.hp).setData('type', type);
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
  }
}
