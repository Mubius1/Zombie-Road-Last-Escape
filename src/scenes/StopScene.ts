import Phaser from 'phaser';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';
import { getRun, setRun, snapshotRun, migrateUpgrades } from '../RunState';
import { locationForLeg, accentCss, STOP_LOCATIONS, StopLocation } from '../Locations';
import { MORALE, FOOD, FATIGUE, SURVIVORS, VEHICLES } from '../GameData';
import { SURVIVOR_ARCS } from '../Convoy';
import { renderHub, buildHubTextures, buildHubCar, buildCrewFigure, dropShadow, HUB_WALK, CAR_GY, CAR_FH } from '../HubEnvironment';
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
const PAD_BTN = { A: 0, B: 1 } as const; // standard mapping (come GameScene/MenuPad)
const ENC_REPEAT_MS = 220;       // auto-repeat della navigazione del modale col pad (= MenuPad.REPEAT_MS)
const WALK_SPEED = 150;          // px/s (spazio di design)
const INTERACT_RADIUS = 80;      // distanza per attivare una stazione

interface Station { x: number; y: number; kind: 'service' | 'depart' | 'refuel' | 'talk'; label: string; survivor?: string }

// Modale di scelta riusato per: incontri Tier C (decisioni morali, docs/CAMPAGNA_CONVOGLIO.md §5) E dialoghi
// coi sopravvissuti ("This War of Mine su ruote": parli con i tuoi). `bodyKey` = ciò che il personaggio DICE
// (assente negli incontri); ogni opzione muta lo stato e ritorna il messaggio-esito (la replica) già tradotto.
interface EncOption { labelKey: string; flag: string; apply: () => string }
interface Encounter { titleKey?: string; titleRaw?: string; bodyKey?: string; options: EncOption[] }

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

  // Modale (incontro Tier C o dialogo) in corso: blocca il cammino finché non scegli.
  private encActive = false;
  private encOptions: EncOption[] = [];
  private encObjs: Array<{ destroy(): void }> = [];
  private encLeg = -1;
  private encIsAuto = false; // true = incontro Tier C automatico (segna encounterDoneLeg); false = dialogo
  // Navigazione del modale col PAD: focus + cornice di selezione, conferma SOLO con A (mai una direzione/altro
  // tasto). Tastiera (1..N) e mouse restano invariati. Vedi handleEncInput/redrawEncHighlight.
  private encSel = 0;                                          // opzione focalizzata (pad)
  private encBtns: Phaser.GameObjects.Rectangle[] = [];        // rettangoli-opzione (per il riquadro di selezione)
  private encHi: Phaser.GameObjects.Graphics | null = null;   // cornice di selezione (visibile solo col pad)
  private encPrevA = false; private encPrevDir = 0; private encNavAt = 0; // edge-trigger A + auto-repeat nav

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
      this.location = locationForLeg((getRun(this.registry, 'legIndex') ?? 1) - 1); // tratta appena conclusa (F1)
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
      { x: vx, y: vy + 8,    kind: 'depart',  label: t('hub.depart') }, // anello sotto le ruote (veicolo dentro il cerchio)
    ];
    if (layout.pump) this.stations.push({ x: layout.pump.x, y: layout.pump.y, kind: 'refuel', label: t('hub.refuel') }); // pompa diegetica

    // ── Equipaggio a bordo: figure con cui PARLARE (il cuore "This War of Mine su ruote") ──
    if (!this.gallery) {
      const crew = getRun(this.registry, 'survivors') ?? [];
      const hungry = getRun(this.registry, 'hungry') ?? [];
      const injured = getRun(this.registry, 'injured') ?? [];
      const fatigue = getRun(this.registry, 'fatigue') ?? {};
      const morale = getRun(this.registry, 'morale') ?? MORALE.start;
      const isTired = (k: string) => (fatigue[k] ?? 0) >= FATIGUE.tired;
      crew.slice(0, 5).forEach((key, i) => {
        const sv = SURVIVORS.find(x => x.key === key);
        const tx = Math.round(this.designW * 0.40) + i * 56, ty = 470;
        const texKey = buildCrewFigure(this, key, sv ? sv.color : '#556070');
        const fig = this.add.image(tx, ty, texKey).setOrigin(0.5, 0.96).setScale(1 / OVERSAMPLE).setDepth(ty); // full-body in scala col mondo (= driver)
        // Stato emotivo (derivato): affamato / ferito / sfinito / morale a terra → figura spenta e fredda.
        const distressed = hungry.includes(key) || injured.includes(key) || isTired(key) || morale < MORALE.break;
        if (distressed) fig.setTint(0x8a93a0).setAlpha(0.85);
        // Idle minimo: respiro (scaleY) sfasato per figura → sembrano vivi, non manichini. Più fiacco se a pezzi.
        this.tweens.add({ targets: fig, scaleY: (1 / OVERSAMPLE) * (distressed ? 1.02 : 1.035), duration: (distressed ? 2000 : 1500) + i * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 180 });
        // Pastiglia di stato sopra la testa: verde in forze · ambra affamato · rosso ferito · azzurro sfinito (mappa stato↔persona).
        const dotY = ty - fig.displayHeight * 0.96 - 6;
        const dotCol = injured.includes(key) ? 0xff5555 : hungry.includes(key) ? 0xffaa44 : isTired(key) ? 0x88aacc : 0x44cc66;
        this.add.circle(tx, dotY, 5, 0x000000, 0.55).setDepth(ty + 1);
        this.add.circle(tx, dotY, 3.4, dotCol).setDepth(ty + 2);
        this.stations.push({ x: tx, y: ty, kind: 'talk', label: t('hub.talk', { name: sv ? sv.properName : key }), survivor: key });
      });
    }
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
    if (!this.gallery) this.maybeShowEncounter(); // incontro Tier C (decisione morale) all'arrivo
  }

  // ─── Overlay (card del luogo, hint, barra galleria) ──────────────────────────

  /**
   * Pannello-stato del convoglio (i BISOGNI, leggibili alla sosta): scorta di cibo + quanti resterebbero a
   * digiuno alla ripartenza, morale con la sua "parola" (saldo/fragile/a terra/alla rotta) e l'elenco di chi
   * è affamato/ferito (o "in forze"). Colori = urgenza. In alto a sinistra, sotto il titolo del luogo.
   */
  private drawConvoyStatus() {
    const crew = getRun(this.registry, 'survivors') ?? [];
    if (crew.length === 0) return;
    const food = getRun(this.registry, 'food') ?? FOOD.start;
    const morale = getRun(this.registry, 'morale') ?? MORALE.start;
    const hungry = getRun(this.registry, 'hungry') ?? [];
    const injured = getRun(this.registry, 'injured') ?? [];
    const fatigue = getRun(this.registry, 'fatigue') ?? {};
    const tired = crew.filter(k => (fatigue[k] ?? 0) >= FATIGUE.tired);
    const lenaAboard = (getRun(this.registry, 'choices') ?? []).includes('lena_found');
    const nameOf = (k: string) => SURVIVORS.find(s => s.key === k)?.properName ?? k;

    const fed = Math.min(crew.length, Math.floor(food / FOOD.perSurvivor)); // sfamati alla prossima tratta
    const hungryNext = crew.length - fed;
    const mState = morale >= 60 ? { k: 'hub.moraleHigh', c: UI.greenOk }
      : morale >= MORALE.break ? { k: 'hub.moraleMid', c: UI.amberSoft }
        : morale >= MORALE.rout ? { k: 'hub.moraleLow', c: UI.red }
          : { k: 'hub.moraleRout', c: UI.red };

    const lines: Array<{ t: string; c: string; s: number; b?: boolean }> = [];
    lines.push({ t: t('hub.statusTitle'), c: UI.faint, s: 9, b: true });
    lines.push({ t: t('shop.food', { n: food, max: FOOD.max }), c: hungryNext > 0 ? UI.amberSoft : UI.text, s: 12 });
    if (hungryNext > 0) lines.push({ t: t('hub.foodShort', { n: hungryNext }), c: UI.amberSoft, s: 10 });
    lines.push({ t: `${t('hub.morale', { n: morale, max: MORALE.max })}  ·  ${t(mState.k)}`, c: mState.c, s: 12 });
    if (injured.length) lines.push({ t: t('hub.statusInjured', { names: injured.map(nameOf).join(', ') }), c: UI.red, s: 10 });
    if (hungry.length) lines.push({ t: t('hub.statusHungry', { names: hungry.map(nameOf).join(', ') }), c: UI.amberSoft, s: 10 });
    if (tired.length) lines.push({ t: t('hub.statusTired', { names: tired.map(nameOf).join(', ') }), c: '#88aacc', s: 10 });
    if (!injured.length && !hungry.length && !tired.length) lines.push({ t: t('hub.statusWell'), c: UI.greenOk, s: 10 });
    if (lenaAboard) lines.push({ t: t('hub.lenaAboard'), c: UI.gold, s: 10 });

    const left = 12, top = 62, W = 246, padX = 10; // sotto il titolo+sottotitolo centrati del luogo (niente sovrapposizione)
    let y = top + 8;
    for (const ln of lines) {
      const txt = Ui.text(this, left + padX, y, ln.t,
        { fontSize: `${ln.s}px`, color: ln.c, fontStyle: ln.b ? 'bold' : 'normal', wordWrap: { width: W - padX * 2 } })
        .setOrigin(0, 0).setDepth(1001);
      y += txt.height + 4;
    }
    this.add.rectangle(left, top, W, (y - top) + 4, UI.black, 0.5).setOrigin(0, 0)
      .setStrokeStyle(1, this.location.accent, 0.55).setDepth(1000);
  }

  private buildOverlays() {
    const accent = accentCss(this.location.accent);
    Ui.text(this, this.designW / 2, 14, t(this.location.nameKey), {
      fontSize: '22px', color: accent, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(1000);
    Ui.text(this, this.designW / 2, 40, t(this.location.flavorKey), {
      fontSize: '11px', color: UI.faint, fontStyle: 'italic',
    }).setOrigin(0.5, 0).setDepth(1000);

    if (!this.gallery) this.drawConvoyStatus(); // pannello-stato: cibo · morale · affamati/feriti (i BISOGNI, leggibili)

    this.prompt = Ui.text(this, 0, 0, '', {
      fontSize: '13px', color: UI.white, fontStyle: 'bold',
      backgroundColor: '#000000cc', padding: { x: 7, y: 3 },
    }).setOrigin(0.5, 1).setDepth(1001).setVisible(false);

    if (this.gallery) {
      Ui.text(this, this.designW / 2, 574, t('hub.galleryBar', {
        i: this.galleryIndex + 1, n: STOP_LOCATIONS.length, name: t(this.location.nameKey),
      }), { fontSize: '12px', color: UI.cyanDebug, fontStyle: 'bold' })
        .setOrigin(0.5, 1).setDepth(1000);
    } else {
      Ui.text(this, this.designW / 2, 576, t('hub.hint'), { fontSize: '11px', color: UI.ghost })
        .setOrigin(0.5, 1).setDepth(1000);
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
      // Modale aperto: nav + conferma li gestisce handleEncInput (croce su/giù = focus, A = conferma). Qui NON
      // committare nulla — basta rivelare la cornice di selezione. (Prima: qualsiasi tasto sceglieva l'ultima.)
      if (this.encActive) { this.redrawEncHighlight(); return; }
      if (btn.index === PAD_BTN.A) this.tryInteract();   // A = interagisci
      if (btn.index === PAD_BTN.B && this.gallery) this.exitGallery(); // B = esci dalla galleria
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
    if (this.encActive) { this.handleEncInput(); return; } // modale incontro Tier C: solo la scelta
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

  private walkPhase = 0;
  private movePlayer(dt: number) {
    let vx = 0, vy = 0;
    if (this.cursors.left?.isDown  || this.aKey.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.dKey.isDown) vx += 1;
    if (this.cursors.up?.isDown    || this.wKey.isDown) vy -= 1;
    if (this.cursors.down?.isDown  || this.sKey.isDown) vy += 1;
    const ls = this.activePad()?.leftStick;
    if (ls && ls.length() > PAD_DEADZONE) { vx += ls.x; vy += ls.y; this.usingPad = true; }

    const len = Math.hypot(vx, vy);
    const base = 1 / OVERSAMPLE;
    if (len > 0.001) {
      vx /= len; vy /= len;
      const nx = Phaser.Math.Clamp(this.player.x + vx * WALK_SPEED * dt, HUB_WALK.minX, this.designW - HUB_WALK.minX);
      const ny = Phaser.Math.Clamp(this.player.y + vy * WALK_SPEED * dt, HUB_WALK.minY, HUB_WALK.maxY);
      const p = this.resolveCollisions(nx, ny);
      this.player.setPosition(p.x, p.y);
      if (vx < -0.01) this.player.setFlipX(true); else if (vx > 0.01) this.player.setFlipX(false);
      // Animazione del passo: molleggio (squash/stretch coi piedi piantati) + leggero dondolio.
      this.walkPhase += dt * 11;
      const b = Math.abs(Math.sin(this.walkPhase));
      this.player.setScale(base * (1 + 0.05 * b), base * (1 - 0.06 * b));
      this.player.setRotation(Math.sin(this.walkPhase * 0.5) * 0.05);
    } else {
      // ritorno morbido alla posa di riposo
      this.player.setScale(Phaser.Math.Linear(this.player.scaleX, base, 0.2), Phaser.Math.Linear(this.player.scaleY, base, 0.2));
      this.player.setRotation(Phaser.Math.Linear(this.player.rotation, 0, 0.2));
      this.walkPhase = 0;
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
    if (this.busy || this.encActive || !this.nearStation) return;
    const s = this.nearStation;
    if (s.kind === 'service') { this.busy = true; Juice.go(this, 'ShopScene'); return; } // servizi → negozio (filtrato per luogo)
    if (s.kind === 'refuel')  { this.refuelAtPump(); return; }                            // pompa: fai benzina sul posto
    if (s.kind === 'talk')    { if (s.survivor) this.talkTo(s.survivor); return; }        // parla con un sopravvissuto
    if (this.gallery) { this.exitGallery(); return; }                                     // in galleria il veicolo = torna al debug
    this.busy = true; Juice.go(this, 'RouteScene');                                       // sosta reale: riparti → percorso
  }

  /** Pompa diegetica: rifornimento diretto, fuori dal menu. Stesso costo del negozio (letto da SHOP_ITEMS →
   *  nessuna deriva); maxFuel rispecchia ShopScene (MAX_FUEL 100 + Serbatoio extra 30). Persiste il checkpoint. */
  private refuelAtPump() {
    const veh = getRun(this.registry, 'vehicle') ?? 'civilian_car';
    const up = migrateUpgrades(getRun(this.registry, 'upgrades')); // upgrade globali del convoglio
    const maxFuel = 100 + (up.fuelTank && (VEHICLES[veh]?.upgrades ?? []).includes('fuelTank') ? 30 : 0);
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

  // ─── Incontri Tier C (decisioni morali del convoglio — docs/CAMPAGNA_CONVOGLIO.md §5) ─────────

  /** Incontro del luogo corrente (null = nessuno). Le `apply` mutano il registry e ritornano il
   *  messaggio-esito già tradotto; il `flag` finisce in `RunData.choices`, letto dall'epilogo. */
  private encounterFor(key: string): Encounter | null {
    const reg = this.registry;
    const money  = () => getRun(reg, 'money') ?? 0;
    const food   = () => getRun(reg, 'food') ?? FOOD.start;
    const morale = () => getRun(reg, 'morale') ?? MORALE.start;
    const adjMoney  = (d: number) => setRun(reg, 'money',  Math.max(0, money() + d));
    const adjFood   = (d: number) => setRun(reg, 'food',   Phaser.Math.Clamp(food() + d, 0, FOOD.max));
    const adjMorale = (d: number) => setRun(reg, 'morale', Phaser.Math.Clamp(morale() + d, 0, MORALE.max));

    if (key === 'camp') return { titleKey: 'enc.camp.title', options: [
      { labelKey: 'enc.camp.share',  flag: 'shared',   apply: () => { adjFood(-20); adjMorale(10); return t('enc.result.shared'); } },
      { labelKey: 'enc.camp.ration', flag: 'rationed', apply: () => { adjMorale(-8); return t('enc.result.rationed'); } },
    ] };
    if (key === 'depot') return { titleKey: 'enc.depot.title', options: [
      { labelKey: 'enc.depot.loot', flag: 'looted',  apply: () => { adjMoney(80); adjMorale(-6); return t('enc.result.looted'); } },
      { labelKey: 'enc.depot.grab', flag: 'grabbed', apply: () => { adjMoney(20); return t('enc.result.grabbed'); } },
    ] };
    if (key === 'checkpoint') return { titleKey: 'enc.checkpoint.title', options: [
      { labelKey: 'enc.checkpoint.pay',   flag: 'paid',   apply: () => { if (money() < 60) return t('hub.noMoney'); adjMoney(-60); return t('enc.result.paid'); } },
      { labelKey: 'enc.checkpoint.force', flag: 'forced', apply: () => { adjMorale(-5); return t('enc.result.forced'); } },
    ] };
    if (key === 'market') {
      const survivors = getRun(reg, 'survivors') ?? [];
      const opts: EncOption[] = [
        { labelKey: 'enc.market.buy', flag: 'bought', apply: () => { if (money() < 120) return t('hub.noMoney'); adjMoney(-120); adjFood(50); return t('enc.result.bought'); } },
      ];
      if (survivors.length > 0) opts.push(
        { labelKey: 'enc.market.sell', flag: 'sold', apply: () => {
          const list = [...survivors];
          const k = list.splice(Math.floor(Math.random() * list.length), 1)[0]!;
          setRun(reg, 'survivors', list);
          adjMoney(150); adjMorale(-18);
          const s = SURVIVORS.find(x => x.key === k);
          return t('enc.result.sold', { name: s ? `${s.properName} ${s.surname}` : k });
        } });
      opts.push({ labelKey: 'enc.market.refuse', flag: '', apply: () => t('enc.result.refused') });
      return { titleKey: 'enc.market.title', options: opts };
    }
    return null; // garage: nessun incontro morale (triage gestionale fuori scope)
  }

  private maybeShowEncounter() {
    const leg = (getRun(this.registry, 'legIndex') ?? 1) - 1; // tratta appena conclusa (come la sosta)
    if (this.registry.get('encounterDoneLeg') === leg) return; // già risolto in questa visita
    const enc = this.encounterFor(this.location.key);
    if (!enc) return;
    this.encLeg = leg;
    this.showEncounter(enc, true);
  }

  private showEncounter(enc: Encounter, isAuto: boolean) {
    this.encActive = true;
    this.encIsAuto = isAuto;
    this.encOptions = enc.options;
    this.encObjs = [];
    // Modale in spazio di DESIGN (oggetti-mondo, NIENTE scrollFactor): la camera dell'hub è statica e
    // centrata su (designW/2, 300), quindi un oggetto a designW/2 cade al centro schermo a ogni risoluzione.
    // ⚠️ NON usare setScrollFactor(0) con coord di design: sotto zoom S≠1 sbanda in alto-a-sinistra (regola
    // del progetto: scrollFactor(0) ⟺ pixel nativi scale.width/height). (Ui.box/RoundRect non supportano
    // scrollFactor → uso this.add.rectangle, ma qui scrollFactor non serve affatto.)
    const cx = this.designW / 2, cyc = 300, n = enc.options.length;
    // Layout verticale a padding espliciti: titolo · (descrizione opz.) · bottoni. `titleH` RISERVA sempre
    // spazio al titolo → senza questa riserva, quando manca la descrizione (incontri auto Tier C) il 1° bottone
    // risaliva sotto il titolo e ci si sovrapponeva. Vedi anche il commento sul perché non c'è scrollFactor.
    const padTop = 18, titleH = 40, rowH = 56, padBottom = 22;
    const bodyH = enc.bodyKey ? 46 : 0;
    const ph = padTop + titleH + bodyH + n * rowH + padBottom;
    this.encObjs.push(this.add.rectangle(cx, cyc, this.designW + 400, 760, 0x000000, 0.72).setDepth(1100).setInteractive());
    this.encObjs.push(this.add.rectangle(cx, cyc, 560, ph, UI.black, 0.96).setStrokeStyle(2, this.location.accent, 0.8).setDepth(1101));
    const top = cyc - ph / 2;
    this.encObjs.push(Ui.text(this, cx, top + padTop, enc.titleRaw ?? (enc.titleKey ? t(enc.titleKey) : ''), {
      fontSize: '20px', color: accentCss(this.location.accent), fontStyle: 'bold', align: 'center', wordWrap: { width: 520 },
    }).setOrigin(0.5, 0).setDepth(1102));
    if (enc.bodyKey) {
      this.encObjs.push(Ui.text(this, cx, top + padTop + titleH, t(enc.bodyKey), {
        fontSize: '14px', color: UI.greenSoft, fontStyle: 'italic', align: 'center', wordWrap: { width: 510 },
      }).setOrigin(0.5, 0).setDepth(1102));
    }
    const optTop = top + padTop + titleH + bodyH + rowH / 2;
    // Selettore PAD: focus alla 1ª opzione + cornice di selezione (sopra i bottoni). Seed dell'edge di A allo
    // stato CORRENTE del pad → la A con cui hai aperto un dialogo (tryInteract) non conta come conferma fresca.
    this.encSel = 0; this.encBtns = []; this.encPrevDir = 0; this.encNavAt = 0;
    const pad0 = this.activePad(); this.encPrevA = !!pad0?.A;
    this.encHi = this.add.graphics().setDepth(1104).setVisible(false);
    this.encObjs.push(this.encHi);
    enc.options.forEach((opt, i) => {
      const by = optTop + i * 56;
      const btn = this.add.rectangle(cx, by, 520, 46, 0x1c1c2a).setStrokeStyle(1, this.location.accent, 0.4).setDepth(1102).setInteractive();
      this.encObjs.push(btn); this.encBtns.push(btn);
      this.encObjs.push(Ui.text(this, cx - 244, by, `${i + 1}.  ${t(opt.labelKey)}`, {
        fontSize: '14px', color: UI.white, align: 'left', wordWrap: { width: 500 },
      }).setOrigin(0, 0.5).setDepth(1103));
      // mouse: hover evidenzia QUESTO bottone e cede al mouse (nasconde la cornice pad → "last input wins").
      btn.on('pointerover', () => { btn.setFillStyle(0x26263a); this.usingPad = false; this.encHi?.setVisible(false); });
      btn.on('pointerout',  () => btn.setFillStyle(0x1c1c2a));
      btn.on('pointerdown', () => this.pickEncounter(i));
    });
    // Suggerimento d'uso col pad (solo se collegato): la lista numerata da sola non dice che la croce naviga.
    if (this.activePad()) {
      this.encObjs.push(Ui.text(this, cx, top + ph - 10, t('enc.padHint'), {
        fontSize: '10px', color: UI.faint, fontStyle: 'italic',
      }).setOrigin(0.5, 1).setDepth(1103));
    }
    this.redrawEncHighlight();
  }

  /** Input del modale: tastiera 1..N (diretto) e mouse (clic) invariati. PAD: croce su/giù + stick sinistro
   *  NAVIGANO il focus; SOLO A (edge-triggered) conferma l'opzione focalizzata. Nessuna direzione o altro
   *  tasto committa — era il bug. È pollato ogni frame da update() finché `encActive`. */
  private handleEncInput() {
    for (let i = 0; i < this.encOptions.length && i < this.numKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.numKeys[i]!)) { this.pickEncounter(i); return; }
    }
    const pad = this.activePad();
    if (!pad) return;
    const ls = pad.leftStick;
    let dir = 0;
    if (pad.up   || ls.y < -PAD_DEADZONE) dir = -1;
    else if (pad.down || ls.y >  PAD_DEADZONE) dir = 1;
    const now = this.time.now;
    if (dir !== 0) {
      this.usingPad = true;
      if (dir !== this.encPrevDir || now - this.encNavAt > ENC_REPEAT_MS) {
        const n = this.encOptions.length;
        this.encSel = (this.encSel + dir + n) % n; // wrap su lista corta
        this.redrawEncHighlight();
        this.encNavAt = now;
      }
    }
    this.encPrevDir = dir;
    // Conferma: SOLO A, edge-triggered e con pad come sorgente attiva (cfr. MenuPad). B non chiude (gli incontri
    // si concludono scegliendo un'opzione, incl. "rifiuta"/"chiudi") → niente dismiss accidentale.
    const a = !!pad.A;
    if (a && !this.encPrevA && this.usingPad) { this.encPrevA = a; this.pickEncounter(this.encSel); return; }
    this.encPrevA = a;
  }

  /** Cornice di selezione (pad) attorno all'opzione focalizzata. Visibile solo se il pad è la sorgente attiva
   *  ("last input wins": mouse/tastiera la nascondono). Stile coerente con MenuPad.drawCursor. */
  private redrawEncHighlight() {
    if (!this.encHi) return;
    const btn = this.encBtns[this.encSel];
    if (!btn || !this.usingPad) { this.encHi.setVisible(false); return; }
    const b = btn.getBounds();
    this.encHi.clear()
      .lineStyle(2, 0x88ccff, 1)
      .strokeRoundedRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6, 7)
      .setVisible(true);
  }

  private pickEncounter(i: number) {
    if (!this.encActive) return;
    const opt = this.encOptions[i];
    if (!opt) return;
    this.encActive = false;
    const msg = opt.apply();
    if (opt.flag) setRun(this.registry, 'choices', [...(getRun(this.registry, 'choices') ?? []), opt.flag]);
    if (this.encIsAuto) this.registry.set('encounterDoneLeg', this.encLeg); // solo l'incontro AUTO non si ri-mostra
    if (this.registry.get('debugRun') !== true) SaveData.saveRun(snapshotRun(this.registry));
    for (const o of this.encObjs) o.destroy();
    this.encObjs = []; this.encBtns = []; this.encHi = null; // la cornice/i bottoni sono in encObjs → già distrutti
    if (!msg) return; // dialogo "chiudi": nessuna replica da mostrare
    // Esito/replica al centro, in evidenza (oggetto-mondo in spazio design, come il modale).
    const txt = Ui.text(this, this.designW / 2, 300, msg, {
      fontSize: '15px', color: UI.greenSoft, fontStyle: 'italic', stroke: '#000000', strokeThickness: 3,
      align: 'center', wordWrap: { width: 480 },
    }).setOrigin(0.5).setDepth(1102);
    this.tweens.add({ targets: txt, alpha: 0, y: 270, delay: 1600, duration: 1400, onComplete: () => txt.destroy() });
  }

  // ─── Dialoghi coi sopravvissuti ("This War of Mine su ruote": parli con i tuoi) ───────────────

  /** Conversazione con un sopravvissuto a bordo. SARA (medico) ha un ARCO (la figlia Lena) con una scelta
   *  che pesa sull'epilogo; gli altri sei hanno una battuta in voce. Riusa il modale (bodyKey = ciò che dice). */
  /** Stato emotivo (derivato): affamato, ferito, o morale del convoglio sotto soglia → "in difficoltà". */
  private isDistressed(key: string): boolean {
    const hungry = getRun(this.registry, 'hungry') ?? [];
    const injured = getRun(this.registry, 'injured') ?? [];
    const fatigue = getRun(this.registry, 'fatigue') ?? {};
    const morale = getRun(this.registry, 'morale') ?? MORALE.start;
    return hungry.includes(key) || injured.includes(key) || (fatigue[key] ?? 0) >= FATIGUE.tired || morale < MORALE.break;
  }

  private talkTo(key: string) {
    if (this.encActive) return;
    const s = SURVIVORS.find(x => x.key === key);
    const name = s ? `${s.properName} ${s.surname}` : key;
    const reg = this.registry;
    const choices = getRun(reg, 'choices') ?? [];
    const arc = SURVIVOR_ARCS[key];

    // Nessun arco (autoriato non ancora caricato per questo personaggio): battuta semplice di ripiego.
    if (!arc) {
      this.showEncounter({ titleRaw: name, bodyKey: `dlg.${key}.line`, options: [{ labelKey: 'dlg.close', flag: '', apply: () => '' }] }, false);
      return;
    }

    const adjMorale = (d: number) => setRun(reg, 'morale', Phaser.Math.Clamp((getRun(reg, 'morale') ?? MORALE.start) + d, 0, MORALE.max));
    const adjFood   = (d: number) => setRun(reg, 'food',   Phaser.Math.Clamp((getRun(reg, 'food') ?? FOOD.start) + d, 0, FOOD.max));
    const adjMoney  = (d: number) => setRun(reg, 'money',  Math.max(0, (getRun(reg, 'money') ?? 0) + d));
    const actIndex = getRun(reg, 'actIndex') ?? 0;
    const chosen = arc.options.find(o => choices.includes(o.flag));

    if (chosen) {
      // S1: un ESITO-diramazione con battute dedicate (es. Sara dopo aver ritrovato/perso Lena) ha la PRIORITÀ
      // sull'eco generica della scelta, e varia per stato emotivo. Altrimenti: eco della scelta, o battuta di stato.
      const outcome = arc.talkAfter?.find(ta => choices.includes(ta.flag));
      const after = arc.after.find(a => a.flag === chosen.flag);
      const body = outcome ? (this.isDistressed(key) ? outcome.distressed : outcome.calm)
                 : after ? after.key
                 : (this.isDistressed(key) ? arc.talk.distressed : arc.talk.calm);
      this.showEncounter({ titleRaw: name, bodyKey: body, options: [{ labelKey: 'dlg.close', flag: '', apply: () => '' }] }, false);
      return;
    }
    // Una DIRAMAZIONE alla volta: se questo arco aprirebbe una deviazione ma una è già in sospeso (scelta a
    // questa stessa sosta), RIMANDA il beat (mostra la battuta di stato) — niente sovrascrittura di pendingDetour.
    const detourPending = (getRun(reg, 'pendingDetour') ?? '') !== '';
    const wouldDetour = arc.options.some(o => o.detour);
    if (actIndex >= arc.unlockAct && !(wouldDetour && detourPending)) {
      // Il BEAT: la scelta che pesa (effetti + flag dal dato).
      this.showEncounter({ titleRaw: name, bodyKey: arc.beatKey, options: arc.options.map(o => ({
        labelKey: o.labelKey, flag: o.flag, apply: () => {
          adjMorale(o.morale); adjFood(o.food); adjMoney(o.money);
          if (o.detour) setRun(reg, 'pendingDetour', o.detour); // DIRAMAZIONE: la prossima tratta è la deviazione
          return t(o.replyKey);
        },
      })) }, false);
      return;
    }
    // Prima dello sblocco: battuta in voce per lo stato emotivo (costruisci rapporto; il beat arriverà).
    this.showEncounter({ titleRaw: name, bodyKey: this.isDistressed(key) ? arc.talk.distressed : arc.talk.calm, options: [{ labelKey: 'dlg.close', flag: '', apply: () => '' }] }, false);
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
