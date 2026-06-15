import Phaser from 'phaser';
import Juice from '../Juice';
import Settings from '../Settings';
import SoundManager from '../SoundManager';
import Ui, { UI, MENU_VIGNETTE } from '../Ui';
import { setupCamera, DESIGN_W, RESOLUTIONS, currentResolution } from '../Config';
const H = 600;
const VOL_STEPS = 10;
/**
 * Schermata Impostazioni. Due modi d'uso:
 *  · da MENU      → scena a sé, "INDIETRO" torna al menu.
 *  · da PARTITA   → overlay di pausa (ESC in GameScene), "RIPRENDI" riprende il gioco
 *                   sopra la scena congelata; in più "Esci al menu" abbandona la partita.
 *
 * Preferenze persistenti (vedi src/Settings.ts):
 *  · Volume audio  — barra a 10 segmenti + muto, con anteprima sonora.
 *  · Effetti schermo — overlay filmico (vignetta + grana + scanline) on/off.
 */
export default class SettingsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SettingsScene' });
        this.fromKey = 'MenuScene';
        this.grain = null;
        this.volCells = [];
        /** Larghezza di design (800 in 4:3, maggiore in 16:9). */
        this.designW = DESIGN_W;
    }
    init(data) {
        this.fromKey = data?.from ?? 'MenuScene';
    }
    create() {
        this.designW = setupCamera(this).designW;
        this.volCells = [];
        const inGame = this.fromKey === 'GameScene';
        // In pausa: fondo semi-trasparente così si intravede la partita congelata.
        this.add.rectangle(this.designW / 2, H / 2, this.designW, H, UI.bg, inGame ? 0.8 : 1);
        Ui.panel(this, this.designW / 2, H / 2, 540, 480, {
            fill: UI.panel, fillAlpha: inGame ? 0.96 : 1, stroke: UI.stroke, strokeWidth: 2,
        });
        if (inGame) {
            Ui.text(this, this.designW / 2, H / 2 - 218, '❚❚  PAUSA', { fontSize: '15px', fontStyle: 'bold', color: UI.faint }).setOrigin(0.5);
        }
        Ui.text(this, this.designW / 2, H / 2 - 196, 'IMPOSTAZIONI', {
            fontSize: '34px', fontStyle: 'bold', color: UI.blue,
        }).setOrigin(0.5);
        this.buildVolume(H / 2 - 120);
        this.buildScreenFx(H / 2 - 40);
        this.buildResolution(H / 2 + 40, inGame);
        this.buildFullscreen(H / 2 + 110);
        this.buildBack(inGame);
        // L'overlay filmico proprio serve solo a scena piena (dal menu);
        // in pausa quello del gioco è già sotto.
        Juice.fadeIn(this);
        if (!inGame && Settings.screenFx)
            this.grain = Juice.addOverlay(this, 18, MENU_VIGNETTE);
    }
    update() {
        Juice.jitterGrain(this.grain);
    }
    // ─── Volume ─────────────────────────────────────────────────────────────────
    buildVolume(y) {
        const cx = this.designW / 2;
        Ui.text(this, cx - 230, y - 28, 'VOLUME AUDIO', { fontSize: '15px', fontStyle: 'bold', color: UI.goldDim });
        this.volLabel = Ui.text(this, cx + 230, y - 28, '', { fontSize: '15px', color: UI.text }).setOrigin(1, 0);
        const cellW = 38, gap = 6, total = VOL_STEPS * cellW + (VOL_STEPS - 1) * gap;
        const startX = cx - total / 2;
        for (let i = 0; i < VOL_STEPS; i++) {
            const x = startX + i * (cellW + gap) + cellW / 2;
            const cell = this.add.rectangle(x, y + 6, cellW, 30, 0x1a1a24)
                .setStrokeStyle(1, UI.strokeSoft)
                .setInteractive({ useHandCursor: true });
            cell.on('pointerdown', () => this.setVolume((i + 1) / VOL_STEPS));
            this.volCells.push(cell);
        }
        this.muteBtn = Ui.text(this, cx, y + 42, '🔇  Muto', { fontSize: '14px', color: UI.muted })
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.muteBtn.on('pointerover', () => this.muteBtn.setColor(UI.redSoft));
        this.muteBtn.on('pointerout', () => this.refreshVolume());
        this.muteBtn.on('pointerdown', () => this.setVolume(0));
        this.refreshVolume();
    }
    setVolume(v) {
        Settings.volume = v;
        this.refreshVolume();
        this.playPreview();
    }
    refreshVolume() {
        const v = Settings.volume;
        const lit = Math.round(v * VOL_STEPS);
        this.volCells.forEach((cell, i) => cell.setFillStyle(i < lit ? UI.greenCell : 0x1a1a24));
        this.volLabel.setText(v <= 0 ? 'Muto' : `${Math.round(v * 100)}%`);
        this.muteBtn.setColor(v <= 0 ? UI.red : UI.muted);
    }
    /** Suono di prova al volume scelto, così il giocatore sente il livello. */
    playPreview() {
        const webAudio = this.sound;
        if (!webAudio?.context)
            return;
        if (!this.preview)
            this.preview = new SoundManager(webAudio.context);
        this.preview.setVolume(Settings.volume);
        this.preview.playZombieKill();
    }
    // ─── Effetti schermo ─────────────────────────────────────────────────────────
    buildScreenFx(y) {
        const cx = this.designW / 2;
        Ui.text(this, cx - 230, y - 12, 'EFFETTI SCHERMO', { fontSize: '15px', fontStyle: 'bold', color: UI.cyan });
        Ui.text(this, cx - 230, y + 8, 'Vignetta · grana · scanline CRT', { fontSize: '11px', color: UI.faint });
        const on = Settings.screenFx;
        const btn = this.add.rectangle(cx + 190, y + 2, 130, 38, on ? 0x16301a : 0x301616)
            .setStrokeStyle(2, on ? UI.hpHigh : 0x995544, 0.8)
            .setInteractive({ useHandCursor: true });
        Ui.text(this, cx + 190, y + 2, on ? 'ATTIVI' : 'DISATTIVI', {
            fontSize: '16px', fontStyle: 'bold', color: on ? UI.greenSoft : UI.amberSoft,
        }).setOrigin(0.5);
        btn.on('pointerover', () => btn.setFillStyle(on ? 0x1d3d22 : 0x3d1d1d));
        btn.on('pointerout', () => btn.setFillStyle(on ? 0x16301a : 0x301616));
        btn.on('pointerdown', () => {
            Settings.screenFx = !Settings.screenFx;
            this.scene.restart({ from: this.fromKey }); // riapplica/rimuove l'overlay all'istante
        });
    }
    // ─── Risoluzione ──────────────────────────────────────────────────────────────
    buildResolution(y, inGame) {
        const cx = this.designW / 2;
        Ui.text(this, cx - 230, y - 12, 'RISOLUZIONE', { fontSize: '15px', fontStyle: 'bold', color: UI.amber });
        Ui.text(this, cx - 230, y + 8, 'Nativa · adattata allo schermo', { fontSize: '11px', color: UI.faint });
        const res = currentResolution();
        // In pausa il cambio risoluzione riallineerebbe la partita congelata sotto:
        // qui è di sola lettura, si cambia dal menu principale.
        if (inGame) {
            Ui.text(this, cx + 185, y - 4, res.label, { fontSize: '15px', color: UI.muted }).setOrigin(0.5);
            Ui.text(this, cx + 185, y + 14, 'dal menu principale', { fontSize: '9px', color: UI.faint }).setOrigin(0.5);
            return;
        }
        Ui.text(this, cx + 185, y - 5, res.label, { fontSize: '15px', fontStyle: 'bold', color: UI.blueBright }).setOrigin(0.5);
        Ui.text(this, cx + 185, y + 13, res.aspect, { fontSize: '10px', color: UI.faint }).setOrigin(0.5);
        const arrow = (x, char, dir) => {
            const a = Ui.text(this, x, y + 2, char, { fontSize: '24px', fontStyle: 'bold', color: UI.blue })
                .setOrigin(0.5).setInteractive({ useHandCursor: true });
            a.on('pointerover', () => a.setColor(UI.white));
            a.on('pointerout', () => a.setColor(UI.blue));
            a.on('pointerdown', () => this.cycleResolution(dir));
            return a;
        };
        arrow(cx + 100, '◂', -1);
        arrow(cx + 268, '▸', +1);
    }
    cycleResolution(dir) {
        const n = RESOLUTIONS.length;
        const next = ((Settings.resolution % n) + n + dir) % n;
        Settings.resolution = next;
        const r = RESOLUTIONS[next];
        this.scale.setGameSize(r.w, r.h); // cambia la risoluzione interna nativa
        this.scene.restart({ from: this.fromKey }); // ridisegna il layout alla nuova dimensione
    }
    // ─── Schermo intero ───────────────────────────────────────────────────────────
    buildFullscreen(y) {
        const cx = this.designW / 2;
        Ui.text(this, cx - 230, y - 12, 'SCHERMO INTERO', { fontSize: '15px', fontStyle: 'bold', color: UI.cyan });
        Ui.text(this, cx - 230, y + 8, 'Riempie tutto lo schermo', { fontSize: '11px', color: UI.faint });
        const draw = (on) => ({ fill: on ? 0x16301a : 0x222238, stroke: on ? UI.hpHigh : UI.blueLine });
        let on = this.scale.isFullscreen;
        const d = draw(on);
        const btn = this.add.rectangle(cx + 190, y + 2, 130, 38, d.fill)
            .setStrokeStyle(2, d.stroke, 0.8)
            .setInteractive({ useHandCursor: true });
        const lbl = Ui.text(this, cx + 190, y + 2, on ? 'ATTIVO' : 'ATTIVA', {
            fontSize: '16px', fontStyle: 'bold', color: on ? UI.greenSoft : UI.blue,
        }).setOrigin(0.5);
        btn.on('pointerover', () => btn.setFillStyle(this.scale.isFullscreen ? 0x1d3d22 : 0x2c2c48));
        btn.on('pointerout', () => btn.setFillStyle(this.scale.isFullscreen ? 0x16301a : 0x222238));
        btn.on('pointerdown', () => {
            // L'API fullscreen aggiorna isFullscreen in modo asincrono: lo stato intenzionale
            // è semplicemente l'opposto di quello attuale.
            on = !this.scale.isFullscreen;
            this.scale.toggleFullscreen();
            Settings.fullscreen = on;
            const nd = draw(on);
            btn.setFillStyle(nd.fill).setStrokeStyle(2, nd.stroke, 0.8);
            lbl.setText(on ? 'ATTIVO' : 'ATTIVA').setColor(on ? UI.greenSoft : UI.blue);
        });
    }
    // ─── Indietro / Riprendi ──────────────────────────────────────────────────────
    buildBack(inGame) {
        const by = H - 64;
        Ui.button(this, this.designW / 2, by, 220, 46, inGame ? '▶  RIPRENDI' : '◂  INDIETRO', {
            fill: 0x14141f, hover: 0x1d1d2e, border: UI.blueLine, color: UI.blue,
            onClick: () => this.goBack(),
        });
        if (inGame) {
            const exit = Ui.text(this, this.designW / 2, H - 26, 'Esci al menu principale', { fontSize: '12px', color: '#886677' })
                .setOrigin(0.5).setInteractive({ useHandCursor: true });
            exit.on('pointerover', () => exit.setColor(UI.redSoft));
            exit.on('pointerout', () => exit.setColor('#886677'));
            exit.on('pointerdown', () => this.exitToMenu());
        }
        this.input.keyboard?.on('keydown-ESC', () => this.goBack());
    }
    goBack() {
        if (this.fromKey === 'GameScene') {
            this.scene.resume('GameScene'); // riprende la partita congelata...
            this.scene.stop(); // ...e chiude l'overlay impostazioni
        }
        else {
            Juice.go(this, 'MenuScene');
        }
    }
    exitToMenu() {
        this.scene.stop('GameScene'); // abbandona la partita in corso
        Juice.go(this, 'MenuScene');
    }
}
//# sourceMappingURL=SettingsScene.js.map