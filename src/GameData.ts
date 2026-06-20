export interface VehicleData {
  name: string; price: number; color: number;
  healthBonus: number; armorBonus: number; speedMult: number; fireMult: number;
}

export const VEHICLES: Record<string, VehicleData> = {
  civilian_car:   { name: 'Auto Civile',         price:    0, color: 0x4a6fa5, healthBonus:   0, armorBonus:  0, speedMult: 1.0,  fireMult: 1.0 },
  pickup:         { name: 'Pickup',               price:  300, color: 0x8B4513, healthBonus:  20, armorBonus: 10, speedMult: 1.0,  fireMult: 1.0 },
  armored_van:    { name: 'Furgone Blindato',     price:  700, color: 0x556B2F, healthBonus:  40, armorBonus: 20, speedMult: 0.9,  fireMult: 1.1 },
  military_suv:   { name: 'SUV Militare',         price: 1200, color: 0x4a5c2a, healthBonus:  60, armorBonus: 25, speedMult: 1.1,  fireMult: 1.2 },
  armored_truck:  { name: 'Camion Corazzato',     price: 2000, color: 0x3a3a3a, healthBonus:  80, armorBonus: 35, speedMult: 0.85, fireMult: 1.0 },
  heavy_military: { name: 'Mezzo Pesante',        price: 3000, color: 0x2a3a2a, healthBonus: 100, armorBonus: 45, speedMult: 0.8,  fireMult: 1.3 },
  experimental:   { name: 'Veicolo Sper.',        price: 5000, color: 0x220044, healthBonus: 120, armorBonus: 50, speedMult: 1.2,  fireMult: 1.5 },
};

export const VEHICLE_KEYS = Object.keys(VEHICLES);

export interface SurvivorData {
  key: string; name: string; ability: string; color: string;
}

export const SURVIVORS: SurvivorData[] = [
  { key: 'mechanic', name: 'Meccanico',   ability: 'Ripara 8hp al comp. peggiore ogni 5s', color: '#44aaff' },
  { key: 'medic',    name: 'Medico',      ability: 'Rigenera 0.3 salute al secondo',        color: '#ff6666' },
  { key: 'soldier',  name: 'Soldato',     ability: 'Torretta auto ogni 1.6 secondi',        color: '#ffcc44' },
  { key: 'explorer', name: 'Esploratore', ability: 'Taniche appaiono ogni 5s (vs 7.5s)',    color: '#44ff88' },
];

export interface Upgrades {
  armor?: boolean;
  engine?: boolean;
  turret?: boolean;
  fuelTank?: boolean;
}

export type WeaponType = 'mg' | 'double_mg' | 'rifle' | 'rockets' | 'flamethrower';

export interface WeaponData {
  name: string; desc: string; price: number;
  cooldown: number; damage: number; speed: number; color: number; range: number;
}

export const WEAPONS: Record<WeaponType, WeaponData> = {
  mg:           { name: 'Mitragliatrice', desc: 'Arma base',               price:   0, cooldown: 280, damage: 1, speed: 680, color: 0xffee00, range: 9999 },
  double_mg:    { name: 'Doppia MG',      desc: 'Due linee parallele larghe',  price: 200, cooldown: 280, damage: 1, speed: 680, color: 0xffdd44, range: 9999 },
  rifle:        { name: 'Fucile Auto',    desc: 'Cadenza alta, danno doppio',  price: 350, cooldown: 140, damage: 2, speed: 720, color: 0x44ff88, range: 9999 },
  rockets:      { name: 'Razzi',          desc: 'Esplosione AoE r=90px',       price: 550, cooldown: 900, damage: 5, speed: 340, color: 0xff4400, range: 9999 },
  flamethrower: { name: 'Lanciafiamme',   desc: 'Corto raggio, DPS altissimo', price: 400, cooldown: 70,  damage: 2, speed: 480, color: 0xff6600, range: 440  },
};

export const WEAPON_KEYS: WeaponType[] = ['mg', 'double_mg', 'rifle', 'rockets', 'flamethrower'];
