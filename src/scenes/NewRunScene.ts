import Phaser from 'phaser';
import Juice from '../Juice';
import Ui, { UI } from '../Ui';
import { setupCamera, DESIGN_W } from '../Config';
import MenuPad from '../MenuPad';
import { resetRunState, setRun } from '../RunState';
import SaveData from '../SaveData';
import MetaProfile from '../MetaProfile';
import Settings from '../Settings';
import { DIFFICULTIES, VEHICLES } from '../GameData';
import { PROLOGUE_ENABLED } from './CutsceneScene';
import { t } from '../i18n';

const H = 600;

/**
 * Schermata di setup della Nuova Partita (Fase R · R2 difficoltà, R3 loadout). Scena DEDICATA (non overlay)
 * per isolare l'input dal menu. Schermata UNICA: scegli DIFFICOLTÀ + MEZZO di partenza (fra quelli
 * meta-sbloccati), poi PARTI. Alla conferma azzera il progresso (NON il meta-profilo), fissa difficoltà e
 * veicolo iniziale nella corsa e avvia (prologo → GameScene). Vedi docs/CAMPAGNA_CONVOGLIO.md §10.
 */
export default class NewRunScene extends Phaser.Scene {
  private designW = DESIGN_W;
  private selDiff = 0;            // difficoltà selezionata (0..2)
  private selVehicle = 'civilian_car'; // mezzo di partenza selezionato (fra gli sbloccati)
  private picker: { destroy(): void }[] = []; // oggetti ridisegnati a ogni selezione
  private nav!: MenuPad;          // navigazione col gamepad (croce/stick = focus, A = scegli, B = indietro)

  constructor() { super({ key: 'NewRunScene' }); }

  create() {
    this.designW = setupCamera(this).designW;
    const maxDiff = MetaProfile.profile.bestDifficulty >= 1 ? 2 : 1; // Incubo gated
    this.selDiff = Math.min(Settings.difficulty, maxDiff);
    this.selVehicle = 'civilian_car';
    this.buildBackdrop();
    // Pad: una sola istanza (i listener si registrano qui), gli elementi si ri-registrano a ogni render.
    // B = indietro, Start = PARTI (come INVIO); A attiva l'elemento focalizzato riusando il suo onClick.
    this.nav = new MenuPad(this).setBack(() => this.back()).setStart(() => this.startRun());
    this.render();

    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.input.keyboard?.on('keydown-ENTER', () => this.startRun());
    Ui.enter(this);
  }

  private buildBackdrop() {
    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(0x07070d, 0x07070d, 0x141320, 0x100c16, 1, 1, 1, 1);
    g.fillRect(0, 0, this.designW, H);
    g.fillStyle(0x7a1e12, 0.30);
    // Linea-orizzonte rosso-sangue: divisore tra la sezione DIFFICOLTÀ (tasti a y=136) e quella del
    // MEZZO (header a y=214). A y=192 sta nel vuoto tra le due → non taglia più i tasti difficoltà.
    g.fillRect(0, 192, this.designW, 2);
  }

  /** Ridisegna l'intera schermata con la selezione corrente (semplice e senza bug di stato). */
  private render() {
    for (const o of this.picker) o.destroy();
    this.picker = [];
    this.nav.clearItems(); // i bottoni qui sotto sono nuovi → ri-registra il set navigabile col pad
    const cx = this.designW / 2;

    this.add_(Ui.text(this, cx, 60, t('newrun.title'), {
      fontSize: '30px', fontStyle: 'bold', color: '#c8d0a0', stroke: '#2a0c08', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10));

    // ── Difficoltà (riga orizzontale) ──
    this.add_(Ui.text(this, cx, 100, t('newrun.chooseDifficulty'), { fontSize: '14px', color: UI.green }).setOrigin(0.5).setDepth(10));
    const best = MetaProfile.profile.bestDifficulty;
    const dStyle = [
      { on: 0x1f3a17, off: 0x122110, border: UI.greenSig, color: UI.green },
      { on: 0x3c2f0d, off: 0x221b08, border: 0xc8a23a,    color: UI.gold  },
      { on: 0x3c1418, off: 0x220c0f, border: 0x9a2a2a,    color: UI.red   },
    ];
    const dW = 150, dGap = 8;
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const key = DIFFICULTIES[i]!.key, st = dStyle[i]!;
      const x = cx + (i - 1) * (dW + dGap);
      const locked = i === 2 && best < 1;
      const sel = this.selDiff === i;
      const b = Ui.button(this, x, 136, dW, 44, locked ? `🔒 ${t(`difficulty.${key}.name`)}` : t(`difficulty.${key}.name`), {
        fill: locked ? 0x16171c : sel ? st.on : st.off, hover: locked ? 0x16171c : st.on,
        border: locked ? 0x3a4150 : st.border, color: locked ? UI.faint : st.color,
        fontSize: '18px', scaleOnHover: locked ? 1 : 1.03,
        onClick: () => { if (!locked) { this.selDiff = i; this.render(); } },
      });
      b.bg.setDepth(10).setAlpha(sel || locked ? 1 : 0.78); b.txt.setDepth(11);
      this.add_(b.bg); this.add_(b.txt);
      this.nav.add(b.bg); // navigabile col pad (A = scegli questa difficoltà; il locked non fa nulla)
    }
    // Descrizione della difficoltà selezionata
    const dKey = DIFFICULTIES[this.selDiff]!.key;
    this.add_(Ui.text(this, cx, 172, t(`difficulty.${dKey}.desc`), {
      fontSize: '11px', color: UI.faint, align: 'center', wordWrap: { width: 480 },
    }).setOrigin(0.5).setDepth(10));

    // ── Mezzo di partenza (griglia degli sbloccati) ──
    this.add_(Ui.text(this, cx, 214, t('newrun.chooseVehicle'), { fontSize: '14px', color: UI.blue }).setOrigin(0.5).setDepth(10));
    const vehicles = MetaProfile.unlockedVehicles();
    const perRow = 4, vW = 124, vH = 40, vGap = 8;
    vehicles.forEach((key, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const inRow = Math.min(perRow, vehicles.length - row * perRow);
      const x = cx + (col - (inRow - 1) / 2) * (vW + vGap);
      const y = 250 + row * (vH + vGap);
      const sel = this.selVehicle === key;
      const b = Ui.button(this, x, y, vW, vH, t(VEHICLES[key]?.name ?? key), {
        fill: sel ? 0x14283a : 0x0e1018, hover: 0x14283a,
        border: sel ? UI.greenSig : UI.blueLine, color: sel ? UI.green : UI.blue,
        fontSize: '12px', scaleOnHover: 1.03,
        onClick: () => { this.selVehicle = key; this.render(); },
      });
      b.bg.setDepth(10).setAlpha(sel ? 1 : 0.82); b.txt.setDepth(11);
      this.add_(b.bg); this.add_(b.txt);
      this.nav.add(b.bg); // navigabile col pad (A = scegli questo mezzo)
    });

    // ── Avvio / Indietro ──
    const startBtn = Ui.button(this, cx, 504, 300, 56, t('newrun.start'), {
      fill: 0x13260f, hover: 0x1f3a17, border: UI.greenSig, color: UI.green,
      fontSize: '24px', scaleOnHover: 1.05, onClick: () => this.startRun(),
    });
    startBtn.bg.setDepth(10); startBtn.txt.setDepth(11);
    this.add_(startBtn.bg); this.add_(startBtn.txt);
    this.nav.add(startBtn.bg);

    const back = Ui.button(this, cx, 570, 180, 38, t('common.back'), {
      fill: 0x101826, hover: 0x1a2740, border: UI.blueLine, color: UI.blue,
      fontSize: '16px', scaleOnHover: 1.04, onClick: () => this.back(),
    });
    back.bg.setDepth(10); back.txt.setDepth(11);
    this.add_(back.bg); this.add_(back.txt);
    this.nav.add(back.bg);
  }

  /** Traccia un oggetto perché venga distrutto al prossimo render. */
  private add_<T extends { destroy(): void }>(o: T): T { this.picker.push(o); return o; }

  /** Conferma: fissa difficoltà + mezzo di partenza, azzera il progresso e avvia (prologo → GameScene). */
  private startRun() {
    Settings.difficulty = this.selDiff; // ricorda la scelta come default del prossimo avvio
    SaveData.clearRun();                // Nuova Partita = unico vero reset del checkpoint (NON tocca il meta-profilo)
    this.registry.set('debugRun', false);
    resetRunState(this.registry);
    setRun(this.registry, 'difficulty', this.selDiff);
    // R3 loadout: parti col mezzo scelto (fra gli sbloccati). Lo possiedi ed è quello attivo; arma base MG.
    if (this.selVehicle !== 'civilian_car') {
      setRun(this.registry, 'vehicle', this.selVehicle);
      setRun(this.registry, 'ownedVehicles', [this.selVehicle]);
    }
    if (PROLOGUE_ENABLED && !this.registry.get('skipCutscenes')) {
      Juice.fadeAndRun(this, () => this.scene.start('CutsceneScene', { cutscene: 'prologue', next: 'GameScene' }));
    } else {
      Juice.go(this, 'GameScene');
    }
  }

  private back() { Juice.go(this, 'MenuScene'); }
}
