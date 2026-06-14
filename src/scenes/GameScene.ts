import Phaser from 'phaser';
import { VEHICLES, Upgrades, WeaponType, WEAPONS } from '../GameData';
import SoundManager from '../SoundManager';

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

type BossType = 'mega_mutant' | 'giant_worm' | 'armored_colossus' | 'radioactive_beast';

interface BossConfig {
  name: string; hp: number; speed: number; scaleX: number; scaleY: number;
  tint: number; bodyW: number; bodyH: number; reward: number;
}

const BOSS_CONFIG: Record<BossType, BossConfig> = {
  mega_mutant:       { name: 'Mega Mutante',      hp: 80,  speed: 55, scaleX: 2.8, scaleY: 2.8, tint: 0x22cc22, bodyW: 48, bodyH: 66, reward: 400 },
  giant_worm:        { name: 'Verme Gigante',      hp: 110, speed: 40, scaleX: 3.8, scaleY: 1.8, tint: 0xcc8822, bodyW: 80, bodyH: 38, reward: 500 },
  armored_colossus:  { name: 'Colosso Corazzato',  hp: 150, speed: 28, scaleX: 3.0, scaleY: 3.2, tint: 0x7788aa, bodyW: 52, bodyH: 70, reward: 650 },
  radioactive_beast: { name: 'Bestia Radioattiva', hp: 95,  speed: 50, scaleX: 2.6, scaleY: 2.6, tint: 0x88ff22, bodyW: 50, bodyH: 58, reward: 450 },
};

const BOSS_ORDER: BossType[] = ['mega_mutant', 'giant_worm', 'armored_colossus', 'radioactive_beast'];

interface EnvConfig {
  name: string;
  bgColor: number; skyColor: number; groundColor: number;
  roadColor: number; lineColor: number; shoulderColor: number;
}

const ENVIRONMENTS: EnvConfig[] = [
  { name: 'Città Distrutta',        bgColor: 0x12121e, skyColor: 0x16161e, groundColor: 0x1a1610, roadColor: 0x2a2a2a, lineColor: 0xddcc00, shoulderColor: 0x1e1e22 },
  { name: 'Autostrada Abbandonata', bgColor: 0x14120e, skyColor: 0x1c180e, groundColor: 0x141208, roadColor: 0x323028, lineColor: 0xaaaa44, shoulderColor: 0x201e16 },
  { name: 'Deserto',                bgColor: 0x1e1006, skyColor: 0x2e1a08, groundColor: 0x1e1408, roadColor: 0x4a3a1a, lineColor: 0xddaa00, shoulderColor: 0x2a2010 },
  { name: 'Foresta Infestata',      bgColor: 0x040c04, skyColor: 0x040c04, groundColor: 0x020802, roadColor: 0x141c10, lineColor: 0x66cc22, shoulderColor: 0x0a100a },
  { name: 'Zona Industriale',       bgColor: 0x0e0a08, skyColor: 0x120e0a, groundColor: 0x0c0806, roadColor: 0x1c1a18, lineColor: 0xff6600, shoulderColor: 0x181410 },
  { name: 'Base Militare',          bgColor: 0x080e06, skyColor: 0x0c1008, groundColor: 0x080e06, roadColor: 0x202818, lineColor: 0x88bb44, shoulderColor: 0x101608 },
  { name: 'Città Finale',           bgColor: 0x0c0612, skyColor: 0x100618, groundColor: 0x0c0612, roadColor: 0x180c22, lineColor: 0xcc44ff, shoulderColor: 0x140a1a },
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
  private rockets!: Phaser.Physics.Arcade.Group;
  private hudWeapon!: Phaser.GameObjects.Text;

  private sfx: SoundManager | null = null;

  // Boss system
  private bossActive = false;
  private bossSpawned = false;
  private bossSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private bossMaxHp = 0;
  private bossGroup!: Phaser.Physics.Arcade.Group;
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private bossHudObjects: Phaser.GameObjects.GameObject[] = [];
  private bossHudFill?: Phaser.GameObjects.Rectangle;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;

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
      this.sfx.startEngine();
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sfx?.stopEngine());
  }

  update(time: number, delta: number) {
    if (!this.alive || this.missionDone) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.scene.restart();
      return;
    }
    const dt = delta / 1000;
    this.updateVehicle(dt);
    this.updateFiring(time);
    this.updateFuel(dt);
    this.updateDistance(dt);
    this.updateZombieSpawning(delta);
    this.updateGiantSpawning(delta);
    this.updateBoss(delta);
    this.updateAttachedZombies(delta);
    this.checkBulletsVsAttached();
    this.updateToxicClouds(delta);
    this.updateSurvivorEffects(delta, time);
    this.updateStripes(dt);
    this.cleanOffScreen();
    this.updateHUD();
  }

  // ─── Textures ────────────────────────────────────────────────────────────────

  private buildTextures() {
    if (this.textures.exists('vehicle')) return;
    const G = (_w: number, _h: number) => this.make.graphics({ add: false } as any) as Phaser.GameObjects.Graphics & { generateTexture(k:string,w:number,h:number):void };

    // ── VEHICLE (100×44) ─────────────────────────────────────────────────────
    {
      const g = G(100,44);
      // Tires
      g.fillStyle(0x111111);
      [14,84].forEach(x => { g.fillEllipse(x,38,20,14); g.fillEllipse(x,6,20,14); });
      // Tire treads
      g.fillStyle(0x1e1e1e);
      [14,84].forEach(x => { [34,40].forEach(y => [x-6,x-3,x,x+3].forEach(tx => g.fillRect(tx,y-3,2,6))); });
      [14,84].forEach(x => { [2,8].forEach(y => [x-6,x-3,x,x+3].forEach(tx => g.fillRect(tx,y-3,2,6))); });
      // Rims
      g.fillStyle(0x666666); [14,84].forEach(x => { g.fillCircle(x,38,5); g.fillCircle(x,6,5); });
      g.fillStyle(0xbbbbbb); [14,84].forEach(x => { g.fillCircle(x,38,3); g.fillCircle(x,6,3); });
      g.fillStyle(0x444444); [14,84].forEach(x => { g.fillCircle(x,38,1); g.fillCircle(x,6,1); });
      // Undercarriage
      g.fillStyle(0x2a2a2a); g.fillRect(8,12,84,20);
      // Body (light gray → tinted by vehicle color)
      g.fillStyle(0xcccccc); g.fillRect(10,11,80,22);
      // Hood & trunk shading
      g.fillStyle(0xbbbbbb); g.fillRect(83,13,14,18); g.fillRect(3,13,9,18);
      // Roof
      g.fillStyle(0xdddddd); g.fillRect(26,5,42,8);
      // Panel seam lines
      g.fillStyle(0x999999); g.fillRect(10,22,80,2); g.fillRect(40,11,2,22); g.fillRect(62,11,2,22);
      // Windshield
      g.fillStyle(0x0d1a22); g.fillRect(27,10,22,15);
      g.fillStyle(0x2a5570, 0.7); g.fillRect(28,11,10,8); g.fillRect(40,11,6,6);
      // Headlights
      g.fillStyle(0xfff8aa); g.fillRect(91,14,8,6); g.fillRect(91,24,8,6);
      g.fillStyle(0xffffff); g.fillRect(93,15,4,4); g.fillRect(93,25,4,4);
      // Headlight halo
      g.fillStyle(0xffffdd,0.4); g.fillRect(95,15,4,2); g.fillRect(95,25,4,2);
      // Taillights
      g.fillStyle(0xcc0000); g.fillRect(2,14,8,6); g.fillRect(2,24,8,6);
      g.fillStyle(0xff3333); g.fillRect(3,15,4,4); g.fillRect(3,25,4,4);
      // Turret base
      g.fillStyle(0x555555); g.fillRect(46,3,18,9); g.fillStyle(0x666666); g.fillRect(47,4,16,7);
      // Gun barrel (3-layer for depth)
      g.fillStyle(0x333333); g.fillRect(62,5,32,8);
      g.fillStyle(0x555555); g.fillRect(62,6,32,6);
      g.fillStyle(0x777777); g.fillRect(62,7,30,4);
      // Muzzle brake
      g.fillStyle(0x222222); g.fillRect(90,4,10,9);
      g.fillStyle(0x000000); g.fillRect(91,5,8,2); g.fillRect(91,10,8,2);
      // Body top sheen
      g.fillStyle(0xffffff,0.1); g.fillRect(10,11,80,5);
      // Exhaust
      g.fillStyle(0x333333); g.fillRect(0,17,9,4); g.fillRect(0,23,9,4);
      g.fillStyle(0x111111); g.fillRect(0,18,6,2); g.fillRect(0,24,6,2);
      // Front bumper
      g.fillStyle(0x666666); g.fillRect(91,15,8,14); g.fillStyle(0x888888); g.fillRect(92,16,6,2);
      g.generateTexture('vehicle', 100, 44);
      g.destroy();
    }

    // ── ZOMBIE COMMON (30×44) ─────────────────────────────────────────────────
    {
      const g = G(30,44);
      // Shadow
      g.fillStyle(0x000000,0.25); g.fillEllipse(15,43,20,5);
      // Boots
      g.fillStyle(0x1a0f00); g.fillRect(5,38,8,5); g.fillRect(17,38,8,5);
      // Legs
      g.fillStyle(0x2a4a2a); g.fillRect(6,26,7,14); g.fillRect(17,26,7,14);
      g.fillStyle(0x3a6a3a); g.fillRect(7,29,4,5); g.fillRect(18,29,4,5);
      // Torso (torn shirt)
      g.fillStyle(0x142814); g.fillRect(8,14,14,14);
      g.fillStyle(0x2a4a2a); g.fillRect(9,15,4,4); g.fillRect(18,17,3,5);
      // Blood on torso
      g.fillStyle(0x880000); g.fillRect(10,18,4,4); g.fillRect(17,22,3,4);
      // Arms outstretched (zombie pose)
      g.fillStyle(0x2a7a2a);
      g.fillRect(-5,16,13,5); g.fillRect(22,16,13,5);
      g.fillStyle(0x3a9a3a); g.fillRect(-7,17,5,3); g.fillRect(32,17,5,3);
      // Hands
      g.fillStyle(0x3a9a3a); g.fillCircle(-7,18,4); g.fillCircle(37,18,4);
      g.fillStyle(0x111111);
      [-3,0,3].forEach(d => g.fillRect(-12,16+d,5,2));
      [-3,0,3].forEach(d => g.fillRect(37,16+d,5,2));
      // Neck
      g.fillStyle(0x3a9a3a); g.fillRect(12,8,6,7);
      // Head base
      g.fillStyle(0x3a9a3a); g.fillRect(7,1,16,14); g.fillCircle(15,3,8);
      // Hair (dark, matted)
      g.fillStyle(0x0f0a00); g.fillRect(7,0,16,7); g.fillCircle(15,1,8);
      g.fillRect(6,1,3,10); g.fillRect(21,1,3,10);
      // Eye sockets
      g.fillStyle(0x111111); g.fillRect(8,7,6,5); g.fillRect(16,7,6,5);
      // Eyes glowing red
      g.fillStyle(0xff2200); g.fillRect(9,8,4,3); g.fillRect(17,8,4,3);
      g.fillStyle(0xff8866); g.fillRect(10,8,2,2); g.fillRect(18,8,2,2);
      // Mouth
      g.fillStyle(0x440000); g.fillRect(8,13,14,3);
      g.fillStyle(0x990000); g.fillRect(9,14,12,1);
      g.fillStyle(0xbbaa88); [9,11,14,16,18].forEach(x => g.fillRect(x,13,2,3));
      // Head wound
      g.fillStyle(0x770000); g.fillRect(19,3,3,6); g.fillStyle(0xaa0000); g.fillRect(20,4,2,4);
      g.generateTexture('zombie_common', 30, 44);
      g.destroy();
    }

    // ── ZOMBIE RUNNER (26×42) ─────────────────────────────────────────────────
    {
      const g = G(26,42);
      g.fillStyle(0x000000,0.2); g.fillEllipse(13,41,18,4);
      // Feet (forward thrust)
      g.fillStyle(0x111111); g.fillRect(2,37,8,4); g.fillRect(14,35,8,4);
      // Lean legs
      g.fillStyle(0x6a1a1a); g.fillRect(3,24,6,14); g.fillRect(15,22,6,14);
      g.fillStyle(0x8a3333); g.fillRect(4,27,3,5); g.fillRect(16,25,3,5);
      // Lean torso (forward hunched)
      g.fillStyle(0x3a0808); g.fillRect(7,13,12,13);
      g.fillStyle(0x6a1a1a); g.fillRect(8,14,4,4); g.fillRect(14,16,3,5);
      // Arms swept back
      g.fillStyle(0x8a2222);
      g.fillRect(-4,17,11,4); // right arm back
      g.fillRect(19,14,10,4); // left arm forward
      g.fillStyle(0xaa3333); g.fillCircle(-4,19,3); g.fillCircle(29,16,3);
      g.fillStyle(0x111111);
      [-2,0,2].forEach(d => g.fillRect(-8,17+d,4,2));
      [-2,0,2].forEach(d => g.fillRect(29,14+d,4,2));
      // Neck
      g.fillStyle(0xaa3333); g.fillRect(10,7,6,7);
      // Head (angular)
      g.fillStyle(0xaa3333); g.fillRect(6,1,14,13); g.fillCircle(13,3,7);
      g.fillStyle(0x110000); g.fillRect(7,0,13,6); g.fillCircle(13,2,7);
      // Eyes (orange-red, intense)
      g.fillStyle(0x110000); g.fillRect(7,5,5,5); g.fillRect(14,5,5,5);
      g.fillStyle(0xff5500); g.fillRect(8,6,3,3); g.fillRect(15,6,3,3);
      g.fillStyle(0xffaa44); g.fillRect(9,6,1,2); g.fillRect(16,6,1,2);
      // Snarl
      g.fillStyle(0x330000); g.fillRect(8,10,10,3);
      g.fillStyle(0x991111); g.fillRect(9,11,8,1);
      g.fillStyle(0xbbaa88); [9,11,13,16].forEach(x => g.fillRect(x,10,2,3));
      g.generateTexture('zombie_runner', 26, 42);
      g.destroy();
    }

    // ── ZOMBIE ARMORED (38×48) ─────────────────────────────────────────────────
    {
      const g = G(38,48);
      g.fillStyle(0x000000,0.35); g.fillEllipse(19,47,28,6);
      // Heavy boots
      g.fillStyle(0x1a1a1a); g.fillRect(4,41,12,7); g.fillRect(22,41,12,7);
      g.fillStyle(0x333333); g.fillRect(4,41,12,3); g.fillRect(22,41,12,3);
      // Armored legs
      g.fillStyle(0x667788); g.fillRect(5,28,12,15); g.fillRect(21,28,12,15);
      g.fillStyle(0x778899); g.fillRect(6,29,10,6); g.fillRect(22,29,10,6);
      g.fillStyle(0x445566); g.fillRect(5,34,12,2); g.fillRect(21,34,12,2);
      // Chest plate
      g.fillStyle(0x778899); g.fillRect(4,14,30,16);
      g.fillStyle(0x8899aa); g.fillRect(5,15,28,13);
      g.fillStyle(0x667788); g.fillRect(5,20,28,2); g.fillRect(18,14,2,16);
      // Bolt rivets
      g.fillStyle(0xaabbcc);
      [[6,15],[30,15],[6,24],[30,24]].forEach(([x,y]) => g.fillRect(x,y,2,2));
      // Shoulder pads
      g.fillStyle(0x8899aa); g.fillRect(-2,13,9,12); g.fillRect(31,13,9,12);
      g.fillStyle(0x9aabbb); g.fillRect(-1,14,7,9); g.fillRect(32,14,7,9);
      // Armored arms
      g.fillStyle(0x667788); g.fillRect(-8,20,10,7); g.fillRect(36,20,10,7);
      g.fillStyle(0x8899aa); g.fillRect(-9,21,9,5); g.fillRect(37,21,9,5);
      // Gauntlets
      g.fillStyle(0x8899aa); g.fillRect(-11,23,8,8); g.fillRect(41,23,8,8);
      g.fillStyle(0x555555);
      [-2,0,2].forEach(d => g.fillRect(-14,22+d,4,2));
      [-2,0,2].forEach(d => g.fillRect(48,22+d,4,2));
      // Neck guard
      g.fillStyle(0x667788); g.fillRect(14,8,10,8);
      // Helmet
      g.fillStyle(0x556677); g.fillRect(7,0,24,16); g.fillCircle(19,3,12);
      g.fillStyle(0x667788); g.fillRect(8,1,22,13); g.fillCircle(19,3,11);
      // Visor (slit)
      g.fillStyle(0x0a1520); g.fillRect(9,8,20,7);
      g.fillStyle(0x1a3040,0.8); g.fillRect(10,9,18,5);
      // Eyes behind visor
      g.fillStyle(0xffffff); g.fillRect(11,10,5,3); g.fillRect(22,10,5,3);
      // Mouth grille
      g.fillStyle(0x445566); g.fillRect(12,14,14,4);
      [13,16,19,22].forEach(x => g.fillRect(x,14,2,4));
      g.generateTexture('zombie_armored', 38, 48);
      g.destroy();
    }

    // ── ZOMBIE JUMPER (32×46) ─────────────────────────────────────────────────
    {
      const g = G(32,46);
      g.fillStyle(0x000000,0.3); g.fillEllipse(16,45,24,5);
      // Crouched/bent legs
      g.fillStyle(0x6a5500);
      g.fillRect(5,24,8,10);  g.fillRect(19,24,8,10); // thighs
      g.fillRect(3,32,8,11);  g.fillRect(21,32,8,11); // shins (angled out)
      // Feet with clawed toes
      g.fillStyle(0x3a2a00); g.fillRect(0,41,12,4); g.fillRect(20,41,12,4);
      g.fillStyle(0x111111);
      [0,3,6].forEach(x => g.fillRect(x,42,2,3));
      [21,24,27].forEach(x => g.fillRect(x,42,2,3));
      // Leg muscle highlight
      g.fillStyle(0x9a8800); g.fillRect(6,25,5,7); g.fillRect(20,25,5,7);
      // Coiled torso
      g.fillStyle(0x3a2a00); g.fillRect(9,12,14,14);
      g.fillStyle(0x6a5500); g.fillRect(10,13,4,5); g.fillRect(18,15,3,5);
      // Arms raised high (ready to grab)
      g.fillStyle(0x8a7700);
      g.fillRect(-6,10,14,5); g.fillRect(24,10,14,5);
      g.fillRect(-8,6,7,10); g.fillRect(33,6,7,10);
      // Claws
      g.fillStyle(0xaaaa00); g.fillCircle(-6,9,4); g.fillCircle(38,9,4);
      g.fillStyle(0x111111);
      [-4,-1,2].forEach(d => g.fillRect(-10,7+d,5,2));
      [-4,-1,2].forEach(d => g.fillRect(37,7+d,5,2));
      // Neck
      g.fillStyle(0xaaaa00); g.fillRect(13,6,6,7);
      // Head
      g.fillStyle(0xaaaa00); g.fillRect(8,0,16,12); g.fillCircle(16,2,8);
      g.fillStyle(0x3a2a00); g.fillRect(8,-1,16,6); g.fillCircle(16,0,8);
      g.fillRect(7,0,3,10); g.fillRect(22,0,3,10);
      // Eyes (intense yellow)
      g.fillStyle(0x111100); g.fillRect(9,3,7,5); g.fillRect(16,3,7,5);
      g.fillStyle(0xffee00); g.fillRect(10,4,5,3); g.fillRect(17,4,5,3);
      g.fillStyle(0xffffff); g.fillRect(11,4,2,2); g.fillRect(18,4,2,2);
      // Snarl
      g.fillStyle(0x221100); g.fillRect(9,9,14,3);
      g.fillStyle(0xbb8800); g.fillRect(10,10,12,1);
      g.fillStyle(0xddcc88); [10,12,15,17,19].forEach(x => g.fillRect(x,9,2,3));
      g.generateTexture('zombie_jumper', 32, 46);
      g.destroy();
    }

    // ── ZOMBIE TOXIC (30×48) ─────────────────────────────────────────────────
    {
      const g = G(30,48);
      // Toxic pool glow
      g.fillStyle(0x004400,0.4); g.fillEllipse(15,47,28,7);
      // Feet (dripping)
      g.fillStyle(0x002200); g.fillRect(4,43,9,5); g.fillRect(17,43,9,5);
      g.fillStyle(0x00aa22,0.6); g.fillRect(5,47,3,2); g.fillRect(20,46,3,3);
      // Bloated legs
      g.fillStyle(0x1a5522); g.fillRect(4,30,9,15); g.fillRect(17,30,9,15);
      // Toxic veins on legs
      g.fillStyle(0x00ee44); g.fillRect(5,33,2,9); g.fillRect(19,35,2,7);
      // Swollen torso
      g.fillStyle(0x0a3311); g.fillEllipse(15,21,26,22);
      g.fillStyle(0x1a5522); g.fillEllipse(15,21,24,20);
      // Blisters
      g.fillStyle(0x00dd33);
      g.fillCircle(8,18,4); g.fillCircle(21,19,5); g.fillCircle(13,24,3); g.fillCircle(20,25,3);
      g.fillStyle(0x00ff44,0.5);
      g.fillCircle(8,18,2); g.fillCircle(21,19,3);
      // Arms (dripping slime)
      g.fillStyle(0x1a5522);
      g.fillRect(-7,17,13,7); g.fillRect(24,17,13,7);
      g.fillStyle(0x00aa22,0.5); g.fillRect(-7,22,13,3); g.fillRect(24,22,13,3);
      g.fillStyle(0x2a7733); g.fillCircle(-6,20,4); g.fillCircle(36,20,4);
      g.fillStyle(0x00ff33);
      [-3,0,3].forEach(d => g.fillRect(-11,18+d,4,2));
      [-3,0,3].forEach(d => g.fillRect(37,18+d,4,2));
      // Slime drips hanging
      g.fillStyle(0x00cc33,0.7);
      g.fillRect(-4,26,2,5); g.fillRect(1,28,2,4); g.fillRect(26,25,2,6); g.fillRect(31,27,2,5);
      // Swollen head
      g.fillStyle(0x2a7733); g.fillEllipse(15,5,24,16); g.fillStyle(0x1a5522); g.fillEllipse(15,5,22,14);
      // Cracked skull
      g.fillStyle(0x0a3311); g.fillRect(11,-1,2,6); g.fillRect(17,0,2,5); g.fillRect(7,2,2,5);
      // Glowing eyes
      g.fillStyle(0x002200); g.fillRect(6,1,8,7); g.fillRect(16,1,8,7);
      g.fillStyle(0x00ff44); g.fillRect(7,2,6,5); g.fillRect(17,2,6,5);
      g.fillStyle(0x88ffaa); g.fillRect(8,2,3,3); g.fillRect(18,2,3,3);
      // Leaking mouth
      g.fillStyle(0x001a00); g.fillRect(8,8,14,4);
      g.fillStyle(0x00cc22,0.8); g.fillRect(8,8,14,4);
      g.fillStyle(0x00ff44,0.6); g.fillRect(10,12,3,6); g.fillRect(16,11,3,7);
      // Aura glow
      g.fillStyle(0x00ff44,0.1); g.fillCircle(15,20,20);
      g.generateTexture('zombie_toxic', 30, 48);
      g.destroy();
    }

    // ── ZOMBIE GIANT (48×66) ─────────────────────────────────────────────────
    {
      const g = G(48,66);
      g.fillStyle(0x000000,0.4); g.fillEllipse(24,65,44,8);
      // Massive boots
      g.fillStyle(0x100a00); g.fillRect(4,57,16,9); g.fillRect(28,57,16,9);
      g.fillStyle(0x221500); g.fillRect(4,57,16,4); g.fillRect(28,57,16,4);
      // Thick legs
      g.fillStyle(0x4a2811); g.fillRect(5,36,16,23); g.fillRect(27,36,16,23);
      // Leg muscle highlight
      g.fillStyle(0x6a4022); g.fillRect(7,38,8,12); g.fillRect(29,38,8,12);
      // Leg wounds
      g.fillStyle(0x660000); g.fillRect(6,44,5,8); g.fillRect(35,46,4,6);
      g.fillStyle(0xaa0000); g.fillRect(7,45,3,6); g.fillRect(36,47,2,5);
      // Massive torso
      g.fillStyle(0x3a2011); g.fillRect(3,16,42,22);
      g.fillStyle(0x4a2811); g.fillRect(4,17,40,20);
      // Belly bulge
      g.fillStyle(0x5a3822); g.fillEllipse(24,30,36,18);
      g.fillStyle(0x4a2811); g.fillEllipse(24,29,32,14);
      // Rib scarring
      g.fillStyle(0x3a2011); [18,22,26,30,34].forEach(y => g.fillRect(6,y,14,2));
      // Huge arms
      g.fillStyle(0x4a2811); g.fillRect(-12,14,18,12); g.fillRect(42,14,18,12);
      g.fillStyle(0x6a4022); g.fillRect(-10,15,14,8); g.fillRect(44,15,14,8);
      // Forearms
      g.fillStyle(0x5a3020); g.fillRect(-16,19,10,8); g.fillRect(54,19,10,8);
      // Fists
      g.fillStyle(0x5a3020); g.fillRect(-20,20,12,10); g.fillRect(56,20,12,10);
      g.fillStyle(0x3a1a00);
      g.fillRect(-20,20,12,3); g.fillRect(56,20,12,3);
      // Knuckles
      g.fillStyle(0x7a5033);
      [-18,-14,-10,-6].forEach(x => g.fillRect(x,20,3,4));
      [57,61,65,69].forEach(x => g.fillRect(x,20,3,4));
      // Neck (massive)
      g.fillStyle(0x5a3822); g.fillRect(17,8,14,10);
      g.fillStyle(0x3a2011); g.fillRect(17,8,3,10); g.fillRect(28,8,3,10);
      // Head
      g.fillStyle(0x5a3822); g.fillRect(10,0,28,14); g.fillEllipse(24,3,30,14);
      g.fillStyle(0x4a2811); g.fillRect(11,1,26,12); g.fillEllipse(24,3,28,12);
      // Skull ridges
      g.fillStyle(0x3a1a00); g.fillRect(12,0,24,5); g.fillEllipse(24,1,28,8);
      [13,17,21,25,29,33].forEach(x => g.fillRect(x,0,3,4));
      // Deep eye sockets
      g.fillStyle(0x0a0000); g.fillRect(12,4,10,8); g.fillRect(26,4,10,8);
      // Glowing red eyes
      g.fillStyle(0xcc1100); g.fillRect(13,5,8,6); g.fillRect(27,5,8,6);
      g.fillStyle(0xff4422); g.fillRect(14,6,6,4); g.fillRect(28,6,6,4);
      g.fillStyle(0xff9977); g.fillRect(15,6,3,3); g.fillRect(29,6,3,3);
      // Nose (crushed)
      g.fillStyle(0x3a1a00); g.fillRect(20,9,8,4);
      g.fillStyle(0x0a0000); g.fillCircle(22,12,2); g.fillCircle(26,12,2);
      // Massive jaw
      g.fillStyle(0x1a0000); g.fillRect(13,12,22,6);
      g.fillStyle(0x550000); g.fillRect(14,13,20,4);
      // Broken teeth
      g.fillStyle(0xbbaa88); [14,17,21,24,28,31].forEach(x => g.fillRect(x,12,3,6));
      g.fillStyle(0x777755); [16,23,30].forEach(x => g.fillRect(x,12,2,4));
      // Blood drips from mouth
      g.fillStyle(0x880000);
      g.fillRect(18,17,3,8); g.fillRect(25,18,2,6); g.fillRect(31,16,3,9);
      g.fillStyle(0xaa0000); g.fillRect(19,17,1,7); g.fillRect(32,17,1,8);
      // Face scar
      g.fillStyle(0x550000); g.fillRect(35,2,3,13); g.fillStyle(0x880000); g.fillRect(36,3,1,11);
      g.generateTexture('zombie_giant', 48, 66);
      g.destroy();
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
  }

  // ─── World & entities ────────────────────────────────────────────────────────

  private buildWorld() {
    const env = ENVIRONMENTS[this.envIndex];

    // Sfondo + fasce
    this.add.rectangle(W/2, H/2, W, H, env.bgColor);
    this.add.rectangle(W/2, ROAD_TOP / 2, W, ROAD_TOP, env.skyColor);
    this.add.rectangle(W/2, (ROAD_BOTTOM + H) / 2, W, H - ROAD_BOTTOM, env.groundColor);

    // Decoratori ambiente (sopra e sotto la strada)
    const dg = this.add.graphics();
    this.drawDecorators(dg, this.envIndex);

    // Strada
    this.add.rectangle(W/2, ROAD_CENTER, W, ROAD_BOTTOM - ROAD_TOP, env.roadColor);
    this.add.rectangle(W/2, ROAD_TOP,    W, 4, env.lineColor);
    this.add.rectangle(W/2, ROAD_BOTTOM, W, 4, env.lineColor);
    this.add.rectangle(W/2, ROAD_TOP    - 10, W, 16, env.shoulderColor);
    this.add.rectangle(W/2, ROAD_BOTTOM + 10, W, 16, env.shoulderColor);

    // Strisce centrali
    const count = Math.ceil(W / STRIPE_GAP) + 3;
    for (let i = 0; i < count; i++) {
      const r = this.add.rectangle(i * STRIPE_GAP, ROAD_CENTER, STRIPE_W, 4, 0xffffff, 0.3).setDepth(1);
      this.stripes.push(r);
    }

    // Banner nome ambiente (scompare dopo 2.5s)
    const envLabel = this.add.text(W / 2, ROAD_TOP - 28, env.name.toUpperCase(), {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
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

  private drawDecorators(g: Phaser.GameObjects.Graphics, idx: number) {
    const SB = ROAD_TOP - 6;   // sky bottom (appoggio decorazioni sopra)
    const GT = ROAD_BOTTOM + 6; // ground top

    switch (idx) {
      case 0: { // Città Distrutta
        g.fillStyle(0x202028);
        [20,80,150,230,320,430,540,650,730].forEach((x, i) => {
          const bw = 48 + (i % 3) * 18;
          const bh = 38 + (i % 4) * 22;
          g.fillRect(x, SB - bh, bw, bh);
          // finestre
          g.fillStyle(0x0e0e22);
          for (let wy = SB - bh + 6; wy < SB - 6; wy += 12)
            for (let wx = x + 4; wx < x + bw - 4; wx += 12)
              g.fillRect(wx, wy, 5, 7);
          g.fillStyle(0x202028);
        });
        // macerie sotto
        g.fillStyle(0x252520);
        [20,110,200,330,470,590,700].forEach(x => g.fillRect(x, GT + 4, 35, 14));
        break;
      }
      case 1: { // Autostrada Abbandonata
        // alberi morti
        g.fillStyle(0x2a2418);
        [40,130,260,400,530,660,770].forEach((x, i) => {
          const th = 48 + (i % 3) * 18;
          g.fillRect(x, SB - th, 5, th);
          g.fillRect(x - 14, SB - th + 6, 12, 4);
          g.fillRect(x + 5,  SB - th + 14, 13, 4);
        });
        // guardrail sopra e sotto
        g.fillStyle(0x3a3830);
        g.fillRect(0, SB - 10, W, 4);
        for (let x = 0; x < W; x += 38) g.fillRect(x, SB - 16, 4, 10);
        g.fillRect(0, GT + 2,  W, 4);
        g.fillRect(0, GT + 14, W, 3);
        for (let x = 0; x < W; x += 38) g.fillRect(x, GT, 4, 18);
        break;
      }
      case 2: { // Deserto
        // dune sopra (approssimazione con rettangoli)
        g.fillStyle(0x3a2c14);
        for (let x = 0; x <= W; x += 2) {
          const ht = Math.round(Math.sin(x / 120 * Math.PI) * 30 + Math.sin(x / 60 * Math.PI) * 12);
          if (ht > 0) g.fillRect(x, SB - ht, 2, ht + 2);
        }
        // cactus
        g.fillStyle(0x2a441a);
        [70,220,370,530,680].forEach(x => {
          g.fillRect(x + 4, SB - 52, 10, 52);
          g.fillRect(x - 8,  SB - 38, 12, 8);
          g.fillRect(x - 8,  SB - 50, 8,  14);
          g.fillRect(x + 14, SB - 33, 12, 8);
          g.fillRect(x + 20, SB - 45, 8,  14);
        });
        // dune sotto
        g.fillStyle(0x3a2c12);
        for (let x = 0; x <= W; x += 2) {
          const ht = Math.round(Math.sin(x / 100 * Math.PI) * 18 + 6);
          g.fillRect(x, GT, 2, ht);
        }
        break;
      }
      case 3: { // Foresta Infestata
        g.fillStyle(0x0a1e08);
        for (let x = 0; x < W + 10; x += 32) {
          const th = 55 + (x % 5) * 8;
          // triangolo albero
          for (let dy = 0; dy < th; dy++) {
            const hw = Math.round((dy / th) * 18);
            g.fillRect(x + 18 - hw, SB - th + dy, hw * 2, 3);
          }
          g.fillRect(x + 14, SB - 8, 8, 10); // tronco
        }
        // sottobosco
        g.fillStyle(0x0c1a08);
        for (let x = 0; x < W; x += 48) g.fillRect(x, GT, 32, 8 + (x % 4) * 3);
        break;
      }
      case 4: { // Zona Industriale
        // ciminiere
        g.fillStyle(0x2a2420);
        [60,180,340,500,660].forEach((x, i) => {
          const sh = 65 + (i % 3) * 22;
          g.fillRect(x, SB - sh, 20, sh);
          g.fillRect(x - 4, SB - sh, 28, 8); // bordo
        });
        // fabbrica (sfondo basso)
        g.fillStyle(0x1e1c18);
        g.fillRect(0, SB - 35, W, 35);
        // fumo simulato
        g.fillStyle(0x181614);
        [60,180,340,500,660].forEach(x => {
          g.fillCircle(x + 10, SB - 70, 10);
          g.fillCircle(x + 16, SB - 80, 7);
        });
        // tubi sotto
        g.fillStyle(0x302820);
        g.fillRect(0, GT + 4, W, 10);
        g.fillRect(0, GT + 20, W, 6);
        for (let x = 0; x < W; x += 75) g.fillRect(x, GT, 14, 28);
        break;
      }
      case 5: { // Base Militare
        // torrette di guardia
        g.fillStyle(0x1e2a14);
        [90,340,590].forEach(x => {
          g.fillRect(x + 4, SB - 75, 7, 75);
          g.fillRect(x - 18, SB - 80, 46, 18);
          g.fillRect(x - 20, SB - 86, 50, 8);
          g.fillStyle(0x446644);
          g.fillRect(x - 6, SB - 74, 5, 10);
          g.fillStyle(0x1e2a14);
        });
        // recinzione sopra
        g.fillStyle(0x2a3820);
        g.fillRect(0, SB - 18, W, 4);
        for (let x = 0; x < W; x += 14) g.fillRect(x, SB - 26, 3, 12);
        // sacchi di sabbia sotto
        g.fillStyle(0x2a2a1a);
        for (let x = 0; x < W; x += 44) {
          g.fillRect(x, GT + 2,  42, 14);
          g.fillRect(x + 5, GT, 32, 10);
        }
        break;
      }
      case 6: { // Città Finale
        // grattacieli drammatici
        [0,52,115,185,260,340,430,515,595,660,730].forEach((x, i) => {
          const bw = 44 + (i % 4) * 8;
          const bh = 58 + (i % 6) * 16;
          g.fillStyle(0x1a0c22);
          g.fillRect(x, SB - bh, bw, bh);
          // finestre illuminate (viola/rosa)
          for (let wy = SB - bh + 5; wy < SB - 5; wy += 10)
            for (let wx = x + 4; wx < x + bw - 4; wx += 9) {
              g.fillStyle(Math.random() > 0.5 ? 0x4a1a6a : 0x0e060e);
              g.fillRect(wx, wy, 4, 5);
            }
        });
        // pavimento sotto — tinta drammatica
        g.fillStyle(0x160820);
        g.fillRect(0, GT, W, H - GT);
        g.fillStyle(0x220c30);
        [50,160,300,450,600,720].forEach(x => g.fillRect(x, GT, 50, 40));
        break;
      }
    }
  }

  private buildVehicle() {
    this.vehicle = this.physics.add.sprite(VEHICLE_X, ROAD_CENTER, 'vehicle');
    (this.vehicle.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(false);
    (this.vehicle.body as Phaser.Physics.Arcade.Body).setSize(72, 22);
    this.vehicle.setDepth(10).setTint(VEHICLES[this.vehicleKey].color);
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
    panel.fillStyle(0x000000, 0.62); panel.fillRect(0,0,W,84);
    panel.lineStyle(1,0x333333,0.7); panel.lineBetween(0,46,W,46);

    this.add.text(8,8,'SALUTE',{fontSize:'11px',color:'#ff8888'}).setDepth(D+1);
    this.add.rectangle(8+BAR_W/2,34,BAR_W,10,0x331111).setDepth(D+1);
    this.hudHealthFill = this.add.rectangle(8,34,BAR_W,10,0xff4444).setOrigin(0,0.5).setDepth(D+2);

    this.add.text(138,8,'CARBURANTE',{fontSize:'11px',color:'#ffaa66'}).setDepth(D+1);
    this.add.rectangle(138+BAR_W/2,34,BAR_W,10,0x331800).setDepth(D+1);
    this.hudFuelFill = this.add.rectangle(138,34,BAR_W,10,0xff8800).setOrigin(0,0.5).setDepth(D+2);
    this.hudFuelNum  = this.add.text(255,28,'',{fontSize:'11px',color:'#ffaa66'}).setDepth(D+2);

    this.hudScore    = this.add.text(290,6,'PUNTEGGIO: 0',{fontSize:'13px',color:'#ffffff'}).setDepth(D+1);
    this.add.text(620,6,`MISS.${missionNum}`,{fontSize:'12px',color:'#88ff88'}).setDepth(D+1);
    this.hudAttached = this.add.text(700,6,'',{fontSize:'11px',color:'#ff8800'}).setDepth(D+1);
    this.hudWeapon   = this.add.text(620,22,'',{fontSize:'10px',color:'#ffaa44'}).setDepth(D+1);

    // Barra progresso missione
    const DIST_KM = Math.floor(MISSION_DIST / 100);
    const DIST_BAR_W = 110;
    this.add.text(290,24,'PERCORSO',{fontSize:'10px',color:'#7777aa'}).setDepth(D+1);
    this.hudDist = this.add.text(395,24,'',{fontSize:'10px',color:'#aaaaff'}).setDepth(D+2);
    this.add.rectangle(290+DIST_BAR_W/2,37,DIST_BAR_W,7,0x111122).setDepth(D+1);
    this.hudDistFill = this.add.rectangle(290,37,DIST_BAR_W,7,0x4466cc).setOrigin(0,0.5).setDepth(D+2);
    // label meta (static)
    this.add.text(408,33,`/ ${DIST_KM} km`,{fontSize:'9px',color:'#445577'}).setDepth(D+1);

    // Survivors icons
    if (this.activeSurvivors.length > 0) {
      const names: Record<string,string> = { mechanic:'[M]', medic:'[+]', soldier:'[S]', explorer:'[E]' };
      const txt = this.activeSurvivors.map(s => names[s]??s).join(' ');
      this.add.text(W-10,8,txt,{fontSize:'11px',color:'#cccc44'}).setOrigin(1,0).setDepth(D+1);
    }

    const compKeys: ComponentKey[] = ['engine','wheels','tank','turret','armor'];
    compKeys.forEach((key,i) => {
      const comp = this.components[key];
      const sx = 10 + i * 158;
      this.add.text(sx,49,comp.label,{fontSize:'10px',color:'#888888'}).setDepth(D+1);
      this.add.rectangle(sx+COMP_BAR_W/2,72,COMP_BAR_W,7,0x1a1a1a).setDepth(D+1);
      const fill = this.add.rectangle(sx,72,COMP_BAR_W,7,comp.baseColor).setOrigin(0,0.5).setDepth(D+2);
      comp.fill = fill;
    });

    this.add.text(W/2,H-6,'↑↓ Muovi   SPAZIO Spara',{fontSize:'11px',color:'#333333'}).setOrigin(0.5,1).setDepth(D);
  }

  private buildInput() {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
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

  private updateFuel(dt: number) {
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
            this.score += 5;
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
    this.hudHealthFill.setFillStyle(hpPct < 0.3 ? 0xff2222 : hpPct < 0.6 ? 0xffaa00 : 0x44cc44);

    this.hudFuelFill.displayWidth = Math.max(0, (this.fuel / this.maxFuel) * 110);
    this.hudFuelNum.setText(`${Math.round(this.fuel)}%`);
    this.hudScore.setText(`PUNTEGGIO: ${this.score}`);
    const km = Math.floor(this.distance / 100);
    this.hudDist.setText(`${km} km`);
    const distPct = Math.min(1, this.distance / MISSION_DIST);
    this.hudDistFill.displayWidth = Math.max(1, distPct * 110);
    const barColor = distPct > 0.8 ? 0x88ff44 : distPct > 0.5 ? 0x44aaff : 0x4466cc;
    this.hudDistFill.setFillStyle(barColor);

    const n = this.attachedZombies.length;
    this.hudAttached.setText(n > 0 ? `[${n} aggrappati]` : '');
    this.hudWeapon.setText(WEAPONS[this.currentWeapon].name.toUpperCase());

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

  private spawnZombie() {
    const type = SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
    const stats = ZOMBIE_STATS[type];

    if (type === 'jumper') {
      const fromTop = Math.random() < 0.5;
      const startY  = fromTop ? ROAD_TOP - 30 : ROAD_BOTTOM + 30;
      const targetY = Phaser.Math.Between(ROAD_TOP + 22, ROAD_BOTTOM - 22);
      const z = this.zombies.create(W + 30, startY, 'zombie_jumper') as Phaser.Physics.Arcade.Sprite;
      z.setScale(stats.scale).setData('hp', stats.hp).setData('type', 'jumper');
      z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9).setBodySize(20,28);
      this.tweens.add({ targets: z, y: targetY, duration: 500, ease: 'Sine.easeOut' });
      return;
    }

    const baseY = Phaser.Math.Between(ROAD_TOP+22, ROAD_BOTTOM-22);
    const count = type === 'common' && Math.random() < 0.25 ? Phaser.Math.Between(2,3) : 1;
    for (let i = 0; i < count; i++) {
      const y = Phaser.Math.Clamp(baseY + i*28*(Math.random()>0.5?1:-1), ROAD_TOP+22, ROAD_BOTTOM-22);
      const z = this.zombies.create(W+30+i*20, y, `zombie_${type}`) as Phaser.Physics.Arcade.Sprite;
      z.setScale(stats.scale).setData('hp', stats.hp).setData('type', type);
      z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9).setBodySize(20,28);
    }
  }

  private spawnGiant() {
    const z = this.zombies.create(W + 60, ROAD_CENTER, 'zombie_giant') as Phaser.Physics.Arcade.Sprite;
    z.setScale(ZOMBIE_STATS.giant.scale).setData('hp', ZOMBIE_STATS.giant.hp).setData('type', 'giant');
    z.setVelocityX(-(ZOMBIE_STATS.giant.speed + SCROLL_SPEED)).setDepth(9).setBodySize(38,50);
    const warn = this.add.text(W - 60, H/2, '⚠ GIGANTE!', {
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
    const hp   = (zombie.getData('hp') as number) - dmg;
    if (hp <= 0) {
      this.score += ZOMBIE_STATS[type].score;
      this.spawnHitParticles(zombie.x, zombie.y);
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
        break;

      case 'armored':
        zombie.destroy();
        this.damageComponent('armor', 18);
        this.damageComponent('engine', 8);
        this.dealDamage(ZOMBIE_STATS.armored.damage);
        this.cameras.main.shake(200, 0.014);
        this.sfx?.playImpact();
        break;

      case 'giant':
        zombie.destroy();
        this.damageComponent('armor', 30);
        this.damageComponent('engine', 20);
        this.damageComponent('wheels', 20);
        this.dealDamage(ZOMBIE_STATS.giant.damage);
        this.cameras.main.shake(400, 0.025);
        this.spawnHitParticles(zombie.x, zombie.y);
        this.sfx?.playExplosion();
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
        this.score += ZOMBIE_STATS[z.getData('type') as ZombieType].score;
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
    this.sfx?.playExplosion();
    this.cameras.main.shake(130, 0.009);
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
    const comp = this.components[key];
    comp.health = Math.max(0, comp.health - amount);
    if (key === 'engine' && comp.health <= 0) this.endGame('Motore distrutto!');
  }

  private dealDamage(amount: number) {
    const armorPct = this.components.armor.health / 100;
    const bonus = this.vehicleArmorBonus / 100;
    const base  = armorPct<=0 ? 2.5 : armorPct<0.3 ? 1.8 : armorPct<0.6 ? 1.3 : 1.0;
    const mult  = Math.max(0.5, base - bonus);
    this.health = Math.max(0, this.health - Math.round(amount * mult));
    if (this.health <= 0) this.endGame('Veicolo distrutto!');
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
    this.add.rectangle(cx,cy,500,260,0x000000,0.9).setDepth(30);
    this.add.text(cx,cy-95,'MISSIONE COMPLETATA!',{
      fontSize:'32px', color:'#88ff44', fontStyle:'bold',
      stroke:'#006600', strokeThickness:4,
    }).setOrigin(0.5).setDepth(31);
    this.add.text(cx,cy-48,`Punteggio: ${this.score}`,{fontSize:'20px',color:'#ffffff'}).setOrigin(0.5).setDepth(31);
    this.add.text(cx,cy-14,`Distanza: ${Math.floor(this.distance/100)} km`,{fontSize:'16px',color:'#aaaaff'}).setOrigin(0.5).setDepth(31);
    this.add.text(cx,cy+20,`Monete guadagnate: +${earned}`,{fontSize:'18px',color:'#ffee44'}).setOrigin(0.5).setDepth(31);
    this.add.text(cx,cy+55,`Totale: ${(this.registry.get('money') ?? 0)}`,{fontSize:'15px',color:'#ffcc00'}).setOrigin(0.5).setDepth(31);
    this.add.text(cx,cy+88,'[ SPAZIO ] per il negozio',{fontSize:'13px',color:'#555555'}).setOrigin(0.5).setDepth(31);

    this.time.delayedCall(600, () => {
      this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('ShopScene'));
    });
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
      this.add.rectangle(cx,cy,440,260,0x000000,0.88).setDepth(30);
      this.add.text(cx,cy-80,'GAME OVER',{
        fontSize:'50px', color:'#ff3333', fontStyle:'bold',
        stroke:'#880000', strokeThickness:5,
      }).setOrigin(0.5).setDepth(31);
      this.add.text(cx,cy-28,reason,{fontSize:'16px',color:'#ffaaaa'}).setOrigin(0.5).setDepth(31);
      this.add.text(cx,cy+10,`Punteggio: ${this.score}`,{fontSize:'22px',color:'#ffffff'}).setOrigin(0.5).setDepth(31);
      this.add.text(cx,cy+44,`Distanza: ${Math.floor(this.distance/100)} km`,{fontSize:'16px',color:'#aaaaff'}).setOrigin(0.5).setDepth(31);
      this.add.text(cx,cy+80,'[ SPAZIO ] per ricominciare',{fontSize:'14px',color:'#666666'}).setOrigin(0.5).setDepth(31);
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
    const warn = this.add.text(W / 2, H / 2, `⚠  ${cfg.name.toUpperCase()}  ⚠`, {
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
    z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9);
    (z.body as Phaser.Physics.Arcade.Body).setSize(20, 28);
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

    const earned = cfg.reward;
    this.score += 500;
    this.registry.set('money', (this.registry.get('money') ?? 0) + earned);
    this.hideBossHUD();

    const vt = this.add.text(W / 2, H / 2 - 10, `BOSS SCONFITTO!  +${earned} monete`, {
      fontSize: '24px', color: '#ffee00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(28);
    this.tweens.add({ targets: vt, alpha: 0, y: H / 2 - 80, duration: 2200, onComplete: () => vt.destroy() });
    this.sfx?.playMissionComplete();

    this.time.delayedCall(2200, () => this.triggerMissionComplete());
  }

  private showBossHUD(name: string) {
    const cx = W / 2, barW = 440, y = 96;
    const bg    = this.add.rectangle(cx, y, barW + 8, 20, 0x000000, 0.85).setDepth(22).setAlpha(0);
    const fill  = this.add.rectangle(cx - barW / 2, y, barW, 14, 0xcc0000).setOrigin(0, 0.5).setDepth(23).setAlpha(0);
    const label = this.add.text(cx, y - 14, name.toUpperCase(), {
      fontSize: '13px', color: '#ff6666', fontStyle: 'bold',
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
