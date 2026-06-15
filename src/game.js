import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene';
import GameScene from './scenes/GameScene';
import ShopScene from './scenes/ShopScene';
import DebugScene from './scenes/DebugScene';
import SettingsScene from './scenes/SettingsScene';
export default class Game {
    start() {
        const config = {
            type: Phaser.AUTO,
            backgroundColor: '#12121e',
            parent: 'game-container',
            width: 800,
            height: 600,
            scene: [MenuScene, GameScene, ShopScene, DebugScene, SettingsScene],
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
//# sourceMappingURL=game.js.map