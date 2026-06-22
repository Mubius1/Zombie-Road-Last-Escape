import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene';
import GameScene from './scenes/GameScene';
import ShopScene from './scenes/ShopScene';
import DebugScene from './scenes/DebugScene';
import SettingsScene from './scenes/SettingsScene';
import PauseScene from './scenes/PauseScene';
import RouteScene from './scenes/RouteScene';
import { currentResolution } from './Config';
import { PIPELINES } from './PostFx';

export default class Game {
  private game?: Phaser.Game;

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
      scene: [MenuScene, GameScene, ShopScene, RouteScene, DebugScene, SettingsScene, PauseScene],
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

    this.game = new Phaser.Game(config);
  }
}
