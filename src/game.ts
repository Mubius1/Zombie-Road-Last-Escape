import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene';
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
      scene: [MenuScene, GameScene, StopScene, ShopScene, RouteScene, SettingsScene, PauseScene],
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
    }
  }
}
