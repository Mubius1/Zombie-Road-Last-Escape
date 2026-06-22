/**
 * Track B1 — Nodi di scelta percorso. Tra una missione e l'altra il giocatore sceglie la prossima
 * tratta tra alcuni nodi rischio/ricompensa: ogni nodo è un MODIFICATORE applicato alla missione
 * successiva (densità nemici, frequenza hazard, monete guadagnate). Dati neutri, senza import →
 * li leggono `RouteScene` (rende le carte) e `GameScene` (applica i moltiplicatori). I `*Key` sono
 * chiavi i18n. La chiave scelta vive in `RunData.routeModifier` (registry + checkpoint).
 */
export interface RouteNode {
  key: string;
  labelKey: string;
  descKey: string;
  accent: number;     // colore-accento della carta (coerente coi colori-firma)
  spawnMult: number;  // moltiplicatore dell'intervallo di spawn: <1 = più denso, >1 = più rado
  hazardMult: number; // frequenza hazard: >1 = più ostacoli, <1 = meno
  moneyMult: number;  // moltiplicatore delle monete guadagnate a fine missione
}

/** Nodo neutro (nessuna scelta fatta, es. prima missione o checkpoint vecchio): tutto a 1×. */
export const ROUTE_NONE: RouteNode = {
  key: 'none', labelKey: '', descKey: '', accent: 0xffffff, spawnMult: 1, hazardMult: 1, moneyMult: 1,
};

export const ROUTE_NODES: RouteNode[] = [
  { key: 'horde',     labelKey: 'route.horde.label',     descKey: 'route.horde.desc',     accent: 0xff4400, spawnMult: 0.62, hazardMult: 1.0, moneyMult: 1.5  },
  { key: 'minefield', labelKey: 'route.minefield.label', descKey: 'route.minefield.desc', accent: 0xffaa00, spawnMult: 1.0,  hazardMult: 2.2, moneyMult: 1.25 },
  { key: 'rest',      labelKey: 'route.rest.label',      descKey: 'route.rest.desc',      accent: 0x44aaff, spawnMult: 1.5,  hazardMult: 0.4, moneyMult: 0.7  },
];

/** Risolve la chiave salvata in un nodo (fallback al neutro se assente/sconosciuta). */
export function routeNode(key: string | undefined | null): RouteNode {
  return ROUTE_NODES.find(n => n.key === key) ?? ROUTE_NONE;
}
