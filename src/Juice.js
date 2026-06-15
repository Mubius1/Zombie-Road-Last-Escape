import Phaser from 'phaser';
/**
 * Sistema di "juice" condiviso: feedback tattile e coesione filmica.
 * Codifica lo "Standard di Produzione AAA" descritto in docs/ART_BIBLE_ZOMBIES.md.
 * Tutto procedurale, fire-and-forget, a 60 fps. L'hit-stop vive in GameScene
 * perché deve gateare il suo update().
 */
export default class Juice {
    // ─── Overlay filmico (vignetta + grana) ──────────────────────────────────
    /** Texture procedurali del juice (grana + alone di luce morbido) — una sola volta. */
    static buildTextures(scene) {
        if (scene.textures.exists('fx_grain'))
            return;
        // Grana / rumore di pellicola
        const S = 128;
        const g = scene.make.graphics({ add: false });
        for (let i = 0; i < 1500; i++) {
            const v = 80 + Math.floor(Math.random() * 100);
            g.fillStyle((v << 16) | (v << 8) | v, 0.25 + Math.random() * 0.4);
            g.fillRect(Math.floor(Math.random() * S), Math.floor(Math.random() * S), 1, 1);
        }
        g.generateTexture('fx_grain', S, S);
        g.destroy();
        // Alone di luce morbido (bianco): cerchi concentrici accumulati → centro acceso, bordi sfumati
        const R = 32;
        const l = scene.make.graphics({ add: false });
        for (let i = R; i >= 1; i--) {
            l.fillStyle(0xffffff, 0.05);
            l.fillCircle(R, R, i);
        }
        l.generateTexture('fx_light', R * 2, R * 2);
        l.destroy();
        // Scanline CRT: riga scura ogni 3 px (texture 4×3 da ripetere)
        const s = scene.make.graphics({ add: false });
        s.fillStyle(0x000000, 1);
        s.fillRect(0, 0, 4, 1);
        s.generateTexture('fx_scanline', 4, 3);
        s.destroy();
    }
    /**
     * Vignetta ai bordi + grana animata. Ritorna la grana (anima il tilePosition nell'update).
     * `vignette` scala la forza della vignettatura: 1 = pieno (gioco), valori più bassi per i
     * menu dove i contenuti vivono ai bordi e non devono essere mangiati dall'ombra.
     */
    static addOverlay(scene, depth = 18, vignette = 1) {
        // Dimensioni NATIVE del canvas: questi overlay sono pinnati allo schermo (scrollFactor 0)
        // e NON subiscono lo zoom della camera, quindi vanno dimensionati al canvas reale.
        const W = scene.scale.width, H = scene.scale.height;
        const ex = Math.round(W * 0.26), ey = Math.round(H * 0.26);
        const a = 0.5 * vignette, b = 0.55 * vignette;
        const v = scene.add.graphics().setScrollFactor(0).setDepth(depth);
        // 4 sfumature nere verso i bordi (gli angoli si scuriscono due volte → vignetta)
        v.fillGradientStyle(0, 0, 0, 0, a, a, 0, 0);
        v.fillRect(0, 0, W, ey); // alto
        v.fillGradientStyle(0, 0, 0, 0, 0, 0, b, b);
        v.fillRect(0, H - ey, W, ey); // basso
        v.fillGradientStyle(0, 0, 0, 0, a, 0, a, 0);
        v.fillRect(0, 0, ex, H); // sinistra
        v.fillGradientStyle(0, 0, 0, 0, 0, a, 0, a);
        v.fillRect(W - ex, 0, ex, H); // destra
        Juice.buildTextures(scene);
        // Aberrazione cromatica finta: frangia rossa a sinistra, ciano a destra (additiva, ai bordi)
        const fr = scene.add.graphics().setScrollFactor(0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
        fr.fillGradientStyle(0xff0022, 0xff0022, 0xff0022, 0xff0022, 0.07, 0, 0.07, 0);
        fr.fillRect(0, 0, 48, H);
        fr.fillGradientStyle(0x00ddff, 0x00ddff, 0x00ddff, 0x00ddff, 0, 0.07, 0, 0.07);
        fr.fillRect(W - 48, 0, 48, H);
        // Scanline CRT (sottili, sopra tutto tranne HUD)
        scene.add.tileSprite(W / 2, H / 2, W, H, 'fx_scanline')
            .setScrollFactor(0).setDepth(depth + 1).setAlpha(0.06);
        // Grana di pellicola animata (ritornata per il jitter per-frame)
        return scene.add.tileSprite(W / 2, H / 2, W, H, 'fx_grain')
            .setScrollFactor(0).setDepth(depth + 1).setAlpha(0.05);
    }
    /** Sposta la grana (chiamala ogni frame per l'effetto pellicola). */
    static jitterGrain(grain) {
        if (!grain)
            return;
        grain.tilePositionX = Math.random() * 128;
        grain.tilePositionY = Math.random() * 128;
    }
    // ─── Bagliori / flash (post-processing finto) ─────────────────────────────
    /** Lampo a schermo intero (impatti grossi: esplosioni, morte boss). */
    static flash(scene, color = 0xffffff, alpha = 0.4, ms = 120) {
        // Native: il lampo è pinnato allo schermo (scrollFactor 0), fuori dallo zoom della camera.
        const W = scene.scale.width, H = scene.scale.height;
        const r = scene.add.rectangle(W / 2, H / 2, W, H, color, alpha).setScrollFactor(0).setDepth(40);
        scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
    }
    /** Vampa di sparo additiva alla bocca dell'arma: illumina un alone davanti. */
    static muzzleFlash(scene, x, y, color = 0xffdd66) {
        const f = scene.add.image(x, y, 'fx_light').setTint(color).setDepth(17)
            .setScale(0.9).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: f, scale: 0.2, alpha: 0, duration: 80, onComplete: () => f.destroy() });
    }
    /** Bloom finto: alone additivo che si espande e svanisce (esplosioni, sorgenti emissive). */
    static bloomBurst(scene, x, y, color, size = 2.5, ms = 260) {
        const b = scene.add.image(x, y, 'fx_light').setTint(color).setDepth(17)
            .setScale(size).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: b, scale: size * 2, alpha: 0, duration: ms, onComplete: () => b.destroy() });
    }
    /**
     * Luce dinamica: un grande alone morbido che divampa e si spegne, illuminando
     * la scena attorno alla sorgente (esplosioni, morte boss). Sopra il grading,
     * sotto la vignetta — così "schiarisce" davvero l'ambiente.
     */
    static lightFlash(scene, x, y, color, scale = 5, ms = 320) {
        const light = scene.add.image(x, y, 'fx_light').setTint(color).setDepth(17)
            .setScale(scale * 0.4).setAlpha(0.95).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: light, scale, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => light.destroy() });
    }
    // ─── Transizioni di scena (niente cut secchi) ─────────────────────────────
    static fadeIn(scene, ms = 300) {
        scene.cameras.main.fadeIn(ms, 0, 0, 0);
    }
    /** Sfuma a nero, poi esegue il callback. */
    static fadeAndRun(scene, cb, ms = 320) {
        scene.cameras.main.fadeOut(ms, 0, 0, 0);
        scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, cb);
    }
    /** Sfuma a nero e avvia un'altra scena. */
    static go(scene, key, ms = 320) {
        Juice.fadeAndRun(scene, () => scene.scene.start(key), ms);
    }
}
//# sourceMappingURL=Juice.js.map