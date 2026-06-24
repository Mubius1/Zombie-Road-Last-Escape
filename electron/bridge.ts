// Contratto TIPIZZATO del bridge desktop esposto su `window.desktop`.
//
// Vive in un file a parte (non in preload.ts) per due motivi:
//  1) il preload lo importa come tipo per costruire l'oggetto da esporre;
//  2) la dichiarazione globale qui sotto tipizza `window.desktop` PER IL GIOCO web
//     (src/), così un futuro `window.desktop?.unlockAchievement(...)` è type-checked.
//
// NB additivo: questa è solo una dichiarazione di tipo `declare global`, non emette codice
// e non viene importata dai sorgenti del gioco. Il gioco web continua a girare identico nel
// browser, dove `window.desktop` è semplicemente `undefined`.

/** Superficie sicura esposta al renderer dal preload. Minima oggi, estendibile per Steamworks. */
export interface DesktopBridge {
  /** Sempre `true` dentro Electron; `undefined` nel browser (il bridge non esiste lì). */
  readonly isDesktop: true;
  // ── Innesto futuro (Steamworks IPC), es.:
  // unlockAchievement(id: string): Promise<boolean>;
  // setRichPresence(key: string, value: string): void;
}

declare global {
  interface Window {
    /** Bridge desktop — presente solo quando il gioco gira dentro Electron. */
    desktop?: DesktopBridge;
  }
}

export {};
