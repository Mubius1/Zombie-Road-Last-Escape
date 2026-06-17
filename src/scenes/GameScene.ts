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

// Spazio di design: l'altezza è fissa (H), la larghezza varia col formato (designW,
// più ampia in 16:9). La camera in zoom adatta tutto alla risoluzione nativa — vedi Config.ts.
const H = 600;
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
// Riga HUD della modalità debug (G) — definita una volta sola: usata in buildHUD e nel toggle.
const GOD_HUD = '◆ GOD MODE  (G off · B boss · N fine · H ripara)';

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
  // Cache HUD: evita setText (re-render del canvas + upload texture GPU) quando il valore mostrato
  // non cambia. Resettata in buildHUD a ogni create() (i Text vengono ricreati). Le barre
  // (displayWidth/setFillStyle) restano per-frame: sono economiche.
  private hudCache = { score: -1, km: -1, fuel: -1, attached: -1, combo: '', dash: '' };

  private sfx: SoundManager | null = null;
  private grain: Phaser.GameObjects.TileSprite | null = null;
  private environment: Environment | null = null;
  private frozen = false;

  // Boss system
  private bossActive = false;
  private bossSpawned = false;
  // True nei ~2.2s di celebrazione tra la morte del boss e triggerMissionComplete: congela il
  // mondo (niente spawn zombi/gigante, niente danni) così la vittoria è garantita e pulita.
  private bossDefeated = false;
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

  /** Larghezza dello spazio di design (800 in 4:3, maggiore in 16:9 → più strada). */
  private designW = DESIGN_W;

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
    this.bossActive = false;
    this.bossSpawned = false;
    this.bossDefeated = false;
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
    // I Text dell'HUD vengono ricreati a ogni create(): azzera la cache così il primo update li popola.
    this.hudCache = { score: -1, km: -1, fuel: -1, attached: -1, combo: '', dash: '' };
    const D = 20, BAR_W = 110, COMP_BAR_W = 120;
    const panel = this.add.graphics().setDepth(D);
    panel.fillStyle(UI.black, 0.62); panel.fillRoundedRect(0,0,this.designW,84,{ tl:0, tr:0, bl:16, br:16 });
    panel.lineStyle(1,UI.strokeDim,0.7); panel.lineBetween(0,46,this.designW,46);

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
    this.hudDash     = Ui.text(this, this.designW-10,22,'↯ SCATTO',{fontSize:'11px',fontStyle:'bold',color:UI.greenOk}).setOrigin(1,0).setDepth(D+1);
    // Selettore armi: una cifra-hotkey per ogni arma posseduta (la selezionata in oro)
    this.weaponSlots = [];
    let wsx = 620;
    WEAPON_KEYS.forEach((wk, i) => {
      if (!this.ownedWeapons.includes(wk)) return;
      const t = Ui.text(this, wsx,34,`${i+1}`,{fontSize:'11px',fontStyle:'bold',color:UI.muted}).setDepth(D+1);
      this.weaponSlots.push({ key: wk, txt: t });
      wsx += 16;
    });
    this.refreshWeaponHUD(); // nome arma + evidenziazione del selettore (eventi discreti, non per-frame)

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
      Ui.text(this, this.designW-10,8,txt,{fontSize:'11px',color:'#cccc44'}).setOrigin(1,0).setDepth(D+1);
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

    Ui.text(this, this.designW/2,H-6,'↑↓ Muovi · SPAZIO Spara · 1-5/Q Arma · SHIFT Scatto',{fontSize:'11px',color:UI.disabled}).setOrigin(0.5,1).setDepth(D);
    Ui.text(this, 4,H-6,'0=Debug',{fontSize:'9px',color:'#2a3a2a'}).setOrigin(0,1).setDepth(D);
    this.hudDebug = Ui.text(this, this.designW-6,H-6, this.debugGod ? GOD_HUD : '', {fontSize:'10px',color:'#00ff88',fontStyle:'bold'}).setOrigin(1,1).setDepth(D+5);
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
      this.hudDebug?.setText(this.debugGod ? GOD_HUD : ''); // evento discreto: non più aggiornato per-frame
    });
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
    this.refreshWeaponHUD();
    // Pop visivo del nome arma (cosmetico)
    this.tweens.killTweensOf(this.hudWeapon);
    this.hudWeapon.setScale(1.3);
    this.tweens.add({ targets: this.hudWeapon, scale: 1, duration: 160 });
  }

  /** Nome arma + evidenziazione del selettore. Eventi discreti (init/cambio arma): non per-frame. */
  private refreshWeaponHUD() {
    this.hudWeapon.setText(WEAPONS[this.currentWeapon].name.toUpperCase());
    for (const slot of this.weaponSlots) {
      slot.txt.setColor(slot.key === this.currentWeapon ? UI.gold : UI.muted);
    }
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
    if (this.bossDefeated) return; // niente consumo durante la celebrazione di vittoria (X4: nessun game over post-vittoria)
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
    if (this.bossActive || this.bossDefeated) return;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnZombie();
      this.spawnInterval = Math.max(500, this.spawnInterval - 3);
      this.spawnTimer = this.spawnInterval;
    }
  }

  private updateGiantSpawning(delta: number) {
    if (this.bossActive || this.bossDefeated) return; // niente gigante durante la celebrazione di vittoria (X6)
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
    // Barre: economiche (displayWidth/setFillStyle), restano per-frame.
    const hpPct = this.health / this.maxHealth;
    this.hudHealthFill.displayWidth = Math.max(0, hpPct * 110);
    this.hudHealthFill.setFillStyle(hpPct < 0.3 ? UI.hpLow : hpPct < 0.6 ? UI.hpMid : UI.hpHigh);
    this.hudFuelFill.displayWidth = Math.max(0, (this.fuel / this.maxFuel) * 110);
    const distPct = Math.min(1, this.distance / MISSION_DIST);
    this.hudDistFill.displayWidth = Math.max(1, distPct * 110);
    this.hudDistFill.setFillStyle(distPct > 0.8 ? 0x88ff44 : distPct > 0.5 ? 0x44aaff : 0x4466cc);

    // Testi: setText solo quando il valore mostrato cambia (vedi hudCache).
    const fuel = Math.round(this.fuel);
    if (fuel !== this.hudCache.fuel)   { this.hudFuelNum.setText(`${fuel}%`);          this.hudCache.fuel  = fuel; }
    if (this.score !== this.hudCache.score) { this.hudScore.setText(`PUNTEGGIO: ${this.score}`); this.hudCache.score = this.score; }
    const km = Math.floor(this.distance / 100);
    if (km !== this.hudCache.km)       { this.hudDist.setText(`${km} km`);             this.hudCache.km    = km; }
    const n = this.attachedZombies.length;
    if (n !== this.hudCache.attached)  { this.hudAttached.setText(n > 0 ? `[${n} aggrappati]` : ''); this.hudCache.attached = n; }

    // Combo
    if (this.combo >= 2) {
      const m = this.comboMultiplier();
      const txt = `COMBO ${this.combo}  ×${m}`;
      if (txt !== this.hudCache.combo) {
        this.hudCombo.setText(txt);
        this.hudCombo.setColor(COMBO_COLORS[m - 1] ?? UI.white);
        this.hudCache.combo = txt;
      }
      this.hudCombo.setVisible(true);
    } else {
      if (this.hudCache.combo !== '') this.hudCache.combo = '';
      this.hudCombo.setVisible(false);
    }

    // Scatto (cooldown)
    const dashRemain = this.dashReadyAt - this.time.now;
    const dashTxt = dashRemain <= 0 ? '↯ SCATTO' : `↯ ${Math.ceil(dashRemain / 1000)}s`;
    if (dashTxt !== this.hudCache.dash) {
      this.hudDash.setText(dashTxt);
      this.hudDash.setColor(dashRemain <= 0 ? UI.greenOk : UI.faint);
      this.hudCache.dash = dashTxt;
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
    clean(this.zombies,    -100, this.designW+100);
    clean(this.fuelCans,   -80,  this.designW+80);
    clean(this.toxicClouds,-80,  this.designW+80);
    clean(this.rockets,         -20,  this.designW+60);
    clean(this.bossProjectiles, -80,  this.designW+80);
    // Bullets respect per-projectile maxX (lanciafiamme ha range breve)
    (this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(s => {
      if (!s.active) return;
      const maxX = (s.getData('maxX') as number) ?? this.designW + 40;
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

  private spawnToxicCloud(x: number, y: number) {
    const cloud = this.toxicClouds.create(x, y, 'toxic_cloud') as Phaser.Physics.Arcade.Sprite;
    cloud.setVelocityX(-SCROLL_SPEED);
    cloud.setData('timer', 3000).setData('lastDmg', 0);
    cloud.setDepth(7).setScale(1.5);
    (cloud.body as Phaser.Physics.Arcade.Body).setSize(36, 36);
  }

  // ─── Component damage system ─────────────────────────────────────────────────

  private damageComponent(key: ComponentKey, amount: number) {
    if (this.debugGod || this.bossDefeated) return; // invulnerabile durante la celebrazione di vittoria
    const comp = this.components[key];
    comp.health = Math.max(0, comp.health - amount);
    if (key === 'engine' && comp.health <= 0) this.endGame('Motore distrutto!');
  }

  private dealDamage(amount: number) {
    if (this.debugGod || this.bossDefeated) return; // invulnerabile durante la celebrazione di vittoria (X4)
    const armorPct = this.components.armor.health / 100;
    const bonus = this.vehicleArmorBonus / 100;
    const base  = armorPct<=0 ? 2.5 : armorPct<0.3 ? 1.8 : armorPct<0.6 ? 1.3 : 1.0;
    const mult  = Math.max(0.5, base - bonus);
    const dealt = Math.round(amount * mult);
    this.health = Math.max(0, this.health - dealt);
    this.flashHealthBar();
    if (this.health <= 0) this.endGame('Veicolo distrutto!');
    else this.flashVehicleDamage(dealt); // se è game over, ci pensa endGame a tingere il veicolo
  }

  /** Feedback al colpo: lampo bianco sulla barra salute + breve "thump" verticale. */
  private flashHealthBar() {
    const f = this.add.rectangle(63, 34, 116, 14, 0xffffff, 0.55).setDepth(24);
    this.tweens.add({ targets: f, alpha: 0, duration: 160, onComplete: () => f.destroy() });
    if (this.hudHealthFill) this.tweens.add({ targets: this.hudHealthFill, scaleY: 1.9, duration: 80, yoyo: true });
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
    this.bossProjectiles.setVelocityX(0); // niente proiettili boss sospesi sopra l'overlay (X9)
    this.bossGroup.setVelocityX(0);
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

  private spawnBoss() {
    this.bossSpawned = true;
    this.bossActive  = true;

    const missionNum: number = this.registry.get('missionNumber') ?? 1;
    const bossType = BOSS_ORDER[(missionNum - 1) % BOSS_ORDER.length];
    const cfg = BOSS_CONFIG[bossType];
    this.bossMaxHp = cfg.hp;

    // Alert
    const warn = Ui.text(this, this.designW / 2, H / 2, `⚠  ${cfg.name.toUpperCase()}  ⚠`, {
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

    // Sprite boss (texture + animazione dedicate per ciascun tipo)
    const texKey = `boss_${bossType}`;
    const boss = this.bossGroup.create(this.designW + 90, ROAD_CENTER, texKey) as Phaser.Physics.Arcade.Sprite;
    boss.setScale(cfg.scaleX / OVERSAMPLE, cfg.scaleY / OVERSAMPLE).setDepth(12);
    boss.play(`walk_${texKey}`);
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
          this.spawnZombieAt('common', this.designW - 80, boss.y - 44);
          this.spawnZombieAt('common', this.designW - 80, boss.y + 44);
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
    z.setScale(stats.scale / OVERSAMPLE).setData('hp', stats.hp).setData('type', type);
    z.setData('rockPhase', Math.random() * 6.28);
    z.setVelocityX(-(stats.speed + SCROLL_SPEED)).setDepth(9);
    (z.body as Phaser.Physics.Arcade.Body).setSize(20, 28);
    z.play(`walk_${type}`); z.anims.setProgress(Math.random());
  }

  private fireBossProjectile(x: number, fromY: number) {
    const p = this.bossProjectiles.create(x, fromY, 'bullet') as Phaser.Physics.Arcade.Sprite;
    const dy = Phaser.Math.Clamp(this.vehicle.y - fromY, -80, 80);
    p.setVelocityX(-200).setVelocityY(dy);
    // Texture sovracampionata → scala ÷OVERSAMPLE e body ×OVERSAMPLE (visivo + hitbox
    // identici a prima). flipX: la punta segue la direzione di volo (verso sinistra).
    p.setScale(2.4 / OVERSAMPLE, 1.6 / OVERSAMPLE).setFlipX(true).setTint(0x8844ff).setDepth(9);
    (p.body as Phaser.Physics.Arcade.Body).setSize(16 * OVERSAMPLE, 6 * OVERSAMPLE);
  }

  private onBulletHitBoss(bullet: Phaser.Physics.Arcade.Sprite, boss: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !boss.active) return;
    const dmg = (bullet.getData('damage') as number) ?? 1;
    bullet.destroy();
    this.damageBoss(boss, dmg);
    // Flash bianco pieno sull'impatto (la texture ha la palette cotta, niente tinta da ripristinare).
    boss.setTintFill(0xffffff);
    this.time.delayedCall(60, () => { if (boss?.active) boss.clearTint(); });
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
    this.bossDefeated = true; // celebrazione: mondo congelato e invulnerabilità fino a triggerMissionComplete
    const bossType = this.bossSprite.getData('bossType') as BossType;
    const cfg = BOSS_CONFIG[bossType];
    const bx = this.bossSprite.x, by = this.bossSprite.y;

    this.bossSprite.destroy();
    this.bossSprite = null;
    // Ripulisci i pericoli residui del boss: proiettili in volo e nubi tossiche non devono più
    // colpire dopo la sua morte (X4).
    this.bossProjectiles.clear(true, true);
    this.toxicClouds.clear(true, true);
    this.cameras.main.shake(500, 0.022);
    this.hitStop(70);
    this.bossDeathFx(bossType, bx, by); // sequenza di morte dedicata per tipo

    const earned = cfg.reward;
    this.addKillScore(500);
    this.registry.set('money', (this.registry.get('money') ?? 0) + earned);
    this.hideBossHUD();

    const vt = Ui.text(this, this.designW / 2, H / 2 - 10, `BOSS SCONFITTO!  +${earned} monete`, {
      fontSize: '24px', color: '#ffee00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(28);
    this.tweens.add({ targets: vt, alpha: 0, y: H / 2 - 80, duration: 2200, onComplete: () => vt.destroy() });
    this.sfx?.playMissionComplete();

    this.time.delayedCall(2200, () => this.triggerMissionComplete());
  }

  /**
   * Sequenza di morte DEDICATA per ogni boss (Standard AAA: VFX + suono + schermo
   * sincronizzati). Tutto fire-and-forget (immagini tinte che si auto-distruggono):
   * nessun emitter persistente, nessun impatto sul gameplay.
   */
  private bossDeathFx(bossType: BossType, x: number, y: number) {
    const cfg = BOSS_CONFIG[bossType];
    // Base condivisa: lampo bianco + alone nel colore-firma + boato-firma + scoppi a catena.
    Juice.flash(this, 0xffffff, 0.5, 140);
    Juice.lightFlash(this, x, y, cfg.tint, 8, 480);
    Juice.bloomBurst(this, x, y, cfg.tint, 3, 320);
    this.sfx?.playBossDeath(bossType);               // timbro di morte dedicato al tipo
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 120, () => {
        this.spawnHitParticles(x + Phaser.Math.Between(-44, 44), y + Phaser.Math.Between(-34, 34));
        if (i % 2 === 0) this.sfx?.playExplosion();   // ~3 boati: lasciano respiro al timbro-firma
      });
    }

    switch (bossType) {
      case 'mega_mutant': {
        // La Madre: la sacca si rompe e SPUTA LA COVATA (zombi-immagine che schizzano via).
        Juice.bloomBurst(this, x, y, 0xff3020, 3.6, 420);
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(50 + i * 70, () => {
            const a = -Math.PI / 2 + Phaser.Math.FloatBetween(-1.1, 1.1);
            const sp = Phaser.Math.Between(70, 150);
            const z = this.add.image(x, y, 'zombie_common', 0).setDepth(14)
              .setScale(0.42).setFlipX(Math.random() < 0.5);
            this.tweens.add({
              targets: z, x: x + Math.cos(a) * sp, y: y - Math.abs(Math.sin(a)) * sp * 0.5 + 120,
              angle: Phaser.Math.Between(-360, 360), alpha: 0, scale: 0.12,
              duration: 760, ease: 'Quad.easeOut', onComplete: () => z.destroy(),
            });
            this.spawnDebris(x, y, 'particle', { tint: 0xff3020, n: 4, scale: 0.5, spread: 130 });
          });
        }
        break;
      }
      case 'giant_worm': {
        // Il Divoratore: il corpo si SFALDA NEI SEGMENTI, schizzati di lato.
        this.spawnDebris(x, y, 'particle', { tint: 0x9a5a2e, n: 9, scale: 1.2, spread: 175, dir: 0.5, gravity: 80,  dur: 780, spin: 200 });
        this.spawnDebris(x, y, 'particle', { tint: 0xff7722, n: 5, scale: 0.6, spread: 150, dir: 0.6, gravity: 60 });
        this.spawnDebris(x, y, 'particle', { tint: 0x5a2e14, n: 5, scale: 0.85, spread: 125, dir: 0.5, gravity: 115 });
        break;
      }
      case 'armored_colossus': {
        // Il Bastione: la corazza ESPLODE IN SCHEGGE METALLICHE + scintille (impatto più pesante).
        this.cameras.main.shake(220, 0.02);
        for (let i = 0; i < 4; i++)
          this.time.delayedCall(i * 90, () => this.emitSparks(x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-30, 30)));
        this.spawnDebris(x, y, 'particle', { tint: 0x5f6b78, n: 8, scale: 0.95, spread: 160, gravity: 130, dur: 820, spin: 260 });
        this.spawnDebris(x, y, 'particle', { tint: 0x8a97a5, n: 5, scale: 0.6,  spread: 140, gravity: 120 });
        this.spawnDebris(x, y, 'particle', { tint: 0xffe9a0, n: 6, scale: 0.4,  spread: 185, gravity: 40, dur: 380 });
        break;
      }
      case 'radioactive_beast': {
        // Il Reattore: FUSIONE DEL NUCLEO — vampata verde + nubi radioattive (solo visive).
        Juice.lightFlash(this, x, y, 0x7dff4a, 11, 560);
        Juice.bloomBurst(this, x, y, 0xb6ff6a, 4, 480);
        this.spawnDebris(x, y, 'particle', { tint: 0x6cff3a, n: 10, scale: 0.6, spread: 190, gravity: 30, dur: 520 });
        ([[0,0,1.8],[-30,-12,1.2],[34,8,1.3],[4,24,1.1]] as [number,number,number][]).forEach(([dx,dy,s], i) =>
          this.time.delayedCall(i * 80, () => {
            const c = this.add.image(x + dx, y + dy, 'toxic_cloud').setDepth(13).setScale(s * 0.5).setAlpha(0.9);
            this.tweens.add({ targets: c, scale: s * 1.8, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
          }));
        break;
      }
    }
  }

  /** Detriti fire-and-forget: immagini tinte che schizzano e svaniscono (no fisica, no danno). */
  private spawnDebris(
    x: number, y: number, texKey: string,
    opts: { tint?: number; n?: number; scale?: number; spread?: number; gravity?: number; dir?: number; dur?: number; depth?: number; spin?: number } = {},
  ) {
    const { tint, n = 6, scale = 0.5, spread = 120, gravity = 90, dir = 0, dur = 700, depth = 14, spin = 0 } = opts;
    for (let i = 0; i < n; i++) {
      // dir 0 = scoppio radiale · dir>0 = bias orizzontale (es. verme che si sfalda di lato)
      const a = dir > 0
        ? (Math.random() < 0.5 ? 0 : Math.PI) + Phaser.Math.FloatBetween(-dir, dir)
        : Math.random() * Math.PI * 2;
      const sp = Phaser.Math.Between(spread * 0.4, spread);
      const p = this.add.image(x, y, texKey).setDepth(depth).setScale(scale * Phaser.Math.FloatBetween(0.7, 1.3));
      if (tint !== undefined) p.setTint(tint);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * sp,
        y: y + Math.sin(a) * sp * 0.6 + gravity,
        alpha: 0, scale: 0.06,
        angle: spin ? Phaser.Math.Between(-spin, spin) : 0,
        duration: dur + Phaser.Math.Between(-120, 120),
        ease: 'Quad.easeOut', onComplete: () => p.destroy(),
      });
    }
  }

  private showBossHUD(name: string) {
    const cx = this.designW / 2, barW = 440, y = 96;
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
