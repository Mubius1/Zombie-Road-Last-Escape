import Phaser from 'phaser';
import GameScene from './scenes/GameScene';
import ShopScene from './scenes/ShopScene';
import DebugScene from './scenes/DebugScene';

export default class Game {
  private game?: Phaser.Game;

  start() {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      backgroundColor: '#12121e',
      parent: 'game-container',
      width: 800,
      height: 600,
      scene: [GameScene, ShopScene, DebugScene],
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
