import Phaser from 'phaser';
import { VEHICLES, VEHICLE_KEYS, SURVIVORS, SurvivorData, Upgrades, WEAPONS, WEAPON_KEYS, WeaponType } from '../GameData';
import GameScene from './GameScene';
import Juice from '../Juice';
import Settings from '../Settings';
import Ui, { UI, MENU_VIGNETTE } from '../Ui';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';

const H = 600;

interface ShopItem {
  key: string; label: string; cost: number; desc: string; oneTime: boolean;
}

const SHOP_ITEMS: ShopItem[] = [
  { key: 'repair',   label: 'Ripara tutto',      cost:  80, desc: 'Tutti i componenti tornano al 100%', oneTime: false },
  { key: 'armor',    label: 'Corazza rinforzata', cost: 150, desc: 'Danno ricevuto ridotto (-20%)',      oneTime: true  },
  { key: 'engine',   label: 'Motore potenziato',  cost: 120, desc: 'Velocità verticale +15%',           oneTime: true  },
  { key: 'turret',   label: 'Torretta migliorata',cost: 100, desc: 'Cadenza di fuoco +25%',             oneTime: true  },
  { key: 'fuelTank', label: 'Serbatoio extra',    cost:  80, desc: 'Carburante massimo +30',            oneTime: true  },
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

    this.money          = this.registry.get('money')         ?? 0;
    this.upgrades       = { ...(this.registry.get('upgrades') ?? {}) };
    this.currentVehicle = this.registry.get('vehicle')       ?? 'civilian_car';
    this.ownedVehicles  = this.registry.get('ownedVehicles')  ?? ['civilian_car'];
    this.survivors      = this.registry.get('survivors')      ?? [];
    this.missionNum     = this.registry.get('missionNumber')  ?? 2;
    this.currentWeapon  = this.registry.get('currentWeapon')  ?? 'mg';
    this.ownedWeapons   = this.registry.get('ownedWeapons')   ?? ['mg'];

    const available = SURVIVORS.filter(s => !this.survivors.includes(s.key));
    this.offeredSurvivors = Phaser.Utils.Array.Shuffle([...available]).slice(0, 3) as SurvivorData[];

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
    GameScene.buildEntityTextures(this);
    VEHICLE_KEYS.forEach(k => GameScene.buildVehicleTexture(this, k));
  }

  private drawUI() {
    // Background: gradiente verticale (più chiaro del vecchio piatto quasi-nero) per dare
    // profondità e tenere leggibili pannelli e card. Scena-locale, non un token di chrome.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a26, 0x1a1a26, 0x101018, 0x12121c, 1, 1, 1, 1);
    bg.fillRect(0, 0, this.designW, H);
    this.add.rectangle(this.designW/2, 32, this.designW, 64, UI.panelAlt);

    Ui.text(this, this.designW/2, 8, `GARAGE  —  Fine Missione ${this.missionNum - 1}`, {
      fontSize: '20px', color: UI.greenSoft, fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.moneyText = Ui.text(this, this.designW - 12, 8, `★ ${this.money} monete`, {
      fontSize: '18px', color: UI.gold,
    }).setOrigin(1, 0);

    Ui.text(this, this.designW/2, 46, `Missione successiva: ${this.missionNum}`, {
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
    Ui.text(this, px, py, 'POTENZIAMENTI', { fontSize: '13px', color: UI.blueInfo, fontStyle: 'bold' });

    SHOP_ITEMS.forEach((item, i) => {
      const iy = py + 22 + i * 48;
      const bought    = item.oneTime && !!(this.upgrades as Record<string,boolean>)[item.key];
      const canAfford = !bought && this.money >= item.cost;
      const bgColor   = bought ? UI.panelBought : UI.panel;

      const bg = Ui.box(this, px + 220, iy + 18, 440, 42, { fill: bgColor, radius: 6, stroke: UI.stroke, strokeAlpha: 0.5 });
      if (!bought) {
        bg.setInteractive(canAfford);
        bg.on('pointerover', () => { if (canAfford) bg.setFillStyle(0x181830); });
        bg.on('pointerout',  () => bg.setFillStyle(bgColor));
        bg.on('pointerdown', () => { if (canAfford) this.buyItem(item); });
      }

      const lc = bought ? UI.greenDim : canAfford ? UI.text : '#554444';
      Ui.text(this, px + 6, iy + 6,  item.label, { fontSize: '13px', color: lc, fontStyle: 'bold' });
      Ui.text(this, px + 6, iy + 24, item.desc,  { fontSize: '10px', color: UI.faint });
      if (bought) {
        Ui.text(this, px + 432, iy + 15, '✓', { fontSize: '13px', color: UI.greenDim }).setOrigin(1, 0.5);
      } else {
        Ui.text(this, px + 432, iy + 15, `★ ${item.cost}`, { fontSize: '13px', color: canAfford ? UI.gold : '#663333' }).setOrigin(1, 0.5);
      }
    });
  }

  private drawWeaponsPanel() {
    const px = 14 + this.ox, py = 322;
    this.drawDivider(py - 4);
    Ui.text(this, px, py, 'ARMI', { fontSize: '13px', color: '#ff9944', fontStyle: 'bold' });

    WEAPON_KEYS.forEach((key, i) => {
      const w        = WEAPONS[key];
      const wx       = px + i * 88;
      const owned    = this.ownedWeapons.includes(key);
      const selected = this.currentWeapon === key;
      const canBuy   = !owned && this.money >= w.price;
      const bgColor  = selected ? 0x1a1200 : owned ? 0x0e0e0e : 0x080808;

      const bg = Ui.box(this, wx + 40, py + 46, 82, 72, { fill: bgColor, radius: 7, stroke: UI.stroke, strokeAlpha: 0.5 })
        .setInteractive(owned || canBuy);

      // Anteprima reale: il proiettile dell'arma (razzo dedicato; bullet tinto per le altre)
      const projKey = key === 'rockets' ? 'rocket' : 'bullet';
      // bullet/rocket sono texture sovracampionate (OS_G) → scala ÷OVERSAMPLE.
      this.add.image(wx + 40, py + 22, projKey)
        .setTint(w.color).setScale((key === 'rockets' ? 1.7 : 2.4) / OVERSAMPLE).setAlpha(owned ? 1 : 0.4);
      Ui.text(this, wx + 40, py + 32, w.name, { fontSize: '8px', color: owned ? UI.text : '#444444', wordWrap: { width: 78 }, align: 'center' }).setOrigin(0.5, 0);

      if (owned) {
        Ui.text(this, wx + 40, py + 68, selected ? '● ATTIVA' : 'Usa',
          { fontSize: '9px', color: selected ? UI.goldDim : UI.blueUse }).setOrigin(0.5);
        if (!selected) {
          bg.on('pointerover',  () => bg.setFillStyle(0x1a1400));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.selectWeapon(key));
        }
      } else {
        Ui.text(this, wx + 40, py + 56, `★${w.price}`, { fontSize: '10px', color: canBuy ? UI.gold : '#443333' }).setOrigin(0.5);
        Ui.text(this, wx + 40, py + 70, canBuy ? 'COMPRA' : '🔒', { fontSize: '9px', color: canBuy ? UI.amber : UI.disabled }).setOrigin(0.5);
        if (canBuy) {
          bg.on('pointerover',  () => bg.setFillStyle(0x1a1000));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.buyWeapon(key));
        }
      }
    });

    // Descrizione arma attiva
    Ui.text(this, px, py + 92, `▸ ${WEAPONS[this.currentWeapon].desc}`,
      { fontSize: '10px', color: '#888866' });
  }

  // ─── Survivors panel (right) ─────────────────────────────────────────────────

  private drawSurvivorsPanel() {
    const px = 490 + this.ox, py = 76;
    Ui.text(this, px, py, 'SOPRAVVISSUTI', { fontSize: '13px', color: UI.goldDim, fontStyle: 'bold' });

    // Recruited list
    if (this.survivors.length > 0) {
      Ui.text(this, px, py + 22, 'Nel veicolo:', { fontSize: '11px', color: '#777755' });
      this.survivors.forEach((key, i) => {
        const s = SURVIVORS.find(sv => sv.key === key);
        if (s) Ui.text(this, px + 6, py + 36 + i * 16, `• ${s.name}`, { fontSize: '12px', color: s.color });
      });
    }

    // Offered survivors
    const rY = py + 24 + Math.max(this.survivors.length, 0) * 16 + 24;
    Ui.text(this, px, rY, this.offeredSurvivors.length > 0 ? 'Recluta (scegli 1):' : 'Nessuno disponibile',
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

      Ui.text(this, px + 6, iy + 8,  s.name,    { fontSize: '14px', color: s.color, fontStyle: 'bold' });
      Ui.text(this, px + 6, iy + 28, s.ability, { fontSize: '10px', color: '#666655' });
      Ui.text(this, px + 6, iy + 46, alreadyIn ? 'GIÀ RECLUTATO' : 'GRATIS',
        { fontSize: '11px', color: alreadyIn ? UI.greenDim : UI.greenOk });
    });
  }

  // ─── Vehicles panel (bottom) ─────────────────────────────────────────────────

  private drawVehiclesPanel() {
    const py = 428;
    Ui.text(this, 14 + this.ox, py, 'VEICOLI', { fontSize: '13px', color: UI.blueBright, fontStyle: 'bold' });

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
      }).setInteractive(owned || canBuy);

      // Anteprima reale: lo sprite del veicolo (sbiadito se non posseduto)
      this.add.image(vx + 50, py + 30, `vehicle_${key}`).setScale(0.7 / OVERSAMPLE).setAlpha(owned ? 1 : 0.4);
      Ui.text(this, vx + 50, py + 50, v.name, {
        fontSize: '8px', color: owned ? UI.text : '#444444', wordWrap: { width: 100 }, align: 'center',
      }).setOrigin(0.5, 0);

      if (owned) {
        Ui.text(this, vx + 50, py + 82, selected ? '● ATTIVO' : 'Usa',
          { fontSize: '10px', color: selected ? UI.green : UI.blueUse }).setOrigin(0.5);
        if (!selected) {
          bg.on('pointerover',  () => bg.setFillStyle(0x14142a));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.selectVehicle(key));
        }
      } else {
        Ui.text(this, vx + 50, py + 74, `★ ${v.price}`,
          { fontSize: '11px', color: canBuy ? UI.gold : '#444444' }).setOrigin(0.5);
        Ui.text(this, vx + 50, py + 92, canBuy ? 'COMPRA' : 'BLOCCATO',
          { fontSize: '9px', color: canBuy ? UI.amber : UI.disabled }).setOrigin(0.5);
        if (canBuy) {
          bg.on('pointerover',  () => bg.setFillStyle(0x141420));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.buyVehicle(key));
        }
      }
    });
  }

  // ─── Continue button ─────────────────────────────────────────────────────────

  private drawContinueButton() {
    Ui.button(this, this.designW/2, H - 28, 240, 44, 'CONTINUA  ▶', {
      fill: 0x1a3a1a, hover: 0x224422, color: UI.green,
      onClick: () => this.continueGame(),
    });
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  private buyItem(item: ShopItem) {
    if (this.money < item.cost) return;
    this.money -= item.cost;
    this.registry.set('money', this.money);

    if (item.key === 'repair') {
      this.registry.set('components', { engine: 100, wheels: 100, tank: 100, turret: 100, armor: 100 });
    } else {
      (this.upgrades as Record<string,boolean>)[item.key] = true;
      this.registry.set('upgrades', { ...this.upgrades });
    }
    this.refresh();
  }

  private recruitSurvivor(key: string) {
    if (this.survivors.includes(key)) return;
    this.registry.set('survivors', [...this.survivors, key]);
    this.refresh();
  }

  private selectVehicle(key: string) {
    this.registry.set('vehicle', key);
    this.refresh();
  }

  private buyVehicle(key: string) {
    const v = VEHICLES[key];
    if (this.money < v.price || this.ownedVehicles.includes(key)) return;
    this.money -= v.price;
    const newOwned = [...this.ownedVehicles, key];
    this.registry.set('money', this.money);
    this.registry.set('ownedVehicles', newOwned);
    this.registry.set('vehicle', key);
    this.refresh();
  }

  private selectWeapon(key: WeaponType) {
    this.registry.set('currentWeapon', key);
    this.refresh();
  }

  private buyWeapon(key: WeaponType) {
    const w = WEAPONS[key];
    if (this.money < w.price || this.ownedWeapons.includes(key)) return;
    this.money -= w.price;
    const newOwned = [...this.ownedWeapons, key];
    this.registry.set('money', this.money);
    this.registry.set('ownedWeapons', newOwned);
    this.registry.set('currentWeapon', key);
    this.refresh();
  }

  private continueGame() {
    Juice.go(this, 'GameScene');
  }
}
