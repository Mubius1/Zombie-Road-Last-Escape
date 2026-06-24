import Phaser from 'phaser';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';
import { getRun, setRun, snapshotRun } from '../RunState';
import { locationForMission, accentCss, STOP_LOCATIONS, StopLocation } from '../Locations';
import { renderHub, buildHubTextures, buildHubCar, dropShadow, HUB_WALK, CAR_GY, CAR_FH } from '../HubEnvironment';
import { buildEntityTextures } from '../EntityTextures';
import Shadows from '../Shadows';
import SaveData from '../SaveData';
import { SHOP_ITEMS } from './ShopScene';
import Juice from '../Juice';
import Ui, { UI } from '../Ui';
import Settings from '../Settings';
import { t } from '../i18n';

const KC = Phaser.Input.Keyboard.KeyCodes;
const PAD_DEADZONE = 0.28;
const WALK_SPEED = 150;          // px/s (spazio di design)
const INTERACT_RADIUS = 80;      // distanza per attivare una stazione

interface Station { x: number; y: number; kind: 'service' | 'depart' | 'refuel'; label: string }

/**
 * Soste diegetiche (docs/SOSTE_DIEGETICHE.md) — l'hub a piedi che sostituisce il menu come destinazione
 * di fine missione. Si arriva qui ( GameScene → StopScene ), si CAMMINA col personaggio-autista fino a una
 * stazione e la si attiva: la stazione-SERVIZI apre il negozio (`ShopScene`, che filtra i pannelli per
 * luogo, Track B3); la stazione-RIPARTI (il veicolo) avvia la `RouteScene`. Modalità GALLERIA per il debug.
 */
export default class StopScene extends Phaser.Scene {
  private designW = DESIGN_W;
  private location!: StopLocation;
  private player!: Phaser.GameObjects.Image;
  private stations: Station[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private nearStation: Station | null = null;
  private busy = false;            // true durante una transizione (evita doppi trigger)
  private usingPad = false;

  // Modalità galleria (solo debug): mostra/ispeziona ogni luogo senza giocare.
  private gallery = false;
  private galleryIndex = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wKey!: Phaser.Input.Keyboard.Key;
  private aKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private dKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private numKeys: Phaser.Input.Keyboard.Key[] = [];
  private grain: Phaser.GameObjects.TileSprite | null = null;

  // Luce-firma del luogo (per il flicker) + ombre dinamiche del personaggio.
  private hubGlow: Phaser.GameObjects.Image | null = null;
  private glowScale = 1; private glowAlpha = 1; private glowWarm = false;
  private shadows: Shadows | null = null;
  private colliders: Array<{ x: number; y: number; r: number }> = []; // ostacoli solidi (no walk-through)

  constructor() { super({ key: 'StopScene' }); }

  create() {
    this.designW = setupCamera(this).designW;
    this.busy = false;
    this.nearStation = null;

    this.gallery = this.registry.get('hubGallery') === true;
    if (this.gallery) {
      this.galleryIndex = (this.registry.get('hubGalleryIndex') as number | undefined) ?? 0;
      this.location = STOP_LOCATIONS[this.galleryIndex] ?? STOP_LOCATIONS[0]!;
    } else {
      this.location = locationForMission(getRun(this.registry, 'missionNumber') ?? 2);
    }

    // Texture (guardia `exists` interna a ciascun builder).
    Juice.buildTextures(this);          // fx_light (luce-firma)
    buildEntityTextures(this);          // particle (atmosfera)
    buildHubTextures(this);             // personaggio-autista + auto laterale dell'hub

    const layout = renderHub(this, this.location, this.designW);
    this.hubGlow = layout.glow; this.glowScale = layout.glowScale; this.glowAlpha = layout.glowAlpha; this.glowWarm = layout.warm;

    // Veicolo parcheggiato (VISTA LATERALE, PER-VEICOLO: colore + silhouette): ombra + pozza tenue.
    const vx = 150, vy = 432;
    const veh = getRun(this.registry, 'vehicle') ?? 'civilian_car';
    dropShadow(this, layout.light, vx, vy + 14, 120, vy);
    this.add.image(vx, vy, buildHubCar(this, veh)).setOrigin(0.5, CAR_GY / CAR_FH).setScale(1 / OVERSAMPLE).setDepth(vy);
    this.add.image(vx, vy + 4, 'fx_light').setTint(0x8a98a8).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(2.6, 1.6).setAlpha(0.22).setDepth(3); // pozza tenue sul mezzo

    this.stations = [
      { x: layout.service.x, y: layout.service.y, kind: 'service', label: t(this.location.stationKey) },
      { x: vx, y: vy + 30,   kind: 'depart',  label: t('hub.depart') },
    ];
    if (layout.pump) this.stations.push({ x: layout.pump.x, y: layout.pump.y, kind: 'refuel', label: t('hub.refuel') }); // pompa diegetica
    for (const s of this.stations) this.drawStationMarker(s);

    // Collisione: ostacoli del renderer (stazione/prop/NPC) + il veicolo. Il personaggio non li attraversa.
    this.colliders = layout.colliders.concat([{ x: vx, y: vy, r: 34 }]);

    // Personaggio-autista (avatar): parte accanto al mezzo ma FUORI dal raggio "Riparti".
    this.player = this.add.image(vx + 110, vy + 44, 'hub_driver').setScale(1 / OVERSAMPLE);
    this.shadows = new Shadows(this, this.designW, 600); // ombra di contatto dinamica del personaggio

    this.buildOverlays();
    this.bindInput();

    if (Settings.vignetteFx) this.grain = Juice.addOverlay(this, 950, 0.85);

    Juice.fadeIn(this);
  }

  // ─── Overlay (card del luogo, hint, barra galleria) ──────────────────────────

  private buildOverlays() {
    const accent = accentCss(this.location.accent);
    Ui.text(this, this.designW / 2, 14, t(this.location.nameKey), {
      fontSize: '22px', color: accent, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);
    Ui.text(this, this.designW / 2, 40, t(this.location.flavorKey), {
      fontSize: '11px', color: UI.faint, fontStyle: 'italic',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);

    this.prompt = Ui.text(this, 0, 0, '', {
      fontSize: '13px', color: UI.white, fontStyle: 'bold',
      backgroundColor: '#000000cc', padding: { x: 7, y: 3 },
    }).setOrigin(0.5, 1).setDepth(1001).setVisible(false);

    if (this.gallery) {
      Ui.text(this, this.designW / 2, 574, t('hub.galleryBar', {
        i: this.galleryIndex + 1, n: STOP_LOCATIONS.length, name: t(this.location.nameKey),
      }), { fontSize: '12px', color: UI.cyanDebug, fontStyle: 'bold' })
        .setOrigin(0.5, 1).setScrollFactor(0).setDepth(1000);
    } else {
      Ui.text(this, this.designW / 2, 576, t('hub.hint'), { fontSize: '11px', color: UI.ghost })
        .setOrigin(0.5, 1).setScrollFactor(0).setDepth(1000);
    }
  }

  /** Anello-marker discreto a terra sotto una stazione (aiuta a leggere "qui si interagisce"). */
  private drawStationMarker(s: Station) {
    const ring = this.add.graphics().setDepth(7);
    ring.lineStyle(2, this.location.accent, 0.35);
    ring.strokeEllipse(s.x, s.y, 54, 20);
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  private bindInput() {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wKey = kb.addKey(KC.W); this.aKey = kb.addKey(KC.A);
    this.sKey = kb.addKey(KC.S); this.dKey = kb.addKey(KC.D);
    this.eKey = kb.addKey(KC.E); this.escKey = kb.addKey(KC.ESC);
    this.numKeys = [KC.ONE, KC.TWO, KC.THREE, KC.FOUR, KC.FIVE].map(k => kb.addKey(k));

    kb.on('keydown', () => { this.usingPad = false; });
    this.input.on('pointermove', () => { this.usingPad = false; });
    this.input.gamepad?.on('down', (_p: Phaser.Input.Gamepad.Gamepad, btn: Phaser.Input.Gamepad.Button) => {
      this.usingPad = true;
      if (btn.index === 0) this.tryInteract();   // A = interagisci
      if (btn.index === 1 && this.gallery) this.exitGallery(); // B = esci dalla galleria
    });
  }

  private activePad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const p = this.input.gamepad?.getPad(0);
    return p?.connected ? p : undefined;
  }

  // ─── Loop ────────────────────────────────────────────────────────────────────

  override update(time: number, deltaMs: number) {
    Juice.jitterGrain(this.grain);
    if (this.glowWarm && this.hubGlow) { // flicker a rumore della sorgente calda (fuoco/neon): somma di seni incommensurabili
      const s = time / 1000;
      const f = 0.82 + 0.10 * Math.sin(s * 11.3) + 0.06 * Math.sin(s * 23.7) + 0.04 * Math.sin(s * 37.1);
      this.hubGlow.setScale(this.glowScale * f).setAlpha(this.glowAlpha * f);
    }
    if (this.busy) return;

    if (this.gallery) {
      if (Phaser.Input.Keyboard.JustDown(this.escKey)) { this.exitGallery(); return; }
      for (let i = 0; i < this.numKeys.length; i++) {
        if (Phaser.Input.Keyboard.JustDown(this.numKeys[i]!)) { this.switchGallery(i); return; }
      }
    }

    this.movePlayer(deltaMs / 1000);
    this.updateProximity();
    this.shadows?.update([this.player] as unknown as Phaser.GameObjects.Sprite[]); // ombra di contatto dinamica

    if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.tryInteract();
  }

  private movePlayer(dt: number) {
    let vx = 0, vy = 0;
    if (this.cursors.left?.isDown  || this.aKey.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.dKey.isDown) vx += 1;
    if (this.cursors.up?.isDown    || this.wKey.isDown) vy -= 1;
    if (this.cursors.down?.isDown  || this.sKey.isDown) vy += 1;
    const ls = this.activePad()?.leftStick;
    if (ls && ls.length() > PAD_DEADZONE) { vx += ls.x; vy += ls.y; this.usingPad = true; }

    const len = Math.hypot(vx, vy);
    if (len > 0.001) {
      vx /= len; vy /= len;
      const nx = Phaser.Math.Clamp(this.player.x + vx * WALK_SPEED * dt, HUB_WALK.minX, this.designW - HUB_WALK.minX);
      const ny = Phaser.Math.Clamp(this.player.y + vy * WALK_SPEED * dt, HUB_WALK.minY, HUB_WALK.maxY);
      const p = this.resolveCollisions(nx, ny);
      this.player.setPosition(p.x, p.y);
      if (vx < -0.01) this.player.setFlipX(true); else if (vx > 0.01) this.player.setFlipX(false);
    }
    this.player.setDepth(this.player.y);
  }

  /** Spinge il personaggio fuori da ogni ostacolo solido (collisione a cerchi) e ri-clampa ai bordi. */
  private resolveCollisions(x: number, y: number): { x: number; y: number } {
    const pr = 7; // raggio del personaggio
    for (const c of this.colliders) {
      const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy), min = pr + c.r;
      if (d < min) { if (d < 0.001) { x = c.x + min; } else { x = c.x + dx / d * min; y = c.y + dy / d * min; } }
    }
    return {
      x: Phaser.Math.Clamp(x, HUB_WALK.minX, this.designW - HUB_WALK.minX),
      y: Phaser.Math.Clamp(y, HUB_WALK.minY, HUB_WALK.maxY),
    };
  }

  private updateProximity() {
    let best: Station | null = null, bestD = INTERACT_RADIUS;
    for (const s of this.stations) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    this.nearStation = best;
    if (best) {
      const key = this.usingPad ? 'hub.promptPad' : 'hub.prompt';
      this.prompt.setText(t(key, { label: best.label })).setPosition(best.x, best.y - 40).setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }
  }

  private tryInteract() {
    if (this.busy || !this.nearStation) return;
    const s = this.nearStation;
    if (s.kind === 'service') { this.busy = true; Juice.go(this, 'ShopScene'); return; } // servizi → negozio (filtrato per luogo)
    if (s.kind === 'refuel')  { this.refuelAtPump(); return; }                            // pompa: fai benzina sul posto
    if (this.gallery) { this.exitGallery(); return; }                                     // in galleria il veicolo = torna al debug
    this.busy = true; Juice.go(this, 'RouteScene');                                       // sosta reale: riparti → percorso
  }

  /** Pompa diegetica: rifornimento diretto, fuori dal menu. Stesso costo del negozio (letto da SHOP_ITEMS →
   *  nessuna deriva); maxFuel rispecchia ShopScene (MAX_FUEL 100 + Serbatoio extra 30). Persiste il checkpoint. */
  private refuelAtPump() {
    const veh = getRun(this.registry, 'vehicle') ?? 'civilian_car';
    const up = ((getRun(this.registry, 'upgrades') ?? {})[veh] ?? {}) as { fuelTank?: boolean };
    const maxFuel = 100 + (up.fuelTank ? 30 : 0);
    const fuel = getRun(this.registry, 'fuel') ?? 100;
    const money = getRun(this.registry, 'money') ?? 0;
    const cost = SHOP_ITEMS.find(i => i.key === 'refuel')?.cost ?? 50;
    if (fuel >= maxFuel) { this.toast(t('hub.tankFull'), UI.amberSoft); return; }
    if (money < cost)    { this.toast(t('hub.noMoney'), UI.red); return; }
    setRun(this.registry, 'money', money - cost);
    setRun(this.registry, 'fuel', maxFuel);
    if (!this.gallery && this.registry.get('debugRun') !== true) SaveData.saveRun(snapshotRun(this.registry));
    this.toast(t('hub.refuelDone', { c: cost }), UI.greenOk);
  }

  /** Messaggio fugace sopra il personaggio (feedback delle azioni dell'hub). */
  private toast(msg: string, color: string) {
    const txt = Ui.text(this, this.player.x, this.player.y - 46, msg, {
      fontSize: '12px', color, fontStyle: 'bold', backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(1002);
    this.tweens.add({ targets: txt, y: txt.y - 22, alpha: 0, duration: 1100, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });
  }

  // ─── Galleria (debug) ────────────────────────────────────────────────────────

  private switchGallery(index: number) {
    this.registry.set('hubGalleryIndex', Phaser.Math.Clamp(index, 0, STOP_LOCATIONS.length - 1));
    this.scene.restart();
  }

  private exitGallery() {
    if (this.busy) return;
    this.busy = true;
    this.registry.set('hubGallery', false);
    Juice.go(this, 'DebugScene');
  }
}
