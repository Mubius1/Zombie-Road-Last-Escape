import Phaser from 'phaser';
import Ui, { UI } from './Ui';
import Juice from './Juice';
import { WEAPONS } from './GameData';
import { t } from './i18n';
import { OVERSAMPLE } from './Config';
import Settings from './Settings';
import SoundManager from './SoundManager';
import Environment from './Environment';
import { BOSS_CONFIG, BOSS_ORDER, ROAD_TOP, ROAD_CENTER, ROAD_BOTTOM } from './World';
import type { BossType, ComponentKey, ZombieType } from './World';
import { getRun, setRun } from './RunState';

const H = 600;

/**
 * Contratto che GameScene espone al boss: capacità di scena (Phaser) + i pochi sistemi/azioni
 * di gioco che il duello col boss deve toccare. Tenerlo esplicito documenta l'accoppiamento e
 * mantiene il boss isolabile.
 */
export interface BossHost extends Phaser.Scene {
  designW: number;
  vehicle: Phaser.Physics.Arcade.Sprite;
  zombies: Phaser.Physics.Arcade.Group;
  toxicClouds: Phaser.Physics.Arcade.Group;
  sfx: SoundManager | null;
  environment: Environment | null;
  addKillScore(base: number): void;
  dealDamage(amount: number): void;
  killBullet(b: Phaser.Physics.Arcade.Sprite): void;
  damageComponent(key: ComponentKey, amount: number): void;
  hitStop(ms: number): void;
  triggerMissionComplete(): void;
  spawnToxicCloud(x: number, y: number): void;
  spawnHitParticles(x: number, y: number): void;
  emitSparks(x: number, y: number): void;
  spawnZombieAt(type: ZombieType, x: number, y: number): void;
}

/**
 * Sottosistema BOSS (estratto da GameScene per coesione): apparizione, movimento/attacchi per tipo,
 * barra HP dedicata, danni, morte con VFX-firma. Possiede il proprio stato e i propri gruppi fisici
 * (`group` = corpo boss, `projectiles` = proiettili). GameScene delega `update`/collisioni e legge
 * lo stato via i getter `active`/`spawned`/`defeated`.
 */
export default class BossController {
  private host: BossHost;
  readonly group: Phaser.Physics.Arcade.Group;
  readonly projectiles: Phaser.Physics.Arcade.Group;

  private _active = false;
  private _spawned = false;
  private _defeated = false; // ~2.2s di celebrazione: GameScene congela mondo e danni
  private sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private maxHp = 0;
  private phase2 = false; // true sotto il 40% HP: attacchi più frequenti (G4)
  private hudObjects: Phaser.GameObjects.GameObject[] = [];
  private hudFill?: Phaser.GameObjects.Rectangle;
  private hudLabel?: Phaser.GameObjects.Text; // etichetta col nome boss (ri-traducibile)
  private hudNameKey = '';                     // chiave i18n del nome boss corrente

  constructor(host: BossHost) {
    this.host = host;
    this.group = host.physics.add.group();
    this.projectiles = host.physics.add.group();
  }

  get active() { return this._active; }
  get spawned() { return this._spawned; }
  get defeated() { return this._defeated; }

  spawn() {
    const host = this.host;
    this._spawned = true;
    this._active = true;
    this.phase2 = false;

    const missionNum: number = getRun(host.registry, 'missionNumber') ?? 1;
    const bossType = BOSS_ORDER[(missionNum - 1) % BOSS_ORDER.length]!;
    const cfg = BOSS_CONFIG[bossType];
    // Scaling NG+ (G2/B4): gli HP del boss crescono di 0.2 a ogni ciclo di 7 regioni, come gli zombi
    // (stessa formula di GameScene.difficultyMult — tenerle in sync).
    const diff = 1 + 0.2 * Math.floor((missionNum - 1) / 7);
    this.maxHp = Math.round(cfg.hp * diff);

    // Alert
    const warn = Ui.text(host, host.designW / 2, H / 2, t('boss.warn', { name: t(cfg.name).toUpperCase() }), {
      fontSize: '28px', color: '#ff4400', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(28).setAlpha(0);
    host.tweens.add({
      targets: warn, alpha: 1, duration: 250, yoyo: true, hold: 800,
      onComplete: () => {
        host.tweens.add({ targets: warn, alpha: 0, y: H / 2 - 60, duration: 1200, onComplete: () => warn.destroy() });
      },
    });
    host.cameras.main.shake(300, 0.016);
    host.sfx?.playBossWarn(); // stinger di apparizione dedicato (AU5) invece del boato generico

    // Sprite boss (texture + animazione dedicate per ciascun tipo)
    const texKey = `boss_${bossType}`;
    const boss = this.group.create(host.designW + 90, ROAD_CENTER, texKey) as Phaser.Physics.Arcade.Sprite;
    boss.setScale(cfg.scaleX / OVERSAMPLE, cfg.scaleY / OVERSAMPLE).setDepth(12);
    boss.play(`walk_${texKey}`);
    boss.setData('bossType', bossType);
    boss.setData('hp', this.maxHp);
    // PRIMO attacco rapido e leggibile. Col timer iniziale al valore pieno dell'intervallo il boss
    // restava passivo per un ciclo intero all'apparizione (mega_mutant: ~8s) mentre avanzava — e
    // durante il duello gli spawn ordinari sono sospesi (GameScene.updateZombieSpawning/Giant), quindi
    // la strada era vuota → sembrava che "i boss non attaccassero". Diamo il primo colpo ~1.2s dopo lo
    // spawn (coincide con la fine del banner "BOSS"); la cadenza a regime resta nei reset per-tipo di update().
    boss.setData('timer1', 1200);
    boss.setData('lastVehicleHit', 0);
    (boss.body as Phaser.Physics.Arcade.Body).setSize(cfg.bodyW, cfg.bodyH);
    this.sprite = boss;

    this.showHud(cfg.name);
  }

  update(delta: number) {
    if (!this.sprite || !this._active) return;
    const host = this.host;
    const boss = this.sprite;
    if (!boss.active) { this._active = false; return; }

    const bossType = boss.getData('bossType') as BossType;
    const cfg = BOSS_CONFIG[bossType];
    const body = boss.body as Phaser.Physics.Arcade.Body;
    const targetX = 560;

    // Avanzamento e stop
    if (boss.x > targetX) {
      body.setVelocityX(-cfg.speed);
    } else {
      body.setVelocityX(0);
      boss.x = targetX;
    }

    // Comportamento per tipo. In 2ª fase (G4) il timer si scarica più in fretta → attacchi più
    // frequenti, senza toccare i valori di reset di ogni caso.
    const t1 = (boss.getData('timer1') as number) - delta * (this.phase2 ? 1.8 : 1);
    boss.setData('timer1', t1);

    switch (bossType) {
      case 'mega_mutant':
        boss.y = Phaser.Math.Linear(boss.y, ROAD_CENTER + Math.sin(host.time.now / 800) * 90, 0.04);
        if (t1 <= 0) {
          boss.setData('timer1', 8000);
          host.spawnZombieAt('common', host.designW - 80, boss.y - 44);
          host.spawnZombieAt('common', host.designW - 80, boss.y + 44);
        }
        break;

      case 'giant_worm':
        boss.y = Phaser.Math.Linear(boss.y, ROAD_CENTER + Math.sin(host.time.now / 600) * 105, 0.05);
        if (t1 <= 0) {
          boss.setData('timer1', 4000);
          host.spawnToxicCloud(boss.x - 24, boss.y);
        }
        break;

      case 'armored_colossus':
        boss.y = Phaser.Math.Linear(boss.y, ROAD_CENTER, 0.03);
        if (t1 <= 0) {
          boss.setData('timer1', 3000);
          this.fireProjectile(boss.x - 32, boss.y);
        }
        break;

      case 'radioactive_beast':
        boss.y = Phaser.Math.Linear(boss.y, ROAD_CENTER + Math.sin(host.time.now / 700) * 75, 0.04);
        if (t1 <= 0) {
          boss.setData('timer1', 2500);
          host.spawnToxicCloud(boss.x - 10, boss.y);
          if (Math.random() < 0.5)
            host.spawnToxicCloud(boss.x + 20, boss.y + Phaser.Math.Between(-40, 40));
        }
        break;
    }

    boss.y = Phaser.Math.Clamp(boss.y, ROAD_TOP + 40, ROAD_BOTTOM - 40);

    // 2ª fase sotto il 40% HP (G4): telegrafo + attacchi più fitti (vedi drain sopra).
    const hp = boss.getData('hp') as number;
    if (!this.phase2 && hp > 0 && hp <= this.maxHp * 0.4) this.enterPhase2(boss);

    // Aggiorna barra HP (rispetta il toggle daltonismo come le barre dell'HUD principale — REG6).
    if (this.hudFill) {
      this.hudFill.displayWidth = Math.max(0, (hp / this.maxHp) * 440);
      const pct = hp / this.maxHp;
      this.hudFill.setFillStyle(Settings.colorblind
        ? (pct < 0.25 ? 0xff7a2a : pct < 0.55 ? 0xffd23a : 0x3a9bff)
        : (pct < 0.25 ? 0xff2200 : pct < 0.55 ? 0xff8800 : 0xcc0000));
    }
  }

  /** Ingresso in 2ª fase (G4): telegrafo visivo/sonoro; gli attacchi accelerano (vedi `update`). */
  private enterPhase2(boss: Phaser.Physics.Arcade.Sprite) {
    this.phase2 = true;
    const host = this.host;
    host.cameras.main.shake(260, 0.012);
    host.sfx?.playExplosion();
    boss.setTintFill(0xff3030);
    host.time.delayedCall(180, () => { if (boss.active) boss.clearTint(); });
    const fury = Ui.text(host, boss.x, boss.y - 60, t('boss.fury'), {
      fontSize: '20px', color: '#ff4422', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(28);
    host.tweens.add({ targets: fury, alpha: 0, y: fury.y - 30, duration: 1100, onComplete: () => fury.destroy() });
  }

  private fireProjectile(x: number, fromY: number) {
    const host = this.host;
    const p = this.projectiles.create(x, fromY, 'bullet') as Phaser.Physics.Arcade.Sprite;
    const dy = Phaser.Math.Clamp(host.vehicle.y - fromY, -80, 80);
    p.setVelocityX(-200).setVelocityY(dy);
    // Texture sovracampionata → scala ÷OVERSAMPLE e body ×OVERSAMPLE (visivo + hitbox
    // identici a prima). flipX: la punta segue la direzione di volo (verso sinistra).
    p.setScale(2.4 / OVERSAMPLE, 1.6 / OVERSAMPLE).setFlipX(true).setTint(0x8844ff).setDepth(9);
    (p.body as Phaser.Physics.Arcade.Body).setSize(16 * OVERSAMPLE, 6 * OVERSAMPLE);
  }

  onBulletHit(bullet: Phaser.Physics.Arcade.Sprite, boss: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !boss.active) return;
    const dmg = (bullet.getData('damage') as number) ?? 1;
    this.host.killBullet(bullet); // pool (P1) invece di destroy
    this.damageBoss(boss, dmg);
    // Flash bianco pieno sull'impatto (la texture ha la palette cotta, niente tinta da ripristinare).
    boss.setTintFill(0xffffff);
    this.host.time.delayedCall(60, () => { if (boss?.active) boss.clearTint(); });
  }

  onRocketHit(rocket: Phaser.Physics.Arcade.Sprite, boss: Phaser.Physics.Arcade.Sprite) {
    if (!rocket.active || !boss.active) return;
    const host = this.host;
    const rx = rocket.x, ry = rocket.y;
    rocket.destroy();
    this.damageBoss(boss, WEAPONS.rockets.damage * 3);
    host.spawnHitParticles(rx, ry);
    host.spawnHitParticles(rx + 10, ry - 8);
    host.environment?.addDecal('scorch', rx, ry);
    Juice.lightFlash(host, rx, ry, 0xff8a33, 4);
    host.sfx?.playExplosion();
    host.cameras.main.shake(120, 0.009);
  }

  onVehicleHit(boss: Phaser.Physics.Arcade.Sprite) {
    if (!boss.active) return;
    const host = this.host;
    const lastHit = (boss.getData('lastVehicleHit') as number) ?? 0;
    if (host.time.now - lastHit < 800) return;
    boss.setData('lastVehicleHit', host.time.now);
    host.dealDamage(20); // M2/M3: la stangata del boss è danno-scafo (Salute); 'armor' componente rimosso
    host.cameras.main.shake(200, 0.016);
    host.sfx?.playExplosion();
  }

  onProjectileHitVehicle(p: Phaser.Physics.Arcade.Sprite) {
    if (!p.active) return;
    const host = this.host;
    p.destroy();
    host.dealDamage(12);
    host.damageComponent('turret', 8);
    host.cameras.main.shake(90, 0.006);
    host.sfx?.playImpact();
  }

  private damageBoss(boss: Phaser.Physics.Arcade.Sprite, amount: number) {
    const hp = (boss.getData('hp') as number) - amount;
    boss.setData('hp', hp);
    if (hp <= 0) this.kill();
  }

  private kill() {
    if (!this.sprite || !this._active) return;
    const host = this.host;
    this._active = false;
    this._defeated = true; // celebrazione: mondo congelato e invulnerabilità fino a triggerMissionComplete
    const bossType = this.sprite.getData('bossType') as BossType;
    const cfg = BOSS_CONFIG[bossType];
    const bx = this.sprite.x, by = this.sprite.y;

    this.sprite.destroy();
    this.sprite = null;
    // Ripulisci i pericoli residui del boss: proiettili in volo e nubi tossiche non devono più
    // colpire dopo la sua morte (X4).
    this.projectiles.clear(true, true);
    host.toxicClouds.clear(true, true);
    host.cameras.main.shake(500, 0.022);
    host.hitStop(70);
    this.deathFx(bossType, bx, by); // sequenza di morte dedicata per tipo

    const earned = cfg.reward;
    host.addKillScore(500);
    setRun(host.registry, 'money', (getRun(host.registry, 'money') ?? 0) + earned);
    this.hideHud();

    const vt = Ui.text(host, host.designW / 2, H / 2 - 10, t('boss.defeated', { n: earned }), {
      fontSize: '24px', color: '#ffee00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(28);
    host.tweens.add({ targets: vt, alpha: 0, y: H / 2 - 80, duration: 2200, onComplete: () => vt.destroy() });
    host.sfx?.playMissionComplete();

    host.time.delayedCall(2200, () => host.triggerMissionComplete());
  }

  /**
   * Sequenza di morte DEDICATA per ogni boss (Standard AAA: VFX + suono + schermo
   * sincronizzati). Tutto fire-and-forget (immagini tinte che si auto-distruggono):
   * nessun emitter persistente, nessun impatto sul gameplay.
   */
  private deathFx(bossType: BossType, x: number, y: number) {
    const host = this.host;
    const cfg = BOSS_CONFIG[bossType];
    // Base condivisa: lampo bianco + alone nel colore-firma + boato-firma + scoppi a catena.
    Juice.flash(host, 0xffffff, 0.5, 140);
    Juice.lightFlash(host, x, y, cfg.tint, 8, 480);
    Juice.bloomBurst(host, x, y, cfg.tint, 3, 320);
    host.sfx?.playBossDeath(bossType);               // timbro di morte dedicato al tipo
    for (let i = 0; i < 6; i++) {
      host.time.delayedCall(i * 120, () => {
        host.spawnHitParticles(x + Phaser.Math.Between(-44, 44), y + Phaser.Math.Between(-34, 34));
        if (i % 2 === 0) host.sfx?.playExplosion();   // ~3 boati: lasciano respiro al timbro-firma
      });
    }

    switch (bossType) {
      case 'mega_mutant': {
        // La Madre: la sacca si rompe e SPUTA LA COVATA (zombi-immagine che schizzano via).
        Juice.bloomBurst(host, x, y, 0xff3020, 3.6, 420);
        for (let i = 0; i < 5; i++) {
          host.time.delayedCall(50 + i * 70, () => {
            const a = -Math.PI / 2 + Phaser.Math.FloatBetween(-1.1, 1.1);
            const sp = Phaser.Math.Between(70, 150);
            const z = host.add.image(x, y, 'zombie_common', 0).setDepth(14)
              .setScale(0.42).setFlipX(Math.random() < 0.5);
            host.tweens.add({
              targets: z, x: x + Math.cos(a) * sp, y: y - Math.abs(Math.sin(a)) * sp * 0.5 + 120,
              angle: Phaser.Math.Between(-360, 360), alpha: 0, scale: 0.12,
              duration: 760, ease: 'Quad.easeOut', onComplete: () => z.destroy(),
            });
            this.spawnDebris(x, y, 'particle', { tint: 0xff3020, n: 4, scale: 0.5, spread: 130 });
          });
        }
        break;
      }
      case 'giant_worm': {
        // Il Divoratore: il corpo si SFALDA NEI SEGMENTI, schizzati di lato.
        this.spawnDebris(x, y, 'particle', { tint: 0x9a5a2e, n: 9, scale: 1.2, spread: 175, dir: 0.5, gravity: 80,  dur: 780, spin: 200 });
        this.spawnDebris(x, y, 'particle', { tint: 0xff7722, n: 5, scale: 0.6, spread: 150, dir: 0.6, gravity: 60 });
        this.spawnDebris(x, y, 'particle', { tint: 0x5a2e14, n: 5, scale: 0.85, spread: 125, dir: 0.5, gravity: 115 });
        break;
      }
      case 'armored_colossus': {
        // Il Bastione: la corazza ESPLODE IN SCHEGGE METALLICHE + scintille (impatto più pesante).
        host.cameras.main.shake(220, 0.02);
        for (let i = 0; i < 4; i++)
          host.time.delayedCall(i * 90, () => host.emitSparks(x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-30, 30)));
        this.spawnDebris(x, y, 'particle', { tint: 0x5f6b78, n: 8, scale: 0.95, spread: 160, gravity: 130, dur: 820, spin: 260 });
        this.spawnDebris(x, y, 'particle', { tint: 0x8a97a5, n: 5, scale: 0.6,  spread: 140, gravity: 120 });
        this.spawnDebris(x, y, 'particle', { tint: 0xffe9a0, n: 6, scale: 0.4,  spread: 185, gravity: 40, dur: 380 });
        break;
      }
      case 'radioactive_beast': {
        // Il Reattore: FUSIONE DEL NUCLEO — vampata verde + nubi radioattive (solo visive).
        Juice.lightFlash(host, x, y, 0x7dff4a, 11, 560);
        Juice.bloomBurst(host, x, y, 0xb6ff6a, 4, 480);
        this.spawnDebris(x, y, 'particle', { tint: 0x6cff3a, n: 10, scale: 0.6, spread: 190, gravity: 30, dur: 520 });
        ([[0,0,1.8],[-30,-12,1.2],[34,8,1.3],[4,24,1.1]] as [number,number,number][]).forEach(([dx,dy,sc], i) =>
          host.time.delayedCall(i * 80, () => {
            const c = host.add.image(x + dx, y + dy, 'toxic_cloud').setDepth(13).setScale(sc * 0.5).setAlpha(0.9);
            host.tweens.add({ targets: c, scale: sc * 1.8, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
          }));
        break;
      }
    }
  }

  /** Detriti fire-and-forget: immagini tinte che schizzano e svaniscono (no fisica, no danno). */
  private spawnDebris(
    x: number, y: number, texKey: string,
    opts: { tint?: number; n?: number; scale?: number; spread?: number; gravity?: number; dir?: number; dur?: number; depth?: number; spin?: number } = {},
  ) {
    const host = this.host;
    const { tint, n = 6, scale = 0.5, spread = 120, gravity = 90, dir = 0, dur = 700, depth = 14, spin = 0 } = opts;
    for (let i = 0; i < n; i++) {
      // dir 0 = scoppio radiale · dir>0 = bias orizzontale (es. verme che si sfalda di lato)
      const a = dir > 0
        ? (Math.random() < 0.5 ? 0 : Math.PI) + Phaser.Math.FloatBetween(-dir, dir)
        : Math.random() * Math.PI * 2;
      const sp = Phaser.Math.Between(spread * 0.4, spread);
      const p = host.add.image(x, y, texKey).setDepth(depth).setScale(scale * Phaser.Math.FloatBetween(0.7, 1.3));
      if (tint !== undefined) p.setTint(tint);
      host.tweens.add({
        targets: p,
        x: x + Math.cos(a) * sp,
        y: y + Math.sin(a) * sp * 0.6 + gravity,
        alpha: 0, scale: 0.06,
        angle: spin ? Phaser.Math.Between(-spin, spin) : 0,
        duration: dur + Phaser.Math.Between(-120, 120),
        ease: 'Quad.easeOut', onComplete: () => p.destroy(),
      });
    }
  }

  private showHud(name: string) {
    const host = this.host;
    const cx = host.designW / 2, barW = 440, y = 96;
    const bg    = host.add.rectangle(cx, y, barW + 8, 20, UI.black, 0.85).setDepth(22).setAlpha(0);
    const fill  = host.add.rectangle(cx - barW / 2, y, barW, 14, UI.redCrit).setOrigin(0, 0.5).setDepth(23).setAlpha(0);
    const label = Ui.text(host, cx, y - 14, t(name).toUpperCase(), {
      fontSize: '13px', color: UI.red, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(23).setAlpha(0);

    this.hudObjects = [bg, fill, label];
    this.hudFill = fill;
    this.hudLabel = label;
    this.hudNameKey = name;
    host.tweens.add({ targets: this.hudObjects, alpha: 1, duration: 400 });
  }

  /** Ri-traduce l'etichetta della barra HP del boss (cambio lingua a partita in pausa). */
  refreshLanguage() {
    this.hudLabel?.setText(t(this.hudNameKey).toUpperCase());
  }

  private hideHud() {
    if (!this.hudObjects.length) return;
    this.host.tweens.add({
      targets: this.hudObjects, alpha: 0, duration: 500,
      onComplete: () => {
        this.hudObjects.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
        this.hudObjects = [];
        this.hudFill = undefined;
      },
    });
  }
}
