/**
 * Idea 1 — Soste (luoghi di fine missione · Track B3). Al termine degli x km non si arriva SEMPRE al
 * garage: si approda a UNO di più luoghi, ognuno con un'identità e un sottoinsieme di servizi diverso.
 * Dati neutri, senza import (come `Routes.ts`) → li legge `ShopScene` (filtra i pannelli), `StopScene`
 * (rende l'hub diegetico) e `GameScene` (nome del luogo nell'overlay di fine missione). I `*Key` sono
 * chiavi i18n.
 *
 * Regola di equità: i RIFORNIMENTI essenziali di sopravvivenza — riparazione, carburante, munizioni
 * (le voci ripetibili `repair`/`refuel`/`restock` di `SHOP_ITEMS`) — sono disponibili in OGNI luogo.
 * Variano solo gli "extra": potenziamenti one-time, armi, sopravvissuti, veicoli. Così nessuna sosta
 * può lasciare il giocatore senza il minimo per ripartire (no softlock). La garanzia "no softlock" è
 * strutturale: ogni sosta rifornisce + finire la benzina su strada NON è game over ma un RIMORCHIO che
 * AVANZA alla sosta successiva (`GameScene.strandLeg`) → nessun leg può restare invincibile.
 *
 * Nella campagna il tipo di sosta viene dal manifest (`STAGE_MANIFEST[leg].stopKind`): distribuzione
 * tarata con ≥1 GARAGE per atto (catalogo raggiungibile lungo tutto il viaggio). Il ciclo `STOP_CYCLE`
 * qui sotto è solo il FALLBACK per-regione (learnable). Una versione seedabile/varia resta possibile (Track D0).
 *
 * Soste diegetiche (vedi docs/SOSTE_DIEGETICHE.md): i campi `hub*`/`stationKey` arredano la mini-scena
 * a piedi (`StopScene`) — colore di terreno/cielo, figure ambientali, nome della stazione-servizi.
 */
import { STAGE_MANIFEST } from './World';

export interface StopLocation {
  key: string;
  nameKey: string;    // titolo del luogo (rimpiazza "GARAGE")
  flavorKey: string;  // riga d'atmosfera sotto il titolo (registro horror)
  accent: number;     // colore-accento del luogo (titolo + cornice + luce-firma dell'hub)
  upgrades: boolean;  // pannello potenziamenti one-time (gli extra del veicolo)
  weapons: boolean;   // pannello armi (acquisto/equip)
  survivors: boolean; // pannello sopravvissuti (recluta/cura/razioni)
  vehicles: boolean;  // pannello veicoli (acquisto/scelta)
  // I core (repair/refuel/restock) sono SEMPRE mostrati, in ogni luogo: vedi nota in testa.
  // ── Arredo dell'hub diegetico (StopScene / HubEnvironment) ──
  hubGround: number;  // colore del terreno/lotto
  hubSky: number;     // colore del fondale (cielo notturno)
  hubNpcs: string[];  // chiavi sopravvissuto mostrate come figure ambientali (atmosfera, non reclutabili qui)
  stationKey: string; // chiave i18n del nome della stazione-servizi (banco/pompa/fuoco/guardia/mercante)
  /** Modello-luce dell'hub (sorgente-firma del luogo): warmth 0..1 (freddo→caldo), reach in px (raggio della
   *  pozza a terra), offX/offY = scostamento della sorgente rispetto alla stazione. Vedi docs/SOSTE_DIEGETICHE.md. */
  hubLight: { warmth: number; reach: number; offX: number; offY: number };
}

/** Roster delle soste. Officina/GARAGE = la sosta COMPLETA; gli altri specializzano.
 *  NB: gli `accent` evitano il BLU (riservato al chrome UI per art bible) → il depot usa arancio-fuoco. */
export const STOP_LOCATIONS: StopLocation[] = [
  { key: 'garage',     nameKey: 'loc.garage.name',     flavorKey: 'loc.garage.flavor',     accent: 0x66cc66, upgrades: true,  weapons: true,  survivors: true,  vehicles: true,  hubGround: 0x1c1c22, hubSky: 0x0c0c14, hubNpcs: ['mechanic'],            stationKey: 'hub.station.workshop', hubLight: { warmth: 0.30, reach: 200, offX: -6, offY: -40 } },
  { key: 'depot',      nameKey: 'loc.depot.name',      flavorKey: 'loc.depot.flavor',      accent: 0xff7722, upgrades: false, weapons: false, survivors: false, vehicles: false, hubGround: 0x20201a, hubSky: 0x0a0c10, hubNpcs: [],                       stationKey: 'hub.station.pump',     hubLight: { warmth: 0.42, reach: 230, offX:  0, offY: -30 } },
  { key: 'camp',       nameKey: 'loc.camp.name',       flavorKey: 'loc.camp.flavor',       accent: 0xffaa55, upgrades: false, weapons: false, survivors: true,  vehicles: false, hubGround: 0x1e1813, hubSky: 0x120b0a, hubNpcs: ['medic', 'explorer'],    stationKey: 'hub.station.fire',     hubLight: { warmth: 1.00, reach: 210, offX:  0, offY: -22 } },
  { key: 'checkpoint', nameKey: 'loc.checkpoint.name', flavorKey: 'loc.checkpoint.flavor', accent: 0xaabb55, upgrades: false, weapons: true,  survivors: false, vehicles: false, hubGround: 0x1a1c16, hubSky: 0x0c0e0b, hubNpcs: ['soldier'],             stationKey: 'hub.station.guard',    hubLight: { warmth: 0.55, reach: 240, offX:  0, offY: -34 } },
  { key: 'market',     nameKey: 'loc.market.name',     flavorKey: 'loc.market.flavor',     accent: 0xcc66cc, upgrades: true,  weapons: true,  survivors: false, vehicles: true,  hubGround: 0x191320, hubSky: 0x0f0a14, hubNpcs: ['looter'],              stationKey: 'hub.station.stall',    hubLight: { warmth: 0.62, reach: 220, offX:  0, offY: -28 } },
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

/**
 * Campagna "IL CONVOGLIO": sosta a valle della tratta APPENA COMPLETATA (`legIndex`), istanziata dal
 * descrittore `STAGE_MANIFEST[legIndex].stopKind` invece che dal ciclo `STOP_CYCLE` mod-7. Fallback al
 * GARAGE per indici fuori range (anti-softlock). Sostituisce `locationForMission` nei tre call-site
 * (overlay fine missione · StopScene · ShopScene).
 */
export function locationForLeg(legIndex: number): StopLocation {
  const key = STAGE_MANIFEST[legIndex]?.stopKind ?? 'garage';
  return STOP_LOCATIONS.find(l => l.key === key) ?? STOP_LOCATIONS[0]!;
}

/** Converte un accento numerico (0xRRGGBB) in stringa CSS per `Ui.text` (es. 0x66cc66 → '#66cc66'). */
export function accentCss(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
