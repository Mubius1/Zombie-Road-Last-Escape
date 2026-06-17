import Phaser from 'phaser';
import Ui, { UI } from './Ui';
import { WEAPONS, WEAPON_KEYS, WeaponType } from './GameData';
import type { ComponentKey, ComponentData } from './scenes/GameScene';

const H = 600;
// Colore del moltiplicatore combo per livello (×1..×5) — toni funzionali UI.
const COMBO_COLORS = [UI.muted, UI.gold, UI.amber, UI.redText, UI.red];
// Riga HUD della modalità debug (G).
const GOD_HUD = '◆ GOD MODE  (G off · B boss · N fine · H ripara)';

export interface HudBuildOpts {
  missionNum: number;
  missionDist: number;
  components: Record<ComponentKey, ComponentData>;
  activeSurvivors: string[];
  ownedWeapons: WeaponType[];
  currentWeapon: WeaponType;
  debugGod: boolean;
}

export interface HudState {
  health: number; maxHealth: number;
  fuel: number; maxFuel: number;
  score: number; distance: number;
  attachedCount: number;
  combo: number; comboMult: number;
  dashReadyAt: number; now: number;
  components: Record<ComponentKey, ComponentData>;
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

  private healthFill!: Phaser.GameObjects.Rectangle;
  private fuelFill!: Phaser.GameObjects.Rectangle;
  private distFill!: Phaser.GameObjects.Rectangle;
  private scoreTxt!: Phaser.GameObjects.Text;
  private distTxt!: Phaser.GameObjects.Text;
  private fuelNum!: Phaser.GameObjects.Text;
  private attachedTxt!: Phaser.GameObjects.Text;
  private weaponTxt!: Phaser.GameObjects.Text;
  private comboTxt!: Phaser.GameObjects.Text;
  private dashTxt!: Phaser.GameObjects.Text;
  private debugTxt!: Phaser.GameObjects.Text;
  private weaponSlots: { key: WeaponType; txt: Phaser.GameObjects.Text }[] = [];
  private cache = { score: -1, km: -1, fuel: -1, attached: -1, combo: '', dash: '' };

  constructor(scene: Phaser.Scene, designW: number) {
    this.scene = scene;
    this.designW = designW;
  }

  build(o: HudBuildOpts) {
    this.missionDist = o.missionDist;
    // I Text vengono (ri)creati a ogni build: azzera la cache così il primo update li popola.
    this.cache = { score: -1, km: -1, fuel: -1, attached: -1, combo: '', dash: '' };
    const s = this.scene, dW = this.designW;
    const D = 20, BAR_W = 110, COMP_BAR_W = 120;
    const panel = s.add.graphics().setDepth(D);
    panel.fillStyle(UI.black, 0.62); panel.fillRoundedRect(0,0,dW,84,{ tl:0, tr:0, bl:16, br:16 });
    panel.lineStyle(1,UI.strokeDim,0.7); panel.lineBetween(0,46,dW,46);

    Ui.text(s, 8,8,'SALUTE',{fontSize:'11px',color:UI.redText}).setDepth(D+1);
    Ui.box(s, 8+BAR_W/2,34,BAR_W,10,{ fill:UI.barRed, radius:3 }).setDepth(D+1);
    this.healthFill = s.add.rectangle(8,34,BAR_W,10,UI.hpFill).setOrigin(0,0.5).setDepth(D+2);

    Ui.text(s, 138,8,'CARBURANTE',{fontSize:'11px',color:UI.amberSoft}).setDepth(D+1);
    Ui.box(s, 138+BAR_W/2,34,BAR_W,10,{ fill:UI.barAmber, radius:3 }).setDepth(D+1);
    this.fuelFill = s.add.rectangle(138,34,BAR_W,10,UI.fuelBar).setOrigin(0,0.5).setDepth(D+2);

    // Tacche di segmentazione sulle due barre principali (gauge "premium")
    const ticks = s.add.graphics().setDepth(D+3);
    ticks.fillStyle(UI.black, 0.45);
    for (let i = 1; i < 5; i++) { ticks.fillRect(8 + i*22, 30, 1, 8); ticks.fillRect(138 + i*22, 30, 1, 8); }
    this.fuelNum  = Ui.text(s, 255,28,'',{fontSize:'11px',color:UI.amberSoft}).setDepth(D+2);

    this.scoreTxt    = Ui.text(s, 290,6,'PUNTEGGIO: 0',{fontSize:'13px',color:UI.white}).setDepth(D+1);
    Ui.text(s, 620,6,`MISS.${o.missionNum}`,{fontSize:'12px',color:UI.greenSoft}).setDepth(D+1);
    this.attachedTxt = Ui.text(s, 700,6,'',{fontSize:'11px',color:'#ff8800'}).setDepth(D+1);
    this.weaponTxt   = Ui.text(s, 620,22,'',{fontSize:'10px',color:'#ffaa44'}).setDepth(D+1);
    this.comboTxt    = Ui.text(s, 470,6,'',{fontSize:'13px',fontStyle:'bold',color:UI.gold}).setDepth(D+1).setVisible(false);
    this.dashTxt     = Ui.text(s, dW-10,22,'↯ SCATTO',{fontSize:'11px',fontStyle:'bold',color:UI.greenOk}).setOrigin(1,0).setDepth(D+1);
    // Selettore armi: una cifra-hotkey per ogni arma posseduta (la selezionata in oro)
    this.weaponSlots = [];
    let wsx = 620;
    WEAPON_KEYS.forEach((wk, i) => {
      if (!o.ownedWeapons.includes(wk)) return;
      const t = Ui.text(s, wsx,34,`${i+1}`,{fontSize:'11px',fontStyle:'bold',color:UI.muted}).setDepth(D+1);
      this.weaponSlots.push({ key: wk, txt: t });
      wsx += 16;
    });
    this.refreshWeapon(o.currentWeapon); // nome arma + evidenziazione del selettore (eventi discreti, non per-frame)

    // Barra progresso missione
    const DIST_KM = Math.floor(o.missionDist / 100);
    const DIST_BAR_W = 110;
    Ui.text(s, 290,24,'PERCORSO',{fontSize:'10px',color:'#7777aa'}).setDepth(D+1);
    this.distTxt = Ui.text(s, 395,24,'',{fontSize:'10px',color:UI.blueInfo}).setDepth(D+2);
    Ui.box(s, 290+DIST_BAR_W/2,37,DIST_BAR_W,7,{ fill:UI.barBlue, radius:2 }).setDepth(D+1);
    this.distFill = s.add.rectangle(290,37,DIST_BAR_W,7,UI.distBar).setOrigin(0,0.5).setDepth(D+2);
    // label meta (static)
    Ui.text(s, 408,33,`/ ${DIST_KM} km`,{fontSize:'9px',color:UI.faint}).setDepth(D+1);

    // Survivors icons
    if (o.activeSurvivors.length > 0) {
      const names: Record<string,string> = { mechanic:'[M]', medic:'[+]', soldier:'[S]', explorer:'[E]' };
      const txt = o.activeSurvivors.map(s2 => names[s2]??s2).join(' ');
      Ui.text(s, dW-10,8,txt,{fontSize:'11px',color:'#cccc44'}).setOrigin(1,0).setDepth(D+1);
    }

    const compKeys: ComponentKey[] = ['engine','wheels','tank','turret','armor'];
    compKeys.forEach((key,i) => {
      const comp = o.components[key];
      const sx = 10 + i * 158;
      Ui.text(s, sx,49,comp.label,{fontSize:'10px',color:UI.muted}).setDepth(D+1);
      Ui.box(s, sx+COMP_BAR_W/2,72,COMP_BAR_W,7,{ fill:UI.barGrey, radius:2 }).setDepth(D+1);
      const fill = s.add.rectangle(sx,72,COMP_BAR_W,7,comp.baseColor).setOrigin(0,0.5).setDepth(D+2);
      comp.fill = fill;
    });

    Ui.text(s, dW/2,H-6,'↑↓ Muovi · SPAZIO Spara · 1-5/Q Arma · SHIFT Scatto',{fontSize:'11px',color:UI.disabled}).setOrigin(0.5,1).setDepth(D);
    Ui.text(s, 4,H-6,'0=Debug',{fontSize:'9px',color:'#2a3a2a'}).setOrigin(0,1).setDepth(D);
    this.debugTxt = Ui.text(s, dW-6,H-6, o.debugGod ? GOD_HUD : '', {fontSize:'10px',color:'#00ff88',fontStyle:'bold'}).setOrigin(1,1).setDepth(D+5);
  }

  update(o: HudState) {
    // Barre: economiche (displayWidth/setFillStyle), restano per-frame.
    const hpPct = o.health / o.maxHealth;
    this.healthFill.displayWidth = Math.max(0, hpPct * 110);
    this.healthFill.setFillStyle(hpPct < 0.3 ? UI.hpLow : hpPct < 0.6 ? UI.hpMid : UI.hpHigh);
    this.fuelFill.displayWidth = Math.max(0, (o.fuel / o.maxFuel) * 110);
    const distPct = Math.min(1, o.distance / this.missionDist);
    this.distFill.displayWidth = Math.max(1, distPct * 110);
    this.distFill.setFillStyle(distPct > 0.8 ? 0x88ff44 : distPct > 0.5 ? 0x44aaff : 0x4466cc);

    // Testi: setText solo quando il valore mostrato cambia (vedi cache).
    const fuel = Math.round(o.fuel);
    if (fuel !== this.cache.fuel)        { this.fuelNum.setText(`${fuel}%`);                  this.cache.fuel  = fuel; }
    if (o.score !== this.cache.score)    { this.scoreTxt.setText(`PUNTEGGIO: ${o.score}`);    this.cache.score = o.score; }
    const km = Math.floor(o.distance / 100);
    if (km !== this.cache.km)            { this.distTxt.setText(`${km} km`);                  this.cache.km    = km; }
    if (o.attachedCount !== this.cache.attached) { this.attachedTxt.setText(o.attachedCount > 0 ? `[${o.attachedCount} aggrappati]` : ''); this.cache.attached = o.attachedCount; }

    // Combo
    if (o.combo >= 2) {
      const m = o.comboMult;
      const txt = `COMBO ${o.combo}  ×${m}`;
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
    const dashStr = dashRemain <= 0 ? '↯ SCATTO' : `↯ ${Math.ceil(dashRemain / 1000)}s`;
    if (dashStr !== this.cache.dash) {
      this.dashTxt.setText(dashStr);
      this.dashTxt.setColor(dashRemain <= 0 ? UI.greenOk : UI.faint);
      this.cache.dash = dashStr;
    }

    for (const key of Object.keys(o.components) as ComponentKey[]) {
      const comp = o.components[key];
      if (!comp.fill) continue;
      const pct = comp.health / 100;
      comp.fill.displayWidth = Math.max(0, pct * 120);
      comp.fill.setFillStyle(pct<=0 ? 0x440000 : pct<0.3 ? 0xff2222 : pct<0.6 ? 0xffcc00 : comp.baseColor);
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
    this.weaponTxt.setText(WEAPONS[currentWeapon].name.toUpperCase());
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
    this.debugTxt.setText(on ? GOD_HUD : '');
  }

  /** Feedback al colpo: lampo bianco sulla barra salute + breve "thump" verticale. */
  flashHealthBar() {
    const f = this.scene.add.rectangle(63, 34, 116, 14, 0xffffff, 0.55).setDepth(24);
    this.scene.tweens.add({ targets: f, alpha: 0, duration: 160, onComplete: () => f.destroy() });
    this.scene.tweens.add({ targets: this.healthFill, scaleY: 1.9, duration: 80, yoyo: true });
  }
}
