import Phaser from 'phaser';
import { BOSS_CONFIG, BOSS_ORDER } from './GameScene';
import { buildEntityTextures } from '../EntityTextures';
import { buildVehicleTexture } from '../VehicleTextures';
import { VEHICLES, VEHICLE_KEYS, WEAPONS, WEAPON_KEYS, WeaponType, SURVIVORS } from '../GameData';
import Juice from '../Juice';
import Ui, { UI } from '../Ui';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';
import { resetRunState } from '../RunState';
import { t } from '../i18n';

const H = 600;

// `label` = chiave i18n (risolta con t() al render).
interface ZombieInfo { key: string; label: string; }

const ZOMBIE_INFO: ZombieInfo[] = [
  { key: 'zombie_common',  label: 'zombie.common' },
  { key: 'zombie_runner',  label: 'zombie.runner' },
  { key: 'zombie_armored', label: 'zombie.armored' },
  { key: 'zombie_jumper',  label: 'zombie.jumper' },
  { key: 'zombie_toxic',   label: 'zombie.toxic' },
  { key: 'zombie_giant',   label: 'zombie.giant' },
];

const OBJECT_INFO: Array<{ key: string; label: string; scale: number; over?: boolean }> = [
  { key: 'bullet',      label: 'obj.bullet',      scale: 3,   over: true }, // sovracampionata (OS_G)
  { key: 'rocket',      label: 'obj.rocket',      scale: 2.4, over: true }, // sovracampionata (OS_G)
  { key: 'fuel_can',    label: 'obj.fuel_can',    scale: 2,   over: true }, // sovracampionata (OS_G)
  { key: 'particle',    label: 'obj.particle',    scale: 3 },
  { key: 'toxic_cloud', label: 'obj.toxic_cloud', scale: 1.4 },
];

export default class DebugScene extends Phaser.Scene {
  /** Larghezza di design (le gallerie restano ancorate a sinistra: è uno strumento di debug). */
  private designW = DESIGN_W;

  constructor() { super({ key: 'DebugScene' }); }

  create() {
    this.designW = setupCamera(this).designW;

    // Genera TUTTE le texture (tutti i veicoli + entità)
    buildEntityTextures(this);
    VEHICLE_KEYS.forEach(k => buildVehicleTexture(this, k));

    this.add.rectangle(this.designW / 2, H / 2, this.designW, H, UI.bgDeep);
    Ui.text(this, this.designW / 2, 6, t('debug.title'), {
      fontSize: '16px', color: UI.cyanDebug, fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    Ui.text(this, this.designW / 2, 26, t('debug.subtitle'), {
      fontSize: '10px', color: UI.faint,
    }).setOrigin(0.5, 0);

    this.drawVehicles(46);
    this.drawZombies(148);
    this.drawBosses(244);
    this.drawObjects(338);
    this.drawWeapons(404);
    this.drawButtons(470);
    Juice.fadeIn(this, 250);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private sectionTitle(x: number, y: number, text: string, color: string = UI.blueBright) {
    Ui.text(this, x, y, text, { fontSize: '12px', color, fontStyle: 'bold' });
  }

  private cell(cx: number, cy: number, w: number, h: number, interactive = false): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(cx, cy, w, h, 0x33343c).setStrokeStyle(1, 0x4a4a55);
    if (interactive) {
      r.setInteractive({ useHandCursor: true });
      r.on('pointerover', () => r.setFillStyle(0x44465a));
      r.on('pointerout',  () => r.setFillStyle(0x33343c));
    }
    return r;
  }

  // ─── Sections ────────────────────────────────────────────────────────────────

  private drawVehicles(y: number) {
    this.sectionTitle(12, y, t('debug.vehicles'), UI.blueBright);
    const top = y + 20;
    VEHICLE_KEYS.forEach((key, i) => {
      const cx = 60 + i * 103;
      const cell = this.cell(cx, top + 22, 98, 48, true);
      cell.on('pointerdown', () => this.testVehicle(key));
      this.add.image(cx, top + 22, `vehicle_${key}`).setOrigin(0.5).setScale(1 / OVERSAMPLE);
      Ui.text(this, cx, top + 48, t(VEHICLES[key].name), {
        fontSize: '8px', color: '#bbbbcc', align: 'center', wordWrap: { width: 100 },
      }).setOrigin(0.5, 0);
    });
  }

  private drawZombies(y: number) {
    this.sectionTitle(12, y, t('debug.zombies'), UI.greenSoft);
    const top = y + 18;
    ZOMBIE_INFO.forEach((z, i) => {
      const cx = 66 + i * 122;
      this.cell(cx, top + 30, 116, 60);
      const type = z.key.replace('zombie_', '');
      this.add.sprite(cx, top + 30, z.key).setOrigin(0.5).setScale(1 / OVERSAMPLE).play(`walk_${type}`);
      Ui.text(this, cx, top + 56, t(z.label), { fontSize: '10px', color: '#aaddaa' }).setOrigin(0.5, 0);
    });
  }

  private drawBosses(y: number) {
    this.sectionTitle(12, y, t('debug.bosses'), UI.redText);
    const top = y + 18;
    BOSS_ORDER.forEach((bt, i) => {
      const cfg = BOSS_CONFIG[bt];
      const cx = 100 + i * 160;
      this.cell(cx, top + 30, 150, 64);
      // Scala ridotta per stare nella cella, ma mantiene proporzioni reali
      const shrink = 0.6;
      const texKey = `boss_${bt}`;
      this.add.sprite(cx, top + 30, texKey)
        .setOrigin(0.5).setScale(cfg.scaleX * shrink / OVERSAMPLE, cfg.scaleY * shrink / OVERSAMPLE)
        .play(`walk_${texKey}`);
      Ui.text(this, cx, top + 50, t(cfg.name), { fontSize: '9px', color: UI.redSoft, fontStyle: 'bold' }).setOrigin(0.5, 0);
      Ui.text(this, cx, top + 62, t('debug.bossStats', { hp: cfg.hp, reward: cfg.reward }), { fontSize: '8px', color: '#886666' }).setOrigin(0.5, 0);
    });
  }

  private drawObjects(y: number) {
    this.sectionTitle(12, y, t('debug.objects'), UI.goldDim);
    const top = y + 16;
    OBJECT_INFO.forEach((o, i) => {
      const cx = 70 + i * 110;
      this.cell(cx, top + 22, 104, 44);
      this.add.image(cx, top + 22, o.key).setOrigin(0.5).setScale(o.over ? o.scale / OVERSAMPLE : o.scale);
      Ui.text(this, cx, top + 40, t(o.label), { fontSize: '9px', color: '#ddcc99' }).setOrigin(0.5, 0);
    });
  }

  private drawWeapons(y: number) {
    this.sectionTitle(12, y, t('debug.weapons'), '#ff9944');
    const top = y + 16;
    WEAPON_KEYS.forEach((key, i) => {
      const w = WEAPONS[key];
      const cx = 70 + i * 110;
      const cell = this.cell(cx, top + 18, 104, 34, true);
      cell.on('pointerdown', () => this.testWeapon(key));
      this.add.rectangle(cx, top + 10, 70, 8, w.color);
      Ui.text(this, cx, top + 18, t(w.name), { fontSize: '9px', color: '#ffddaa' }).setOrigin(0.5, 0);
    });
  }

  private drawButtons(y: number) {
    const mk = (x: number, w: number, label: string, color: number, cb: () => void) => {
      const b = this.add.rectangle(x, y, w, 30, color).setInteractive({ useHandCursor: true });
      Ui.text(this, x, y, label, { fontSize: '11px', color: UI.white, fontStyle: 'bold' }).setOrigin(0.5);
      b.on('pointerover', () => b.setAlpha(0.8));
      b.on('pointerout',  () => b.setAlpha(1));
      b.on('pointerdown', cb);
    };

    // Riga 1: setup test
    mk(90,  150, t('debug.add5000'), 0x665500, () => this.toast(t('debug.toastCoins'), () =>
      this.registry.set('money', (this.registry.get('money') ?? 0) + 5000)));
    mk(250, 150, t('debug.allWeapons'), 0x664400, () => this.toast(t('debug.toastWeapons'), () => {
      this.registry.set('ownedWeapons', [...WEAPON_KEYS]);
    }));
    mk(410, 150, t('debug.allVehicles'), 0x445566, () => this.toast(t('debug.toastVehicles'), () => {
      this.registry.set('ownedVehicles', [...VEHICLE_KEYS]);
    }));
    mk(570, 150, t('debug.recruitAll'), 0x556644, () => this.toast(t('debug.toastSurvivors'), () => {
      this.registry.set('survivors', SURVIVORS.map(s => s.key));
    }));

    // Riga 2: navigazione
    const y2 = y + 42;
    const mk2 = (x: number, w: number, label: string, color: number, cb: () => void) => {
      const b = this.add.rectangle(x, y2, w, 32, color).setInteractive({ useHandCursor: true });
      Ui.text(this, x, y2, label, { fontSize: '13px', color: UI.white, fontStyle: 'bold' }).setOrigin(0.5);
      b.on('pointerover', () => b.setAlpha(0.8));
      b.on('pointerout',  () => b.setAlpha(1));
      b.on('pointerdown', cb);
    };
    mk2(140, 220, t('debug.newGame'), 0x1a4a1a, () => this.startFresh());
    mk2(400, 150, t('debug.shop'), 0x2a2a5a, () => Juice.go(this, 'ShopScene'));
    mk2(620, 220, t('debug.toGame'), 0x3a3a3a, () => Juice.go(this, 'GameScene'));
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  private testVehicle(key: string) {
    const owned = (this.registry.get('ownedVehicles') as string[] | null) ?? ['civilian_car'];
    if (!owned.includes(key)) owned.push(key);
    this.registry.set('ownedVehicles', owned);
    this.registry.set('vehicle', key);
    Juice.go(this, 'GameScene');
  }

  private testWeapon(key: WeaponType) {
    const owned = (this.registry.get('ownedWeapons') as WeaponType[] | null) ?? ['mg'];
    if (!owned.includes(key)) owned.push(key);
    this.registry.set('ownedWeapons', owned);
    this.registry.set('currentWeapon', key);
    Juice.go(this, 'GameScene');
  }

  private startFresh() {
    resetRunState(this.registry);
    Juice.go(this, 'GameScene');
  }

  private toast(msg: string, apply: () => void) {
    apply();
    const toastTxt = Ui.text(this, this.designW / 2, 560, msg, {
      fontSize: '14px', color: UI.greenSoft, fontStyle: 'bold',
      backgroundColor: '#003300', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: toastTxt, alpha: 0, y: 540, duration: 1200, onComplete: () => toastTxt.destroy() });
  }
}
