import Phaser from 'phaser';
import { VEHICLES, VEHICLE_KEYS, SURVIVORS, WEAPONS, WEAPON_KEYS } from '../GameData';
const W = 800, H = 600;
const SHOP_ITEMS = [
    { key: 'repair', label: 'Ripara tutto', cost: 80, desc: 'Tutti i componenti tornano al 100%', oneTime: false },
    { key: 'armor', label: 'Corazza rinforzata', cost: 150, desc: 'Danno ricevuto ridotto (-20%)', oneTime: true },
    { key: 'engine', label: 'Motore potenziato', cost: 120, desc: 'Velocità verticale +15%', oneTime: true },
    { key: 'turret', label: 'Torretta migliorata', cost: 100, desc: 'Cadenza di fuoco +25%', oneTime: true },
    { key: 'fuelTank', label: 'Serbatoio extra', cost: 80, desc: 'Carburante massimo +30', oneTime: true },
];
export default class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
        this.money = 0;
        this.upgrades = {};
        this.currentWeapon = 'mg';
        this.ownedWeapons = ['mg'];
        this.currentVehicle = 'civilian_car';
        this.ownedVehicles = ['civilian_car'];
        this.survivors = [];
        this.missionNum = 2;
        this.offeredSurvivors = [];
    }
    create() {
        this.money = this.registry.get('money') ?? 0;
        this.upgrades = { ...(this.registry.get('upgrades') ?? {}) };
        this.currentVehicle = this.registry.get('vehicle') ?? 'civilian_car';
        this.ownedVehicles = this.registry.get('ownedVehicles') ?? ['civilian_car'];
        this.survivors = this.registry.get('survivors') ?? [];
        this.missionNum = this.registry.get('missionNumber') ?? 2;
        this.currentWeapon = this.registry.get('currentWeapon') ?? 'mg';
        this.ownedWeapons = this.registry.get('ownedWeapons') ?? ['mg'];
        const available = SURVIVORS.filter(s => !this.survivors.includes(s.key));
        this.offeredSurvivors = Phaser.Utils.Array.Shuffle([...available]).slice(0, 3);
        this.drawUI();
    }
    drawUI() {
        // Background
        this.add.rectangle(W / 2, H / 2, W, H, 0x080810);
        this.add.rectangle(W / 2, 32, W, 64, 0x0e0e22);
        this.add.text(W / 2, 8, `GARAGE  —  Fine Missione ${this.missionNum - 1}`, {
            fontSize: '20px', color: '#88ff88', fontStyle: 'bold',
        }).setOrigin(0.5, 0);
        this.moneyText = this.add.text(W - 12, 8, `★ ${this.money} monete`, {
            fontSize: '18px', color: '#ffee44',
        }).setOrigin(1, 0);
        this.add.text(W / 2, 46, `Missione successiva: ${this.missionNum}`, {
            fontSize: '12px', color: '#555577',
        }).setOrigin(0.5, 0);
        this.drawDivider(66);
        this.drawUpgradesPanel();
        this.drawWeaponsPanel();
        this.drawSurvivorsPanel();
        this.drawDivider(418);
        this.drawVehiclesPanel();
        this.drawContinueButton();
    }
    drawDivider(y) {
        this.add.rectangle(W / 2, y, W, 1, 0x222244);
    }
    // ─── Upgrades panel (left) ───────────────────────────────────────────────────
    drawUpgradesPanel() {
        const px = 14, py = 76;
        this.add.text(px, py, 'POTENZIAMENTI', { fontSize: '13px', color: '#aaaaff', fontStyle: 'bold' });
        SHOP_ITEMS.forEach((item, i) => {
            const iy = py + 22 + i * 48;
            const bought = item.oneTime && !!this.upgrades[item.key];
            const canAfford = !bought && this.money >= item.cost;
            const bgColor = bought ? 0x0e1e0e : 0x0e0e1a;
            const bg = this.add.rectangle(px + 220, iy + 18, 440, 42, bgColor).setOrigin(0.5);
            if (!bought) {
                bg.setInteractive({ useHandCursor: canAfford });
                bg.on('pointerover', () => { if (canAfford)
                    bg.setFillStyle(0x181830); });
                bg.on('pointerout', () => bg.setFillStyle(bgColor));
                bg.on('pointerdown', () => { if (canAfford)
                    this.buyItem(item); });
            }
            const lc = bought ? '#446644' : canAfford ? '#dddddd' : '#554444';
            this.add.text(px + 6, iy + 6, item.label, { fontSize: '13px', color: lc, fontStyle: 'bold' });
            this.add.text(px + 6, iy + 24, item.desc, { fontSize: '10px', color: '#555566' });
            if (bought) {
                this.add.text(px + 432, iy + 15, '✓', { fontSize: '13px', color: '#446644' }).setOrigin(1, 0.5);
            }
            else {
                this.add.text(px + 432, iy + 15, `★ ${item.cost}`, { fontSize: '13px', color: canAfford ? '#ffee44' : '#663333' }).setOrigin(1, 0.5);
            }
        });
    }
    drawWeaponsPanel() {
        const px = 14, py = 322;
        this.drawDivider(py - 4);
        this.add.text(px, py, 'ARMI', { fontSize: '13px', color: '#ff9944', fontStyle: 'bold' });
        WEAPON_KEYS.forEach((key, i) => {
            const w = WEAPONS[key];
            const wx = px + i * 88;
            const owned = this.ownedWeapons.includes(key);
            const selected = this.currentWeapon === key;
            const canBuy = !owned && this.money >= w.price;
            const bgColor = selected ? 0x1a1200 : owned ? 0x0e0e0e : 0x080808;
            const bg = this.add.rectangle(wx + 40, py + 46, 82, 72, bgColor).setOrigin(0.5)
                .setInteractive({ useHandCursor: owned || canBuy });
            // Icona colore arma
            this.add.rectangle(wx + 40, py + 22, 50, 8, w.color).setOrigin(0.5);
            this.add.text(wx + 40, py + 32, w.name, { fontSize: '8px', color: owned ? '#cccccc' : '#444444', wordWrap: { width: 78 }, align: 'center' }).setOrigin(0.5, 0);
            if (owned) {
                this.add.text(wx + 40, py + 68, selected ? '● ATTIVA' : 'Usa', { fontSize: '9px', color: selected ? '#ffcc44' : '#4488ff' }).setOrigin(0.5);
                if (!selected) {
                    bg.on('pointerover', () => bg.setFillStyle(0x1a1400));
                    bg.on('pointerout', () => bg.setFillStyle(bgColor));
                    bg.on('pointerdown', () => this.selectWeapon(key));
                }
            }
            else {
                this.add.text(wx + 40, py + 56, `★${w.price}`, { fontSize: '10px', color: canBuy ? '#ffee44' : '#443333' }).setOrigin(0.5);
                this.add.text(wx + 40, py + 70, canBuy ? 'COMPRA' : '🔒', { fontSize: '9px', color: canBuy ? '#ffaa00' : '#333333' }).setOrigin(0.5);
                if (canBuy) {
                    bg.on('pointerover', () => bg.setFillStyle(0x1a1000));
                    bg.on('pointerout', () => bg.setFillStyle(bgColor));
                    bg.on('pointerdown', () => this.buyWeapon(key));
                }
            }
        });
        // Descrizione arma attiva
        this.add.text(px, py + 92, `▸ ${WEAPONS[this.currentWeapon].desc}`, { fontSize: '10px', color: '#888866' });
    }
    // ─── Survivors panel (right) ─────────────────────────────────────────────────
    drawSurvivorsPanel() {
        const px = 490, py = 76;
        this.add.text(px, py, 'SOPRAVVISSUTI', { fontSize: '13px', color: '#ffcc44', fontStyle: 'bold' });
        // Recruited list
        if (this.survivors.length > 0) {
            this.add.text(px, py + 22, 'Nel veicolo:', { fontSize: '11px', color: '#777755' });
            this.survivors.forEach((key, i) => {
                const s = SURVIVORS.find(sv => sv.key === key);
                if (s)
                    this.add.text(px + 6, py + 36 + i * 16, `• ${s.name}`, { fontSize: '12px', color: s.color });
            });
        }
        // Offered survivors
        const rY = py + 24 + Math.max(this.survivors.length, 0) * 16 + 24;
        this.add.text(px, rY, this.offeredSurvivors.length > 0 ? 'Recluta (scegli 1):' : 'Nessuno disponibile', { fontSize: '11px', color: '#777755' });
        this.offeredSurvivors.forEach((s, i) => {
            const iy = rY + 18 + i * 74;
            const alreadyIn = this.survivors.includes(s.key);
            const bg = this.add.rectangle(px + 145, iy + 30, 290, 66, 0x131310).setOrigin(0.5);
            if (!alreadyIn) {
                bg.setInteractive({ useHandCursor: true });
                bg.on('pointerover', () => bg.setFillStyle(0x1e1e14));
                bg.on('pointerout', () => bg.setFillStyle(0x131310));
                bg.on('pointerdown', () => this.recruitSurvivor(s.key));
            }
            this.add.text(px + 6, iy + 8, s.name, { fontSize: '14px', color: s.color, fontStyle: 'bold' });
            this.add.text(px + 6, iy + 28, s.ability, { fontSize: '10px', color: '#666655' });
            this.add.text(px + 6, iy + 46, alreadyIn ? 'GIÀ RECLUTATO' : 'GRATIS', { fontSize: '11px', color: alreadyIn ? '#446644' : '#44cc44' });
        });
    }
    // ─── Vehicles panel (bottom) ─────────────────────────────────────────────────
    drawVehiclesPanel() {
        const py = 428;
        this.add.text(14, py, 'VEICOLI', { fontSize: '13px', color: '#88aaff', fontStyle: 'bold' });
        VEHICLE_KEYS.forEach((key, i) => {
            const v = VEHICLES[key];
            const vx = 14 + i * 112;
            const owned = this.ownedVehicles.includes(key);
            const selected = this.currentVehicle === key;
            const canBuy = !owned && this.money >= v.price;
            const bgColor = selected ? 0x0e1e2e : owned ? 0x0e0e1e : 0x08080e;
            const bg = this.add.rectangle(vx + 50, py + 66, 106, 96, bgColor).setOrigin(0.5)
                .setInteractive({ useHandCursor: owned || canBuy });
            // Vehicle color swatch
            this.add.rectangle(vx + 50, py + 32, 76, 18, v.color).setOrigin(0.5);
            this.add.text(vx + 50, py + 44, v.name, {
                fontSize: '8px', color: owned ? '#cccccc' : '#444444', wordWrap: { width: 100 },
            }).setOrigin(0.5, 0);
            if (owned) {
                this.add.text(vx + 50, py + 82, selected ? '● ATTIVO' : 'Usa', { fontSize: '10px', color: selected ? '#88ff44' : '#4488ff' }).setOrigin(0.5);
                if (!selected) {
                    bg.on('pointerover', () => bg.setFillStyle(0x14142a));
                    bg.on('pointerout', () => bg.setFillStyle(bgColor));
                    bg.on('pointerdown', () => this.selectVehicle(key));
                }
            }
            else {
                this.add.text(vx + 50, py + 74, `★ ${v.price}`, { fontSize: '11px', color: canBuy ? '#ffee44' : '#444444' }).setOrigin(0.5);
                this.add.text(vx + 50, py + 92, canBuy ? 'COMPRA' : 'BLOCCATO', { fontSize: '9px', color: canBuy ? '#ffcc00' : '#333333' }).setOrigin(0.5);
                if (canBuy) {
                    bg.on('pointerover', () => bg.setFillStyle(0x141420));
                    bg.on('pointerout', () => bg.setFillStyle(bgColor));
                    bg.on('pointerdown', () => this.buyVehicle(key));
                }
            }
        });
    }
    // ─── Continue button ─────────────────────────────────────────────────────────
    drawContinueButton() {
        const btn = this.add.rectangle(W / 2, H - 28, 240, 44, 0x1a3a1a)
            .setInteractive({ useHandCursor: true });
        this.add.text(W / 2, H - 28, 'CONTINUA  ▶', {
            fontSize: '20px', color: '#88ff44', fontStyle: 'bold',
        }).setOrigin(0.5);
        btn.on('pointerover', () => btn.setFillStyle(0x224422));
        btn.on('pointerout', () => btn.setFillStyle(0x1a3a1a));
        btn.on('pointerdown', () => this.continueGame());
    }
    // ─── Actions ─────────────────────────────────────────────────────────────────
    buyItem(item) {
        if (this.money < item.cost)
            return;
        this.money -= item.cost;
        this.registry.set('money', this.money);
        if (item.key === 'repair') {
            this.registry.set('components', { engine: 100, wheels: 100, tank: 100, turret: 100, armor: 100 });
        }
        else {
            this.upgrades[item.key] = true;
            this.registry.set('upgrades', { ...this.upgrades });
        }
        this.scene.restart();
    }
    recruitSurvivor(key) {
        if (this.survivors.includes(key))
            return;
        this.registry.set('survivors', [...this.survivors, key]);
        this.scene.restart();
    }
    selectVehicle(key) {
        this.registry.set('vehicle', key);
        this.scene.restart();
    }
    buyVehicle(key) {
        const v = VEHICLES[key];
        if (this.money < v.price || this.ownedVehicles.includes(key))
            return;
        this.money -= v.price;
        const newOwned = [...this.ownedVehicles, key];
        this.registry.set('money', this.money);
        this.registry.set('ownedVehicles', newOwned);
        this.registry.set('vehicle', key);
        this.scene.restart();
    }
    selectWeapon(key) {
        this.registry.set('currentWeapon', key);
        this.scene.restart();
    }
    buyWeapon(key) {
        const w = WEAPONS[key];
        if (this.money < w.price || this.ownedWeapons.includes(key))
            return;
        this.money -= w.price;
        const newOwned = [...this.ownedWeapons, key];
        this.registry.set('money', this.money);
        this.registry.set('ownedWeapons', newOwned);
        this.registry.set('currentWeapon', key);
        this.scene.restart();
    }
    continueGame() {
        this.scene.start('GameScene');
    }
}
//# sourceMappingURL=ShopScene.js.map