import Phaser from 'phaser';
import { VEHICLES, Upgrades } from '../GameData';
import SoundManager from '../SoundManager';

const W = 800, H = 600;
const ROAD_TOP = 155, ROAD_BOTTOM = 445, ROAD_CENTER = 300;
const VEHICLE_X = 150;
const SCROLL_SPEED = 240;
const BASE_FUEL_DRAIN = 2.2;
const MAX_FUEL = 100;
const BASE_FIRE_COOLDOWN = 280;
const BULLET_SPEED = 680;
const STRIPE_W = 48, STRIPE_GAP = 82;
const ATTACH_DAMAGE_INTERVAL = 1600;
const ATTACH_DAMAGE_AMOUNT = 14;
const MISSION_DIST = 18000;
const GIANT_SPAWN_INTERVAL = 22000;

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

  private hudHealthFill!: Phaser.GameObjects.Rectangle;
  private hudFuelFill!: Phaser.GameObjects.Rectangle;
  private hudDistFill!: Phaser.GameObjects.Rectangle;
  private hudScore!: Phaser.GameObjects.Text;
  private hudDist!: Phaser.GameObjects.Text;
  private hudFuelNum!: Phaser.GameObjects.Text;
  private hudAttached!: Phaser.GameObjects.Text;

  private sfx: SoundManager | null = null;

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

    const vg = this.make.graphics({ add: false } as any);
    vg.fillStyle(0x111111);
    vg.fillRect(8,0,16,8); vg.fillRect(54,0,16,8);
    vg.fillRect(8,28,16,8); vg.fillRect(54,28,16,8);
    vg.fillStyle(0x4a6fa5); vg.fillRect(2,6,74,24);
    vg.fillStyle(0x2c4f8a); vg.fillRect(18,10,34,16);
    vg.fillStyle(0x88aadd); vg.fillRect(48,11,12,14);
    vg.fillStyle(0x6688aa); vg.fillRect(72,7,4,22);
    vg.fillStyle(0xffffaa); vg.fillRect(70,8,5,5); vg.fillRect(70,23,5,5);
    vg.fillStyle(0xcc2222); vg.fillRect(4,8,5,5);  vg.fillRect(4,23,5,5);
    vg.fillStyle(0x778899); vg.fillRect(74,16,18,4);
    vg.generateTexture('vehicle', 94, 36);
    vg.destroy();

    const zombieConfigs: Array<[string, number]> = [
      ['common',  0x3aaa3a],
      ['runner',  0xcc3333],
      ['armored', 0x778899],
      ['jumper',  0xccaa00],
      ['toxic',   0x44ee44],
    ];
    for (const [type, color] of zombieConfigs) {
      const zg = this.make.graphics({ add: false } as any);
      zg.fillStyle(color);
      zg.fillCircle(14,6,6); zg.fillRect(7,12,14,14);
      zg.fillRect(7,26,5,10); zg.fillRect(16,26,5,10);
      zg.fillRect(1,12,6,10); zg.fillRect(21,12,6,10);
      zg.fillStyle(0xff0000); zg.fillRect(10,4,3,3); zg.fillRect(16,4,3,3);
      if (type === 'toxic') { zg.fillStyle(0x00ff00, 0.5); zg.fillCircle(14,18,8); }
      if (type === 'jumper') { zg.fillStyle(0xffee00); zg.fillRect(6,24,16,4); }
      zg.generateTexture(`zombie_${type}`, 28, 36);
      zg.destroy();
    }

    // Giant zombie
    const gg = this.make.graphics({ add: false } as any);
    gg.fillStyle(0x664433);
    gg.fillCircle(22,10,10); gg.fillRect(8,18,28,24);
    gg.fillRect(6,42,10,18); gg.fillRect(22,42,10,18);
    gg.fillRect(0,18,8,18);  gg.fillRect(36,18,8,18);
    gg.fillStyle(0xff2200); gg.fillRect(14,6,6,5); gg.fillRect(24,6,5,5);
    gg.generateTexture('zombie_giant', 44, 60);
    gg.destroy();

    const bg = this.make.graphics({ add: false } as any);
    bg.fillStyle(0xffee00); bg.fillRect(0,0,16,4);
    bg.fillStyle(0xffaa00); bg.fillRect(12,0,4,4);
    bg.generateTexture('bullet', 16, 4);
    bg.destroy();

    const fg = this.make.graphics({ add: false } as any);
    fg.fillStyle(0xff7700); fg.fillRect(2,5,16,17);
    fg.fillStyle(0xffaa44); fg.fillRect(7,1,6,6);
    fg.fillStyle(0xffd090, 0.5); fg.fillRect(5,9,4,10);
    fg.generateTexture('fuel_can', 20, 22);
    fg.destroy();

    const pg = this.make.graphics({ add: false } as any);
    pg.fillStyle(0xff8800); pg.fillCircle(5,5,5);
    pg.generateTexture('particle', 10, 10);
    pg.destroy();

    const tcg = this.make.graphics({ add: false } as any);
    tcg.fillStyle(0x22ee22, 0.45); tcg.fillCircle(20,20,20);
    tcg.fillStyle(0x00aa00, 0.3);
    tcg.fillCircle(14,14,12); tcg.fillCircle(26,26,10);
    tcg.generateTexture('toxic_cloud', 40, 40);
    tcg.destroy();
  }

  // ─── World & entities ────────────────────────────────────────────────────────

  private buildWorld() {
    this.add.rectangle(W/2, H/2, W, H, 0x12121e);
    const hills = this.add.graphics();
    hills.fillStyle(0x1e1e2e);
    const hd = [[0,55],[130,35],[280,65],[420,30],[560,50],[700,40],[850,60]];
    for (let i = 0; i < hd.length - 1; i++) {
      const [x1,h1] = hd[i], [x2,h2] = hd[i+1];
      hills.fillTriangle(x1,ROAD_TOP,(x1+x2)/2,ROAD_TOP-Math.max(h1,h2),x2,ROAD_TOP);
    }
    this.add.rectangle(W/2,ROAD_TOP/2,W,ROAD_TOP,0x1a1a10);
    this.add.rectangle(W/2,(ROAD_BOTTOM+H)/2,W,H-ROAD_BOTTOM,0x1e1a10);
    this.add.rectangle(W/2,ROAD_CENTER,W,ROAD_BOTTOM-ROAD_TOP,0x333333);
    this.add.rectangle(W/2,ROAD_TOP,W,4,0xddcc00);
    this.add.rectangle(W/2,ROAD_BOTTOM,W,4,0xddcc00);
    this.add.rectangle(W/2,ROAD_TOP-10,W,16,0x2a2a20);
    this.add.rectangle(W/2,ROAD_BOTTOM+10,W,16,0x2a2a20);
    const count = Math.ceil(W/STRIPE_GAP)+3;
    for (let i = 0; i < count; i++) {
      const r = this.add.rectangle(i*STRIPE_GAP,ROAD_CENTER,STRIPE_W,4,0xffffff,0.35).setDepth(1);
      this.stripes.push(r);
    }
  }

  private buildVehicle() {
    this.vehicle = this.physics.add.sprite(VEHICLE_X, ROAD_CENTER, 'vehicle');
    (this.vehicle.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(false);
    (this.vehicle.body as Phaser.Physics.Arcade.Body).setSize(72, 22);
    this.vehicle.setDepth(10).setTint(VEHICLES[this.vehicleKey].color);
  }

  private buildGroups() {
    this.zombies     = this.physics.add.group();
    this.bullets     = this.physics.add.group();
    this.fuelCans    = this.physics.add.group();
    this.toxicClouds = this.physics.add.group();
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
    this.hudAttached = this.add.text(690,6,'',{fontSize:'12px',color:'#ff8800'}).setDepth(D+1);

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
      this.fireBullet(this.vehicle.y - 1, false);
    }
  }

  private updateFuel(dt: number) {
    this.fuel -= this.getEffectiveFuelDrain() * dt;
    if (this.fuel <= 0) { this.fuel = 0; this.endGame('Carburante esaurito!'); }
  }

  private updateDistance(dt: number) {
    this.distance += SCROLL_SPEED * dt;
    if (this.distance >= MISSION_DIST) this.triggerMissionComplete();
  }

  private updateZombieSpawning(delta: number) {
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnZombie();
      this.spawnInterval = Math.max(500, this.spawnInterval - 3);
      this.spawnTimer = this.spawnInterval;
    }
  }

  private updateGiantSpawning(delta: number) {
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
        this.fireBullet(targetY, true);
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
      (g.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(s => { if (s.x<l||s.x>r) s.destroy(); });
    clean(this.zombies,    -100, W+100);
    clean(this.bullets,    -20,  W+40);
    clean(this.fuelCans,   -80,  W+80);
    clean(this.toxicClouds,-80,  W+80);
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

  private fireBullet(y: number, autoShot: boolean) {
    const b = this.bullets.create(this.vehicle.x + 50, y, 'bullet') as Phaser.Physics.Arcade.Sprite;
    b.setVelocityX(BULLET_SPEED).setDepth(8);
    if (autoShot) b.setTint(0x00ffff);
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
    bullet.destroy();
    const type = zombie.getData('type') as ZombieType;
    const hp   = (zombie.getData('hp') as number) - 1;
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
    return (BASE_FIRE_COOLDOWN / this.vehicleFireMult) * (1 + (1 - this.components.turret.health/100) * 1.4);
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
