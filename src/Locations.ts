/**
 * Idea 1 — Soste (luoghi di fine missione · Track B3). Al termine degli x km non si arriva SEMPRE al
 * garage: si approda a UNO di più luoghi, ognuno con un'identità e un sottoinsieme di servizi diverso.
 * Dati neutri, senza import (come `Routes.ts`) → li leggono `ShopScene` (rende il luogo + filtra i
 * pannelli) e `GameScene` (nome del luogo nell'overlay di fine missione). I `*Key` sono chiavi i18n.
 *
 * Regola di equità: i RIFORNIMENTI essenziali di sopravvivenza — riparazione, carburante, munizioni
 * (le voci ripetibili `repair`/`refuel`/`restock` di `SHOP_ITEMS`) — sono disponibili in OGNI luogo.
 * Variano solo gli "extra": potenziamenti one-time, armi, sopravvissuti, veicoli. Così nessuna sosta
 * può lasciare il giocatore senza il minimo per ripartire (no softlock).
 *
 * Selezione DETERMINISTICA dalla regione appena percorsa (learnable, non casuale in questa prima
 * versione): il GARAGE (servizi completi) ricorre ~ogni 3-4 soste; gli altri sono specialisti.
 * Una versione seedabile/varia resta possibile con l'RNG di Track D0.
 */
export interface StopLocation {
  key: string;
  nameKey: string;    // titolo del luogo (rimpiazza "GARAGE")
  flavorKey: string;  // riga d'atmosfera sotto il titolo (registro horror)
  accent: number;     // colore-accento del luogo (titolo + cornice)
  upgrades: boolean;  // pannello potenziamenti one-time (gli extra del veicolo)
  weapons: boolean;   // pannello armi (acquisto/equip)
  survivors: boolean; // pannello sopravvissuti (recluta/cura/razioni)
  vehicles: boolean;  // pannello veicoli (acquisto/scelta)
  // I core (repair/refuel/restock) sono SEMPRE mostrati, in ogni luogo: vedi nota in testa.
}

/** Roster delle soste. Officina/GARAGE = la sosta COMPLETA; gli altri specializzano. */
export const STOP_LOCATIONS: StopLocation[] = [
  { key: 'garage',     nameKey: 'loc.garage.name',     flavorKey: 'loc.garage.flavor',     accent: 0x66cc66, upgrades: true,  weapons: true,  survivors: true,  vehicles: true  },
  { key: 'depot',      nameKey: 'loc.depot.name',      flavorKey: 'loc.depot.flavor',      accent: 0x44aacc, upgrades: false, weapons: false, survivors: false, vehicles: false },
  { key: 'camp',       nameKey: 'loc.camp.name',       flavorKey: 'loc.camp.flavor',       accent: 0xffaa55, upgrades: false, weapons: false, survivors: true,  vehicles: false },
  { key: 'checkpoint', nameKey: 'loc.checkpoint.name', flavorKey: 'loc.checkpoint.flavor', accent: 0xaabb55, upgrades: false, weapons: true,  survivors: false, vehicles: false },
  { key: 'market',     nameKey: 'loc.market.name',     flavorKey: 'loc.market.flavor',     accent: 0xcc66cc, upgrades: true,  weapons: true,  survivors: false, vehicles: true  },
];

/**
 * Ciclo delle soste indicizzato per REGIONE (0..6, come `envIndex = (missione − 1) mod 7`):
 * tematico e learnable (deposito sull'autostrada, posto di blocco alla base militare, …).
 * GARAGE alle regioni 0 e 4 → mai più di 3 soste-specialiste tra un garage e l'altro.
 */
const STOP_CYCLE = ['garage', 'depot', 'market', 'camp', 'garage', 'checkpoint', 'market'];

/**
 * Risolve il luogo della sosta dalla `nextMission` (= numero di missione GIÀ incrementato, com'è nel
 * negozio e nell'overlay di fine missione). La regione appena percorsa è quella della missione
 * completata = `nextMission − 1` → indice `(nextMission − 2) mod 7`. Fallback al GARAGE.
 */
export function locationForMission(nextMission: number): StopLocation {
  const region = (((nextMission - 2) % 7) + 7) % 7;
  const key = STOP_CYCLE[region] ?? 'garage';
  return STOP_LOCATIONS.find(l => l.key === key) ?? STOP_LOCATIONS[0]!;
}

/** Converte un accento numerico (0xRRGGBB) in stringa CSS per `Ui.text` (es. 0x66cc66 → '#66cc66'). */
export function accentCss(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
