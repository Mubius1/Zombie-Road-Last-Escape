import Phaser from 'phaser';
import { VEHICLES, Upgrades, WeaponType, WEAPONS, WEAPON_KEYS } from '../GameData';
import SoundManager from '../SoundManager';
import Juice from '../Juice';
import Environment from '../Environment';
import Settings from '../Settings';
import Ui, { UI } from '../Ui';

const W = 800, H = 600;
const ROAD_TOP = 155, ROAD_BOTTOM = 445, ROAD_CENTER = 300;
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
// Colore del moltiplicatore combo per livello (×1..×5) — toni funzionali UI
const COMBO_COLORS = [UI.muted, UI.gold, UI.amber, UI.redText, UI.red];

export type BossType = 'mega_mutant' | 'giant_worm' | 'armored_colossus' | 'radioactive_beast';

export interface BossConfig {
  name: string; hp: number; speed: number; scaleX: number; scaleY: number;
  tint: number; bodyW: number; bodyH: number; reward: number;
}

export const BOSS_CONFIG: Record<BossType, BossConfig> = {
  mega_mutant:       { name: 'Mega Mutante',      hp: 80,  speed: 55, scaleX: 2.8, scaleY: 2.8, tint: 0x22cc22, bodyW: 48, bodyH: 66, reward: 400 },
  giant_worm:        { name: 'Verme Gigante',      hp: 110, speed: 40, scaleX: 3.8, scaleY: 1.8, tint: 0xcc8822, bodyW: 80, bodyH: 38, reward: 500 },
  armored_colossus:  { name: 'Colosso Corazzato',  hp: 150, speed: 28, scaleX: 3.0, scaleY: 3.2, tint: 0x7788aa, bodyW: 52, bodyH: 70, reward: 650 },
  radioactive_beast: { name: 'Bestia Radioattiva', hp: 95,  speed: 50, scaleX: 2.6, scaleY: 2.6, tint: 0x88ff22, bodyW: 50, bodyH: 58, reward: 450 },
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

type ZombieType = 'common' | 'runner' | 'armored' | 'jumper' | 'giant' | 'toxic';
type ComponentKey = 'engine' | 'wheels' | 'tank' | 'turret' | 'armor';

interface ZombieStats { speed: number; hp: number; scale: number; damage: number; score: number; }
interface ComponentData { health: number; label: string; baseColor: number; fill?: Phaser.GameObjects.Rectangle; }
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

export default class GameScene extends Phaser.Scene {
  private vehicle!: Phaser.Physics.Arcade.Sprite;
  private zombies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private fuelCans!: Phaser.Physics.Arcade.Group;
  private toxicClouds!: Phaser.Physics.Arcade.Group;

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

  private hudHealthFill!: Phaser.GameObjects.Rectangle;
  private hudFuelFill!: Phaser.GameObjects.Rectangle;
  private hudDistFill!: Phaser.GameObjects.Rectangle;
  private hudScore!: Phaser.GameObjects.Text;
  private hudDist!: Phaser.GameObjects.Text;
  private hudFuelNum!: Phaser.GameObjects.Text;
  private hudAttached!: Phaser.GameObjects.Text;

  private currentWeapon: WeaponType = 'mg';
  private ownedWeapons: WeaponType[] = ['mg'];
  private rockets!: Phaser.Physics.Arcade.Group;
  private hudWeapon!: Phaser.GameObjects.Text;
  private hudCombo!: Phaser.GameObjects.Text;
  private hudDash!: Phaser.GameObjects.Text;
  private weaponSlots: { key: WeaponType; txt: Phaser.GameObjects.Text }[] = [];

  private sfx: SoundManager | null = null;
  private grain: Phaser.GameObjects.TileSprite | null = null;
  private environment: Environment | null = null;
  private frozen = false;

  // Boss system
  private bossActive = false;
  private bossSpawned = false;
  private bossSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private bossMaxHp = 0;
  private bossGroup!: Phaser.Physics.Arcade.Group;
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private bossHudObjects: Phaser.GameObjects.GameObject[] = [];
  private bossHudFill?: Phaser.GameObjects.Rectangle;

  // Debug
  private debugGod = false;
  private hudDebug?: Phaser.GameObjects.Text;

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

  constructor() { super({ key: 'GameScene' }); }

  create() {
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
    this.bossActive = false;
    this.bossSpawned = false;
    this.bossSprite = null;
    this.bossHudObjects = [];
    this.bossHudFill = undefined;

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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sfx?.stopEngine());

    // Ritorno dalle impostazioni (pausa ESC): riallinea il volume e riavvia il motore.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.sfx?.setVolume(Settings.volume);
      this.sfx?.startEngine();
    });

    // Juice: overlay filmico (opzionale) + entrata in dissolvenza
    this.frozen = false;
    this.grain = Settings.screenFx ? Juice.addOverlay(this) : null;
    Juice.fadeIn(this);
  }

  update(time: number, delta: number) {
    if (!this.alive || this.missionDone) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) Juice.fadeAndRun(this, () => this.scene.restart());
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
    this.updateBoss(delta);
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
    GameScene.buildVehicleTexture(this, this.vehicleKey);
    GameScene.buildEntityTextures(this);
  }

  static buildEntityTextures(scene: Phaser.Scene) {
    if (scene.textures.exists('zombie_common')) return;
    const G = (_w: number, _h: number) => scene.make.graphics({ add: false } as any) as Phaser.GameObjects.Graphics & { generateTexture(k:string,w:number,h:number):void };
    // Aggiunge N frame numerati (0..n-1) a una texture spritesheet generata
    const AF = (key: string, fw: number, fh: number, n: number) => {
      const t = scene.textures.get(key);
      for (let i = 0; i < n; i++) t.add(i, 0, i * fw, 0, fw, fh);
    };

    // ── ZOMBIE COMMON · "Il Collo Rotto" (30×44 × 3) ───────────────────────────
    {
      const g = G(90,44);
      const flA=0x6f7d54, flHi=0x8a9668, flSh=0x444c33, livid=0x5a4e63;
      const musc=0x6e2a26, muscHi=0x9a3a2e, bone=0xd9cba6;
      const shA=0x3b4156, shHi=0x4d5570, shSh=0x282c3c, pants=0x34322b, eye=0xff2a10;
      for (let f = 0; f < 3; f++) {
        const ox = f * 30, ph = f - 1; const X = (x: number) => ox + x;
        // ombra + scarpe + gambe (passo alternato)
        g.fillStyle(0x000000,0.28); g.fillEllipse(X(15),42,22,6);
        g.fillStyle(0x191510); g.fillEllipse(X(10-ph),40+ph,9,5); g.fillEllipse(X(20+ph),39-ph,9,5);
        g.fillStyle(pants);
        g.fillRoundedRect(X(8-ph),27+ph*2,6,13-ph,3);
        g.fillRoundedRect(X(16+ph),26-ph*2,6,14+ph,3);
        // chiazze di livor mortis sulle gambe
        g.fillStyle(livid,0.7); g.fillEllipse(X(11-ph),34,4,6); g.fillEllipse(X(19+ph),33,4,5);
        // braccio DESTRO penzolante (lussato, lungo il fianco)
        g.fillStyle(flSh); g.fillRoundedRect(X(22),16,5,16,2);
        g.fillStyle(flA);  g.fillRoundedRect(X(22),16,4,15,2);
        g.fillStyle(flA);  g.fillCircle(X(24),33,3);
        g.fillStyle(flHi); g.fillTriangle(X(22),35,X(24),38,X(26),35);
        // braccio SINISTRO proteso (controfase col passo)
        const laY=16+ph*2;
        g.fillStyle(flSh); g.fillRoundedRect(X(1),laY,8,5,2);
        g.fillStyle(flA);  g.fillRoundedRect(X(1),laY,7,4,2);
        g.fillStyle(flHi); g.fillRect(X(2),laY,5,1);
        g.fillStyle(flA);  g.fillCircle(X(1),laY+2,3);
        g.fillStyle(0x9aae86); g.fillTriangle(X(-1),laY-1,X(-3),laY,X(-1),laY+2);
        // torso: brandelli di maglietta (bordo strappato a triangoli)
        g.fillStyle(shSh); g.fillRoundedRect(X(7),14,16,15,5);
        g.fillStyle(shA);  g.fillRoundedRect(X(8),15,14,12,4);
        g.fillStyle(shSh); [9,12,15,18].forEach(x=>g.fillTriangle(X(x),26,X(x+3),26,X(x+1.5),30));
        g.fillStyle(shHi); g.fillRoundedRect(X(9),16,5,6,2);
        // squarcio: muscolo vivo + costola d'osso
        g.fillStyle(musc);   g.fillEllipse(X(15),25,9,6);
        g.fillStyle(muscHi); g.fillEllipse(X(14),24,4,2);
        g.fillStyle(bone);   [12,15,18].forEach(x=>g.fillRect(X(x),22,1,6));
        g.fillStyle(0x4a0e0e); g.fillEllipse(X(17),26,3,3);
        // collo slanciato → testa che PENDE a destra (collo rotto)
        g.fillStyle(flSh); g.fillRoundedRect(X(14),9,8,7,3);
        g.fillStyle(flA);  g.fillCircle(X(19),8,7); g.fillEllipse(X(20),11,11,8);
        g.fillStyle(flHi); g.fillEllipse(X(16),5,6,5);
        g.fillStyle(flSh); g.fillEllipse(X(23),11,5,6);
        g.fillStyle(livid,0.6); g.fillEllipse(X(22),9,4,5);
        g.fillStyle(0x241c12); g.fillEllipse(X(18),3,12,6); g.fillTriangle(X(12),4,X(14),10,X(15),4);
        // occhiaie + occhi rossi + bocca storta + denti + bava
        g.fillStyle(0x2a2418); g.fillEllipse(X(16),8,5,4); g.fillEllipse(X(23),8,4,4);
        g.fillStyle(eye); g.fillEllipse(X(16),8,2.6,2.2); g.fillEllipse(X(23),8,2.4,2);
        g.fillStyle(0xffc7a0); g.fillCircle(X(15),7,1); g.fillCircle(X(22),7,1);
        g.fillStyle(0x2a0a0a); g.fillEllipse(X(20),13,7,3);
        g.fillStyle(bone); [17,20,23].forEach(x=>g.fillTriangle(X(x),12,X(x+2),12,X(x+1),14));
        g.fillStyle(0x88aa66,0.6); g.fillRect(X(20),14,1,6);
      }
      g.generateTexture('zombie_common',90,44); AF('zombie_common',30,44,3); g.destroy();
    }

    // ── ZOMBIE RUNNER · "Lo Scorticato" (26×42 × 3) ────────────────────────────
    {
      const g = G(78,42);
      const sk=0xb3a48f, skHi=0xcabba6, skSh=0x7d705e;
      const abr=0x7a2e22, abrHi=0xa8412e, rag=0x55303a, bone=0xd9cba6, eye=0xff6410;
      for (let f = 0; f < 3; f++) {
        const ox = f * 26, ph = f - 1; const X = (x: number) => ox + x;
        g.fillStyle(0x000000,0.22); g.fillEllipse(X(13),40,18,5);
        // gamba posteriore (spinta indietro)
        g.fillStyle(skSh); g.fillRoundedRect(X(2+ph*3),24+ph*3,5,14-ph,2);
        g.fillStyle(sk);   g.fillRoundedRect(X(2+ph*3),24+ph*3,4,12-ph,2);
        g.fillStyle(0x191510); g.fillEllipse(X(3+ph*3),38+ph,7,4);
        // gamba anteriore (slancio avanti)
        g.fillStyle(skSh); g.fillRoundedRect(X(15-ph*3),22-ph*3,5,15+ph,2);
        g.fillStyle(sk);   g.fillRoundedRect(X(15-ph*3),22-ph*3,4,13+ph,2);
        g.fillStyle(skHi); g.fillRect(X(16-ph*3),24-ph*3,2,7);
        g.fillStyle(0x191510); g.fillEllipse(X(18-ph*3),37-ph,8,4);
        // abrasione sulla coscia (raschiatura da asfalto)
        g.fillStyle(abr); g.fillEllipse(X(16-ph*2),27,3,5);
        g.fillStyle(abrHi); g.fillEllipse(X(16-ph*2),26,1.5,2);
        // braccio posteriore
        const baY = 18+ph*3;
        g.fillStyle(skSh); g.fillRoundedRect(X(-3),baY,11,4,2);
        g.fillStyle(sk);   g.fillCircle(X(-2),baY+2,3);
        // torso magro + costole + abrasione spalla
        g.fillStyle(rag);   g.fillRoundedRect(X(7),12,12,14,4);
        g.fillStyle(0x44262e); g.fillRoundedRect(X(8),13,5,8,2);
        g.fillStyle(sk);   g.fillEllipse(X(13),22,9,6);
        g.fillStyle(skSh); g.fillRect(X(9),20,8,1); g.fillRect(X(9),22,8,1); g.fillRect(X(10),24,6,1);
        g.fillStyle(abr);  g.fillEllipse(X(11),15,4,3); g.fillStyle(abrHi); g.fillEllipse(X(11),14,2,1.4);
        // braccio anteriore proteso ad artiglio
        const aaY = 13-ph*3;
        g.fillStyle(skSh); g.fillRoundedRect(X(18),aaY,9,4,2);
        g.fillStyle(sk);   g.fillRoundedRect(X(18),aaY,8,3,2);
        g.fillStyle(skHi); g.fillRect(X(19),aaY,6,1);
        g.fillStyle(sk);   g.fillCircle(X(26),aaY+2,3);
        g.fillStyle(0xcabba6);
        g.fillTriangle(X(27),aaY-1,X(29),aaY-1,X(27),aaY+2);
        g.fillTriangle(X(27),aaY+2,X(29),aaY+3,X(27),aaY+5);
        // collo teso + testa protesa, angolosa
        g.fillStyle(skSh); g.fillRoundedRect(X(11),7,7,6,2);
        g.fillStyle(sk);   g.fillEllipse(X(14),6,13,10);
        g.fillStyle(skHi); g.fillEllipse(X(12),4,6,5);
        g.fillStyle(skSh); g.fillEllipse(X(18),8,5,6);
        g.fillStyle(0x2a221a); g.fillEllipse(X(13),2,10,4);
        // occhi arancio brucianti (faro) + bocca spalancata che ringhia
        g.fillStyle(0x1a0e00); g.fillEllipse(X(10),6,5,4); g.fillEllipse(X(18),6,5,4);
        g.fillStyle(eye); g.fillEllipse(X(10),6,3,2.4); g.fillEllipse(X(18),6,3,2.4);
        g.fillStyle(0xffd28a); g.fillCircle(X(9),5,1.1); g.fillCircle(X(17),5,1.1);
        g.fillStyle(0x1a0000); g.fillEllipse(X(14),11,8,5);
        g.fillStyle(bone);
        [9,12,15,18].forEach(x => g.fillTriangle(X(x),9,X(x+2),9,X(x+1),12));
        [10,13,16].forEach(x => g.fillTriangle(X(x),14,X(x+2),14,X(x+1),11));
        g.fillStyle(abr); g.fillRect(X(14),13,2,4);
      }
      g.generateTexture('zombie_runner',78,42); AF('zombie_runner',26,42,3); g.destroy();
    }

    // ── ZOMBIE ARMORED · "Il Tutore" (38×48 × 3) ───────────────────────────────
    {
      const g = G(114,48);
      const st=0x5f6b78, stHi=0x8a97a5, stSh=0x39424c, stDD=0x20262c;
      const rustT=0x8a4a26, rustB=0x3a1d0e, verd=0x3f6b54, bloodOx=0x2a1410;
      const flesh=0x5a4e63, eye=0xffcc22;
      for (let f = 0; f < 3; f++) {
        const ox = f * 38, ph = f - 1; const X = (x: number) => ox + x;
        g.fillStyle(0x000000,0.35); g.fillEllipse(X(19),46,30,6);
        // stivali + gambe (marcia minima, pesante)
        g.fillStyle(0x16181c); g.fillEllipse(X(12-ph),43,12,7); g.fillEllipse(X(26+ph),43,12,7);
        g.fillStyle(stSh); g.fillRoundedRect(X(8-ph),28+ph,11,15,3); g.fillRoundedRect(X(20+ph),28-ph,11,15,3);
        g.fillStyle(st);   g.fillRoundedRect(X(9-ph),29+ph,9,12,3); g.fillRoundedRect(X(21+ph),29-ph,9,12,3);
        g.fillStyle(verd,0.6); g.fillRect(X(9-ph),38,9,2); g.fillRect(X(21+ph),38,9,2);
        // braccio destro + guanto
        g.fillStyle(stSh); g.fillRoundedRect(X(30),20-ph,9,7,3);
        g.fillStyle(st);   g.fillRoundedRect(X(31),20-ph,8,5,2);
        g.fillStyle(stDD); g.fillCircle(X(39),24-ph,4);
        // corazza pettorale + sangue ossidato
        g.fillStyle(stDD); g.fillRoundedRect(X(9),13,22,18,6);
        g.fillStyle(st);   g.fillRoundedRect(X(10),14,20,16,5);
        g.fillStyle(stHi); g.fillRoundedRect(X(12),15,8,6,3);
        g.fillStyle(stSh); g.fillRect(X(11),22,18,1); g.fillRect(X(20),14,1,16);
        g.fillStyle(bloodOx,0.8); g.fillEllipse(X(23),25,6,4);
        // rivetti con colature di RUGGINE che scendono
        const rivets: [number, number][] = [[12,16],[28,16],[12,28],[28,28]];
        rivets.forEach(([x,y]) => { g.fillStyle(rustT,0.7); g.fillRect(X(x),y,2,8); g.fillStyle(rustB,0.7); g.fillRect(X(x),y+5,2,4); });
        g.fillStyle(0xb8c6d4); rivets.forEach(([x,y]) => g.fillCircle(X(x+1),y,1.3));
        // spallaccio destro (cupola)
        g.fillStyle(stSh); g.fillEllipse(X(32),16,11,10);
        g.fillStyle(st);   g.fillEllipse(X(32),15,8,7);
        g.fillStyle(stHi); g.fillEllipse(X(30),13,4,3);
        // collo (carne marcia) + casco (verderame sui bordi)
        g.fillStyle(flesh); g.fillRoundedRect(X(15),9,10,6,2);
        g.fillStyle(stDD); g.fillEllipse(X(20),7,24,15);
        g.fillStyle(st);   g.fillEllipse(X(20),6,21,13);
        g.fillStyle(stHi); g.fillEllipse(X(15),2,8,5);
        g.fillStyle(verd,0.5); g.fillEllipse(X(28),9,5,6);
        // visiera scura + occhi gialli dietro
        g.fillStyle(0x0a1118); g.fillRoundedRect(X(10),7,21,7,3);
        g.fillStyle(0x1c3550,0.7); g.fillRoundedRect(X(11),8,19,3,2);
        g.fillStyle(eye); g.fillEllipse(X(15),10,4,2.4); g.fillEllipse(X(26),10,4,2.4);
        g.fillStyle(0xffffcc); g.fillCircle(X(14),10,1); g.fillCircle(X(25),10,1);
        // griglia bocca
        g.fillStyle(stDD); g.fillRoundedRect(X(14),14,13,5,2);
        g.fillStyle(0x14181e); [15,18,21,24].forEach(x => g.fillRect(X(x),15,2,4));
        // SCUDO antisommossa sul braccio sinistro (gancio silhouette)
        g.fillStyle(stDD); g.fillRoundedRect(X(-2),12,9,28,4);
        g.fillStyle(stSh); g.fillRoundedRect(X(-1),13,7,26,4);
        g.fillStyle(st);   g.fillRoundedRect(X(0),15,4,22,3);
        g.fillStyle(stHi); g.fillRect(X(1),17,2,10);
        g.fillStyle(bloodOx,0.7); g.fillEllipse(X(3),24,3,5);
        g.fillStyle(verd,0.5); g.fillRect(X(0),36,5,2);
      }
      g.generateTexture('zombie_armored',114,48); AF('zombie_armored',38,48,3); g.destroy();
    }

    // ── ZOMBIE JUMPER · "Il Ragno" (32×46 × 3) ─────────────────────────────────
    {
      const g = G(96,46);
      const sk=0x9aa83e, skHi=0xc2d05a, skSh=0x5f6a22, joint=0x20240e;
      const tend=0xd8e08a, eye=0xfff000, claw=0xe8e0c0, blood=0x7a2e22;
      for (let f = 0; f < 3; f++) {
        const ox = f * 32, ph = f - 1; const X = (x: number) => ox + x;
        const bY = ph * 2;
        g.fillStyle(0x000000,0.3); g.fillEllipse(X(16),44,22,5);
        // cosce (compressione a molla nel frame centrale)
        const thH = 9 - Math.abs(ph)*2;
        g.fillStyle(skSh); g.fillRoundedRect(X(5),23+bY,8,thH,4); g.fillRoundedRect(X(19),23+bY,8,thH,4);
        g.fillStyle(sk);   g.fillEllipse(X(8),26+bY,6,thH-2); g.fillEllipse(X(24),26+bY,6,thH-2);
        // ginocchia annerite (lettura "insetto")
        g.fillStyle(joint); g.fillCircle(X(7),30+bY,2.4); g.fillCircle(X(25),30+bY,2.4);
        // stinchi + tendini esposti
        g.fillStyle(skSh); g.fillRoundedRect(X(3),30+bY,7,11,3); g.fillRoundedRect(X(22),30+bY,7,11,3);
        g.fillStyle(sk);   g.fillRoundedRect(X(3),30+bY,5,9,3); g.fillRoundedRect(X(22),30+bY,5,9,3);
        g.fillStyle(tend); g.fillRect(X(4),31+bY,1,7); g.fillRect(X(26),31+bY,1,7);
        // piedi artigliati
        g.fillStyle(skSh); g.fillEllipse(X(5),41,9,4); g.fillEllipse(X(27),41,9,4);
        g.fillStyle(claw);
        [1,4,7].forEach(x => g.fillTriangle(X(x),42,X(x+2),42,X(x+1),45));
        [23,26,29].forEach(x => g.fillTriangle(X(x),42,X(x+2),42,X(x+1),45));
        // torso teso (addominali a tendine)
        g.fillStyle(skSh); g.fillEllipse(X(16),17+bY,15,15);
        g.fillStyle(sk);   g.fillEllipse(X(16),17+bY,13,13);
        g.fillStyle(skHi); g.fillEllipse(X(12),13+bY,6,6);
        g.fillStyle(tend); g.fillRect(X(11),18+bY,10,1); g.fillRect(X(12),21+bY,8,1);
        g.fillStyle(blood); g.fillEllipse(X(19),20+bY,4,3);
        // braccia alzate (gomiti scuri) + artigli
        const aY = 9+bY+ph*2;
        g.fillStyle(skSh); g.fillRoundedRect(X(-4),aY,12,5,2); g.fillRoundedRect(X(24),aY,12,5,2);
        g.fillStyle(joint); g.fillCircle(X(2),aY+2,2.2); g.fillCircle(X(30),aY+2,2.2);
        g.fillStyle(sk);   g.fillRoundedRect(X(-5),aY-4,6,8,3); g.fillRoundedRect(X(31),aY-4,6,8,3);
        g.fillStyle(skHi); g.fillRect(X(-4),aY-3,2,5); g.fillRect(X(32),aY-3,2,5);
        g.fillStyle(claw);
        [-6,-3,0].forEach(x => g.fillTriangle(X(x),aY-6,X(x+2),aY-6,X(x+1),aY-10));
        [32,35,38].forEach(x => g.fillTriangle(X(x),aY-6,X(x+2),aY-6,X(x+1),aY-10));
        // collo + testa
        g.fillStyle(skSh); g.fillRoundedRect(X(13),5+bY,6,6,2);
        g.fillStyle(sk);   g.fillEllipse(X(16),5+bY,14,11);
        g.fillStyle(skHi); g.fillEllipse(X(13),3+bY,7,6);
        g.fillStyle(skSh); g.fillEllipse(X(20),7+bY,6,6);
        // occhi giallo elettrico + ghigno con zanne
        g.fillStyle(0x222a00); g.fillEllipse(X(11),5+bY,5,4); g.fillEllipse(X(20),5+bY,5,4);
        g.fillStyle(eye); g.fillEllipse(X(11),5+bY,3,2.6); g.fillEllipse(X(20),5+bY,3,2.6);
        g.fillStyle(0xffffd0); g.fillCircle(X(10),4+bY,1); g.fillCircle(X(19),4+bY,1);
        g.fillStyle(0x1a1400); g.fillEllipse(X(16),10+bY,9,4);
        g.fillStyle(claw);
        [12,15,18].forEach(x => g.fillTriangle(X(x),8+bY,X(x+2),8+bY,X(x+1),11+bY));
        [13,16].forEach(x => g.fillTriangle(X(x),13+bY,X(x+2),13+bY,X(x+1),10+bY));
      }
      g.generateTexture('zombie_jumper',96,46); AF('zombie_jumper',32,46,3); g.destroy();
    }

    // ── ZOMBIE TOXIC · "Il Gonfio" (30×48 × 3) ─────────────────────────────────
    {
      const g = G(90,48);
      const sk=0x3f7a33, skHi=0x5fa84a, skSh=0x265020, vein=0x7dff4a;
      const ooze=0x6cff3a, oozeD=0x2cbb2a, sac=0x8fd86a, eye=0x9dff5a;
      for (let f = 0; f < 3; f++) {
        const ox = f * 30, ph = f - 1; const X = (x: number) => ox + x; const sw = ph;
        g.fillStyle(0x33ff33,0.08); g.fillCircle(X(15)+sw,24,21);
        g.fillStyle(0x004400,0.4);  g.fillEllipse(X(15)+sw,46,26,7);
        // piedi + gambe gonfie con vene
        g.fillStyle(skSh); g.fillEllipse(X(8-ph),44,9,5); g.fillEllipse(X(22+ph),44,9,5);
        g.fillStyle(skSh); g.fillEllipse(X(9-ph),36+ph,9,16); g.fillEllipse(X(21+ph),36-ph,9,16);
        g.fillStyle(sk);   g.fillEllipse(X(9-ph),35+ph,7,13); g.fillEllipse(X(21+ph),35-ph,7,13);
        g.fillStyle(vein,0.8); g.fillRect(X(8-ph),30,1,12); g.fillRect(X(22+ph),32,1,9);
        // torso gonfio
        g.fillStyle(skSh); g.fillEllipse(X(15)+sw,22,27,24);
        g.fillStyle(sk);   g.fillEllipse(X(15)+sw,22,24,21);
        g.fillStyle(skHi); g.fillEllipse(X(10)+sw,15,9,8);
        // vene emissive sul torso
        g.fillStyle(vein,0.7);
        g.fillRect(X(13)+sw,14,1,16); g.fillRect(X(13)+sw,22,8,1); g.fillRect(X(9)+sw,26,8,1);
        // pustole con nucleo luminoso
        const pus: [number, number, number][] = [[8,20,4],[21,28,3],[13,30,3]];
        pus.forEach(([x,y,r]) => {
          g.fillStyle(oozeD); g.fillCircle(X(x)+sw,y,r);
          g.fillStyle(ooze);  g.fillCircle(X(x)+sw,y,r*0.5);
          g.fillStyle(0xeaffd6); g.fillCircle(X(x-1)+sw,y-1,1);
        });
        // braccia colanti (oscillano inversamente)
        const laY=22+ph, raY=22-ph;
        g.fillStyle(skSh); g.fillEllipse(X(-2),laY,12,7); g.fillEllipse(X(32),raY,12,7);
        g.fillStyle(sk);   g.fillEllipse(X(-1),laY-1,9,5); g.fillEllipse(X(31),raY-1,9,5);
        g.fillStyle(skSh); g.fillCircle(X(-3),laY+2,4); g.fillCircle(X(33),raY+2,4);
        // SACCA tossica enorme sulla spalla destra (gancio silhouette)
        g.fillStyle(skSh); g.fillEllipse(X(24)+sw,11,16,15);
        g.fillStyle(sac);  g.fillEllipse(X(24)+sw,11,13,12);
        g.fillStyle(ooze,0.5); g.fillEllipse(X(24)+sw,12,8,7);
        g.fillStyle(0xeaffd6); g.fillEllipse(X(21)+sw,8,3,3);
        g.fillStyle(vein,0.7); g.fillRect(X(20)+sw,8,8,1); g.fillRect(X(24)+sw,5,1,12);
        // testa gonfia (inclinata verso la sacca)
        g.fillStyle(skSh); g.fillEllipse(X(13)+sw,7,20,15);
        g.fillStyle(sk);   g.fillEllipse(X(13)+sw,7,17,12);
        g.fillStyle(skHi); g.fillEllipse(X(9)+sw,3,7,6);
        g.fillStyle(skSh); g.fillRect(X(12)+sw,0,2,5);
        // occhi luminosi + bocca che cola
        g.fillStyle(0x062006); g.fillEllipse(X(9)+sw,7,6,5); g.fillEllipse(X(18)+sw,7,5,4);
        g.fillStyle(eye);   g.fillEllipse(X(9)+sw,7,3.5,3); g.fillEllipse(X(18)+sw,7,3,2.6);
        g.fillStyle(0xeaffd6); g.fillCircle(X(8)+sw,6,1.2); g.fillCircle(X(17)+sw,6,1);
        g.fillStyle(0x051a05); g.fillEllipse(X(13)+sw,13,10,5);
        g.fillStyle(ooze,0.85); g.fillEllipse(X(13)+sw,13,8,3);
        g.fillStyle(ooze,0.7); g.fillEllipse(X(11)+sw,17,2,4); g.fillEllipse(X(15)+sw,16,2,4);
      }
      g.generateTexture('zombie_toxic',90,48); AF('zombie_toxic',30,48,3); g.destroy();
    }

    // ── ZOMBIE GIANT · "L'Innesto" (48×66 × 3) — riusato dai boss ──────────────
    {
      const g = G(144,66);
      const sk=0x5a3a2e, skHi=0x7d5240, skSh=0x38241c, livid=0x4a3a52;
      const graft=0x5a5a3a, graftHi=0x7d7d50, graftSh=0x2a2a18;
      const sut=0x1e140e, stitch=0x8a7a60, bone=0xd9c8a0, blood=0x6e2a26, eye=0xff2a10;
      for (let f = 0; f < 3; f++) {
        const ox = f * 48, ph = f - 1; const X = (x: number) => ox + x;
        g.fillStyle(0x000000,0.4); g.fillEllipse(X(24),64,44,8);
        // piedi + gambe massicce (passo pesante)
        g.fillStyle(0x120c06); g.fillEllipse(X(13-ph*2),60,16,8); g.fillEllipse(X(35+ph*2),60,16,8);
        g.fillStyle(skSh); g.fillRoundedRect(X(6-ph*2),38+ph*2,16,22,7); g.fillRoundedRect(X(26+ph*2),38-ph*2,16,22,7);
        g.fillStyle(sk);   g.fillRoundedRect(X(7-ph*2),38+ph*2,13,20,6); g.fillRoundedRect(X(28+ph*2),38-ph*2,13,20,6);
        g.fillStyle(skHi); g.fillEllipse(X(12-ph*2),44+ph,5,11); g.fillEllipse(X(33+ph*2),44-ph,5,11);
        g.fillStyle(livid,0.6); g.fillEllipse(X(10),52,5,8);
        g.fillStyle(blood); g.fillEllipse(X(35),50,5,7);
        // braccio SINISTRO (carne normale)
        const laY=22+ph*2;
        g.fillStyle(skSh); g.fillEllipse(X(5),laY,18,14);
        g.fillStyle(sk);   g.fillEllipse(X(5),laY-1,14,11);
        g.fillStyle(skHi); g.fillEllipse(X(3),laY-4,6,5);
        g.fillStyle(skSh); g.fillEllipse(X(4),laY+8,13,12);
        g.fillStyle(sk);   g.fillEllipse(X(4),laY+8,10,10);
        // braccio DESTRO INNESTATO (più grosso, colore diverso, suture alla spalla)
        const raY=22-ph*2;
        g.fillStyle(graftSh); g.fillEllipse(X(43),raY,21,16);
        g.fillStyle(graft);   g.fillEllipse(X(43),raY-1,17,13);
        g.fillStyle(graftHi); g.fillEllipse(X(44),raY-4,7,5);
        g.fillStyle(graftSh); g.fillEllipse(X(44),raY+9,15,14);
        g.fillStyle(graft);   g.fillEllipse(X(44),raY+9,12,11);
        g.fillStyle(sut); g.fillRect(X(35),raY-6,1,15);
        g.fillStyle(stitch); [raY-5,raY-1,raY+3,raY+7].forEach(y => g.fillRect(X(33),y,5,1));
        // nocche
        g.fillStyle(skSh);   [1,4,7].forEach(x => g.fillCircle(X(x),laY+18,1.6));
        g.fillStyle(graftSh); [41,44,47].forEach(x => g.fillCircle(X(x),raY+18,1.6));
        // torso colossale + GOBBA (spalla destra rialzata)
        g.fillStyle(skSh); g.fillRoundedRect(X(3),15,42,26,10);
        g.fillStyle(sk);   g.fillRoundedRect(X(5),16,38,23,9);
        g.fillStyle(skSh); g.fillEllipse(X(38),13,16,12);
        g.fillStyle(sk);   g.fillEllipse(X(38),13,12,9);
        g.fillStyle(skHi); g.fillEllipse(X(15),21,12,8); g.fillEllipse(X(33),20,10,7);
        g.fillStyle(skSh); g.fillRect(X(24),18,1,20);
        // chiazze livide + suture sul torso
        g.fillStyle(livid,0.55); g.fillEllipse(X(13),30,8,6); g.fillEllipse(X(34),31,7,5);
        g.fillStyle(sut); g.fillRect(X(18),18,1,18);
        g.fillStyle(stitch); [20,24,28,32].forEach(y => g.fillRect(X(16),y,5,1));
        // pancia squarciata (costole + sangue)
        g.fillStyle(0x2e1a14); g.fillEllipse(X(24),33,18,9);
        g.fillStyle(bone); [16,20,24,28,32].forEach(x => g.fillRect(X(x),29,2,8));
        g.fillStyle(blood); g.fillEllipse(X(24),35,12,4);
        // collo + testa piccola e infossata
        g.fillStyle(skSh); g.fillRoundedRect(X(16),9,16,10,4);
        g.fillStyle(skSh); g.fillEllipse(X(23),6,26,14);
        g.fillStyle(sk);   g.fillEllipse(X(23),6,22,11);
        g.fillStyle(skHi); g.fillEllipse(X(17),2,9,6);
        // cresta ossea
        g.fillStyle(skSh); g.fillEllipse(X(23),1,20,6);
        [14,18,22,26,30].forEach(x => g.fillTriangle(X(x),1,X(x+3),1,X(x+1.5),4));
        // occhi rossi infossati
        g.fillStyle(0x100000); g.fillEllipse(X(16),6,8,6); g.fillEllipse(X(30),6,8,6);
        g.fillStyle(eye); g.fillEllipse(X(16),6,4.5,3.5); g.fillEllipse(X(30),6,4.5,3.5);
        g.fillStyle(0xff9977); g.fillCircle(X(15),5,1.4); g.fillCircle(X(29),5,1.4);
        // mascella + zanne + sangue
        g.fillStyle(0x180000); g.fillEllipse(X(23),12,20,6);
        g.fillStyle(bone);
        [14,18,23,28,32].forEach(x => g.fillTriangle(X(x),9,X(x+3),9,X(x+1.5),14));
        [16,21,26,30].forEach(x => g.fillTriangle(X(x),16,X(x+3),16,X(x+1.5),11));
        g.fillStyle(blood); g.fillRect(X(19),14,3,7); g.fillRect(X(27),14,2,6);
      }
      g.generateTexture('zombie_giant',144,66); AF('zombie_giant',48,66,3); g.destroy();
    }

    // ── BULLET (18×5) ─────────────────────────────────────────────────────────
    {
      const g = G(18,5);
      g.fillStyle(0xffdd00,0.3); g.fillRect(0,0,18,5);
      g.fillStyle(0xaa8800); g.fillRect(0,1,6,3);
      g.fillStyle(0xffffff); g.fillRect(2,2,10,2);
      g.fillStyle(0xffee44); g.fillRect(12,0,5,5);
      g.fillStyle(0xffffff); g.fillRect(14,1,3,3);
      g.generateTexture('bullet', 18, 5);
      g.destroy();
    }

    // ── FUEL CAN (22×26) ──────────────────────────────────────────────────────
    {
      const g = G(22,26);
      g.fillStyle(0xaa2200); g.fillRect(2,6,18,18);
      g.fillStyle(0xff4422); g.fillRect(2,6,5,18);
      g.fillStyle(0xcc3300); g.fillRect(7,6,13,18);
      // Ribs
      g.fillStyle(0x881a00); g.fillRect(5,7,2,16); g.fillRect(15,7,2,16);
      // Highlight stripe
      g.fillStyle(0xff7755,0.5); g.fillRect(3,7,3,16);
      // Top cap
      g.fillStyle(0x882200); g.fillRect(3,4,16,4); g.fillStyle(0xaa3300); g.fillRect(4,5,14,2);
      // Spout
      g.fillStyle(0x888888); g.fillRect(13,1,7,4); g.fillStyle(0xbbbbbb); g.fillRect(14,0,5,2);
      // Handle
      g.fillStyle(0x777777); g.fillRect(3,4,8,3); g.fillStyle(0x999999); g.fillRect(4,5,6,1);
      // Warning label
      g.fillStyle(0xffee00,0.8); g.fillRect(5,11,12,8);
      g.fillStyle(0xff3300); g.fillRect(10,12,2,6); g.fillRect(7,14,8,2);
      // Bottom
      g.fillStyle(0x661100); g.fillRect(3,22,16,4);
      g.generateTexture('fuel_can', 22, 26);
      g.destroy();
    }

    // ── PARTICLE (12×12) ──────────────────────────────────────────────────────
    {
      const g = G(12,12);
      g.fillStyle(0xff6600,0.5); g.fillCircle(6,6,6);
      g.fillStyle(0xffaa00); g.fillCircle(6,6,4);
      g.fillStyle(0xffee44); g.fillCircle(6,6,2);
      g.fillStyle(0xffffff); g.fillCircle(6,6,1);
      g.generateTexture('particle', 12, 12);
      g.destroy();
    }

    // ── ROCKET (28×12) ────────────────────────────────────────────────────────
    {
      const g = G(28,12);
      // Body
      g.fillStyle(0xcccccc); g.fillRect(4,2,18,8);
      g.fillStyle(0xeeeeee); g.fillRect(4,3,18,3);
      // Warhead
      g.fillStyle(0xcc2200); g.fillRect(20,1,6,10);
      g.fillStyle(0xff4422); g.fillRect(21,2,4,8);
      g.fillStyle(0xff6644); g.fillRect(22,3,2,6);
      // Nose cone
      g.fillStyle(0xbb1100); g.fillTriangle(26,0,26,12,28,6);
      // Band/stripe
      g.fillStyle(0x888888); g.fillRect(10,2,3,8); g.fillRect(16,2,2,8);
      // Nozzle
      g.fillStyle(0x444444); g.fillRect(0,3,6,6);
      g.fillStyle(0x222222); g.fillRect(0,4,4,4);
      // Fins
      g.fillStyle(0x888888);
      g.fillTriangle(0,0,0,4,5,2); g.fillTriangle(0,8,0,12,5,10);
      // Exhaust flame
      g.fillStyle(0xff5500,0.9); g.fillTriangle(-10,4,-10,8,1,6);
      g.fillStyle(0xffaa00,0.7); g.fillTriangle(-6,5,-6,7,0,6);
      g.fillStyle(0xffffff,0.5); g.fillTriangle(-3,5,-3,7,0,6);
      g.generateTexture('rocket', 28, 12);
      g.destroy();
    }

    // ── TOXIC CLOUD (50×50) ───────────────────────────────────────────────────
    {
      const g = G(50,50);
      g.fillStyle(0x003300,0.15); g.fillCircle(25,25,25);
      g.fillStyle(0x006600,0.2);  g.fillCircle(25,25,21);
      g.fillStyle(0x00aa33,0.3);  g.fillCircle(25,25,17);
      g.fillStyle(0x00cc44,0.3);
      g.fillCircle(19,19,12); g.fillCircle(31,21,11); g.fillCircle(22,29,11);
      g.fillStyle(0x00ff55,0.2);  g.fillCircle(25,25,9);
      g.fillStyle(0x44ff88,0.12); g.fillCircle(25,25,5);
      g.generateTexture('toxic_cloud', 50, 50);
      g.destroy();
    }

    // ── Animazioni di camminata (ciclo 0=passo sx · 1=neutro · 2=passo dx) ──────
    const walk = (type: string, rate: number) => {
      const key = `walk_${type}`;
      if (scene.anims.exists(key)) return;
      scene.anims.create({
        key,
        frames: [
          { key: `zombie_${type}`, frame: 0 },
          { key: `zombie_${type}`, frame: 1 },
          { key: `zombie_${type}`, frame: 2 },
          { key: `zombie_${type}`, frame: 1 },
        ],
        frameRate: rate, repeat: -1,
      });
    };
    walk('common', 5);
    walk('runner', 12);
    walk('armored', 4);
    walk('jumper', 9);
    walk('toxic', 4);
    walk('giant', 3.5);
  }

  // Interpola un colore verso un target (0xffffff per schiarire, 0x000000 per scurire)
  static mixColor(color: number, target: number, t: number): number {
    const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    const tr = (target >> 16) & 0xff, tg = (target >> 8) & 0xff, tb = target & 0xff;
    const nr = Math.round(r + (tr - r) * t);
    const ng = Math.round(g + (tg - g) * t);
    const nb = Math.round(b + (tb - b) * t);
    return (nr << 16) | (ng << 8) | nb;
  }

  // Veicolo in vista dall'alto (top-down), colore "cotto" nella texture (niente tint)
  static buildVehicleTexture(scene: Phaser.Scene, vehicleKey: string) {
    const key = `vehicle_${vehicleKey}`;
    if (scene.textures.exists(key)) return;

    const base    = VEHICLES[vehicleKey].color;
    const light   = GameScene.mixColor(base, 0xffffff, 0.30);
    const lighter = GameScene.mixColor(base, 0xffffff, 0.52);
    const dark    = GameScene.mixColor(base, 0x000000, 0.34);
    const darker  = GameScene.mixColor(base, 0x000000, 0.58);

    const metal = 0x4a4a52, metalL = 0x70707a, metalD = 0x26262c;
    const g = scene.make.graphics({ add: false } as any) as Phaser.GameObjects.Graphics & { generateTexture(k:string,w:number,h:number):void };

    g.fillStyle(0x000000, 0.22); g.fillEllipse(50, 25, 96, 40);

    if (vehicleKey === 'civilian_car') {
      // ── BERLINA CIVILE ──────────────────────────────────────────────────────
      const wh: [number,number][] = [[16,2],[62,2],[16,31],[62,31]];
      g.fillStyle(0x141414); wh.forEach(([x,y]) => g.fillRoundedRect(x,y,22,11,4));
      g.fillStyle(0x2c2c2c); wh.forEach(([x,y]) => [5,10,15].forEach(o => g.fillRect(x+o,y+2,2,7)));
      g.fillStyle(darker); g.fillRoundedRect(7,6,86,32,{tl:8,bl:8,tr:16,br:16});
      g.fillStyle(base);   g.fillRoundedRect(8,7,84,30,{tl:7,bl:7,tr:15,br:15});
      g.fillStyle(dark);   g.fillRoundedRect(10,29,80,7,{tl:4,bl:4,tr:8,br:8});
      g.fillStyle(light);  g.fillRoundedRect(12,8,74,9,{tl:5,bl:2,tr:9,br:2});
      g.fillStyle(dark);  g.fillRect(64,15,22,1); g.fillRect(64,28,22,1);
      g.fillStyle(light); g.fillRect(66,21,18,2);
      g.fillStyle(0x0e1d29);
      g.fillPoints([{x:52,y:10},{x:64,y:14},{x:64,y:30},{x:52,y:34}],true);
      g.fillStyle(0x2c5470,0.5);
      g.fillPoints([{x:53,y:12},{x:60,y:14},{x:58,y:19},{x:53,y:17}],true);
      g.fillStyle(light);   g.fillRoundedRect(33,11,20,22,6);
      g.fillStyle(lighter); g.fillRoundedRect(35,13,16,8,4);
      g.fillStyle(dark);    g.fillRect(33,21,20,1);
      g.fillStyle(0x0e1d29);
      g.fillPoints([{x:24,y:12},{x:33,y:11},{x:33,y:33},{x:24,y:32}],true);
      g.fillStyle(0x2c5470,0.4);
      g.fillPoints([{x:25,y:13},{x:31,y:13},{x:30,y:18},{x:25,y:17}],true);
      g.fillStyle(dark); g.fillRect(20,9,1,26); g.fillRect(11,12,8,1); g.fillRect(11,31,8,1);
      g.fillStyle(base);     g.fillRoundedRect(49,3,7,4,2); g.fillRoundedRect(49,37,7,4,2);
      g.fillStyle(0x0e1d29); g.fillRect(50,4,4,2); g.fillRect(50,38,4,2);
      g.fillStyle(0xfff4bc); g.fillRoundedRect(85,9,6,5,2); g.fillRoundedRect(85,30,6,5,2);
      g.fillStyle(0xffffff); g.fillRect(86,10,3,3); g.fillRect(86,31,3,3);
      g.fillStyle(0xfff4bc,0.3); g.fillRect(90,10,4,3); g.fillRect(90,31,4,3);
      g.fillStyle(0xcc1111); g.fillRoundedRect(8,10,4,5,1); g.fillRoundedRect(8,29,4,5,1);
      g.fillStyle(0xff4444); g.fillRect(9,11,2,3); g.fillRect(9,30,2,3);
      g.fillStyle(lighter); g.fillRoundedRect(89,16,4,12,2);
      g.fillStyle(metalD); g.fillCircle(58,22,9); g.fillStyle(metal); g.fillCircle(58,22,7);
      g.fillStyle(metalL); g.fillCircle(56,20,2.5); g.fillStyle(metalD); g.fillCircle(58,22,2);
      g.fillStyle(metalD); g.fillRect(58,18,42,8); g.fillStyle(metal); g.fillRect(58,19,42,6);
      g.fillStyle(metalL); g.fillRect(58,20,38,2);
      g.fillStyle(metalD); g.fillRect(90,17,10,10);
      g.fillStyle(0x000000); g.fillRect(91,19,8,2); g.fillRect(91,23,8,2);
      g.fillStyle(0xffffff,0.10); g.fillRoundedRect(16,7,58,3,2);

    } else if (vehicleKey === 'pickup') {
      // ── PICKUP — cabina (ant.) + pianale aperto con listoni (post.) ─────────
      const wh: [number,number][] = [[10,1],[62,1],[10,32],[62,32]];
      g.fillStyle(0x141414); wh.forEach(([x,y]) => g.fillRoundedRect(x,y,24,12,4));
      g.fillStyle(0x2c2c2c); wh.forEach(([x,y]) => [5,11,17].forEach(o => g.fillRect(x+o,y+2,2,8)));
      // pianale posteriore (sinistra) con listoni
      g.fillStyle(darker); g.fillRect(7,6,42,32);
      g.fillStyle(dark);   g.fillRect(8,7,40,30);
      g.fillStyle(darker); g.fillRect(8,7,40,4); g.fillRect(8,33,40,4);
      [14,20,26,32,38].forEach(x => { g.fillStyle(darker); g.fillRect(x,11,2,22); });
      g.fillStyle(base); [15,21,27,33,39].forEach(x => g.fillRect(x,11,1,22));
      // separatore cabina / pianale
      g.fillStyle(darker); g.fillRect(48,4,4,36);
      g.fillStyle(metalD); g.fillRect(49,4,2,36);
      // cabina (destra — anteriore)
      g.fillStyle(darker); g.fillRoundedRect(51,5,43,34,{tl:4,bl:4,tr:14,br:14});
      g.fillStyle(base);   g.fillRoundedRect(52,6,41,32,{tl:3,bl:3,tr:13,br:13});
      g.fillStyle(dark);   g.fillRoundedRect(54,29,37,8,{tl:2,bl:2,tr:8,br:8});
      g.fillStyle(light);  g.fillRoundedRect(54,7,35,9,3);
      // parabrezza cabina
      g.fillStyle(0x0e1d29);
      g.fillPoints([{x:67,y:9},{x:80,y:13},{x:80,y:31},{x:67,y:35}],true);
      g.fillStyle(0x2c5470,0.5);
      g.fillPoints([{x:68,y:11},{x:76,y:14},{x:74,y:19},{x:68,y:16}],true);
      // finestrino laterale cabina
      g.fillStyle(0x0e1d29);
      g.fillPoints([{x:53,y:9},{x:67,y:9},{x:67,y:35},{x:53,y:35}],true);
      g.fillStyle(0x2c5470,0.35); g.fillRect(55,11,10,11); g.fillRect(55,22,10,11);
      // cofano ant.
      g.fillStyle(dark); g.fillRect(80,15,12,1); g.fillRect(80,28,12,1);
      g.fillStyle(light); g.fillRect(82,20,8,4);
      g.fillStyle(0xfff4bc); g.fillRoundedRect(89,8,5,5,2); g.fillRoundedRect(89,31,5,5,2);
      g.fillStyle(0xffffff); g.fillRect(90,9,2,3); g.fillRect(90,32,2,3);
      g.fillStyle(0xfff4bc,0.3); g.fillRect(93,9,4,3); g.fillRect(93,32,4,3);
      g.fillStyle(0xcc1111); g.fillRoundedRect(7,10,4,5,1); g.fillRoundedRect(7,29,4,5,1);
      g.fillStyle(0xff4444); g.fillRect(8,11,2,3); g.fillRect(8,30,2,3);
      g.fillStyle(lighter); g.fillRoundedRect(92,15,4,14,2);
      // mitragliatrice montata sul pianale
      g.fillStyle(metalD); g.fillCircle(28,22,8); g.fillStyle(metal); g.fillCircle(28,22,6);
      g.fillStyle(metalL); g.fillCircle(26,20,2); g.fillStyle(metalD); g.fillCircle(28,22,2);
      g.fillStyle(metalD); g.fillRect(28,19,22,6); g.fillStyle(metal); g.fillRect(28,20,22,4);
      g.fillStyle(metalL); g.fillRect(29,21,18,2);
      g.fillStyle(metalD); g.fillRect(48,18,4,8);
      g.fillStyle(0x000000); g.fillRect(49,20,2,2); g.fillRect(49,24,2,2);
      g.fillStyle(0xffffff,0.10); g.fillRoundedRect(53,6,38,3,2);

    } else if (vehicleKey === 'armored_van') {
      // ── FURGONE BLINDATO — corpo scatolato, piastre, rivetti, feritoie ─────
      const wh: [number,number][] = [[11,1],[62,1],[11,32],[62,32]];
      g.fillStyle(0x141414); wh.forEach(([x,y]) => g.fillRoundedRect(x,y,22,11,3));
      g.fillStyle(0x2c2c2c); wh.forEach(([x,y]) => [4,9,14].forEach(o => g.fillRect(x+o,y+2,2,7)));
      g.fillStyle(darker); g.fillRect(6,4,88,36);
      g.fillStyle(base);   g.fillRect(7,5,86,34);
      g.fillStyle(light);  g.fillRect(9,5,82,8);
      g.fillStyle(dark);   g.fillRect(9,31,82,8);
      // giunzioni piastre
      g.fillStyle(darker);
      [26,50,70].forEach(x => g.fillRect(x,5,3,34));
      g.fillRect(7,20,86,3);
      // rivetti
      g.fillStyle(metalD);
      [16,35,57,76].forEach(x => [9,17,27,35].forEach(y => g.fillCircle(x,y,2)));
      // feritoie anteriori
      g.fillStyle(0x0e1d29); g.fillRect(73,8,15,7); g.fillRect(73,29,15,7);
      g.fillStyle(0x2c5470,0.5); g.fillRect(75,10,9,3); g.fillRect(75,31,9,3);
      // feritoie laterali
      g.fillStyle(0x0e1d29); g.fillRect(30,7,14,8); g.fillRect(30,29,14,8);
      g.fillStyle(0x2c5470,0.35); g.fillRect(32,9,8,4); g.fillRect(32,31,8,4);
      g.fillStyle(0xfff4bc); g.fillRect(88,8,5,4); g.fillRect(88,32,5,4);
      g.fillStyle(0xffffff); g.fillRect(89,9,2,2); g.fillRect(89,33,2,2);
      g.fillStyle(0xfff4bc,0.3); g.fillRect(92,9,3,2); g.fillRect(92,33,3,2);
      g.fillStyle(0xcc1111); g.fillRect(7,9,4,5); g.fillRect(7,30,4,5);
      g.fillStyle(0xff4444); g.fillRect(8,10,2,3); g.fillRect(8,31,2,3);
      g.fillStyle(metalD); g.fillRect(91,8,5,28); g.fillStyle(metal); g.fillRect(92,9,3,26);
      g.fillStyle(metalD); g.fillRect(6,9,3,26);
      // torretta blindata (con scatola protettiva)
      g.fillStyle(darker); g.fillRect(36,8,28,28);
      g.fillStyle(base);   g.fillRect(37,9,26,26);
      g.fillStyle(metalD); g.fillCircle(50,22,11); g.fillStyle(metal); g.fillCircle(50,22,9);
      g.fillStyle(metalL); g.fillCircle(48,20,3); g.fillStyle(metalD); g.fillCircle(50,22,2);
      g.fillStyle(metalD); g.fillRect(50,17,46,10); g.fillStyle(metal); g.fillRect(50,18,46,8);
      g.fillStyle(metalL); g.fillRect(50,19,42,3);
      g.fillStyle(metalD); g.fillRect(90,16,7,12); g.fillRect(94,15,4,14);
      g.fillStyle(0x000000); g.fillRect(95,18,2,2); g.fillRect(95,23,2,2);
      g.fillStyle(0xffffff,0.10); g.fillRect(9,5,78,3);

    } else if (vehicleKey === 'military_suv') {
      // ── SUV MILITARE — alto, boxy, ruote grandi, bull bar, antenna radio ────
      const wh: [number,number][] = [[9,0],[60,0],[9,33],[60,33]];
      g.fillStyle(0x141414); wh.forEach(([x,y]) => g.fillRoundedRect(x,y,25,13,4));
      g.fillStyle(0x2c2c2c); wh.forEach(([x,y]) => [5,10,17].forEach(o => g.fillRect(x+o,y+2,2,9)));
      g.fillStyle(0x555555); wh.forEach(([x,y]) => g.fillCircle(x+12,y+6,4));
      // corpo alto e boxy
      g.fillStyle(darker); g.fillRoundedRect(6,3,88,38,{tl:6,bl:6,tr:10,br:10});
      g.fillStyle(base);   g.fillRoundedRect(7,4,86,36,{tl:5,bl:5,tr:9,br:9});
      g.fillStyle(dark);   g.fillRoundedRect(9,32,80,7,{tl:3,bl:3,tr:7,br:7});
      g.fillStyle(light);  g.fillRoundedRect(9,5,76,10,{tl:4,bl:2,tr:7,br:2});
      // finestre militari (piccole e quadrate)
      g.fillStyle(0x0e1d29); g.fillRect(55,8,22,12); g.fillRect(55,24,22,12);
      g.fillStyle(0x2c5470,0.45); g.fillRect(57,10,14,6); g.fillRect(57,26,14,6);
      g.fillStyle(0x0e1d29); g.fillRect(31,8,20,12); g.fillRect(31,24,20,12);
      g.fillStyle(0x2c5470,0.35); g.fillRect(33,10,12,6); g.fillRect(33,26,12,6);
      g.fillStyle(base); g.fillRect(51,5,6,34);
      g.fillStyle(dark); g.fillRect(78,15,12,1); g.fillRect(78,28,12,1);
      g.fillStyle(light); g.fillRect(80,20,8,4);
      // bull bar anteriore
      g.fillStyle(metalD); g.fillRoundedRect(88,9,6,26,3);
      g.fillStyle(metal);  g.fillRect(89,12,4,20);
      g.fillStyle(metalD); g.fillRect(89,7,3,5); g.fillRect(89,32,3,5);
      g.fillStyle(0xfff4bc); g.fillRoundedRect(83,7,7,7,2); g.fillRoundedRect(83,30,7,7,2);
      g.fillStyle(0xffffff); g.fillRect(84,8,4,5); g.fillRect(84,31,4,5);
      g.fillStyle(0xfff4bc,0.3); g.fillRect(89,8,5,5); g.fillRect(89,31,5,5);
      g.fillStyle(0xcc1111); g.fillRoundedRect(7,9,5,6,1); g.fillRoundedRect(7,29,5,6,1);
      g.fillStyle(0xff4444); g.fillRect(8,10,2,4); g.fillRect(8,30,2,4);
      g.fillStyle(base); g.fillRoundedRect(52,1,8,5,2); g.fillRoundedRect(52,38,8,5,2);
      g.fillStyle(0x0e1d29); g.fillRect(53,2,5,3); g.fillRect(53,39,5,3);
      // antenna radio
      g.fillStyle(metalD); g.fillRect(18,3,2,5); g.fillStyle(metalL); g.fillRect(19,2,1,3);
      g.fillStyle(metalD); g.fillRect(6,11,3,22);
      // torretta
      g.fillStyle(metalD); g.fillCircle(47,22,11); g.fillStyle(metal); g.fillCircle(47,22,9);
      g.fillStyle(metalL); g.fillCircle(45,20,3); g.fillStyle(metalD); g.fillCircle(47,22,2);
      g.fillStyle(metalD); g.fillRect(47,17,49,10); g.fillStyle(metal); g.fillRect(47,18,49,8);
      g.fillStyle(metalL); g.fillRect(47,19,44,3);
      g.fillStyle(metalD); g.fillRect(89,16,8,12); g.fillRect(93,15,5,14);
      g.fillStyle(0x000000); g.fillRect(94,18,3,2); g.fillRect(94,23,3,2);
      g.fillStyle(0xffffff,0.10); g.fillRoundedRect(15,4,68,3,2);

    } else if (vehicleKey === 'armored_truck') {
      // ── CAMION CORAZZATO — corpo enorme, 6 ruote (doppio assale post.) ──────
      g.fillStyle(0x141414);
      g.fillRoundedRect(62,0,26,13,4); g.fillRoundedRect(62,31,26,13,4);
      g.fillRoundedRect(10,0,24,13,4); g.fillRoundedRect(34,0,24,13,4);
      g.fillRoundedRect(10,31,24,13,4); g.fillRoundedRect(34,31,24,13,4);
      g.fillStyle(0x2c2c2c);
      ([[62,0],[10,0],[34,0],[62,31],[10,31],[34,31]] as [number,number][]).forEach(([x,y]) =>
        [5,11,17].forEach(o => g.fillRect(x+o,y+3,2,7))
      );
      g.fillStyle(darker); g.fillRect(5,2,90,40);
      g.fillStyle(base);   g.fillRect(6,3,88,38);
      g.fillStyle(light);  g.fillRect(8,3,84,10);
      g.fillStyle(dark);   g.fillRect(8,31,84,10);
      g.fillStyle(darker);
      g.fillRect(5,21,90,3);
      [22,44,62].forEach(x => g.fillRect(x,2,3,40));
      g.fillStyle(metalD);
      [14,32,51,70,84].forEach(x => [8,15,29,36].forEach(y => g.fillCircle(x,y,2.5)));
      g.fillStyle(0x0e1d29); g.fillRect(65,7,18,9); g.fillRect(65,28,18,9);
      g.fillStyle(0x2c5470,0.4); g.fillRect(67,9,12,5); g.fillRect(67,30,12,5);
      g.fillStyle(0xfff4bc); g.fillRect(87,7,5,5); g.fillRect(87,32,5,5);
      g.fillStyle(0xffffff); g.fillRect(88,8,2,3); g.fillRect(88,33,2,3);
      g.fillStyle(0xfff4bc,0.3); g.fillRect(91,8,4,3); g.fillRect(91,33,4,3);
      g.fillStyle(0xcc1111); g.fillRect(6,8,5,5); g.fillRect(6,31,5,5);
      g.fillStyle(0xff4444); g.fillRect(7,9,2,3); g.fillRect(7,32,2,3);
      g.fillStyle(metalD); g.fillRect(91,6,6,32); g.fillStyle(metal); g.fillRect(92,7,4,30);
      g.fillStyle(metalD); g.fillRect(5,7,3,30);
      // torretta corazzata con scatola protettiva visibile
      g.fillStyle(darker); g.fillRect(22,7,30,30);
      g.fillStyle(base);   g.fillRect(23,8,28,28);
      g.fillStyle(metalD); g.fillCircle(37,22,11); g.fillStyle(metal); g.fillCircle(37,22,9);
      g.fillStyle(metalL); g.fillCircle(35,20,3); g.fillStyle(metalD); g.fillCircle(37,22,2);
      g.fillStyle(metalD); g.fillRect(37,16,56,12); g.fillStyle(metal); g.fillRect(37,17,56,10);
      g.fillStyle(metalL); g.fillRect(37,18,52,4);
      g.fillStyle(metalD); g.fillRect(87,15,10,14); g.fillRect(92,13,6,18);
      g.fillStyle(0x000000); g.fillRect(93,17,4,2); g.fillRect(93,24,4,2);
      g.fillStyle(0xffffff,0.08); g.fillRect(8,3,80,3);

    } else if (vehicleKey === 'heavy_military') {
      // ── MEZZO PESANTE — 6 ruote enormi, doppio cannone, corazza massima ─────
      g.fillStyle(0x141414);
      g.fillRoundedRect(60,0,28,14,4); g.fillRoundedRect(60,30,28,14,4);
      g.fillRoundedRect(30,0,26,14,4); g.fillRoundedRect(30,30,26,14,4);
      g.fillRoundedRect(4,0,22,14,4);  g.fillRoundedRect(4,30,22,14,4);
      g.fillStyle(0x2c2c2c);
      ([[60,0],[30,0],[4,0],[60,30],[30,30],[4,30]] as [number,number][]).forEach(([x,y]) =>
        [5,11,17,22].forEach(o => g.fillRect(x+o,y+3,2,8))
      );
      g.fillStyle(0x555555);
      ([[74,6],[44,6],[15,6],[74,37],[44,37],[15,37]] as [number,number][]).forEach(([x,y]) => g.fillCircle(x,y,5));
      g.fillStyle(darker); g.fillRect(3,1,94,42);
      g.fillStyle(base);   g.fillRect(4,2,92,40);
      g.fillStyle(light);  g.fillRect(6,2,88,11);
      g.fillStyle(dark);   g.fillRect(6,31,88,11);
      g.fillStyle(darker);
      g.fillRect(3,21,94,3);
      [18,38,56,74].forEach(x => g.fillRect(x,1,3,42));
      g.fillStyle(metalD);
      [11,27,46,63,80,91].forEach(x => [8,15,29,36].forEach(y => g.fillCircle(x,y,2.5)));
      g.fillStyle(0x0e1d29);
      g.fillRect(60,5,16,8); g.fillRect(60,31,16,8);
      g.fillRect(40,5,14,8); g.fillRect(40,31,14,8);
      g.fillStyle(0x2c5470,0.4);
      g.fillRect(62,7,10,4); g.fillRect(62,33,10,4);
      g.fillRect(42,7,8,4);  g.fillRect(42,33,8,4);
      g.fillStyle(0xfff4bc); g.fillRect(86,4,6,6); g.fillRect(86,34,6,6);
      g.fillStyle(0xffffff); g.fillRect(87,5,3,4); g.fillRect(87,35,3,4);
      g.fillStyle(0xfff4bc,0.3); g.fillRect(91,5,5,4); g.fillRect(91,35,5,4);
      g.fillStyle(0xcc1111); g.fillRect(4,7,5,6); g.fillRect(4,31,5,6);
      g.fillStyle(0xff4444); g.fillRect(5,8,2,4); g.fillRect(5,32,2,4);
      g.fillStyle(metalD); g.fillRect(90,5,7,34); g.fillStyle(metal); g.fillRect(91,6,5,32);
      g.fillStyle(metalD); g.fillRect(3,9,3,26); g.fillStyle(metal); g.fillRect(3,17,3,10);
      // DOPPIO CANNONE
      g.fillStyle(darker); g.fillRect(20,10,26,24);
      g.fillStyle(base);   g.fillRect(21,11,24,22);
      g.fillStyle(metalD); g.fillCircle(33,22,11); g.fillStyle(metal); g.fillCircle(33,22,9);
      g.fillStyle(metalL); g.fillCircle(31,20,3.5); g.fillStyle(metalD); g.fillCircle(33,22,2);
      g.fillStyle(metalD); g.fillRect(33,13,60,7); g.fillStyle(metal); g.fillRect(33,14,60,5);
      g.fillStyle(metalL); g.fillRect(33,14,56,2);
      g.fillStyle(metalD); g.fillRect(87,12,10,9);
      g.fillStyle(0x000000); g.fillRect(88,14,7,2);
      g.fillStyle(metalD); g.fillRect(33,24,60,7); g.fillStyle(metal); g.fillRect(33,25,60,5);
      g.fillStyle(metalL); g.fillRect(33,25,56,2);
      g.fillStyle(metalD); g.fillRect(87,23,10,9);
      g.fillStyle(0x000000); g.fillRect(88,25,7,2);
      g.fillStyle(0xffffff,0.07); g.fillRect(6,2,82,3);

    } else {
      // ── VEICOLO SPERIMENTALE — futuristico, angolare, cannone a energia ──────
      g.fillStyle(0x111122);
      g.fillRoundedRect(11,2,20,10,5); g.fillRoundedRect(11,32,20,10,5);
      g.fillRoundedRect(63,2,20,10,5); g.fillRoundedRect(63,32,20,10,5);
      g.fillStyle(0x440088);
      g.fillCircle(21,7,3);  g.fillCircle(21,37,3);
      g.fillCircle(73,7,3);  g.fillCircle(73,37,3);
      g.fillStyle(0x8833ff,0.8);
      g.fillCircle(21,7,2);  g.fillCircle(21,37,2);
      g.fillCircle(73,7,2);  g.fillCircle(73,37,2);
      // corpo angolare a cunei
      const body = [{x:8,y:11},{x:16,y:5},{x:82,y:5},{x:94,y:15},{x:94,y:29},{x:82,y:39},{x:16,y:39},{x:8,y:33}];
      g.fillStyle(darker); g.fillPoints(body.map(p => ({x:p.x+1,y:p.y+1})),true);
      g.fillStyle(base);   g.fillPoints(body,true);
      g.fillStyle(light);
      g.fillPoints([{x:16,y:6},{x:82,y:6},{x:82,y:12},{x:16,y:12}],true);
      g.fillStyle(dark);
      g.fillPoints([{x:16,y:32},{x:82,y:32},{x:82,y:38},{x:16,y:38}],true);
      // trim viola caratteristico
      g.fillStyle(0x8833ff,0.85);
      g.fillRect(8,21,86,2); g.fillRect(8,10,86,1); g.fillRect(8,33,86,1);
      // cabina vetro scuro angolare
      g.fillStyle(0x060012);
      g.fillPoints([{x:43,y:7},{x:74,y:9},{x:74,y:35},{x:43,y:37}],true);
      g.fillStyle(0x3300aa,0.55);
      g.fillPoints([{x:45,y:9},{x:68,y:11},{x:66,y:17},{x:45,y:15}],true);
      // pannello laterale
      g.fillStyle(0x060012);
      g.fillPoints([{x:19,y:8},{x:43,y:7},{x:43,y:37},{x:19,y:36}],true);
      g.fillStyle(0x220044,0.6); g.fillRect(21,10,18,10); g.fillRect(21,24,18,10);
      // griglia anteriore ad energia
      g.fillStyle(0x060012);
      g.fillPoints([{x:74,y:9},{x:88,y:14},{x:88,y:30},{x:74,y:35}],true);
      g.fillStyle(0x8833ff,0.45); g.fillRect(76,13,10,5); g.fillRect(76,26,10,5);
      // fari anteriori energia viola
      g.fillStyle(0xbb44ff); g.fillRoundedRect(86,8,7,6,2); g.fillRoundedRect(86,30,7,6,2);
      g.fillStyle(0xffffff,0.8); g.fillRect(87,9,3,4); g.fillRect(87,31,3,4);
      g.fillStyle(0xbb44ff,0.4); g.fillRect(92,9,5,4); g.fillRect(92,31,5,4);
      // fari posteriori rosa energia
      g.fillStyle(0xff22aa); g.fillRect(9,10,5,6); g.fillRect(9,28,5,6);
      g.fillStyle(0xff88cc,0.5); g.fillRect(13,11,3,4); g.fillRect(13,29,3,4);
      // CANNONE A ENERGIA
      g.fillStyle(0x330066); g.fillCircle(47,22,11);
      g.fillStyle(0x550099); g.fillCircle(47,22,9);
      g.fillStyle(0x9955ee); g.fillCircle(45,20,3.5);
      g.fillStyle(0x8833ff,0.9); g.fillCircle(47,22,5);
      g.fillStyle(0xffffff,0.8); g.fillCircle(47,22,2);
      g.fillStyle(0x330066); g.fillRect(47,18,46,8);
      g.fillStyle(0x550099); g.fillRect(47,19,46,6);
      g.fillStyle(0x8833ff,0.7); g.fillRect(49,20,40,4);
      g.fillStyle(0x330066); g.fillRect(87,17,9,10);
      g.fillStyle(0xffffff,0.9); g.fillRect(90,19,6,6);
      g.fillStyle(0x8833ff,0.3); g.fillRect(49,17,38,10);
      g.fillStyle(0xffffff,0.12); g.fillRoundedRect(17,6,52,3,2);
    }

    g.generateTexture(key, 100, 44);
    g.destroy();
  }

  // ─── World & entities ────────────────────────────────────────────────────────

  private buildWorld() {
    const env = ENVIRONMENTS[this.envIndex];

    // Sfondo + fasce
    this.add.rectangle(W/2, H/2, W, H, env.bgColor);
    this.add.rectangle(W/2, ROAD_TOP / 2, W, ROAD_TOP, env.skyColor);
    this.add.rectangle(W/2, (ROAD_BOTTOM + H) / 2, W, H - ROAD_BOTTOM, env.groundColor);

    // Strada di base (rettangolo piatto + spallette esterne): l'asfalto tileato
    // dell'Environment la copre, le spallette restano come terza fascia del ciglio.
    this.add.rectangle(W/2, ROAD_CENTER, W, ROAD_BOTTOM - ROAD_TOP, env.roadColor);
    this.add.rectangle(W/2, ROAD_TOP    - 10, W, 16, env.shoulderColor);
    this.add.rectangle(W/2, ROAD_BOTTOM + 10, W, 16, env.shoulderColor);

    // Ambiente & Strada (docs/ART_BIBLE_AMBIENTE.md): profondità (parallasse far/near),
    // superficie (asfalto tileato + ciglio rumble), illuminazione (gradiente cielo,
    // luce di carreggiata, fari) e memoria (decal dinamici).
    this.environment = new Environment(
      this,
      { W, H, roadTop: ROAD_TOP, roadBottom: ROAD_BOTTOM, roadCenter: ROAD_CENTER, scrollSpeed: SCROLL_SPEED },
      env, this.envIndex,
    );

    // Strisce di corsia ambientate: colore della linea d'ambiente, consumate, qualche dash "mancante"
    const count = Math.ceil(W / STRIPE_GAP) + 3;
    for (let i = 0; i < count; i++) {
      const worn = (i % 6 === 4);
      const a = worn ? 0.06 : 0.20 + (i % 3) * 0.08;
      const r = this.add.rectangle(i * STRIPE_GAP, ROAD_CENTER, STRIPE_W, 4, env.lineColor, a).setDepth(1);
      this.stripes.push(r);
    }

    // Color grading: viraggio cromatico del mood (MULTIPLY su tutto il gameplay, sotto HUD/vignetta)
    this.add.rectangle(W / 2, H / 2, W, H, env.grade)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setAlpha(env.gradeAlpha)
      .setScrollFactor(0)
      .setDepth(16);

    // Banner nome ambiente (scompare dopo 2.5s)
    const envLabel = Ui.text(this, W / 2, ROAD_TOP - 28, env.name.toUpperCase(), {
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
    this.bossGroup       = this.physics.add.group();
    this.bossProjectiles = this.physics.add.group();
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
    this.physics.add.overlap(this.bullets, this.bossGroup,
      (b,boss) => this.onBulletHitBoss(b as Phaser.Physics.Arcade.Sprite, boss as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.rockets, this.bossGroup,
      (r,boss) => this.onRocketHitBoss(r as Phaser.Physics.Arcade.Sprite, boss as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.bossGroup,
      (_v,boss) => this.onVehicleHitBoss(boss as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.vehicle, this.bossProjectiles,
      (_v,p) => this.onBossProjectileHitVehicle(p as Phaser.Physics.Arcade.Sprite));
  }

  private buildHUD(missionNum: number) {
    const D = 20, BAR_W = 110, COMP_BAR_W = 120;
    const panel = this.add.graphics().setDepth(D);
    panel.fillStyle(UI.black, 0.62); panel.fillRoundedRect(0,0,W,84,{ tl:0, tr:0, bl:16, br:16 });
    panel.lineStyle(1,UI.strokeDim,0.7); panel.lineBetween(0,46,W,46);

    Ui.text(this, 8,8,'SALUTE',{fontSize:'11px',color:UI.redText}).setDepth(D+1);
    Ui.box(this, 8+BAR_W/2,34,BAR_W,10,{ fill:UI.barRed, radius:3 }).setDepth(D+1);
    this.hudHealthFill = this.add.rectangle(8,34,BAR_W,10,UI.hpFill).setOrigin(0,0.5).setDepth(D+2);

    Ui.text(this, 138,8,'CARBURANTE',{fontSize:'11px',color:UI.amberSoft}).setDepth(D+1);
    Ui.box(this, 138+BAR_W/2,34,BAR_W,10,{ fill:UI.barAmber, radius:3 }).setDepth(D+1);
    this.hudFuelFill = this.add.rectangle(138,34,BAR_W,10,UI.fuelBar).setOrigin(0,0.5).setDepth(D+2);

    // Tacche di segmentazione sulle due barre principali (gauge "premium")
    const ticks = this.add.graphics().setDepth(D+3);
    ticks.fillStyle(UI.black, 0.45);
    for (let i = 1; i < 5; i++) { ticks.fillRect(8 + i*22, 30, 1, 8); ticks.fillRect(138 + i*22, 30, 1, 8); }
    this.hudFuelNum  = Ui.text(this, 255,28,'',{fontSize:'11px',color:UI.amberSoft}).setDepth(D+2);

    this.hudScore    = Ui.text(this, 290,6,'PUNTEGGIO: 0',{fontSize:'13px',color:UI.white}).setDepth(D+1);
    Ui.text(this, 620,6,`MISS.${missionNum}`,{fontSize:'12px',color:UI.greenSoft}).setDepth(D+1);
    this.hudAttached = Ui.text(this, 700,6,'',{fontSize:'11px',color:'#ff8800'}).setDepth(D+1);
    this.hudWeapon   = Ui.text(this, 620,22,'',{fontSize:'10px',color:'#ffaa44'}).setDepth(D+1);
    this.hudCombo    = Ui.text(this, 470,6,'',{fontSize:'13px',fontStyle:'bold',color:UI.gold}).setDepth(D+1).setVisible(false);
    this.hudDash     = Ui.text(this, W-10,22,'↯ SCATTO',{fontSize:'11px',fontStyle:'bold',color:UI.greenOk}).setOrigin(1,0).setDepth(D+1);
    // Selettore armi: una cifra-hotkey per ogni arma posseduta (la selezionata in oro)
    this.weaponSlots = [];
    let wsx = 620;
    WEAPON_KEYS.forEach((wk, i) => {
      if (!this.ownedWeapons.includes(wk)) return;
      const t = Ui.text(this, wsx,34,`${i+1}`,{fontSize:'11px',fontStyle:'bold',color:UI.muted}).setDepth(D+1);
      this.weaponSlots.push({ key: wk, txt: t });
      wsx += 16;
    });

    // Barra progresso missione
    const DIST_KM = Math.floor(MISSION_DIST / 100);
    const DIST_BAR_W = 110;
    Ui.text(this, 290,24,'PERCORSO',{fontSize:'10px',color:'#7777aa'}).setDepth(D+1);
    this.hudDist = Ui.text(this, 395,24,'',{fontSize:'10px',color:UI.blueInfo}).setDepth(D+2);
    Ui.box(this, 290+DIST_BAR_W/2,37,DIST_BAR_W,7,{ fill:UI.barBlue, radius:2 }).setDepth(D+1);
    this.hudDistFill = this.add.rectangle(290,37,DIST_BAR_W,7,UI.distBar).setOrigin(0,0.5).setDepth(D+2);
    // label meta (static)
    Ui.text(this, 408,33,`/ ${DIST_KM} km`,{fontSize:'9px',color:UI.faint}).setDepth(D+1);

    // Survivors icons
    if (this.activeSurvivors.length > 0) {
      const names: Record<string,string> = { mechanic:'[M]', medic:'[+]', soldier:'[S]', explorer:'[E]' };
      const txt = this.activeSurvivors.map(s => names[s]??s).join(' ');
      Ui.text(this, W-10,8,txt,{fontSize:'11px',color:'#cccc44'}).setOrigin(1,0).setDepth(D+1);
    }

    const compKeys: ComponentKey[] = ['engine','wheels','tank','turret','armor'];
    compKeys.forEach((key,i) => {
      const comp = this.components[key];
      const sx = 10 + i * 158;
      Ui.text(this, sx,49,comp.label,{fontSize:'10px',color:UI.muted}).setDepth(D+1);
      Ui.box(this, sx+COMP_BAR_W/2,72,COMP_BAR_W,7,{ fill:UI.barGrey, radius:2 }).setDepth(D+1);
      const fill = this.add.rectangle(sx,72,COMP_BAR_W,7,comp.baseColor).setOrigin(0,0.5).setDepth(D+2);
      comp.fill = fill;
    });

    Ui.text(this, W/2,H-6,'↑↓ Muovi · SPAZIO Spara · 1-5/Q Arma · SHIFT Scatto',{fontSize:'11px',color:UI.disabled}).setOrigin(0.5,1).setDepth(D);
    Ui.text(this, 4,H-6,'0=Debug',{fontSize:'9px',color:'#2a3a2a'}).setOrigin(0,1).setDepth(D);
    this.hudDebug = Ui.text(this, W-6,H-6,'',{fontSize:'10px',color:'#00ff88',fontStyle:'bold'}).setOrigin(1,1).setDepth(D+5);
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
    kb.on('keydown-G', () => { this.debugGod = !this.debugGod; if (this.debugGod) this.fuel = this.maxFuel; });
    kb.on('keydown-B', () => { if (this.alive && !this.bossSpawned) this.spawnBoss(); });
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
    // Pop visivo del nome arma (cosmetico)
    this.tweens.killTweensOf(this.hudWeapon);
    this.hudWeapon.setScale(1.3);
    this.tweens.add({ targets: this.hudWeapon, scale: 1, duration: 160 });
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
  private addKillScore(base: number) {
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    this.score += base * this.comboMultiplier();
    if (this.combo >= 2 && this.hudCombo) {
      this.tweens.killTweensOf(this.hudCombo);
      this.hudCombo.setScale(1.35);
      this.tweens.add({ targets: this.hudCombo, scale: 1, duration: 180 });
    }
  }

  private updateFuel(dt: number) {
    if (this.debugGod) { this.fuel = this.maxFuel; return; }
    this.fuel -= this.getEffectiveFuelDrain() * dt;
    if (this.fuel <= 0) { this.fuel = 0; this.endGame('Carburante esaurito!'); }
  }

  private updateDistance(dt: number) {
    this.distance += SCROLL_SPEED * dt;
    if (!this.bossSpawned && this.distance >= MISSION_DIST * BOSS_TRIGGER) {
      this.spawnBoss();
    }
    if (this.bossActive) return;
    if (this.distance >= MISSION_DIST) this.triggerMissionComplete();
  }

  private updateZombieSpawning(delta: number) {
    if (this.bossActive) return;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnZombie();
      this.spawnInterval = Math.max(500, this.spawnInterval - 3);
      this.spawnTimer = this.spawnInterval;
    }
  }

  private updateGiantSpawning(delta: number) {
    if (this.bossActive) return;
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
    const hpPct = this.health / this.maxHealth;
    this.hudHealthFill.displayWidth = Math.max(0, hpPct * 110);
    this.hudHealthFill.setFillStyle(hpPct < 0.3 ? UI.hpLow : hpPct < 0.6 ? UI.hpMid : UI.hpHigh);

    this.hudFuelFill.displayWidth = Math.max(0, (this.fuel / this.maxFuel) * 110);
    this.hudFuelNum.setText(`${Math.round(this.fuel)}%`);
    this.hudScore.setText(`PUNTEGGIO: ${this.score}`);
    const km = Math.floor(this.distance / 100);
    this.hudDist.setText(`${km} km`);
    const distPct = Math.min(1, this.distance / MISSION_DIST);
    this.hudDistFill.displayWidth = Math.max(1, distPct * 110);
    const barColor = distPct > 0.8 ? 0x88ff44 : distPct > 0.5 ? 0x44aaff : 0x4466cc;
    this.hudDistFill.setFillStyle(barColor);

    this.hudDebug?.setText(this.debugGod ? '◆ GOD MODE  (G off · B boss · N fine · H ripara)' : '');

    const n = this.attachedZombies.length;
    this.hudAttached.setText(n > 0 ? `[${n} aggrappati]` : '');
    this.hudWeapon.setText(WEAPONS[this.currentWeapon].name.toUpperCase());

    // Combo
    if (this.combo >= 2) {
      const m = this.comboMultiplier();
      this.hudCombo.setText(`COMBO ${this.combo}  ×${m}`);
      this.hudCombo.setColor(COMBO_COLORS[m - 1] ?? UI.white);
      this.hudCombo.setVisible(true);
    } else {
      this.hudCombo.setVisible(false);
    }

    // Scatto (cooldown)
    const dashRemain = this.dashReadyAt - this.time.now;
    if (dashRemain <= 0) { this.hudDash.setText('↯ SCATTO'); this.hudDash.setColor(UI.greenOk); }
    else { this.hudDash.setText(`↯ ${Math.ceil(dashRemain / 1000)}s`); this.hudDash.setColor(UI.faint); }

    // Selettore armi: evidenzia quella attiva
    for (const slot of this.weaponSlots) {
      slot.txt.setColor(slot.key === this.currentWeapon ? UI.gold : UI.muted);
    }

    for (const key of Object.keys(this.components) as ComponentKey[]) {
      const comp = this.components[key];
      if (!comp.fill) continue;
      const pct = comp.health / 100;
      comp.fill.displayWidth = Math.max(0, pct * 120);
      comp.fill.setFillStyle(pct<=0 ? 0x440000 : pct<0.3 ? 0xff2222 : pct<0.6 ? 0xffcc00 : comp.baseColor);
    }
  }

  private cleanOffScreen() {
    const clean = (g: Phaser.Physics.Arcade.Group, l: number, r: number) =>
      (g.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(s => { if (s.active && (s.x<l||s.x>r)) s.destroy(); });
    clean(this.zombies,    -100, W+100);
    clean(this.fuelCans,   -80,  W+80);
    clean(this.toxicClouds,-80,  W+80);
    clean(this.rockets,         -20,  W+60);
    clean(this.bossProjectiles, -80,  W+80);
    // Bullets respect per-projectile maxX (lanciafiamme ha range breve)
    (this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(s => {
      if (!s.active) return;
      const maxX = (s.getData('maxX') as number) ?? W + 40;
      if (s.x < -20 || s.x > maxX) s.destroy();
    });
  }

  // ─── Spawning ────────────────────────────────────────────────────────────────

  // Hit-stop: congela il gioco per pochi ms sugli impatti forti (vende il "peso")
  private hitStop(ms: number) {
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

      // Respiro / gonfiore (squash-stretch del volume)
      if (m.wob > 0) {
        const base = ZOMBIE_STATS[type].scale;
        const w = Math.sin(t * m.spd * 0.7 + ph) * m.wob;
        z.setScale(base * (1 + w), base * (1 - w));
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
  private emitSparks(x: number, y: number) {
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
      const z = this.zombies.create(W + 30, startY, 'zombie_jumper') as Phaser.Physics.Arcade.Sprite;
      z.setScale(stats.scale).setData('hp', stats.hp).setData('type', 'jumper');
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
      const z = this.zombies.create(W+30+i*20, y, `zombie_${type}`) as Phaser.Physics.Arcade.Sprite;
      z.setScale(stats.scale).setData('hp', stats.hp).setData('type', type);
      z.setData('rockPhase', Math.random() * 6.28);
      z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9).setBodySize(20,28);
      z.play(`walk_${type}`); z.anims.setProgress(Math.random());
    }
  }

  private spawnGiant() {
    const z = this.zombies.create(W + 60, ROAD_CENTER, 'zombie_giant') as Phaser.Physics.Arcade.Sprite;
    z.setScale(ZOMBIE_STATS.giant.scale).setData('hp', ZOMBIE_STATS.giant.hp).setData('type', 'giant');
    z.setData('rockPhase', Math.random() * 6.28);
    z.setVelocityX(-(ZOMBIE_STATS.giant.speed + SCROLL_SPEED)).setDepth(9).setBodySize(38,50);
    z.play('walk_giant'); z.anims.setProgress(Math.random());
    const warn = Ui.text(this, W - 60, H/2, '⚠ GIGANTE!', {
      fontSize: '22px', color: '#ff4400', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: warn, alpha: 0, y: H/2 - 50, duration: 1600, onComplete: () => warn.destroy() });
  }

  private spawnFuelCan() {
    if (!this.alive || this.missionDone) return;
    const f = this.fuelCans.create(W+20, Phaser.Math.Between(ROAD_TOP+22, ROAD_BOTTOM-22), 'fuel_can') as Phaser.Physics.Arcade.Sprite;
    f.setVelocityX(-SCROLL_SPEED).setDepth(6);
  }

  private fireWeapon() {
    const w = WEAPONS[this.currentWeapon];
    const vx = this.vehicle.x + 50, vy = this.vehicle.y;
    switch (this.currentWeapon) {
      case 'mg':
      case 'rifle':
        this.spawnBullet(vx, vy, w.damage, w.speed, w.color, W + 40);
        break;
      case 'double_mg':
        this.spawnBullet(vx, vy - 8, w.damage, w.speed, w.color, W + 40);
        this.spawnBullet(vx, vy + 8, w.damage, w.speed, w.color, W + 40);
        break;
      case 'flamethrower':
        this.spawnBullet(vx, vy + Phaser.Math.Between(-6, 6), 1, w.speed, w.color, vx - 50 + w.range);
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
    b.setVelocityX(speed).setDepth(8).setTint(color);
    b.setData('damage', damage);
    b.setData('maxX', maxX);
  }

  private spawnRocket(x: number, y: number) {
    const r = this.rockets.create(x, y, 'rocket') as Phaser.Physics.Arcade.Sprite;
    r.setVelocityX(WEAPONS.rockets.speed).setDepth(8);
    (r.body as Phaser.Physics.Arcade.Body).setSize(22, 8);
  }

  private fireAutoShot(y: number) {
    this.spawnBullet(this.vehicle.x + 50, y, 1, BULLET_SPEED, 0x00ffff, W + 40);
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
      this.spawnHitParticles(zombie.x, zombie.y);
      this.environment?.addDecal('blood', zombie.x, zombie.y);
      this.sfx?.playZombieKill();
      if (type === 'toxic') this.spawnToxicCloud(zombie.x, zombie.y);
      if (type === 'giant') {
        this.cameras.main.shake(200, 0.012);
        this.spawnHitParticles(zombie.x, zombie.y);
        this.spawnHitParticles(zombie.x + 10, zombie.y - 10);
      }
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

      case 'giant':
        zombie.destroy();
        this.damageComponent('armor', 30);
        this.damageComponent('engine', 20);
        this.damageComponent('wheels', 20);
        this.dealDamage(ZOMBIE_STATS.giant.damage);
        this.cameras.main.shake(400, 0.025);
        this.hitStop(50);
        this.spawnHitParticles(zombie.x, zombie.y);
        this.sfx?.playExplosion();
        this.environment?.addDecal('skid', zombie.x, zombie.y);
        this.environment?.addDecal('debris', zombie.x, zombie.y);
        this.environment?.addDecal('blood', zombie.x, zombie.y);
        break;

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
        this.addKillScore(ZOMBIE_STATS[z.getData('type') as ZombieType].score);
        this.spawnHitParticles(z.x, z.y);
        if (z.getData('type') === 'toxic') this.spawnToxicCloud(z.x, z.y);
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
    sprite.setScale(0.68).setDepth(11).setTint(type==='jumper' ? 0xffcc00 : 0xff8800);
    sprite.play(`walk_${type}`); sprite.anims.setProgress(Math.random());
    this.tweens.add({ targets: sprite, scaleX: 0.84, scaleY: 0.84, yoyo: true, duration: 110, repeat: 1 });
    this.attachedZombies.push({ sprite, slotIndex, comp: slot.comp, hp, timer: ATTACH_DAMAGE_INTERVAL });
    this.cameras.main.shake(70, 0.005);
    this.sfx?.playZombieAttach();
  }

  // ─── Toxic cloud ─────────────────────────────────────────────────────────────

  private spawnToxicCloud(x: number, y: number) {
    const cloud = this.toxicClouds.create(x, y, 'toxic_cloud') as Phaser.Physics.Arcade.Sprite;
    cloud.setVelocityX(-SCROLL_SPEED);
    cloud.setData('timer', 3000).setData('lastDmg', 0);
    cloud.setDepth(7).setScale(1.5);
    (cloud.body as Phaser.Physics.Arcade.Body).setSize(36, 36);
  }

  // ─── Component damage system ─────────────────────────────────────────────────

  private damageComponent(key: ComponentKey, amount: number) {
    if (this.debugGod) return;
    const comp = this.components[key];
    comp.health = Math.max(0, comp.health - amount);
    if (key === 'engine' && comp.health <= 0) this.endGame('Motore distrutto!');
  }

  private dealDamage(amount: number) {
    if (this.debugGod) return;
    const armorPct = this.components.armor.health / 100;
    const bonus = this.vehicleArmorBonus / 100;
    const base  = armorPct<=0 ? 2.5 : armorPct<0.3 ? 1.8 : armorPct<0.6 ? 1.3 : 1.0;
    const mult  = Math.max(0.5, base - bonus);
    this.health = Math.max(0, this.health - Math.round(amount * mult));
    this.flashHealthBar();
    if (this.health <= 0) this.endGame('Veicolo distrutto!');
  }

  /** Feedback al colpo: lampo bianco sulla barra salute + breve "thump" verticale. */
  private flashHealthBar() {
    const f = this.add.rectangle(63, 34, 116, 14, 0xffffff, 0.55).setDepth(24);
    this.tweens.add({ targets: f, alpha: 0, duration: 160, onComplete: () => f.destroy() });
    if (this.hudHealthFill) this.tweens.add({ targets: this.hudHealthFill, scaleY: 1.9, duration: 80, yoyo: true });
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

  private triggerMissionComplete() {
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

    const cx = W/2, cy = H/2;
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

    // Reset tutto al game over
    this.registry.set('missionNumber', 1);
    this.registry.set('money', 0);
    this.registry.set('survivors', []);
    this.registry.set('upgrades', {});
    this.registry.set('vehicle', 'civilian_car');
    this.registry.set('ownedVehicles', ['civilian_car']);
    this.registry.set('ownedWeapons', ['mg']);
    this.registry.set('currentWeapon', 'mg');
    this.registry.set('components', null);

    this.sfx?.playGameOver();
    this.sfx?.stopEngine();
    this.vehicle.setTint(0xff2200);
    this.cameras.main.shake(500, 0.018);
    this.zombies.setVelocityX(0);
    this.bullets.setVelocityX(0);
    this.fuelCans.setVelocityX(0);

    this.time.delayedCall(700, () => {
      const cx = W/2, cy = H/2;
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

  private spawnBoss() {
    this.bossSpawned = true;
    this.bossActive  = true;

    const missionNum: number = this.registry.get('missionNumber') ?? 1;
    const bossType = BOSS_ORDER[(missionNum - 1) % BOSS_ORDER.length];
    const cfg = BOSS_CONFIG[bossType];
    this.bossMaxHp = cfg.hp;

    // Alert
    const warn = Ui.text(this, W / 2, H / 2, `⚠  ${cfg.name.toUpperCase()}  ⚠`, {
      fontSize: '28px', color: '#ff4400', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(28).setAlpha(0);
    this.tweens.add({
      targets: warn, alpha: 1, duration: 250, yoyo: true, hold: 800,
      onComplete: () => {
        this.tweens.add({ targets: warn, alpha: 0, y: H / 2 - 60, duration: 1200, onComplete: () => warn.destroy() });
      },
    });
    this.cameras.main.shake(300, 0.016);
    this.sfx?.playExplosion();

    // Sprite boss (riusa zombie_giant scalato e tintato)
    const boss = this.bossGroup.create(W + 90, ROAD_CENTER, 'zombie_giant') as Phaser.Physics.Arcade.Sprite;
    boss.setScale(cfg.scaleX, cfg.scaleY).setTint(cfg.tint).setDepth(12);
    boss.play('walk_giant');
    boss.setData('bossType', bossType);
    boss.setData('hp', cfg.hp);
    const t1init = bossType === 'armored_colossus' ? 3000
                 : bossType === 'giant_worm'       ? 4000
                 : bossType === 'radioactive_beast' ? 2500
                 : 8000;
    boss.setData('timer1', t1init);
    boss.setData('lastVehicleHit', 0);
    (boss.body as Phaser.Physics.Arcade.Body).setSize(cfg.bodyW, cfg.bodyH);
    this.bossSprite = boss;

    this.showBossHUD(cfg.name);
  }

  private updateBoss(delta: number) {
    if (!this.bossSprite || !this.bossActive) return;
    const boss = this.bossSprite;
    if (!boss.active) { this.bossActive = false; return; }

    const bossType = boss.getData('bossType') as BossType;
    const cfg = BOSS_CONFIG[bossType];
    const body = boss.body as Phaser.Physics.Arcade.Body;
    const targetX = 560;

    // Avanzamento e stop
    if (boss.x > targetX) {
      body.setVelocityX(-cfg.speed);
    } else {
      body.setVelocityX(0);
      boss.x = targetX;
    }

    // Comportamento per tipo
    let t1 = (boss.getData('timer1') as number) - delta;
    boss.setData('timer1', t1);

    switch (bossType) {
      case 'mega_mutant':
        boss.y = Phaser.Math.Linear(boss.y, ROAD_CENTER + Math.sin(this.time.now / 800) * 90, 0.04);
        if (t1 <= 0) {
          boss.setData('timer1', 8000);
          this.spawnZombieAt('common', W - 80, boss.y - 44);
          this.spawnZombieAt('common', W - 80, boss.y + 44);
        }
        break;

      case 'giant_worm':
        boss.y = Phaser.Math.Linear(boss.y, ROAD_CENTER + Math.sin(this.time.now / 600) * 105, 0.05);
        if (t1 <= 0) {
          boss.setData('timer1', 4000);
          this.spawnToxicCloud(boss.x - 24, boss.y);
        }
        break;

      case 'armored_colossus':
        boss.y = Phaser.Math.Linear(boss.y, ROAD_CENTER, 0.03);
        if (t1 <= 0) {
          boss.setData('timer1', 3000);
          this.fireBossProjectile(boss.x - 32, boss.y);
        }
        break;

      case 'radioactive_beast':
        boss.y = Phaser.Math.Linear(boss.y, ROAD_CENTER + Math.sin(this.time.now / 700) * 75, 0.04);
        if (t1 <= 0) {
          boss.setData('timer1', 2500);
          this.spawnToxicCloud(boss.x - 10, boss.y);
          if (Math.random() < 0.5)
            this.spawnToxicCloud(boss.x + 20, boss.y + Phaser.Math.Between(-40, 40));
        }
        break;
    }

    boss.y = Phaser.Math.Clamp(boss.y, ROAD_TOP + 40, ROAD_BOTTOM - 40);

    // Aggiorna barra HP
    const hp = boss.getData('hp') as number;
    if (this.bossHudFill) {
      this.bossHudFill.displayWidth = Math.max(0, (hp / this.bossMaxHp) * 440);
      const pct = hp / this.bossMaxHp;
      this.bossHudFill.setFillStyle(pct < 0.25 ? 0xff2200 : pct < 0.55 ? 0xff8800 : 0xcc0000);
    }
  }

  private spawnZombieAt(type: ZombieType, x: number, y: number) {
    const stats = ZOMBIE_STATS[type];
    const z = this.zombies.create(
      x, Phaser.Math.Clamp(y, ROAD_TOP + 22, ROAD_BOTTOM - 22), `zombie_${type}`
    ) as Phaser.Physics.Arcade.Sprite;
    z.setScale(stats.scale).setData('hp', stats.hp).setData('type', type);
    z.setData('rockPhase', Math.random() * 6.28);
    z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9);
    (z.body as Phaser.Physics.Arcade.Body).setSize(20, 28);
    z.play(`walk_${type}`); z.anims.setProgress(Math.random());
  }

  private fireBossProjectile(x: number, fromY: number) {
    const p = this.bossProjectiles.create(x, fromY, 'bullet') as Phaser.Physics.Arcade.Sprite;
    const dy = Phaser.Math.Clamp(this.vehicle.y - fromY, -80, 80);
    p.setVelocityX(-200).setVelocityY(dy);
    p.setScale(2.4, 1.6).setTint(0x8844ff).setDepth(9);
    (p.body as Phaser.Physics.Arcade.Body).setSize(16, 6);
  }

  private onBulletHitBoss(bullet: Phaser.Physics.Arcade.Sprite, boss: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !boss.active) return;
    const dmg = (bullet.getData('damage') as number) ?? 1;
    bullet.destroy();
    const bossType = boss.getData('bossType') as BossType;
    this.damageBoss(boss, dmg);
    boss.setTint(0xffffff);
    this.time.delayedCall(60, () => { if (boss?.active) boss.setTint(BOSS_CONFIG[bossType].tint); });
  }

  private onRocketHitBoss(rocket: Phaser.Physics.Arcade.Sprite, boss: Phaser.Physics.Arcade.Sprite) {
    if (!rocket.active || !boss.active) return;
    const rx = rocket.x, ry = rocket.y;
    rocket.destroy();
    this.damageBoss(boss, WEAPONS.rockets.damage * 3);
    this.spawnHitParticles(rx, ry);
    this.spawnHitParticles(rx + 10, ry - 8);
    this.environment?.addDecal('scorch', rx, ry);
    Juice.lightFlash(this, rx, ry, 0xff8a33, 4);
    this.sfx?.playExplosion();
    this.cameras.main.shake(120, 0.009);
  }

  private onVehicleHitBoss(boss: Phaser.Physics.Arcade.Sprite) {
    if (!boss.active) return;
    const lastHit = (boss.getData('lastVehicleHit') as number) ?? 0;
    if (this.time.now - lastHit < 800) return;
    boss.setData('lastVehicleHit', this.time.now);
    this.dealDamage(20);
    this.damageComponent('armor', 25);
    this.cameras.main.shake(200, 0.016);
    this.sfx?.playExplosion();
  }

  private onBossProjectileHitVehicle(p: Phaser.Physics.Arcade.Sprite) {
    if (!p.active) return;
    p.destroy();
    this.dealDamage(12);
    this.damageComponent('turret', 8);
    this.cameras.main.shake(90, 0.006);
    this.sfx?.playImpact();
  }

  private damageBoss(boss: Phaser.Physics.Arcade.Sprite, amount: number) {
    const hp = (boss.getData('hp') as number) - amount;
    boss.setData('hp', hp);
    if (hp <= 0) this.killBoss();
  }

  private killBoss() {
    if (!this.bossSprite || !this.bossActive) return;
    this.bossActive = false;
    const bossType = this.bossSprite.getData('bossType') as BossType;
    const cfg = BOSS_CONFIG[bossType];
    const bx = this.bossSprite.x, by = this.bossSprite.y;

    // Esplosioni a catena
    for (let i = 0; i < 7; i++) {
      this.time.delayedCall(i * 130, () => {
        this.spawnHitParticles(bx + Phaser.Math.Between(-40, 40), by + Phaser.Math.Between(-30, 30));
        this.spawnHitParticles(bx + Phaser.Math.Between(-40, 40), by + Phaser.Math.Between(-30, 30));
        this.sfx?.playExplosion();
      });
    }

    this.bossSprite.destroy();
    this.bossSprite = null;
    this.cameras.main.shake(500, 0.022);
    this.hitStop(70);
    Juice.flash(this, 0xffffff, 0.5, 140);
    Juice.lightFlash(this, bx, by, 0xffbb55, 8, 460);

    const earned = cfg.reward;
    this.addKillScore(500);
    this.registry.set('money', (this.registry.get('money') ?? 0) + earned);
    this.hideBossHUD();

    const vt = Ui.text(this, W / 2, H / 2 - 10, `BOSS SCONFITTO!  +${earned} monete`, {
      fontSize: '24px', color: '#ffee00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(28);
    this.tweens.add({ targets: vt, alpha: 0, y: H / 2 - 80, duration: 2200, onComplete: () => vt.destroy() });
    this.sfx?.playMissionComplete();

    this.time.delayedCall(2200, () => this.triggerMissionComplete());
  }

  private showBossHUD(name: string) {
    const cx = W / 2, barW = 440, y = 96;
    const bg    = this.add.rectangle(cx, y, barW + 8, 20, UI.black, 0.85).setDepth(22).setAlpha(0);
    const fill  = this.add.rectangle(cx - barW / 2, y, barW, 14, UI.redCrit).setOrigin(0, 0.5).setDepth(23).setAlpha(0);
    const label = Ui.text(this, cx, y - 14, name.toUpperCase(), {
      fontSize: '13px', color: UI.red, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(23).setAlpha(0);

    this.bossHudObjects = [bg, fill, label];
    this.bossHudFill = fill;
    this.tweens.add({ targets: this.bossHudObjects, alpha: 1, duration: 400 });
  }

  private hideBossHUD() {
    if (!this.bossHudObjects.length) return;
    this.tweens.add({
      targets: this.bossHudObjects, alpha: 0, duration: 500,
      onComplete: () => {
        this.bossHudObjects.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
        this.bossHudObjects = [];
        this.bossHudFill = undefined;
      },
    });
  }

  // ─── Visual FX ───────────────────────────────────────────────────────────────

  private spawnHitParticles(x: number, y: number) {
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
}
