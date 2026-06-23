import Phaser from 'phaser';
import Ui, { UI, RoundRect } from '../Ui';
import Juice from '../Juice';
import MenuPad from '../MenuPad';
import { setupCamera, DESIGN_W } from '../Config';
import { setRun, getRun } from '../RunState';
import { ROUTE_NODES, RouteNode } from '../Routes';
import { t } from '../i18n';

const H = 600;

/**
 * Track B1 — schermata di scelta percorso, tra il negozio e la missione successiva
 * (ShopScene.continueGame → RouteScene → GameScene). Mostra i nodi rischio/ricompensa
 * (`Routes.ts`) come carte; la scelta salva `routeModifier` nel registry e avvia la missione,
 * che applica i moltiplicatori (densità nemici, hazard, monete) in `GameScene.create`.
 */
export default class RouteScene extends Phaser.Scene {
  private designW = DESIGN_W;

  constructor() { super({ key: 'RouteScene' }); }

  create() {
    this.designW = setupCamera(this).designW;
    const cx = this.designW / 2;
    const nextMission = getRun(this.registry, 'missionNumber') ?? 1;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x161620, 0x161620, 0x0e0e16, 0x10101a, 1, 1, 1, 1);
    bg.fillRect(0, 0, this.designW, H);

    Ui.text(this, cx, 72, t('route.title'), {
      fontSize: '26px', color: UI.greenSoft, fontStyle: 'bold',
    }).setOrigin(0.5);
    Ui.text(this, cx, 106, t('route.subtitle', { n: nextMission }), {
      fontSize: '13px', color: UI.faint,
    }).setOrigin(0.5);

    const cardW = 232, gap = 26, n = ROUTE_NODES.length;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = cx - totalW / 2 + cardW / 2;
    const nav = new MenuPad(this);
    ROUTE_NODES.forEach((node, i) => nav.add(this.drawCard(startX + i * (cardW + gap), 312, cardW, node)));

    Juice.fadeIn(this);
  }

  private drawCard(cx: number, cy: number, w: number, node: RouteNode): RoundRect {
    const h = 248, fill = 0x1c1c2a, fillHover = 0x26263a;
    const card = Ui.box(this, cx, cy, w, h, { fill, radius: 12, stroke: node.accent, strokeAlpha: 0.7 });
    card.setInteractive(true);
    // Striscia-accento in alto
    this.add.rectangle(cx, cy - h / 2 + 12, w - 22, 4, node.accent).setOrigin(0.5);

    Ui.text(this, cx, cy - h / 2 + 30, t(node.labelKey), {
      fontSize: '19px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 24 },
    }).setOrigin(0.5, 0);

    Ui.text(this, cx, cy - 36, t(node.descKey), {
      fontSize: '12px', color: UI.faint, align: 'center', wordWrap: { width: w - 32 },
    }).setOrigin(0.5, 0);

    // Riga ricompensa/costo monete, colorata per segno.
    const pct = `${node.moneyMult > 1 ? '+' : '−'}${Math.abs(Math.round((node.moneyMult - 1) * 100))}%`;
    Ui.text(this, cx, cy + h / 2 - 36, t('route.money', { p: pct }), {
      fontSize: '15px', color: node.moneyMult >= 1 ? UI.greenSoft : UI.redSoft, fontStyle: 'bold',
    }).setOrigin(0.5);

    card.on('pointerover', () => { card.setFillStyle(fillHover); this.input.setDefaultCursor('pointer'); });
    card.on('pointerout',  () => { card.setFillStyle(fill); this.input.setDefaultCursor('default'); });
    card.on('pointerdown', () => this.choose(node));
    return card;
  }

  private choose(node: RouteNode) {
    setRun(this.registry, 'routeModifier', node.key);
    Juice.go(this, 'GameScene');
  }
}
