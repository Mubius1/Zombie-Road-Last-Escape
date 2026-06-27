import Phaser from 'phaser';
import { VEHICLES, VEHICLE_KEYS, SURVIVORS, SurvivorData, Upgrades, WEAPONS, WEAPON_KEYS, WEAPON_AMMO, weaponInfiniteAmmo, WeaponType, FOOD, MORALE, vehicleRangeKm } from '../GameData';
import MetaProfile from '../MetaProfile';
import { buildEntityTextures, buildSurvivorTextures } from '../EntityTextures';
import { buildVehicleTexture, buildTurretTextures, TURRET_DX } from '../VehicleTextures';
import Juice from '../Juice';
import Settings from '../Settings';
import SoundManager from '../SoundManager';
import Ui, { UI } from '../Ui';
import MenuPad, { Focusable } from '../MenuPad';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';
import { getRun, setRun, snapshotRun, migrateUpgrades } from '../RunState';
import SaveData from '../SaveData';
import { locationForLeg, accentCss, StopLocation } from '../Locations';
import { t } from '../i18n';

const H = 600;
const HEAL_COST = 60; // M3: costo cura di un sopravvissuto ferito (dimezzato col Medico a bordo)

// `label`/`desc` sono CHIAVI i18n (risolte con t() al render). `key`/`cost` restano dati.
interface ShopItem {
  key: string; label: string; cost: number; desc: string; oneTime: boolean;
}

// Catalogo COMPLETO dei potenziamenti. 'repair' è universale; quali degli altri compaiano nel negozio
// dipende dal veicolo corrente (VEHICLES[key].upgrades). Acquisti = GLOBALI del convoglio (RunData.upgrades: Upgrades, portabili).
export const SHOP_ITEMS: ShopItem[] = [
  { key: 'repair',     label: 'item.repair.label',     cost:  80, desc: 'item.repair.desc',     oneTime: false },
  { key: 'refuel',     label: 'item.refuel.label',     cost:  50, desc: 'item.refuel.desc',     oneTime: false }, // carburante "viaggio": fa il pieno; compare solo se il serbatoio non è già pieno
  { key: 'restock',    label: 'item.restock.label',    cost: 120, desc: 'item.restock.desc',    oneTime: false }, // munizioni: ricarica al massimo le armi finite (pivot horror)
  { key: 'armor',      label: 'item.armor.label',      cost: 150, desc: 'item.armor.desc',      oneTime: true  },
  { key: 'engine',     label: 'item.engine.label',     cost: 120, desc: 'item.engine.desc',     oneTime: true  },
  { key: 'turret',     label: 'item.turret.label',     cost: 100, desc: 'item.turret.desc',     oneTime: true  },
  { key: 'fuelTank',   label: 'item.fuelTank.label',   cost:  80, desc: 'item.fuelTank.desc',   oneTime: true  },
  { key: 'plating',    label: 'item.plating.label',    cost: 180, desc: 'item.plating.desc',    oneTime: true  },
  { key: 'ram',        label: 'item.ram.label',        cost: 130, desc: 'item.ram.desc',        oneTime: true  },
  { key: 'nitro',      label: 'item.nitro.label',      cost: 110, desc: 'item.nitro.desc',      oneTime: true  },
  { key: 'ammo',       label: 'item.ammo.label',       cost: 160, desc: 'item.ammo.desc',       oneTime: true  },
  { key: 'filters',    label: 'item.filters.label',    cost:  90, desc: 'item.filters.desc',    oneTime: true  },
  { key: 'overcharge', label: 'item.overcharge.label', cost: 140, desc: 'item.overcharge.desc', oneTime: true  },
];

export default class ShopScene extends Phaser.Scene {
  private money = 0;
  private upgrades: Upgrades = {};                     // upgrade POSSEDUTI: set GLOBALE del convoglio (portabili)
  private currentWeapon: WeaponType = 'mg';
  private ownedWeapons: WeaponType[] = ['mg'];
  private currentVehicle = 'civilian_car';
  private ownedVehicles: string[] = ['civilian_car'];
  private survivors: string[] = [];
  private food = 0; // M2: scorta cibo di campagna (per il display + acquisto razioni nel negozio)
  private injured: string[] = []; // M3: sopravvissuti feriti (marker 🩹 + cura nel negozio)
  private missionNum = 2;
  private offeredSurvivors: SurvivorData[] = [];
  /** Idea 1 (B3): luogo della sosta (garage o specialista). Determina titolo, atmosfera e pannelli. */
  private location!: StopLocation;

  private moneyText!: Phaser.GameObjects.Text;
  // SoundManager condiviso (statico): il negozio fa scene.restart a ogni acquisto, quindi NON va
  // creato a ogni create() (lascerebbe un master appeso a ogni restart — cfr. AU7). Riusato.
  private static sfx?: SoundManager;
  /** true quando la scena si ri-disegna dopo un acquisto (niente nuova dissolvenza). */
  private replay = false;

  /** Larghezza di design e offset per centrare il blocco-contenuti (800px) in 16:9. */
  private designW = DESIGN_W;
  private ox = 0;
  /** Oggetti del tooltip veicolo (scheda al passaggio del mouse), distrutti all'uscita. */
  private vehicleTip: Array<{ destroy(): void }> = [];
  /** Elementi navigabili col gamepad, raccolti a ogni drawUI (la scena fa restart a ogni acquisto). */
  private navItems: Focusable[] = [];

  /** Registra un elemento per la navigazione col pad e lo restituisce (per concatenare). */
  private nav<T extends Focusable>(go: T): T { this.navItems.push(go); return go; }

  constructor() { super({ key: 'ShopScene' }); }

  init(data: { replay?: boolean }) {
    this.replay = data?.replay ?? false;
  }

  create() {
    this.designW = setupCamera(this).designW;
    this.ox = (this.designW - DESIGN_W) / 2;

    this.money          = getRun(this.registry, 'money')         ?? 0;
    this.currentVehicle = getRun(this.registry, 'vehicle')       ?? 'civilian_car';
    this.upgrades       = migrateUpgrades(getRun(this.registry, 'upgrades')); // upgrade posseduti (globali del convoglio, portabili)
    this.ownedVehicles  = getRun(this.registry, 'ownedVehicles')  ?? ['civilian_car'];
    this.survivors      = getRun(this.registry, 'survivors')      ?? [];
    this.food           = getRun(this.registry, 'food')           ?? FOOD.start;
    this.injured        = getRun(this.registry, 'injured')        ?? [];
    this.missionNum     = getRun(this.registry, 'missionNumber')  ?? 2;
    this.currentWeapon  = getRun(this.registry, 'currentWeapon')  ?? 'mg';
    this.ownedWeapons   = getRun(this.registry, 'ownedWeapons')   ?? ['mg'];

    // Campagna "IL CONVOGLIO" (F1): la sosta è quella della tratta APPENA COMPLETATA = legIndex−1
    // (triggerMissionComplete ha già avanzato legIndex). Stabile tra i refresh post-acquisto.
    this.location = locationForLeg((getRun(this.registry, 'legIndex') ?? 1) - 1);

    // Offerta reclute: calcolata UNA volta per SOSTA (non sui refresh post-azione né sul rientro dall'hub,
    // altrimenti uscire/rientrare nel negozio rimescola la terna = reroll gratis). Cache nel registry,
    // marcata col numero di missione → fresca solo a una sosta nuova; riusata per refresh e rientri.
    const offerMission = this.registry.get('offeredSurvivorsMission') as number | undefined;
    const cachedKeys = (this.registry.get('offeredSurvivors') as string[] | undefined) ?? [];
    if (offerMission !== this.missionNum || cachedKeys.length === 0) {
      // Fase R (R3): si possono reclutare solo i sopravvissuti META-SBLOCCATI (gate di varietà del roster).
      const available = SURVIVORS.filter(s => !this.survivors.includes(s.key) && MetaProfile.isUnlocked('survivor', s.key));
      this.offeredSurvivors = Phaser.Utils.Array.Shuffle([...available]).slice(0, 3);
      this.registry.set('offeredSurvivors', this.offeredSurvivors.map(s => s.key));
      this.registry.set('offeredSurvivorsMission', this.missionNum);
    } else {
      this.offeredSurvivors = cachedKeys.map(k => SURVIVORS.find(s => s.key === k)).filter(Boolean) as SurvivorData[];
    }

    // Audio del negozio (feedback acquisti U7 / diniego U6) — istanza statica riusata fra i restart.
    const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (webAudio?.context) {
      if (!ShopScene.sfx) ShopScene.sfx = new SoundManager(webAudio.context);
      ShopScene.sfx.setVolume(Settings.volume);
    }

    this.ensureTextures();
    this.drawUI();

    // Dissolvenza solo al primo ingresso — non a ogni ri-disegno dopo un acquisto. Il negozio è un
    // MENU: nessun effetto schermo (il post-processing filmico vive solo in GameScene), qualunque sia `screenFx`.
    if (!this.replay) Juice.fadeIn(this);

    // Bark di reclutamento sopravvissuto al refresh: mostrato sulla scena ricostruita → leggibile per intero.
    const pendingBark = this.registry.get('pendingRecruitBark') as string | undefined;
    if (pendingBark) { this.registry.remove('pendingRecruitBark'); this.bark(pendingBark); }
  }

  /** Ri-disegna la scena dopo un acquisto/selezione, senza ripetere la dissolvenza. */
  private refresh() {
    this.scene.restart({ replay: true });
  }

  /** Genera (una volta) le texture procedurali per le anteprime di armi e veicoli. */
  private ensureTextures() {
    buildSurvivorTextures(this); // ritratti sopravvissuti (guardia propria, sempre disponibili)
    if (this.textures.exists('vehicle_experimental')) return; // già generate da una partita
    buildEntityTextures(this);
    VEHICLE_KEYS.forEach(k => buildVehicleTexture(this, k));
    buildTurretTextures(this); // torretta statica per le anteprime
  }

  private drawUI() {
    this.navItems = []; // ricostruiti a ogni disegno (restart post-acquisto)
    // Background: gradiente verticale (più chiaro del vecchio piatto quasi-nero) per dare
    // profondità e tenere leggibili pannelli e card. Scena-locale, non un token di chrome.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a26, 0x1a1a26, 0x101018, 0x12121c, 1, 1, 1, 1);
    bg.fillRect(0, 0, this.designW, H);
    this.add.rectangle(this.designW/2, 32, this.designW, 64, UI.panelAlt);

    // Idea 1 (B3): titolo = NOME DEL LUOGO (non più sempre "GARAGE") + riga d'atmosfera, tinti d'accento.
    const accent = accentCss(this.location.accent);
    Ui.text(this, this.designW/2, 6, t('shop.titleAt', { place: t(this.location.nameKey), n: this.missionNum - 1 }), {
      fontSize: '20px', color: accent, fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.moneyText = Ui.text(this, this.designW - 12, 8, t('shop.money', { n: this.money }), {
      fontSize: '18px', color: UI.gold,
    }).setOrigin(1, 0);

    Ui.text(this, this.designW/2, 32, t(this.location.flavorKey), {
      fontSize: '11px', color: accent, fontStyle: 'italic',
    }).setOrigin(0.5, 0);
    Ui.text(this, this.designW/2, 49, t('shop.nextMission', { n: this.missionNum }), {
      fontSize: '11px', color: UI.faint,
    }).setOrigin(0.5, 0);

    this.drawDivider(66);
    this.drawUpgradesPanel();
    if (this.location.weapons)   this.drawWeaponsPanel();
    if (this.location.survivors) this.drawSurvivorsPanel();
    if (this.location.vehicles) { this.drawDivider(418); this.drawVehiclesPanel(); }
    this.drawContinueButton();

    // Navigazione col gamepad: tutti gli elementi attivabili raccolti durante il disegno.
    // B = prosegui (come il pulsante CONTINUA) → non si resta intrappolati nel negozio.
    const pad = new MenuPad(this).setBack(() => this.continueGame());
    for (const it of this.navItems) pad.add(it);
  }

  private drawDivider(y: number) {
    this.add.rectangle(this.designW/2, y, this.designW, 1, UI.stroke);
  }

  // ─── Upgrades panel (left) ───────────────────────────────────────────────────

  private drawUpgradesPanel() {
    const px = 14 + this.ox, py = 76;
    // Idea 1 (B3): i RIFORNIMENTI (repair/refuel/restock) sono ovunque; i potenziamenti one-time solo
    // nei luoghi con `upgrades`. Senza di essi il pannello si rietichetta "RIFORNIMENTI".
    const showUpgrades = this.location.upgrades;
    const vName = t(VEHICLES[this.currentVehicle]?.name ?? '');
    Ui.text(this, px, py, showUpgrades ? t('shop.upgrades') : t('shop.supplies'), { fontSize: '13px', color: UI.blueInfo, fontStyle: 'bold' });
    // Sottotitolo (catalogo di QUESTO veicolo): solo se il luogo vende potenziamenti.
    if (showUpgrades) Ui.text(this, px + 434, py + 2, t('shop.upgradesFor', { v: vName }), { fontSize: '10px', color: UI.faint }).setOrigin(1, 0);

    // 'repair' è universale; 'restock' compare solo se possiedi un'arma finita (la MG è ∞ → inutile);
    // gli altri (one-time) dipendono dal catalogo del veicolo CORRENTE e solo dove `showUpgrades`.
    const catalog = (VEHICLES[this.currentVehicle]?.upgrades ?? []) as string[];
    const hasFinite = this.ownedWeapons.some(w => !weaponInfiniteAmmo(w));
    const items = SHOP_ITEMS.filter(it =>
      it.key === 'repair'  ? true :
      it.key === 'refuel'  ? this.refuelNeeded() : // universale, ma solo se c'è da rifornire
      it.key === 'restock' ? hasFinite :
      showUpgrades && catalog.includes(it.key));

    const colW = 216, rowH = 50, boxW = 208;
    items.forEach((item, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const ix = px + col * colW, iy = py + 22 + row * rowH;
      const bought    = item.oneTime && !!(this.upgrades as Record<string,boolean>)[item.key];
      const canAfford = !bought && this.money >= item.cost;
      const bgColor   = bought ? UI.panelBought : UI.panel;

      const bg = Ui.box(this, ix + boxW / 2, iy + 18, boxW, 42, { fill: bgColor, radius: 6, stroke: UI.stroke, strokeAlpha: 0.5 });
      if (!bought) {
        // Interattiva anche se non acquistabile: serve il feedback "monete insufficienti" (U6).
        bg.setInteractive(true);
        bg.on('pointerover', () => { if (canAfford) bg.setFillStyle(0x181830); });
        bg.on('pointerout',  () => bg.setFillStyle(bgColor));
        bg.on('pointerdown', () => { if (canAfford) this.buyItem(item); else this.denyPurchase(); });
        this.nav(bg);
      }

      const lc = bought ? UI.greenDim : canAfford ? UI.text : '#554444';
      Ui.text(this, ix + 6, iy + 5,  t(item.label), { fontSize: '12px', color: lc, fontStyle: 'bold' });
      Ui.text(this, ix + 6, iy + 23, t(item.desc),  { fontSize: '9px',  color: UI.faint });
      if (bought) {
        Ui.text(this, ix + boxW - 8, iy + 14, '✓', { fontSize: '13px', color: UI.greenDim }).setOrigin(1, 0.5);
      } else if (canAfford) {
        Ui.text(this, ix + boxW - 8, iy + 14, `★${item.cost}`, { fontSize: '12px', color: UI.gold }).setOrigin(1, 0.5);
      } else {
        Ui.text(this, ix + boxW - 8, iy + 14, `🔒${item.cost}`, { fontSize: '11px', color: '#aa5555' }).setOrigin(1, 0.5);
      }
    });
  }

  private drawWeaponsPanel() {
    // Alzato (la griglia potenziamenti compatta ha liberato spazio sopra) e ri-spaziato: titolo SOPRA
    // le card, descrizione SOTTO le card e sopra il divisore dei veicoli (niente più sovrapposizioni).
    const px = 14 + this.ox, py = 300;
    this.drawDivider(py - 8);
    Ui.text(this, px, py - 4, t('shop.weapons'), { fontSize: '13px', color: '#ff9944', fontStyle: 'bold' });

    // Fase R (R3): il negozio offre solo le armi META-SBLOCCATE (o già possedute). Gate di VARIETÀ, non potenza.
    const shopWeapons = WEAPON_KEYS.filter(k => MetaProfile.isUnlocked('weapon', k) || this.ownedWeapons.includes(k));
    shopWeapons.forEach((key, i) => {
      const w        = WEAPONS[key];
      const wx       = px + i * 88;
      const owned    = this.ownedWeapons.includes(key);
      const selected = this.currentWeapon === key;
      const canBuy   = !owned && this.money >= w.price;
      const bgColor  = selected ? 0x1a1200 : owned ? 0x0e0e0e : 0x080808;
      const cy       = py + 50; // centro card (82×72 → top py+14, bottom py+86): sotto il titolo

      const bg = Ui.box(this, wx + 40, cy, 82, 72, { fill: bgColor, radius: 7, stroke: UI.stroke, strokeAlpha: 0.5 })
        .setInteractive(true);

      // Anteprima reale: il proiettile dell'arma (razzo dedicato; bullet tinto per le altre)
      const projKey = key === 'rockets' ? 'rocket' : 'bullet';
      // bullet/rocket sono texture sovracampionate (OS_G) → scala ÷OVERSAMPLE.
      this.add.image(wx + 40, cy - 24, projKey)
        .setTint(w.color).setScale((key === 'rockets' ? 1.7 : 2.4) / OVERSAMPLE).setAlpha(owned ? 1 : 0.4);
      Ui.text(this, wx + 40, cy - 14, t(w.name), { fontSize: '10px', color: owned ? UI.text : '#444444', wordWrap: { width: 78 }, align: 'center' }).setOrigin(0.5, 0);

      if (owned) {
        Ui.text(this, wx + 40, cy + 22, selected ? t('shop.activeWeapon') : t('shop.use'),
          { fontSize: '10px', color: selected ? UI.goldDim : UI.blueUse }).setOrigin(0.5);
        if (!selected) {
          bg.on('pointerover',  () => bg.setFillStyle(0x1a1400));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.selectWeapon(key));
          this.nav(bg);
        }
      } else {
        Ui.text(this, wx + 40, cy + 10, `★${w.price}`, { fontSize: '11px', color: canBuy ? UI.gold : '#443333' }).setOrigin(0.5);
        Ui.text(this, wx + 40, cy + 24, canBuy ? t('shop.buy') : '🔒', { fontSize: '11px', color: canBuy ? UI.amber : UI.disabled }).setOrigin(0.5);
        if (canBuy) {
          bg.on('pointerover',  () => bg.setFillStyle(0x1a1000));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.buyWeapon(key));
        } else {
          bg.on('pointerdown',  () => this.denyPurchase()); // feedback "monete insufficienti" anche sulle armi (REG7)
        }
        this.nav(bg);
      }
    });

    // Descrizione arma attiva (sotto le card, ben sopra il divisore dei veicoli a y=418)
    Ui.text(this, px, py + 92, t('shop.weaponDesc', { desc: t(WEAPONS[this.currentWeapon].desc) }),
      { fontSize: '11px', color: '#888866' });
  }

  // ─── Survivors panel (right) ─────────────────────────────────────────────────

  private drawSurvivorsPanel() {
    const px = 490 + this.ox, py = 76;
    const cap = VEHICLES[this.currentVehicle]?.survivorSlots ?? 4;
    Ui.text(this, px, py, `${t('shop.survivors')}  ${this.survivors.length}/${cap}`, {
      fontSize: '13px', color: this.survivors.length >= cap ? UI.amberSoft : UI.goldDim, fontStyle: 'bold',
    });

    // M2 cibo: scorta di campagna + acquisto razioni. La proiezione "affamato" si aggiorna dal vivo
    // comprando razioni (più cibo → più sopravvissuti sfamati alla prossima missione).
    const fedNext = Math.floor(this.food / FOOD.perSurvivor);
    Ui.text(this, px, py + 18, t('shop.food', { n: this.food, max: FOOD.max }),
      { fontSize: '11px', color: this.food < this.survivors.length * FOOD.perSurvivor ? UI.amberSoft : UI.goldDim });
    const canRation = this.food < FOOD.max && this.money >= FOOD.rationCost;
    const rat = Ui.text(this, px + 286, py + 18, t('shop.rations', { n: FOOD.rationFood, c: FOOD.rationCost }),
      { fontSize: '11px', color: canRation ? UI.greenOk : '#554444', fontStyle: 'bold' }).setOrigin(1, 0);
    if (canRation) {
      rat.setInteractive({ useHandCursor: true });
      rat.on('pointerover', () => rat.setColor(UI.white));
      rat.on('pointerout',  () => rat.setColor(UI.greenOk));
      rat.on('pointerdown', () => this.buyRations());
      this.nav(rat);
    }

    // Recruited list (sotto la riga del cibo). Chi è oltre la capienza di cibo → segnato "affamato".
    if (this.survivors.length > 0) {
      Ui.text(this, px, py + 40, t('shop.inVehicle'), { fontSize: '11px', color: '#777755' });
      this.survivors.forEach((key, i) => {
        const s = SURVIVORS.find(sv => sv.key === key);
        if (!s) return;
        const ly = py + 54 + i * 18;
        const starving = i >= fedNext; // proiezione fame alla prossima missione col cibo attuale
        const hurt = this.injured.includes(key);
        const mark = (hurt ? ' 🩹' : '') + (starving ? ' 🍖✗' : '');
        Ui.text(this, px + 6, ly, t('shop.survivorName', { name: `${s.properName} ${s.surname}` }) + mark,
          { fontSize: '12px', color: hurt ? UI.red : starving ? UI.amberSoft : s.color });
        // M3: cura del ferito (★, dimezzata col Medico a bordo).
        if (hurt) {
          const cost = this.healCost(), canHeal = this.money >= cost;
          const heal = Ui.text(this, px + 250, ly, t('shop.heal', { c: cost }),
            { fontSize: '10px', color: canHeal ? UI.greenOk : '#554444', fontStyle: 'bold' }).setOrigin(1, 0);
          if (canHeal) {
            heal.setInteractive({ useHandCursor: true });
            heal.on('pointerover', () => heal.setColor(UI.white));
            heal.on('pointerout',  () => heal.setColor(UI.greenOk));
            heal.on('pointerdown', () => this.healSurvivor(key));
            this.nav(heal);
          }
        }
        // ✕ = fai scendere dal veicolo (libera un posto).
        const off = Ui.text(this, px + 286, ly, '✕', { fontSize: '14px', color: UI.amberSoft, fontStyle: 'bold' })
          .setOrigin(1, 0).setInteractive({ useHandCursor: true });
        off.on('pointerover', () => off.setColor(UI.red));
        off.on('pointerout',  () => off.setColor(UI.amberSoft));
        off.on('pointerdown', () => this.dismissSurvivor(key));
        this.nav(off);
      });
    }

    // Offered survivors. M1: dopo aver reclutato in questa sosta, gli altri offerti si bloccano.
    const recruitSpent = getRun(this.registry, 'recruitLockMission') === this.missionNum;
    const rY = py + 42 + Math.max(this.survivors.length, 0) * 18 + 24;
    Ui.text(this, px, rY, recruitSpent ? t('shop.recruitSpent')
        : (this.offeredSurvivors.length > 0 ? t('shop.recruit') : t('shop.noneAvailable')),
      { fontSize: '11px', color: recruitSpent ? UI.amberSoft : '#777755' });

    this.offeredSurvivors.forEach((s, i) => {
      const iy = rY + 18 + i * 88;
      const alreadyIn = this.survivors.includes(s.key);
      const full = !alreadyIn && this.survivors.length >= cap;
      const locked = alreadyIn || full || recruitSpent;
      const bg = Ui.box(this, px + 145, iy + 38, 290, 80, { fill: UI.panelWarm, radius: 7, stroke: UI.stroke, strokeAlpha: 0.5 });

      if (!locked) {
        bg.setInteractive(true);
        bg.on('pointerover', () => bg.setFillStyle(0x1e1e14));
        bg.on('pointerout',  () => bg.setFillStyle(UI.panelWarm));
        bg.on('pointerdown', () => this.recruitSurvivor(s.key));
        this.nav(bg);
      }

      // Ritratto procedurale (sbiadito se non reclutabile: a bordo, veicolo pieno o reclutamento speso).
      this.add.image(px + 262, iy + 38, `survivor_${s.key}`).setScale(1 / OVERSAMPLE).setAlpha(locked ? 0.45 : 1);
      Ui.text(this, px + 6, iy + 6,  `${s.properName} ${s.surname} · ${t(s.name)}`, { fontSize: '13px', color: s.color, fontStyle: 'bold' });
      Ui.text(this, px + 6, iy + 23, t(s.bio), { fontSize: '9px', color: '#8a8478', fontStyle: 'italic', wordWrap: { width: 218 } });
      Ui.text(this, px + 6, iy + 53, t(s.ability, s.abilityParams), { fontSize: '10px', color: '#666655', wordWrap: { width: 218 } });
      Ui.text(this, px + 6, iy + 67,
        alreadyIn ? t('shop.recruited') : full ? t('shop.vehicleFull') : recruitSpent ? t('shop.recruitOnePerVisit') : t('shop.free'),
        { fontSize: '11px', color: alreadyIn ? UI.greenDim : full ? UI.amberSoft : recruitSpent ? UI.amberSoft : UI.greenOk });
    });
  }

  // ─── Vehicles panel (bottom) ─────────────────────────────────────────────────

  private drawVehiclesPanel() {
    const py = 428;
    Ui.text(this, 14 + this.ox, py, t('shop.vehicles'), { fontSize: '13px', color: UI.blueBright, fontStyle: 'bold' });

    // Fase R (R3): il negozio offre solo i veicoli META-SBLOCCATI (o già posseduti).
    const shopVehicles = VEHICLE_KEYS.filter(k => MetaProfile.isUnlocked('vehicle', k) || this.ownedVehicles.includes(k));
    shopVehicles.forEach((key, i) => {
      const v = VEHICLES[key]!;
      const vx = 14 + this.ox + i * 112;
      const owned    = this.ownedVehicles.includes(key);
      const selected = this.currentVehicle === key;
      const canBuy   = !owned && this.money >= v.price;

      const bgColor = selected ? 0x0e1e2e : owned ? 0x0e0e1e : 0x08080e;
      const bg = Ui.box(this, vx + 50, py + 66, 106, 96, {
        fill: bgColor, radius: 8,
        stroke: selected ? UI.greenSig : UI.stroke, strokeAlpha: selected ? 0.9 : 0.5,
      }).setInteractive(true);
      bg.on('pointerover', () => this.showVehicleTooltip(key)); // scheda completa (descrizione + specifiche)
      bg.on('pointerout',  () => this.hideVehicleTooltip());

      // Anteprima reale: sprite veicolo (sbiadito se non posseduto) + torretta statica (canna mg, in avanti).
      // Scala 0.58 (era 0.7): i mezzi larghi (camion) restavano dentro al bordo della card da 106px.
      // y a py+32 (era py+28): scende di 4px così il bordo alto del mezzo non tocca il bordo della card.
      this.add.image(vx + 50, py + 32, `vehicle_${key}`).setScale(0.58 / OVERSAMPLE).setAlpha(owned ? 1 : 0.4);
      this.add.image(vx + 50 + (TURRET_DX[key] ?? 8) * 0.58, py + 32, 'aim_turret_mg')
        .setOrigin(0.11, 0.5).setScale(0.58 / OVERSAMPLE).setAlpha(owned ? 1 : 0.4);
      Ui.text(this, vx + 50, py + 46, t(v.name), {
        fontSize: '10px', color: owned ? UI.text : '#444444', wordWrap: { width: 100 }, align: 'center',
      }).setOrigin(0.5, 0);

      if (owned) {
        Ui.text(this, vx + 50, py + 82, selected ? t('shop.activeVehicle') : t('shop.use'),
          { fontSize: '10px', color: selected ? UI.green : UI.blueUse }).setOrigin(0.5);
        if (!selected) {
          bg.on('pointerover',  () => bg.setFillStyle(0x14142a));
          bg.on('pointerout',   () => bg.setFillStyle(bgColor));
          bg.on('pointerdown',  () => this.selectVehicle(key));
          this.nav(bg);
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
        this.nav(bg);
      }
    });
  }

  /** Scheda veicolo (al passaggio del mouse): nome, descrizione e specifiche CV/peso/velocità + bonus. */
  private showVehicleTooltip(key: string) {
    this.hideVehicleTooltip();
    const v = VEHICLES[key]!;
    const cx = this.designW / 2, cy = 352;
    const keep = <T extends { destroy(): void }>(o: T): T => { this.vehicleTip.push(o); return o; };
    keep(Ui.box(this, cx, cy, 600, 128, { fill: 0x0a0a14, fillAlpha: 0.98, radius: 10, stroke: UI.blueLine, strokeAlpha: 0.85 }).setDepth(60));
    keep(Ui.text(this, cx, cy - 54, t(v.name), { fontSize: '15px', color: UI.blueBright, fontStyle: 'bold' }).setOrigin(0.5).setDepth(61));
    keep(Ui.text(this, cx, cy - 34, t(v.desc), { fontSize: '11px', color: '#9a9488', fontStyle: 'italic', align: 'center', wordWrap: { width: 560 } }).setOrigin(0.5, 0).setDepth(61));
    keep(Ui.text(this, cx, cy + 12, t('shop.vehSpecs', { hp: v.horsepower, w: v.weight, sp: v.topSpeed }), { fontSize: '13px', color: UI.gold, fontStyle: 'bold' }).setOrigin(0.5).setDepth(61));
    // Autonomia stimata del pieno (logistica visibile): deriva da massa/potenza via vehicleRangeKm (BALANCE §3 bis).
    keep(Ui.text(this, cx, cy + 30, t('shop.vehRange', { km: vehicleRangeKm(v) }), { fontSize: '11px', color: UI.amberSoft }).setOrigin(0.5).setDepth(61));
    const stats = `❤ +${v.healthBonus}     🛡 +${v.armorBonus}     👥 ${v.survivorSlots}     ⚡ ×${v.speedMult}     🔫 ×${v.fireMult}`;
    keep(Ui.text(this, cx, cy + 48, stats, { fontSize: '12px', color: UI.text }).setOrigin(0.5).setDepth(61));
  }

  private hideVehicleTooltip() {
    this.vehicleTip.forEach(o => o.destroy());
    this.vehicleTip = [];
  }

  // ─── Continue button ─────────────────────────────────────────────────────────

  private drawContinueButton() {
    // "Indietro": esce dal negozio e torna alla sosta (l'hub). Colore neutro (non più verde "prosegui").
    const cont = Ui.button(this, this.designW/2, H - 28, 240, 44, t('shop.back'), {
      fill: 0x1e2336, hover: 0x29304a, color: UI.blue,
      onClick: () => this.continueGame(),
    });
    this.nav(cont.bg);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  private buyItem(item: ShopItem) {
    if (this.money < item.cost) return;
    // Rifornimento munizioni: niente acquisto a vuoto se non c'è nulla da ricaricare (evita spreco monete).
    if (item.key === 'restock' && !this.restockNeeded()) { this.denyPurchase(); return; }
    if (item.key === 'refuel'  && !this.refuelNeeded())  { this.denyPurchase(); return; }
    this.money -= item.cost;
    setRun(this.registry, 'money', this.money);

    if (item.key === 'repair') {
      setRun(this.registry, 'components', { engine: 100, wheels: 100, tank: 100, turret: 100 }); // M2: 4 componenti
    } else if (item.key === 'refuel') {
      setRun(this.registry, 'fuel', this.maxFuelForVehicle()); // carburante "viaggio": fa il pieno del mezzo corrente
    } else if (item.key === 'restock') {
      // Munizioni (pivot horror): ricarica al MASSIMO ogni arma finita posseduta.
      const ammo = { ...(getRun(this.registry, 'ammo') ?? {}) } as Partial<Record<WeaponType, number>>;
      for (const wk of this.ownedWeapons) if (!weaponInfiniteAmmo(wk)) ammo[wk] = WEAPON_AMMO[wk];
      setRun(this.registry, 'ammo', ammo);
    } else {
      // Potenziamento POSSEDUTO globalmente (portabile): comprato una volta, vale su ogni mezzo che lo supporta.
      (this.upgrades as Record<string,boolean>)[item.key] = true;
      setRun(this.registry, 'upgrades', { ...this.upgrades });
    }
    this.afterPurchase();
  }

  /** Voce dell'equipaggio: toast diegetico (battuta) a centro-alto, per dare personalità ai sopravvissuti. */
  private bark(msg: string) {
    const txt = Ui.text(this, this.scale.width / 2, 44, msg, {
      fontSize: '14px', color: UI.greenSoft, fontStyle: 'italic', stroke: '#000000', strokeThickness: 3,
      align: 'center', wordWrap: { width: 540 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(80);
    this.tweens.add({ targets: txt, alpha: 0, y: 30, delay: 2600, duration: 1500, onComplete: () => txt.destroy() }); // ~4.1s: tempo di leggere la bio
  }

  private recruitSurvivor(key: string) {
    if (this.survivors.includes(key)) return;
    // M1: 1 reclutamento a sosta. Il lock è per numero di missione → sopravvive al refresh del negozio.
    if (getRun(this.registry, 'recruitLockMission') === this.missionNum) { ShopScene.sfx?.playImpact(); return; }
    const cap = VEHICLES[this.currentVehicle]?.survivorSlots ?? 4;
    if (this.survivors.length >= cap) { ShopScene.sfx?.playImpact(); return; } // veicolo pieno
    setRun(this.registry, 'survivors', [...this.survivors, key]);
    setRun(this.registry, 'recruitLockMission', this.missionNum);
    // F5: reclutare risolleva il morale del convoglio (il gruppo cresce).
    setRun(this.registry, 'morale', Math.min(MORALE.max, (getRun(this.registry, 'morale') ?? MORALE.start) + MORALE.dRecruit));
    this.persist();
    ShopScene.sfx?.playFuelPickup();
    // Voce: chi sale a bordo si presenta leggendo la propria storia (i bio finora "morti" diventano voce).
    // Il bark è memorizzato nel registry e ri-mostrato dopo il refresh: `scene.restart()` lo cancellerebbe
    // in 150 ms (lampo illeggibile) → invece lo replichiamo sulla scena ricostruita, dura per intero.
    const sv = SURVIVORS.find(x => x.key === key);
    if (sv) this.registry.set('pendingRecruitBark', t('survivor.barkRecruit', { name: `${sv.properName} ${sv.surname}`, bio: t(sv.bio) }));
    this.time.delayedCall(150, () => this.refresh());
  }

  /** M3: cura un sopravvissuto ferito pagando healCost() monete. */
  private healSurvivor(key: string) {
    const cost = this.healCost();
    if (!this.injured.includes(key) || this.money < cost) return;
    this.money -= cost;
    this.injured = this.injured.filter(k => k !== key);
    setRun(this.registry, 'money', this.money);
    setRun(this.registry, 'injured', this.injured);
    this.afterPurchase();
  }

  /** Costo cura: dimezzato se il Medico è a bordo (sinergia M3). */
  private healCost(): number {
    return this.survivors.includes('medic') ? Math.floor(HEAL_COST / 2) : HEAL_COST;
  }

  /** M2: compra una razione (food += rationFood, cap FOOD.max) per FOOD.rationCost monete. */
  private buyRations() {
    if (this.food >= FOOD.max || this.money < FOOD.rationCost) return;
    this.money -= FOOD.rationCost;
    this.food = Math.min(FOOD.max, this.food + FOOD.rationFood);
    setRun(this.registry, 'money', this.money);
    setRun(this.registry, 'food', this.food);
    this.afterPurchase();
  }

  /** Pulisce le key di stato (injured/hungry) dei sopravvissuti che lasciano il veicolo. Senza questo,
   *  'injured' (mai ricalcolato a runtime) resta orfano → al re-reclutamento il sopravvissuto risulta
   *  ferito e incurabile (la cura nel negozio itera solo i sopravvissuti a bordo). */
  private clearSurvivorState(keys: string[]) {
    this.injured = this.injured.filter(k => !keys.includes(k));
    setRun(this.registry, 'injured', this.injured);
    setRun(this.registry, 'hungry', (getRun(this.registry, 'hungry') ?? []).filter(k => !keys.includes(k)));
  }

  /** Fa scendere un sopravvissuto dal veicolo (libera un posto; il re-render aggiorna capienza e offerti). */
  private dismissSurvivor(key: string) {
    if (!this.survivors.includes(key)) return;
    this.survivors = this.survivors.filter(k => k !== key);
    setRun(this.registry, 'survivors', this.survivors);
    this.clearSurvivorState([key]);
    this.persist();
    ShopScene.sfx?.playImpact();
    this.time.delayedCall(120, () => this.refresh());
  }

  /** Riduce i sopravvissuti alla capienza del veicolo scelto (gli eccedenti restano indietro). */
  private trimSurvivors(vehicleKey: string) {
    const cap = VEHICLES[vehicleKey]?.survivorSlots ?? 4;
    if (this.survivors.length > cap) {
      const dropped = this.survivors.slice(cap);
      this.survivors = this.survivors.slice(0, cap);
      setRun(this.registry, 'survivors', this.survivors);
      this.clearSurvivorState(dropped);
    }
  }

  private selectVehicle(key: string) {
    setRun(this.registry, 'vehicle', key);
    this.currentVehicle = key;
    this.trimSurvivors(key);
    this.persist();
    this.refresh();
  }

  private buyVehicle(key: string) {
    const v = VEHICLES[key]!;
    if (this.money < v.price || this.ownedVehicles.includes(key)) return;
    this.money -= v.price;
    const newOwned = [...this.ownedVehicles, key];
    setRun(this.registry, 'money', this.money);
    setRun(this.registry, 'ownedVehicles', newOwned);
    setRun(this.registry, 'vehicle', key);
    this.currentVehicle = key;
    this.trimSurvivors(key);
    this.afterPurchase();
  }

  private selectWeapon(key: WeaponType) {
    setRun(this.registry, 'currentWeapon', key);
    this.persist();
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
    // Munizioni (pivot horror): un'arma finita appena comprata arriva CARICA.
    if (!weaponInfiniteAmmo(key)) {
      const ammo = { ...(getRun(this.registry, 'ammo') ?? {}) } as Partial<Record<WeaponType, number>>;
      ammo[key] = WEAPON_AMMO[key];
      setRun(this.registry, 'ammo', ammo);
    }
    this.afterPurchase();
  }

  /** True se almeno un'arma finita posseduta non è al massimo (→ il rifornimento ha effetto). */
  private restockNeeded(): boolean {
    const ammo = (getRun(this.registry, 'ammo') ?? {});
    return this.ownedWeapons.some(w => !weaponInfiniteAmmo(w) && (ammo[w] ?? 0) < WEAPON_AMMO[w]);
  }

  /** Serbatoio massimo del veicolo corrente (= MAX_FUEL 100 + Serbatoio extra). MAX_FUEL non è importabile
   *  da GameScene → letterale 100, allineato a `MAX_FUEL`/`item.fuelTank` (+30). */
  private maxFuelForVehicle(): number {
    return 100 + (this.upgrades.fuelTank && (VEHICLES[this.currentVehicle]?.upgrades ?? []).includes('fuelTank') ? 30 : 0);
  }

  /** True se il serbatoio non è già pieno (→ il rifornimento al garage ha effetto). */
  private refuelNeeded(): boolean {
    return (getRun(this.registry, 'fuel') ?? 100) < this.maxFuelForVehicle();
  }

  /** Persiste il checkpoint su disco dopo ogni cambiamento di stato nel negozio (fix review: chiudere
   *  il browser nel negozio non deve perdere acquisti/scelte). I run di Debug non persistono. */
  private persist() {
    if (this.registry.get('debugRun') === true) return;
    SaveData.saveRun(snapshotRun(this.registry));
  }

  /** Feedback positivo all'acquisto (U7): suono + "pop" del contatore monete, poi ri-disegna. */
  private afterPurchase() {
    this.persist();
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
    // Soste diegetiche: dal negozio si ESCE tornando alla sosta (l'hub a piedi). Il viaggio prosegue
    // SOLO scegliendo di ripartire dal veicolo nella sosta → niente più proseguimento forzato dal menu.
    Juice.go(this, 'StopScene');
  }
}
