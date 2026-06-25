import Phaser from 'phaser';
import Ui, { UI, RoundRect } from '../Ui';
import Juice from '../Juice';
import MenuPad from '../MenuPad';
import { setupCamera, DESIGN_W } from '../Config';
import { setRun, getRun } from '../RunState';
import { ROUTE_NODES, RouteNode } from '../Routes';
import { isBranchLeg, stageAt, odometerKm, CAMPAIGN_TOTAL_KM, ACT_NAME_KEYS } from '../World';
import { locationForLeg } from '../Locations';
import { t } from '../i18n';

const H = 600;

/**
 * Campagna "IL CONVOGLIO" (F3) — schermata-mappa tra il negozio e la missione successiva
 * (`ShopScene.continueGame → StopScene → RouteScene → GameScene`). Mostra il **nastro-odometro**
 * (progresso verso il rifugio) e:
 *  · sulle tratte LINEARI: i 3 nodi rischio/ricompensa di Track B1 (`Routes.ts`) + l'anteprima della tratta;
 *  · ai 2 PUNTI DI BIFORCAZIONE (`isBranchLeg`, leg 11/22): 2 carte — scorciatoia rischiosa vs strada lunga
 *    — che salvano la scelta in `RunData.branchTaken` (il ramo È il descrittore C2, decisione §9.4-C → niente
 *    `routeModifier` separato ai bivi).
 */
export default class RouteScene extends Phaser.Scene {
  private designW = DESIGN_W;

  constructor() { super({ key: 'RouteScene' }); }

  create() {
    this.designW = setupCamera(this).designW;
    const cx = this.designW / 2;
    const nextMission = getRun(this.registry, 'missionNumber') ?? 1;
    const nextLeg = getRun(this.registry, 'legIndex') ?? 0;
    const branch = isBranchLeg(nextLeg);

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x161620, 0x161620, 0x0e0e16, 0x10101a, 1, 1, 1, 1);
    bg.fillRect(0, 0, this.designW, H);

    Ui.text(this, cx, 64, t('route.title'), {
      fontSize: '26px', color: UI.greenSoft, fontStyle: 'bold',
    }).setOrigin(0.5);
    Ui.text(this, cx, 96, branch ? t('route.branchTitle') : t('route.subtitle', { n: nextMission }), {
      fontSize: '13px', color: UI.faint,
    }).setOrigin(0.5);

    // Nastro-odometro: progresso verso il rifugio (atto + km percorsi/totali).
    this.drawOdometer(cx, 138, nextLeg);

    const nav = new MenuPad(this);

    if (branch) {
      // ── 2 carte: scorciatoia (ramo 'alt') vs strada lunga (ramo 'base') ──
      nav.add(this.drawBranchCard(cx - 130, 330, 232, 'route.branch.shortcut.label', 'route.branch.shortcut.desc',
        0xff5522, () => this.chooseBranch(nextLeg, 'alt')));
      nav.add(this.drawBranchCard(cx + 130, 330, 232, 'route.branch.long.label', 'route.branch.long.desc',
        0x66cc66, () => this.chooseBranch(nextLeg, 'base')));
    } else {
      // ── Tratta lineare: 3 nodi B1 + anteprima della tratta ──
      const biome = t('region.' + stageAt(nextLeg).biome);
      const stop = locationForLeg(nextLeg);
      Ui.text(this, cx, 178, t('route.preview', { biome, stop: t(stop.nameKey) }), {
        fontSize: '12px', color: UI.blueInfo,
      }).setOrigin(0.5);

      const cardW = 232, gap = 26, n = ROUTE_NODES.length;
      const totalW = n * cardW + (n - 1) * gap;
      const startX = cx - totalW / 2 + cardW / 2;
      ROUTE_NODES.forEach((node, i) => nav.add(this.drawCard(startX + i * (cardW + gap), 336, cardW, node)));
    }

    Juice.fadeIn(this);
  }

  /** Nastro-odometro 0→totale km con le tacche dei 6 atti e la posizione corrente. */
  private drawOdometer(cx: number, y: number, legIndex: number) {
    const km = odometerKm(legIndex), total = CAMPAIGN_TOTAL_KM;
    const actName = t(ACT_NAME_KEYS[stageAt(legIndex).act - 1] ?? '');
    Ui.text(this, cx, y - 16, t('hud.odometer', { act: actName, km, total }), {
      fontSize: '12px', color: UI.greenSoft,
    }).setOrigin(0.5);
    const W = 380, x0 = cx - W / 2;
    Ui.box(this, cx, y, W, 9, { fill: UI.barGrey, radius: 3 });
    const pct = total > 0 ? Math.min(1, km / total) : 0;
    this.add.rectangle(x0, y, Math.max(2, W * pct), 9, UI.distBar).setOrigin(0, 0.5);
    const ticks = this.add.graphics();
    ticks.fillStyle(UI.black, 0.5);
    for (let i = 1; i < 6; i++) ticks.fillRect(x0 + Math.round(W * i / 6), y - 5, 1, 10);
  }

  private drawCard(cx: number, cy: number, w: number, node: RouteNode): RoundRect {
    const h = 232, fill = 0x1c1c2a, fillHover = 0x26263a;
    const card = Ui.box(this, cx, cy, w, h, { fill, radius: 12, stroke: node.accent, strokeAlpha: 0.7 });
    card.setInteractive(true);
    this.add.rectangle(cx, cy - h / 2 + 12, w - 22, 4, node.accent).setOrigin(0.5);

    Ui.text(this, cx, cy - h / 2 + 30, t(node.labelKey), {
      fontSize: '19px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 24 },
    }).setOrigin(0.5, 0);

    Ui.text(this, cx, cy - 36, t(node.descKey), {
      fontSize: '12px', color: UI.faint, align: 'center', wordWrap: { width: w - 32 },
    }).setOrigin(0.5, 0);

    const pct = `${node.moneyMult > 1 ? '+' : '−'}${Math.abs(Math.round((node.moneyMult - 1) * 100))}%`;
    Ui.text(this, cx, cy + h / 2 - 36, t('route.money', { p: pct }), {
      fontSize: '15px', color: node.moneyMult >= 1 ? UI.greenSoft : UI.redSoft, fontStyle: 'bold',
    }).setOrigin(0.5);

    card.on('pointerover', () => { card.setFillStyle(fillHover); this.input.setDefaultCursor('pointer'); });
    card.on('pointerout',  () => { card.setFillStyle(fill); this.input.setDefaultCursor('default'); });
    card.on('pointerdown', () => this.choose(node));
    return card;
  }

  /** Carta di biforcazione: label/desc i18n + accento di rischio, con callback di scelta. */
  private drawBranchCard(cx: number, cy: number, w: number, labelKey: string, descKey: string, accent: number, onPick: () => void): RoundRect {
    const h = 248, fill = 0x1c1c2a, fillHover = 0x26263a;
    const card = Ui.box(this, cx, cy, w, h, { fill, radius: 12, stroke: accent, strokeAlpha: 0.75 });
    card.setInteractive(true);
    this.add.rectangle(cx, cy - h / 2 + 12, w - 22, 4, accent).setOrigin(0.5);
    Ui.text(this, cx, cy - h / 2 + 30, t(labelKey), {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 24 },
    }).setOrigin(0.5, 0);
    Ui.text(this, cx, cy - 28, t(descKey), {
      fontSize: '12px', color: UI.faint, align: 'center', wordWrap: { width: w - 32 },
    }).setOrigin(0.5, 0);
    card.on('pointerover', () => { card.setFillStyle(fillHover); this.input.setDefaultCursor('pointer'); });
    card.on('pointerout',  () => { card.setFillStyle(fill); this.input.setDefaultCursor('default'); });
    card.on('pointerdown', onPick);
    return card;
  }

  private choose(node: RouteNode) {
    setRun(this.registry, 'routeModifier', node.key);
    Juice.go(this, 'GameScene');
  }

  /** Bivio: salva il ramo scelto in `branchTaken` (il descrittore C2 È il ramo → routeModifier neutro). */
  private chooseBranch(leg: number, which: 'alt' | 'base') {
    const bt = { ...(getRun(this.registry, 'branchTaken') ?? {}) };
    bt[String(leg)] = which;
    setRun(this.registry, 'branchTaken', bt);
    setRun(this.registry, 'routeModifier', 'none');
    Juice.go(this, 'GameScene');
  }
}
