import Phaser from 'phaser';
import { VEHICLES, VEHICLE_KEYS, SURVIVORS, SurvivorData, Upgrades, WEAPONS, WEAPON_KEYS, WeaponType } from '../GameData';
import { buildEntityTextures } from '../EntityTextures';
import { buildVehicleTexture } from '../VehicleTextures';
import Juice from '../Juice';
import Settings from '../Settings';
import SoundManager from '../SoundManager';
import Ui, { UI, MENU_VIGNETTE } from '../Ui';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';
import { getRun, setRun } from '../RunState';
import { t } from '../i18n';

const H = 600;

// `label`/`desc` sono CHIAVI i18n (risolte con t() al render). `key`/`cost` restano dati.
interface ShopItem {
  key: string; label: string; cost: number; desc: string; oneTime: boolean;
}

const SHOP_ITEMS: ShopItem[] = [
  { key: 'repair',   label: 'item.repair.label',   cost:  80, desc: 'item.repair.desc',   oneTime: false },
  { key: 'armor',    label: 'item.armor.label',    cost: 150, desc: 'item.armor.desc',    oneTime: true  },
  { key: 'engine',   label: 'item.engine.label',   cost: 120, desc: 'item.engine.desc',   oneTime: true  },
  { key: 'turret',   label: 'item.turret.label',   cost: 100, desc: 'item.turret.desc',   oneTime: true  },
  { key: 'fuelTank', label: 'item.fuelTank.label', cost:  80, desc: 'item.fuelTank.desc', oneTime: true  },
];

export default class ShopScene extends Phaser.Scene {
  private money = 0;
  private upgrades: Upgrades = {};
  private currentWeapon: WeaponType = 'mg';
  private ownedWeapons: WeaponType[] = ['mg'];
  private currentVehicle = 'civilian_car';
  private ownedVehicles: string[] = ['civilian_car'];
  private survivors: string[] = [];
  private missionNum = 2;
  private offeredSurvivors: SurvivorData[] = [];

  private moneyText!: Phaser.GameObjects.Text;
  private grain: Phaser.GameObjects.TileSprite | null = null;
  // SoundManager condiviso (statico): il negozio fa scene.restart a ogni acquisto, quindi NON va
  // creato a ogni create() (lascerebbe un master appeso a ogni restart — cfr. AU7). Riusato.
  private static sfx?: SoundManager;
  /** true quando la scena si ri-disegna dopo un acquisto (niente nuova dissolvenza). */
  private replay = false;

  /** Larghezza di design e offset per centrare il blocco-contenuti (800px) in 16:9. */
  private designW = DESIGN_W;
  private ox = 0;

  constructor() { super({ key: 'ShopScene' }); }

  init(data: { replay?: boolean }) {
    this.replay = data?.replay ?? false;
  }

  create() {
    this.designW = setupCamera(this).designW;
    this.ox = (this.designW - DESIGN_W) / 2;

    this.money          = getRun(this.registry, 'money')         ?? 0;
    this.upgrades       = { ...(getRun(this.registry, 'upgrades') ?? {}) };
    this.currentVehicle = getRun(this.registry, 'vehicle')       ?? 'civilian_car';
    this.ownedVehicles  = getRun(this.registry, 'ownedVehicles')  ?? ['civilian_car'];
    this.survivors      = getRun(this.registry, 'survivors')      ?? [];
    this.missionNum     = getRun(this.registry, 'missionNumber')  ?? 2;
    this.currentWeapon  = getRun(this.registry, 'currentWeapon')  ?? 'mg';
    this.ownedWeapons   = getRun(this.registry, 'ownedWeapons')   ?? ['mg'];

    const available = SURVIVORS.filter(s => !this.survivors.includes(s.key));
    this.offeredSurvivors = Phaser.Utils.Array.Shuffle([...available]).slice(0, 3) as SurvivorData[];

    // Audio del negozio (feedback acquisti U7 / diniego U6) — istanza statica riusata fra i restart.
    const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (webAudio?.context) {
      if (!ShopScene.sfx) ShopScene.sfx = new SoundManager(webAudio.context);
      ShopScene.sfx.setVolume(Settings.volume);
    }

    this.ensureTextures();
    this.drawUI();

    // Coesione filmica: overlay sempre presente (se attivo), dissolvenza solo al
    // primo ingresso — non ad ogni ri-disegno dopo un acquisto. Vignetta morbida
    // (menu): i pannelli laterali e la fila veicoli vivono ai bordi.
    if (Settings.screenFx) this.grain = Juice.addOverlay(this, 18, MENU_VIGNETTE);
    if (!this.replay) Juice.fadeIn(this);
  }

  update() {
    Juice.jitterGrain(this.grain);
  }

  /** Ri-disegna la scena dopo un acquisto/selezione, senza ripetere la dissolvenza. */
  private refresh() {
    this.scene.restart({ replay: true });
  }

  /** Genera (una volta) le texture procedurali per le anteprime di armi e veicoli. */
  private ensureTextures() {
    if (this.textures.exists('vehicle_experimental')) return; // già generate da una partita
    buildEntityTextures(this);
    VEHICLE_KEYS.forEach(k => buildVehicleTexture(this, k));
  }

  private drawUI() {
    // Background: gradiente verticale (più chiaro del vecchio piatto quasi-nero) per dare
    // profondità e tenere leggibili pannelli e card. Scena-locale, non un token di chrome.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a26, 0x1a1a26, 0x101018, 0x12121c, 1, 1, 1, 1);
    bg.fillRect(0, 0, this.designW, H);
    this.add.rectangle(this.designW/2, 32, this.designW, 64, UI.panelAlt);

    Ui.text(this, this.designW/2, 8, t('shop.title', { n: this.missionNum - 1 }), {
      fontSize: '20px', color: UI.greenSoft, fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.moneyText = Ui.text(this, this.designW - 12, 8, t('shop.money', { n: this.money }), {
      fontSize: '18px', color: UI.gold,
    }).setOrigin(1, 0);

    Ui.text(this, this.designW/2, 46, t('shop.nextMission', { n: this.missionNum }), {
      fontSize: '12px', color: UI.faint,
    }).setOrigin(0.5, 0);

    this.drawDivider(66);
    this.drawUpgradesPanel();
    this.drawWeaponsPanel();
    this.drawSurvivorsPanel();
    this.drawDivider(418);
    this.drawVehiclesPanel();
    this.drawContinueButton();
  }

  private drawDivider(y: number) {
    this.add.rectangle(this.designW/2, y, this.designW, 1, UI.stroke);
  }

  // ─── Upgrades panel (left) ───────────────────────────────────────────────────

  private drawUpgradesPanel() {
    const px = 14 + this.ox, py = 76;
    Ui.text(this, px, py, t('shop.upgrades'), { fontSize: '13px', color: UI.blueInfo, fontStyle: 'bold' });

    SHOP_ITEMS.forEach((item, i) => {
      const iy = py + 22 + i * 48;
      const bought    = item.oneTime && !!(this.upgrades as Record<string,boolean>)[item.key];
      const canAfford = !bought && this.money >= item.cost;
      const bgColor   = bought ? UI.panelBought : UI.panel;

      const bg = Ui.box(this, px + 220, iy + 18, 440, 42, { fill: bgColor, radius: 6, stroke: UI.stroke, strokeAlpha: 0.5 });
      if (!bought) {
        // Interattiva anche se non acquistabile: serve il feedback "monete insufficienti" (U6).
        bg.setInteractive(true);
        bg.on('pointerover', () => { if (canAfford) bg.setFillStyle(0x181830); });
        bg.on('pointerout',  () => bg.setFillStyle(bgColor));
        bg.on('pointerdown', () => { if (canAfford) this.buyItem(item); else this.denyPurchase(); });
      }

      const lc = bought ? UI.greenDim : canAfford ? UI.text : '#554444';
      Ui.text(this, px + 6, iy + 6,  t(item.label), { fontSize: '13px', color: lc, fontStyle: 'bold' });
      Ui.text(this, px + 6, iy + 24, t(item.desc),  { fontSize: '10px', color: UI.faint });
      if (bought) {
        Ui.text(this, px + 432, iy + 15, '✓', { fontSize: '13px', color: UI.greenDim }).setOrigin(1, 0.5);
      } else if (canAfford) {
        Ui.text(this, px + 432, iy + 15, `★ ${item.cost}`, { fontSize: '13px', color: UI.gold }).setOrigin(1, 0.5);
      } else {
        // Marker esplicito di "non acquistabile" + quanto manca (U6).
        Ui.text(this, px + 432, iy + 9,  `🔒 ★${item.cost}`,            { fontSize: '12px', color: '#aa5555' }).setOrigin(1, 0.5);
        Ui.text(this, px + 432, iy + 26, t('shop.missing', { n: item.cost - this.money }), { fontSize: '10px', color: '#996644' }).setOrigin(1, 0.5);
      }
    });
  }

  private drawWeaponsPanel() {
    const px = 14 + this.ox, py = 322;
    this.drawDivider(py - 4);
    Ui.text(this, px, py, t('shop.weapons'), { fontSize: '13px', color: '#ff9944', fontStyle: 'bold' });

    WEAPON_KEYS.forEach((key, i) => {
      const w        = WEAPONS[key];
      const wx       = px + i * 88;
      const owned    = this.ownedWeapons.includes(key);
      const selected = this.currentWeapon === key;
      const canBuy   = !owned && this.money >= w.price;
      const bgColor  = selected ? 0x1a1200 : owned ? 0x0e0e0e : 0x080808;

      const bg = Ui.box(this, wx + 40, py + 46, 82, 72, { fill: bgColor, radius: 7, stroke: UI.stroke, strokeAlpha: 0.5 })
        .setInteractive(true);

      // Anteprima reale: il proiettile dell'arma (razzo dedicato; bullet tinto per le altre)
      const projKey = key === 'rockets' ? 'rocket' : 'bullet';
      // bullet/rocket sono texture sovracampionate (OS_G) → scala ÷OVERSAMPLE.
      this.add.image(wx + 40, py + 22, projKey)
        .setTint(w.color).setScale((key === 'rockets' ? 1.7 : 2.4) / OVERSAMPLE).setAlpha(owned ? 1 : 0.4);
      Ui.text(this, wx + 40, py + 32, t(w.name), { fontSize: '10px', color: owned ? UI.text : '#444444', wordWrap: { width: 78 }, align: 'center' }).setOrigin(0.5, 0);

      if (owned) {
        Ui.text(this, wx + 40, py + 68, selected ? t('shop.activeWeapon') : t('shop.use'),
          { fontSize: '10px', color: selected ? UI.goldDim : UI.blueUse }).setOrigin(0.5);
        if (!selected) {
          bg.on('pointerover',  () => bg.setFillStyle(0x1a1400));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.selectWeapon(key));
        }
      } else {
        Ui.text(this, wx + 40, py + 56, `★${w.price}`, { fontSize: '11px', color: canBuy ? UI.gold : '#443333' }).setOrigin(0.5);
        Ui.text(this, wx + 40, py + 70, canBuy ? t('shop.buy') : '🔒', { fontSize: '11px', color: canBuy ? UI.amber : UI.disabled }).setOrigin(0.5);
        if (canBuy) {
          bg.on('pointerover',  () => bg.setFillStyle(0x1a1000));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.buyWeapon(key));
        } else {
          bg.on('pointerdown',  () => this.denyPurchase()); // feedback "monete insufficienti" anche sulle armi (REG7)
        }
      }
    });

    // Descrizione arma attiva
    Ui.text(this, px, py + 92, t('shop.weaponDesc', { desc: t(WEAPONS[this.currentWeapon].desc) }),
      { fontSize: '11px', color: '#888866' });
  }

  // ─── Survivors panel (right) ─────────────────────────────────────────────────

  private drawSurvivorsPanel() {
    const px = 490 + this.ox, py = 76;
    Ui.text(this, px, py, t('shop.survivors'), { fontSize: '13px', color: UI.goldDim, fontStyle: 'bold' });

    // Recruited list
    if (this.survivors.length > 0) {
      Ui.text(this, px, py + 22, t('shop.inVehicle'), { fontSize: '11px', color: '#777755' });
      this.survivors.forEach((key, i) => {
        const s = SURVIVORS.find(sv => sv.key === key);
        if (s) Ui.text(this, px + 6, py + 36 + i * 16, t('shop.survivorName', { name: t(s.name) }), { fontSize: '12px', color: s.color });
      });
    }

    // Offered survivors
    const rY = py + 24 + Math.max(this.survivors.length, 0) * 16 + 24;
    Ui.text(this, px, rY, this.offeredSurvivors.length > 0 ? t('shop.recruit') : t('shop.noneAvailable'),
      { fontSize: '11px', color: '#777755' });

    this.offeredSurvivors.forEach((s, i) => {
      const iy = rY + 18 + i * 74;
      const alreadyIn = this.survivors.includes(s.key);
      const bg = Ui.box(this, px + 145, iy + 30, 290, 66, { fill: UI.panelWarm, radius: 7, stroke: UI.stroke, strokeAlpha: 0.5 });

      if (!alreadyIn) {
        bg.setInteractive(true);
        bg.on('pointerover', () => bg.setFillStyle(0x1e1e14));
        bg.on('pointerout',  () => bg.setFillStyle(UI.panelWarm));
        bg.on('pointerdown', () => this.recruitSurvivor(s.key));
      }

      Ui.text(this, px + 6, iy + 8,  t(s.name),    { fontSize: '14px', color: s.color, fontStyle: 'bold' });
      Ui.text(this, px + 6, iy + 28, t(s.ability, s.abilityParams), { fontSize: '10px', color: '#666655' });
      Ui.text(this, px + 6, iy + 46, alreadyIn ? t('shop.recruited') : t('shop.free'),
        { fontSize: '11px', color: alreadyIn ? UI.greenDim : UI.greenOk });
    });
  }

  // ─── Vehicles panel (bottom) ─────────────────────────────────────────────────

  private drawVehiclesPanel() {
    const py = 428;
    Ui.text(this, 14 + this.ox, py, t('shop.vehicles'), { fontSize: '13px', color: UI.blueBright, fontStyle: 'bold' });

    VEHICLE_KEYS.forEach((key, i) => {
      const v = VEHICLES[key];
      const vx = 14 + this.ox + i * 112;
      const owned    = this.ownedVehicles.includes(key);
      const selected = this.currentVehicle === key;
      const canBuy   = !owned && this.money >= v.price;

      const bgColor = selected ? 0x0e1e2e : owned ? 0x0e0e1e : 0x08080e;
      const bg = Ui.box(this, vx + 50, py + 66, 106, 96, {
        fill: bgColor, radius: 8,
        stroke: selected ? UI.greenSig : UI.stroke, strokeAlpha: selected ? 0.9 : 0.5,
      }).setInteractive(true);

      // Anteprima reale: lo sprite del veicolo (sbiadito se non posseduto)
      this.add.image(vx + 50, py + 30, `vehicle_${key}`).setScale(0.7 / OVERSAMPLE).setAlpha(owned ? 1 : 0.4);
      Ui.text(this, vx + 50, py + 50, t(v.name), {
        fontSize: '10px', color: owned ? UI.text : '#444444', wordWrap: { width: 100 }, align: 'center',
      }).setOrigin(0.5, 0);

      if (owned) {
        Ui.text(this, vx + 50, py + 82, selected ? t('shop.activeVehicle') : t('shop.use'),
          { fontSize: '10px', color: selected ? UI.green : UI.blueUse }).setOrigin(0.5);
        if (!selected) {
          bg.on('pointerover',  () => bg.setFillStyle(0x14142a));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.selectVehicle(key));
        }
      } else {
        Ui.text(this, vx + 50, py + 74, `★ ${v.price}`,
          { fontSize: '11px', color: canBuy ? UI.gold : '#444444' }).setOrigin(0.5);
        Ui.text(this, vx + 50, py + 92, canBuy ? t('shop.buy') : t('shop.locked'),
          { fontSize: '10px', color: canBuy ? UI.amber : UI.disabled }).setOrigin(0.5);
        if (canBuy) {
          bg.on('pointerover',  () => bg.setFillStyle(0x141420));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.buyVehicle(key));
        } else {
          bg.on('pointerdown',  () => this.denyPurchase()); // feedback "monete insufficienti" anche sui veicoli (REG7)
        }
      }
    });
  }

  // ─── Continue button ─────────────────────────────────────────────────────────

  private drawContinueButton() {
    Ui.button(this, this.designW/2, H - 28, 240, 44, t('shop.continue'), {
      fill: 0x1a3a1a, hover: 0x224422, color: UI.green,
      onClick: () => this.continueGame(),
    });
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  private buyItem(item: ShopItem) {
    if (this.money < item.cost) return;
    this.money -= item.cost;
    setRun(this.registry, 'money', this.money);

    if (item.key === 'repair') {
      setRun(this.registry, 'components', { engine: 100, wheels: 100, tank: 100, turret: 100, armor: 100 });
    } else {
      (this.upgrades as Record<string,boolean>)[item.key] = true;
      setRun(this.registry, 'upgrades', { ...this.upgrades });
    }
    this.afterPurchase();
  }

  private recruitSurvivor(key: string) {
    if (this.survivors.includes(key)) return;
    setRun(this.registry, 'survivors', [...this.survivors, key]);
    ShopScene.sfx?.playFuelPickup();
    this.time.delayedCall(150, () => this.refresh());
  }

  private selectVehicle(key: string) {
    setRun(this.registry, 'vehicle', key);
    this.refresh();
  }

  private buyVehicle(key: string) {
    const v = VEHICLES[key];
    if (this.money < v.price || this.ownedVehicles.includes(key)) return;
    this.money -= v.price;
    const newOwned = [...this.ownedVehicles, key];
    setRun(this.registry, 'money', this.money);
    setRun(this.registry, 'ownedVehicles', newOwned);
    setRun(this.registry, 'vehicle', key);
    this.afterPurchase();
  }

  private selectWeapon(key: WeaponType) {
    setRun(this.registry, 'currentWeapon', key);
    this.refresh();
  }

  private buyWeapon(key: WeaponType) {
    const w = WEAPONS[key];
    if (this.money < w.price || this.ownedWeapons.includes(key)) return;
    this.money -= w.price;
    const newOwned = [...this.ownedWeapons, key];
    setRun(this.registry, 'money', this.money);
    setRun(this.registry, 'ownedWeapons', newOwned);
    setRun(this.registry, 'currentWeapon', key);
    this.afterPurchase();
  }

  /** Feedback positivo all'acquisto (U7): suono + "pop" del contatore monete, poi ri-disegna. */
  private afterPurchase() {
    ShopScene.sfx?.playFuelPickup();
    this.moneyText.setText(t('shop.money', { n: this.money }));
    this.tweens.killTweensOf(this.moneyText);
    this.moneyText.setScale(1.25);
    this.tweens.add({ targets: this.moneyText, scale: 1, duration: 180 });
    this.time.delayedCall(160, () => this.refresh());
  }

  /** Feedback negativo (U6): monete insufficienti → suono + lampo rosso sul contatore monete. */
  private denyPurchase() {
    ShopScene.sfx?.playImpact();
    this.tweens.killTweensOf(this.moneyText);
    this.moneyText.setColor(UI.red).setScale(1.12);
    this.tweens.add({ targets: this.moneyText, scale: 1, duration: 220, onComplete: () => this.moneyText.setColor(UI.gold) });
  }

  private continueGame() {
    Juice.go(this, 'GameScene');
  }
}
