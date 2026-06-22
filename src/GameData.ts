// I campi `name`/`desc`/`ability` contengono CHIAVI i18n (vedi src/i18n.ts + src/locales/),
// risolte con t() al punto d'uso. NON sono testo da mostrare direttamente.
// Nota anti-deriva: le entry di VEHICLES/WEAPONS restano su RIGA SINGOLA senza graffe annidate
// perché scripts/validate-balance.mjs ne estrae i campi numerici con una regex riga-singola.

export interface VehicleData {
  name: string; price: number; color: number;
  healthBonus: number; armorBonus: number; speedMult: number; fireMult: number;
  /** Posti per i sopravvissuti (oltre al guidatore): cap di reclutamento nel negozio. */
  survivorSlots: number;
  /** Specifiche descrittive (flavor/UI, NON gameplay): cavalli (CV), peso (kg), velocità max (km/h). */
  horsepower: number; weight: number; topSpeed: number;
  /** Catalogo potenziamenti disponibili per QUESTO veicolo (oltre a 'repair', universale). I
   *  potenziamenti acquistati sono per-veicolo: vedi RunData.upgrades = Record<vehicleKey, Upgrades>. */
  upgrades: UpgradeKey[];
  /** Chiave i18n della descrizione del veicolo. */
  desc: string;
}

export const VEHICLES: Record<string, VehicleData> = {
  civilian_car:   { name: 'vehicle.civilian_car.name',   price:    0, color: 0x4a6fa5, healthBonus:   0, armorBonus:  0, speedMult: 1.0,  fireMult: 1.0, survivorSlots: 4, horsepower:  90, weight: 1200, topSpeed: 160, upgrades: ['armor', 'engine', 'fuelTank', 'nitro'], desc: 'vehicle.civilian_car.desc' },
  pickup:         { name: 'vehicle.pickup.name',         price:  300, color: 0x8B4513, healthBonus:  20, armorBonus: 10, speedMult: 1.0,  fireMult: 1.0, survivorSlots: 2, horsepower: 150, weight: 1900, topSpeed: 170, upgrades: ['engine', 'fuelTank', 'ram', 'nitro'], desc: 'vehicle.pickup.desc' },
  armored_van:    { name: 'vehicle.armored_van.name',    price:  700, color: 0x556B2F, healthBonus:  40, armorBonus: 20, speedMult: 0.9,  fireMult: 1.1, survivorSlots: 5, horsepower: 140, weight: 2800, topSpeed: 130, upgrades: ['armor', 'plating', 'turret', 'fuelTank', 'filters'], desc: 'vehicle.armored_van.desc' },
  military_suv:   { name: 'vehicle.military_suv.name',   price: 1200, color: 0x4a5c2a, healthBonus:  60, armorBonus: 25, speedMult: 1.1,  fireMult: 1.2, survivorSlots: 4, horsepower: 250, weight: 2600, topSpeed: 185, upgrades: ['engine', 'turret', 'nitro', 'ammo'], desc: 'vehicle.military_suv.desc' },
  armored_truck:  { name: 'vehicle.armored_truck.name',  price: 2000, color: 0x3a3a3a, healthBonus:  80, armorBonus: 35, speedMult: 0.85, fireMult: 1.0, survivorSlots: 4, horsepower: 300, weight: 7000, topSpeed: 120, upgrades: ['armor', 'plating', 'ram', 'fuelTank', 'turret'], desc: 'vehicle.armored_truck.desc' },
  heavy_military: { name: 'vehicle.heavy_military.name', price: 3000, color: 0x2a3a2a, healthBonus: 100, armorBonus: 45, speedMult: 0.8,  fireMult: 1.3, survivorSlots: 3, horsepower: 520, weight: 12000, topSpeed: 110, upgrades: ['armor', 'plating', 'turret', 'ammo', 'filters'], desc: 'vehicle.heavy_military.desc' },
  experimental:   { name: 'vehicle.experimental.name',   price: 5000, color: 0x220044, healthBonus:  60, armorBonus: 20, speedMult: 1.2,  fireMult: 1.5, survivorSlots: 2, horsepower: 600, weight: 1600, topSpeed: 240, upgrades: ['turret', 'ammo', 'nitro', 'overcharge'], desc: 'vehicle.experimental.desc' },
};

export const VEHICLE_KEYS = Object.keys(VEHICLES);

/** M2 cibo & mantenimento sopravvissuti (numeri in BALANCE.md §8). Condiviso GameScene↔ShopScene
 *  per evitare drift tra consumo (gioco) e proiezione "affamato" (negozio). */
export const FOOD = { max: 120, perSurvivor: 10, start: 40, rationFood: 40, rationCost: 100 } as const;

export interface SurvivorData {
  /** Chiave stabile (logica/persistenza). */
  key: string;
  /** Chiave i18n del nome. */
  name: string;
  /** Chiave i18n della descrizione abilità (con segnaposto). */
  ability: string;
  /** Numeri iniettati nei segnaposto dell'abilità (singola fonte di verità, niente drift). */
  abilityParams?: Record<string, number>;
  color: string;
  /** Nome proprio (fisso, non tradotto — i nomi non si traducono). Texture: `survivor_<key>`. */
  properName: string;
  /** Cognome (fisso). */
  surname: string;
  /** Chiave i18n della storia del personaggio, prima dell'epidemia. */
  bio: string;
}

export const SURVIVORS: SurvivorData[] = [
  { key: 'mechanic', properName: 'Bruno',  surname: 'Salerno', bio: 'survivor.mechanic.bio', name: 'survivor.mechanic.name', ability: 'survivor.mechanic.ability', abilityParams: { hp: 8, s: 5 },       color: '#44aaff' },
  { key: 'medic',    properName: 'Sara',   surname: 'Conti',   bio: 'survivor.medic.bio',    name: 'survivor.medic.name',    ability: 'survivor.medic.ability',    abilityParams: { hp: 0.3 },          color: '#ff6666' },
  { key: 'soldier',  properName: 'Marcus', surname: 'Hale',    bio: 'survivor.soldier.bio',  name: 'survivor.soldier.name',  ability: 'survivor.soldier.ability',  abilityParams: { s: 1.6 },           color: '#ffcc44' },
  { key: 'explorer', properName: 'Nadia',  surname: 'Volkova', bio: 'survivor.explorer.bio', name: 'survivor.explorer.name', ability: 'survivor.explorer.ability', abilityParams: { s: 5, base: 7.5 },  color: '#44ff88' },
  { key: 'looter',        properName: 'Vince',  surname: 'Pagano',    bio: 'survivor.looter.bio',        name: 'survivor.looter.name',        ability: 'survivor.looter.ability',        abilityParams: { p: 12 },  color: '#d4af37' },
  { key: 'sniper',        properName: 'Eva',    surname: 'Lindqvist', bio: 'survivor.sniper.bio',        name: 'survivor.sniper.name',        ability: 'survivor.sniper.ability',        abilityParams: { s: 2.2 }, color: '#88bbff' },
  { key: 'demolitionist', properName: 'Karim',  surname: 'Haddad',    bio: 'survivor.demolitionist.bio', name: 'survivor.demolitionist.name', ability: 'survivor.demolitionist.ability', abilityParams: { s: 5.5 }, color: '#ff7733' },
];

export interface Upgrades {
  armor?: boolean;
  engine?: boolean;
  turret?: boolean;
  fuelTank?: boolean;
  plating?: boolean;     // +30 salute massima
  ram?: boolean;         // ariete frontale: speronare i nemici li danneggia
  nitro?: boolean;       // scatto −30% ricarica
  ammo?: boolean;        // +1 danno proiettile
  filters?: boolean;     // danno tossico −50%
  overcharge?: boolean;  // overdrive +30% durata
}
export type UpgradeKey = keyof Upgrades;

export type WeaponType = 'mg' | 'double_mg' | 'rifle' | 'rockets' | 'flamethrower';

export interface WeaponData {
  name: string; desc: string; price: number;
  cooldown: number; damage: number; speed: number; color: number; range: number;
}

export const WEAPONS: Record<WeaponType, WeaponData> = {
  mg:           { name: 'weapon.mg.name',           desc: 'weapon.mg.desc',           price:   0, cooldown: 280, damage: 1, speed: 680, color: 0xffee00, range: 9999 },
  double_mg:    { name: 'weapon.double_mg.name',    desc: 'weapon.double_mg.desc',    price: 200, cooldown: 280, damage: 1, speed: 680, color: 0xffdd44, range: 9999 },
  rifle:        { name: 'weapon.rifle.name',        desc: 'weapon.rifle.desc',        price: 350, cooldown: 140, damage: 2, speed: 720, color: 0x44ff88, range: 9999 },
  rockets:      { name: 'weapon.rockets.name',      desc: 'weapon.rockets.desc',      price: 550, cooldown: 900, damage: 5, speed: 340, color: 0xff4400, range: 9999 },
  flamethrower: { name: 'weapon.flamethrower.name', desc: 'weapon.flamethrower.desc', price: 400, cooldown: 70,  damage: 2, speed: 480, color: 0xff6600, range: 440  },
};

export const WEAPON_KEYS: WeaponType[] = ['mg', 'double_mg', 'rifle', 'rockets', 'flamethrower'];
