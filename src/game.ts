import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene';
import NewRunScene from './scenes/NewRunScene';
import CutsceneScene from './scenes/CutsceneScene';
import GameScene from './scenes/GameScene';
import ShopScene from './scenes/ShopScene';
import StopScene from './scenes/StopScene';
import SettingsScene from './scenes/SettingsScene';
import PauseScene from './scenes/PauseScene';
import RouteScene from './scenes/RouteScene';
import { currentResolution } from './Config';
import { PIPELINES } from './PostFx';
// NB: DebugScene NON è importata staticamente → si carica solo in sviluppo (import dinamico gated da
// `import.meta.env.DEV`, vedi sotto). In `vite build` il blocco è dead-code → la galleria debug non
// entra nemmeno nel bundle finale.

export default class Game {
  start() {
    // La risoluzione interna è quella scelta dal giocatore (Impostazioni → Config.RESOLUTIONS);
    // lo Scale Manager FIT la adatta poi a finestra/schermo intero mantenendo le proporzioni.
    const res = currentResolution();
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      backgroundColor: '#12121e',
      scale: {
        parent: 'game-container',
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: res.w,
        height: res.h,
      },
      // Gamepad: schema di input alternativo (tastiera+mouse restano il default). La Gamepad API del
      // browser non espone i pad finché l'utente non preme un tasto dopo il load → si attiva al primo input.
      input: { gamepad: true },
      scene: [MenuScene, NewRunScene, CutsceneScene, GameScene, StopScene, ShopScene, RouteScene, SettingsScene, PauseScene],
      // Post-processing GLSL (WebGL): Phaser instrada le sottoclassi PostFXPipeline
      // al registro post-pipeline al boot. Su Canvas (fallback AUTO) viene ignorato.
      // `as any`: PipelineConfig vuole `typeof WebGLPipeline`, qui passiamo le classi PostFX.
      pipeline: PIPELINES as any,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
    };

    const game = new Phaser.Game(config);

    // Galleria/strumenti di DEBUG: registrati SOLO in sviluppo. In `vite build` `import.meta.env.DEV`
    // è `false` → l'intero blocco (e l'import dinamico di DebugScene) è rimosso dal bundle finale.
    if (import.meta.env.DEV) {
      void import('./scenes/DebugScene').then(m => game.scene.add('DebugScene', m.default));
      // Hook per i test E2E automatici (tests/e2e/*, vedi docs/TESTING.md §7): espone l'istanza di gioco
      // al contesto pagina così Playwright può leggere lo stato delle scene (salute/carburante/posizione…)
      // e verificare invarianti e bounds dell'interfaccia. SOLO in DEV → `vite build` sostituisce
      // `import.meta.env.DEV` con `false` e rimuove l'intero blocco (dead-code elimination): nel gioco
      // distribuito NON esiste alcuna superficie `__ZR`.
      (globalThis as Record<string, unknown>).__ZR = game;
    }
  }
}
