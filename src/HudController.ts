import Phaser from 'phaser';
import Ui, { UI } from './Ui';
import Settings from './Settings';
import { WEAPONS, WEAPON_KEYS, WeaponType } from './GameData';
import { t } from './i18n';
import { OVERSAMPLE } from './Config';
import { distanceKm } from './World';
import type { ComponentKey } from './World';
import type { ComponentData } from './scenes/GameScene';

const H = 600;
// Colore del moltiplicatore combo per livello (×1..×5) — toni funzionali UI.
const COMBO_COLORS = [UI.muted, UI.gold, UI.amber, UI.redText, UI.red];

// Palette daltonico-safe (blu/giallo/arancio: distinguibili per protan/deutan, dove rosso↔verde
// si confondono) usata per le barre di stato quando `Settings.colorblind` è attivo (U5). La % numerica
// sulle barre resta sempre come ridondanza non cromatica.
const CB_HP   = { low: 0xff7a2a, mid: 0xffd23a, high: 0x3a9bff };
const CB_COMP = { zero: 0x552200, low: 0xff7a2a, mid: 0xffd23a, base: 0x3a9bff };
// Palette del Sovraccarico (Overdrive, A3): ambra→oro (gialli CB-safe per protan/deutan). La
// label testuale "PRONTO/ATTIVO" è ridondanza non cromatica, come la % sulle altre barre.
const OD_COLORS = { charge: 0xcc8a2a, ready: 0xffcc33, active: 0xfff0a0 };

// Componenti HUD: larghezza barra + sigle 3-lettere (chiavi i18n).
const COMP_BAR_W = 120;
const COMP_ABBR: Record<ComponentKey, string> = {
  engine: 'comp.engineAbbr', wheels: 'comp.wheelsAbbr', tank: 'comp.tankAbbr', turret: 'comp.turretAbbr',
};
// Colore di STATO della barra componente (band 0=KO · 1=basso · 2=medio · 3=sano): stesso schema
// verde→ambra→rosso della salute (con variante daltonico-safe CB_COMP). Unifica la lettura — il colore
// dice lo *stato*, non *quale* componente (quello lo portano icona + sigla). Vedi ART_BIBLE_INTERFACCE §4.2.
function compStateColor(band: number, cb: boolean): number {
  if (cb) return band === 0 ? CB_COMP.zero : band === 1 ? CB_COMP.low : band === 2 ? CB_COMP.mid : CB_COMP.base;
  return band === 0 ? 0x440000 : band === 1 ? UI.hpLow : band === 2 ? UI.hpMid : UI.hpHigh;
}
const hexStr = (n: number) => '#' + n.toString(16).padStart(6, '0');

export interface HudBuildOpts {
  missionNum: number;
  missionDist: number;
  components: Record<ComponentKey, ComponentData>;
  activeSurvivors: string[];
  /** M2: sopravvissuti affamati (abilità spenta → ritratto smorzato nel pannello-crew). */
  hungry: string[];
  /** M3: sopravvissuti feriti (abilità spenta → ritratto smorzato + anello rosso nel pannello-crew). */
  injured: string[];
  /** Stanchezza: sopravvissuti sfiniti (abilità spenta finché non riposano → anello azzurro nel pannello-crew). */
  tired: string[];
  /** M2 corazza passiva: riduzione danno % (badge statico, non più una barra componente). */
  armorReductionPct: number;
  ownedWeapons: WeaponType[];
  currentWeapon: WeaponType;
  debugGod: boolean;
  /** Callback per il cambio arma da click sul selettore HUD (U3). */
  onSelectWeapon: (key: WeaponType) => void;
  // Nastro-odometro di campagna "IL CONVOGLIO" (F3): progresso verso il rifugio.
  actName: string;       // nome atto già risolto (i18n)
  campaignKm: number;    // km percorsi all'inizio della tratta corrente
  campaignTotalKm: number; // km totali della campagna (META)
  // Morale del convoglio (F5): indicatore + soglia sotto cui le abilità si spengono.
  morale: number;
  moraleBreak: number;
}

export interface HudState {
  health: number; maxHealth: number;
  fuel: number; maxFuel: number;
  score: number; distance: number;
  attachedCount: number;
  combo: number; comboMult: number;
  overdrive: number; overdriveMax: number; overdriveActive: boolean;
  dashReadyAt: number; now: number;
  components: Record<ComponentKey, ComponentData>;
  /** Munizioni dell'arma equipaggiata (pivot horror). `ammoInfinite` = MG (∞), `ammo` = riserva delle altre. */
  ammo?: number; ammoInfinite?: boolean;
}

/**
 * HUD di gioco (estratto da GameScene per coesione/testabilità): pannello salute/carburante,
 * punteggio, percorso, combo, scatto, selettore armi, barre componenti, riga debug. È una "vista":
 * riceve lo stato (`build`/`update`) e aggiorna i display object — non conosce la logica di gioco.
 * Ottimizzazione: `setText` solo quando il valore mostrato cambia (vedi `cache`).
 */
export default class HudController {
  private scene: Phaser.Scene;
  private designW: number;
  private missionDist = 1;
  private onSelectWeapon: (key: WeaponType) => void = () => {};
  private currentWeaponKey: WeaponType = 'mg';

  private healthFill!: Phaser.GameObjects.Rectangle;
  private healthNum!: Phaser.GameObjects.Text;
  private fuelFill!: Phaser.GameObjects.Rectangle;
  private distFill!: Phaser.GameObjects.Rectangle;
  private scoreTxt!: Phaser.GameObjects.Text;
  private distTxt!: Phaser.GameObjects.Text;
  private fuelNum!: Phaser.GameObjects.Text;
  private attachedTxt!: Phaser.GameObjects.Text;
  private weaponTxt!: Phaser.GameObjects.Text;
  private weaponLabel = ''; // nome arma corrente (le munizioni si compongono per-frame in update)
  private comboTxt!: Phaser.GameObjects.Text;
  private dashTxt!: Phaser.GameObjects.Text;
  private overdriveFill!: Phaser.GameObjects.Rectangle;
  private overdriveTxt!: Phaser.GameObjects.Text;
  private debugTxt!: Phaser.GameObjects.Text;
  private weaponSlots: { key: WeaponType; txt: Phaser.GameObjects.Text }[] = [];
  // Celle componenti (icona + sigla + %): tracciate per il risalto a danno (alpha/colore in update()).
  private compCells: { key: ComponentKey; icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; abbr: string; pctShown: number; band: number }[] = [];
  private iconTip!: Phaser.GameObjects.Text; // tooltip in hover sulle icone HUD (teach-once: il nome resta consultabile)
  private cache = { score: -1, km: -1, fuel: -1, health: -1, attached: -1, combo: '', dash: '', overdrive: '', weapon: '' };
  // Tutti gli oggetti creati da build(): tracciati per poterli distruggere su un re-build
  // (es. cambio lingua a partita in pausa → l'HUD va ridisegnato nella nuova lingua).
  private objects: { destroy(): void }[] = [];

  constructor(scene: Phaser.Scene, designW: number) {
    this.scene = scene;
    this.designW = designW;
  }

  /** Registra un oggetto creato da build() così può essere distrutto al re-build. */
  private own<T extends { destroy(): void }>(o: T): T { this.objects.push(o); return o; }

  /**
   * Icona HUD procedurale (texture `icon_*`, vedi IconTextures) al posto di un'etichetta di testo.
   * `px` = dimensione di display in pixel di design (la texture è 16·OVERSAMPLE → scala di conseguenza).
   * Tooltip al passaggio del mouse: il nome (`labelKey`, i18n) resta consultabile → il giocatore impara
   * il simbolo (teach-once); col pad non c'è cursore, la legenda vive nel doc/onboarding. Vedi ART_BIBLE_ICONE.
   */
  private hudIcon(x: number, y: number, key: string, px: number, labelKey: string, depth: number) {
    const img = this.own(this.scene.add.image(x, y, key).setScale(px / (16 * OVERSAMPLE)).setDepth(depth));
    img.setInteractive({ useHandCursor: false });
    img.on('pointerover', () => this.iconTip.setText(t(labelKey)).setPosition(x, y + 11).setVisible(true));
    img.on('pointerout',  () => this.iconTip.setVisible(false));
    return img;
  }

  build(o: HudBuildOpts) {
    this.missionDist = o.missionDist;
    this.onSelectWeapon = o.onSelectWeapon;
    // Re-build (es. cambio lingua): distruggi l'HUD precedente prima di ridisegnarlo.
    for (const obj of this.objects) obj.destroy();
    this.objects = [];
    // I Text vengono (ri)creati a ogni build: azzera la cache così il primo update li popola.
    this.cache = { score: -1, km: -1, fuel: -1, health: -1, attached: -1, combo: '', dash: '', overdrive: '', weapon: '' };
    const s = this.scene, dW = this.designW;
    const D = 20, BAR_W = 110;
    // Blocco di destra ancorato a dW: in 4:3 (dW=800) coincide con i vecchi 620/700; in 16:9 si
    // sposta verso destra invece di addensarsi a sinistra (U1). Lo score/combo/percorso restano a sx.
    const rxMiss = dW - 180, rxAtt = dW - 100;
    const panel = this.own(s.add.graphics().setDepth(D));
    panel.fillStyle(UI.black, 0.62); panel.fillRoundedRect(0,0,dW,84,{ tl:0, tr:0, bl:16, br:16 });
    panel.lineStyle(1,UI.strokeDim,0.7); panel.lineBetween(0,46,dW,46);

    // Tooltip condiviso delle icone HUD (teach-once): nascosto finché il mouse non passa su un'icona.
    this.iconTip = this.own(Ui.text(s, 0, 0, '', {
      fontSize:'10px', color:UI.white, backgroundColor:'#000000d0', padding:{ x:5, y:2 },
    }).setOrigin(0.5, 0).setDepth(D+30).setVisible(false));

    // SALUTE — icona croce (sostituisce l'etichetta di testo; nome in hover). Vedi ART_BIBLE_ICONE.
    this.hudIcon(15, 13, 'icon_health', 14, 'hud.health', D+1);
    this.own(Ui.box(s, 8+BAR_W/2,34,BAR_W,10,{ fill:UI.barRed, radius:3 }).setDepth(D+1));
    this.healthFill = this.own(s.add.rectangle(8,34,BAR_W,10,UI.hpFill).setOrigin(0,0.5).setDepth(D+2));
    // % salute sovrapposta alla barra: ridondanza non cromatica (U5, accessibilità daltonismo).
    this.healthNum = this.own(Ui.text(s, 8+BAR_W/2, 34, '', {
      fontSize:'9px', color:UI.white, stroke:'#000000', strokeThickness:2,
    }).setOrigin(0.5).setDepth(D+3));

    this.hudIcon(145, 13, 'icon_fuel', 14, 'hud.fuel', D+1); // CARBURANTE — icona goccia
    this.own(Ui.box(s, 138+BAR_W/2,34,BAR_W,10,{ fill:UI.barAmber, radius:3 }).setDepth(D+1));
    this.fuelFill = this.own(s.add.rectangle(138,34,BAR_W,10,UI.fuelBar).setOrigin(0,0.5).setDepth(D+2));

    // Tacche di segmentazione sulle due barre principali (gauge "premium")
    const ticks = this.own(s.add.graphics().setDepth(D+3));
    ticks.fillStyle(UI.black, 0.45);
    for (let i = 1; i < 5; i++) { ticks.fillRect(8 + i*22, 30, 1, 8); ticks.fillRect(138 + i*22, 30, 1, 8); }
    this.fuelNum  = this.own(Ui.text(s, 255,28,'',{fontSize:'11px',color:UI.amberSoft}).setDepth(D+2));

    this.scoreTxt    = this.own(Ui.text(s, 290,6,t('hud.score',{n:0}),{fontSize:'13px',color:UI.white}).setDepth(D+1));
    this.own(Ui.text(s, rxMiss,6,t('hud.mission',{n:o.missionNum}),{fontSize:'12px',color:UI.greenSoft}).setDepth(D+1));
    this.attachedTxt = this.own(Ui.text(s, rxAtt,6,'',{fontSize:'11px',color:'#ff8800'}).setDepth(D+1));
    this.weaponTxt   = this.own(Ui.text(s, rxMiss,22,'',{fontSize:'10px',color:'#ffaa44'}).setDepth(D+1));
    this.comboTxt    = this.own(Ui.text(s, 470,6,'',{fontSize:'13px',fontStyle:'bold',color:UI.gold}).setDepth(D+1).setVisible(false));
    this.dashTxt     = this.own(Ui.text(s, dW-10,22,t('hud.dash'),{fontSize:'11px',fontStyle:'bold',color:UI.greenOk}).setOrigin(1,0).setDepth(D+1));
    // Selettore armi: una cifra-hotkey per ogni arma posseduta (selezionata in oro), cliccabile (U3).
    this.weaponSlots = [];
    let wsx = rxMiss;
    WEAPON_KEYS.forEach((wk, i) => {
      if (!o.ownedWeapons.includes(wk)) return;
      const t = this.own(Ui.text(s, wsx,34,`${i+1}`,{fontSize:'11px',fontStyle:'bold',color:UI.muted}).setDepth(D+1));
      // Area cliccabile più ampia della singola cifra (target comodo a mouse).
      t.setInteractive(new Phaser.Geom.Rectangle(-3, -1, 14, 16), Phaser.Geom.Rectangle.Contains);
      if (t.input) t.input.cursor = 'pointer';
      t.on('pointerover', () => t.setColor(UI.white));
      t.on('pointerout',  () => t.setColor(wk === this.currentWeaponKey ? UI.gold : UI.muted));
      t.on('pointerdown', () => this.onSelectWeapon(wk));
      this.weaponSlots.push({ key: wk, txt: t });
      wsx += 16;
    });
    this.refreshWeapon(o.currentWeapon); // nome arma + evidenziazione del selettore (eventi discreti, non per-frame)

    // Barra progresso missione
    const DIST_KM = Math.floor(o.missionDist / 100);
    const DIST_BAR_W = 110;
    this.hudIcon(295, 25, 'icon_route', 12, 'hud.route', D+1); // PERCORSO — icona bandiera
    this.distTxt = this.own(Ui.text(s, 395,24,'',{fontSize:'10px',color:UI.blueInfo}).setDepth(D+2));
    this.own(Ui.box(s, 290+DIST_BAR_W/2,37,DIST_BAR_W,7,{ fill:UI.barBlue, radius:2 }).setDepth(D+1));
    this.distFill = this.own(s.add.rectangle(290,37,DIST_BAR_W,7,UI.distBar).setOrigin(0,0.5).setDepth(D+2));
    // label meta (static)
    this.own(Ui.text(s, 408,33,t('hud.kmTarget',{n:DIST_KM}),{fontSize:'10px',color:UI.faint}).setDepth(D+1));

    // ── Equipaggio "IL CONVOGLIO" (presenza visibile) ──────────────────────────────
    // I sopravvissuti a bordo come RITRATTI sul bordo sinistro (riuso `survivor_<key>`), con stato
    // leggibile: anello verde=sano · ambra=affamato · rosso=ferito (abilità spenta = ritratto smorzato).
    // Il convoglio diventa qualcosa che VEDI, non tre iniziali in un angolo. Vedi docs/CAMPAGNA_CONVOGLIO.md.
    const crew = o.activeSurvivors;
    if (crew.length > 0) {
      const cwX = 18, cwGap = 30, cwY0 = H / 2 - (crew.length - 1) * cwGap / 2;
      crew.forEach((key, i) => {
        const cy = cwY0 + i * cwGap;
        const injured = o.injured.includes(key), hungry = o.hungry.includes(key), tired = o.tired.includes(key);
        const ring = injured ? 0xff5555 : hungry ? 0xffaa44 : tired ? 0x88aacc : 0x44cc66; // rosso ferito · ambra affamato · azzurro sfinito · verde sano
        this.own(Ui.box(s, cwX, cy, 26, 26, { fill: UI.black, fillAlpha: 0.5, radius: 6, stroke: ring, strokeAlpha: 0.95 }).setDepth(D));
        const img = this.own(s.add.image(cwX, cy, `survivor_${key}`).setDepth(D + 1));
        if (img.height > 0) img.setScale(22 / img.height);
        if (injured || hungry || tired) img.setAlpha(0.5); // abilità spenta → ritratto smorzato
        this.own(s.add.circle(cwX + 10, cy - 10, 3.5, ring).setDepth(D + 2));
      });
    }

    // Componenti (4): icona + SIGLA 3-lettere + % e barra a schema colore UNIFICATO (verde→ambra→rosso,
    // come salute). La sigla disambigua l'icona — il teach-once in hover non scatta in azione (mouse
    // impegnato a mirare). Le celle sane sono SMORZATE; una cella ferita torna a piena opacità + vira
    // ambra/rosso → il danno "salta all'occhio". Vedi ART_BIBLE_INTERFACCE §4.2 e ART_BIBLE_ICONE.
    const compKeys: ComponentKey[] = ['engine','wheels','tank','turret']; // M2: 5→4 barre (no 'armor')
    this.compCells = [];
    compKeys.forEach((key,i) => {
      const comp = o.components[key];
      const sx = 10 + i * 158;
      const icon = this.hudIcon(sx + 7, 54, `icon_${key}`, 13, comp.label, D+1); // nome completo in hover
      const abbr = t(COMP_ABBR[key]);
      const label = this.own(Ui.text(s, sx + 18, 54, abbr, { fontSize:'9px', color:UI.muted })
        .setOrigin(0,0.5).setDepth(D+1));
      this.own(Ui.box(s, sx+COMP_BAR_W/2,72,COMP_BAR_W,8,{ fill:UI.barGrey, radius:2 }).setDepth(D+1));
      const fill = this.own(s.add.rectangle(sx,72,COMP_BAR_W,8,UI.hpHigh).setOrigin(0,0.5).setDepth(D+2));
      comp.fill = fill;
      this.compCells.push({ key, icon, label, abbr, pctShown: -1, band: -1 });
    });
    // M2: armatura PASSIVA → badge statico (non degrada) nello slot liberato dalla 5ª barra.
    const ax = 10 + 4 * 158;
    this.own(Ui.text(s, ax,49,t('comp.armor'),{fontSize:'10px',color:UI.muted}).setDepth(D+1));
    this.own(Ui.text(s, ax,64,t('hud.armorStat',{ p:o.armorReductionPct }),{fontSize:'13px',color:UI.blueInfo,fontStyle:'bold'}).setDepth(D+1));

    // Barra Sovraccarico (Overdrive, A3): gauge nella banda alta a sinistra, sotto il pannello HUD.
    const OD_X = 10, OD_Y = 98, OD_W = 120;
    this.own(Ui.text(s, OD_X, OD_Y - 13, t('hud.overdrive'), { fontSize:'10px', color:UI.amberSoft }).setDepth(D+1));
    this.own(Ui.box(s, OD_X + OD_W/2, OD_Y, OD_W, 9, { fill:UI.barGrey, radius:3 }).setDepth(D+1));
    this.overdriveFill = this.own(s.add.rectangle(OD_X, OD_Y, OD_W, 9, OD_COLORS.charge).setOrigin(0,0.5).setDepth(D+2));
    this.overdriveTxt  = this.own(Ui.text(s, OD_X + OD_W + 6, OD_Y, '', { fontSize:'10px', fontStyle:'bold', color:UI.gold }).setOrigin(0,0.5).setDepth(D+2));

    // Nastro-odometro di campagna "IL CONVOGLIO" (F3): barra 0→totale km, con le tacche dei 6 atti,
    // specchio della barra Sovraccarico ma a destra. Statico nella missione (progresso costante).
    const ODO_W = 140, ODO_X = dW - ODO_W - 10, ODO_Y = OD_Y;
    this.own(Ui.text(s, ODO_X + ODO_W, ODO_Y - 13, t('hud.odometer', { act: o.actName, km: o.campaignKm, total: o.campaignTotalKm }),
      { fontSize:'10px', color:UI.greenSoft }).setOrigin(1, 0.5).setDepth(D+1));
    this.own(Ui.box(s, ODO_X + ODO_W/2, ODO_Y, ODO_W, 8, { fill:UI.barGrey, radius:3 }).setDepth(D+1));
    const odoPct = o.campaignTotalKm > 0 ? Math.min(1, o.campaignKm / o.campaignTotalKm) : 0;
    this.own(s.add.rectangle(ODO_X, ODO_Y, Math.max(1, ODO_W * odoPct), 8, UI.distBar).setOrigin(0,0.5).setDepth(D+2));
    const odoTicks = this.own(s.add.graphics().setDepth(D+3));
    odoTicks.fillStyle(UI.black, 0.5);
    for (let i = 1; i < 6; i++) odoTicks.fillRect(ODO_X + Math.round(ODO_W * i / 6), ODO_Y - 4, 1, 8);

    // Morale del convoglio (F5): indicatore al centro della banda alta; vira rosso sotto la soglia di crollo.
    this.own(Ui.text(s, dW / 2, ODO_Y, t('hud.morale', { n: Math.round(o.morale) }), {
      fontSize:'11px', fontStyle:'bold', color: o.morale < o.moraleBreak ? UI.redSoft : UI.greenSoft,
    }).setOrigin(0.5).setDepth(D+1));

    // Hint comandi: leggibile (U11). Prima era UI.disabled (#333) su pannello quasi nero → illeggibile.
    this.own(Ui.text(s, dW/2,H-6,t('hud.controls'),{fontSize:'11px',color:UI.faint}).setOrigin(0.5,1).setDepth(D));
    this.own(Ui.text(s, 4,H-6,t('hud.debugHint'),{fontSize:'9px',color:'#2a3a2a'}).setOrigin(0,1).setDepth(D));
    this.debugTxt = this.own(Ui.text(s, dW-6,H-6, o.debugGod ? t('hud.godMode') : '', {fontSize:'10px',color:'#00ff88',fontStyle:'bold'}).setOrigin(1,1).setDepth(D+5));
  }

  update(o: HudState) {
    const cb = Settings.colorblind;
    // Barre: economiche (displayWidth/setFillStyle), restano per-frame.
    const hpPct = o.health / o.maxHealth;
    this.healthFill.displayWidth = Math.max(0, hpPct * 110);
    this.healthFill.setFillStyle(hpPct < 0.3 ? (cb?CB_HP.low:UI.hpLow) : hpPct < 0.6 ? (cb?CB_HP.mid:UI.hpMid) : (cb?CB_HP.high:UI.hpHigh));
    this.fuelFill.displayWidth = Math.max(0, (o.fuel / o.maxFuel) * 110);
    const distPct = Math.min(1, o.distance / this.missionDist);
    this.distFill.displayWidth = Math.max(1, distPct * 110);
    // In daltonismo evita il verde a fine percorso (rosso↔verde): usa giallo CB-safe (REG6).
    this.distFill.setFillStyle(distPct > 0.8 ? (cb ? 0xffd23a : 0x88ff44) : distPct > 0.5 ? 0x44aaff : 0x4466cc);

    // Testi: setText solo quando il valore mostrato cambia (vedi cache).
    const hp = Math.round(hpPct * 100);
    if (hp !== this.cache.health)        { this.healthNum.setText(`${hp}%`);                  this.cache.health = hp; }
    const fuel = Math.round(o.fuel);
    if (fuel !== this.cache.fuel)        { this.fuelNum.setText(`${fuel}%`);                  this.cache.fuel  = fuel; }
    if (o.score !== this.cache.score)    { this.scoreTxt.setText(t('hud.score',{n:o.score})); this.cache.score = o.score; }
    const km = distanceKm(o.distance);
    if (km !== this.cache.km)            { this.distTxt.setText(t('hud.km',{n:km}));          this.cache.km    = km; }
    if (o.attachedCount !== this.cache.attached) { this.attachedTxt.setText(o.attachedCount > 0 ? t('hud.attached',{n:o.attachedCount}) : ''); this.cache.attached = o.attachedCount; }

    // Arma + munizioni (pivot horror): "NOME · 24" oppure "NOME · ∞" per la MG. Rosso quando a secco.
    const ammoStr = o.ammoInfinite ? '∞' : `${o.ammo ?? 0}`;
    const wlabel = `${this.weaponLabel} · ${ammoStr}`;
    if (wlabel !== this.cache.weapon) {
      this.weaponTxt.setText(wlabel);
      this.weaponTxt.setColor(!o.ammoInfinite && (o.ammo ?? 0) <= 0 ? UI.red : '#ffaa44');
      this.cache.weapon = wlabel;
    }

    // Combo
    if (o.combo >= 2) {
      const m = o.comboMult;
      // Mostra "×M" solo quando moltiplica davvero (>1): a combo basse il moltiplicatore è 1 e un
      // "×1" sembrava un bug (G3).
      const txt = m > 1 ? t('hud.comboMult',{n:o.combo,m}) : t('hud.combo',{n:o.combo});
      if (txt !== this.cache.combo) {
        this.comboTxt.setText(txt);
        this.comboTxt.setColor(COMBO_COLORS[m - 1] ?? UI.white);
        this.cache.combo = txt;
      }
      this.comboTxt.setVisible(true);
    } else {
      if (this.cache.combo !== '') this.cache.combo = '';
      this.comboTxt.setVisible(false);
    }

    // Scatto (cooldown)
    const dashRemain = o.dashReadyAt - o.now;
    const dashStr = dashRemain <= 0 ? t('hud.dash') : t('hud.dashCooldown',{n:Math.ceil(dashRemain / 1000)});
    if (dashStr !== this.cache.dash) {
      this.dashTxt.setText(dashStr);
      this.dashTxt.setColor(dashRemain <= 0 ? UI.greenOk : UI.faint);
      this.cache.dash = dashStr;
    }

    // Sovraccarico (A3): riempimento + stato (carica → pronto → attivo).
    const odPct = Phaser.Math.Clamp(o.overdrive / o.overdriveMax, 0, 1);
    this.overdriveFill.displayWidth = Math.max(0, odPct * 120);
    const odReady = odPct >= 1;
    this.overdriveFill.setFillStyle(o.overdriveActive ? OD_COLORS.active : odReady ? OD_COLORS.ready : OD_COLORS.charge);
    const odStr = o.overdriveActive ? t('hud.overdriveActive') : odReady ? t('hud.overdriveReady') : '';
    if (odStr !== this.cache.overdrive) { this.overdriveTxt.setText(odStr); this.cache.overdrive = odStr; }

    // Componenti: barra a schema di stato unificato + risalto a danno (le celle sane sono smorzate).
    for (const cell of this.compCells) {
      const comp = o.components[cell.key];
      if (!comp.fill) continue;
      const pct = comp.health / 100;
      comp.fill.displayWidth = Math.max(0, pct * COMP_BAR_W);
      const band = pct <= 0 ? 0 : pct < 0.3 ? 1 : pct < 0.6 ? 2 : 3;
      const col = compStateColor(band, cb);
      comp.fill.setFillStyle(col);
      const healthy = band === 3;
      // Sano = leggermente smorzato ma SEMPRE leggibile (la barra resta visibile anche nell'angolo
      // basso-sx sotto la vignetta); ferito = piena opacità + colore caldo → il danno salta all'occhio.
      // Il segnale forte di danno è il COLORE, non l'invisibilità del sano.
      comp.fill.setAlpha(healthy ? 0.85 : 1);
      cell.icon.setAlpha(healthy ? 0.6 : 1);
      cell.label.setAlpha(healthy ? 0.75 : 1);
      if (band !== cell.band) { cell.label.setColor(hexStr(col)); cell.band = band; } // setColor solo al cambio banda
      const shown = Math.round(pct * 100);
      if (shown !== cell.pctShown) { cell.label.setText(`${cell.abbr} ${shown}%`); cell.pctShown = shown; } // setText solo al cambio %
    }
  }

  /** Cambio arma: aggiorna nome + selettore e dà un "pop" cosmetico al nome. */
  setWeapon(currentWeapon: WeaponType) {
    this.refreshWeapon(currentWeapon);
    this.scene.tweens.killTweensOf(this.weaponTxt);
    this.weaponTxt.setScale(1.3);
    this.scene.tweens.add({ targets: this.weaponTxt, scale: 1, duration: 160 });
  }

  private refreshWeapon(currentWeapon: WeaponType) {
    this.currentWeaponKey = currentWeapon;
    this.weaponLabel = t(WEAPONS[currentWeapon].name).toUpperCase();
    this.weaponTxt.setText(this.weaponLabel); // le munizioni si aggiungono al prossimo update()
    this.cache.weapon = '';                   // forza il ricomposto nome+munizioni
    for (const slot of this.weaponSlots) {
      slot.txt.setColor(slot.key === currentWeapon ? UI.gold : UI.muted);
    }
  }

  /** "Pop" del contatore combo a ogni uccisione in catena (chiamato quando combo ≥ 2). */
  popCombo() {
    this.scene.tweens.killTweensOf(this.comboTxt);
    this.comboTxt.setScale(1.35);
    this.scene.tweens.add({ targets: this.comboTxt, scale: 1, duration: 180 });
  }

  setDebug(on: boolean) {
    this.debugTxt.setText(on ? t('hud.godMode') : '');
  }

  /** Feedback al colpo: lampo bianco sulla barra salute + breve "thump" verticale. */
  flashHealthBar() {
    const f = this.scene.add.rectangle(63, 34, 116, 14, 0xffffff, 0.55).setDepth(24);
    this.scene.tweens.add({ targets: f, alpha: 0, duration: 160, onComplete: () => f.destroy() });
    this.scene.tweens.add({ targets: this.healthFill, scaleY: 1.9, duration: 80, yoyo: true });
  }
}
