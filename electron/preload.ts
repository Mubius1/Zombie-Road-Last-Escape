// Preload di Electron — bridge MINIMO e TIPIZZATO tra renderer (il gioco) e processo main.
//
// Gira in un contesto isolato (contextIsolation: true) con sandbox attiva. Espone su
// `window.desktop` una superficie ridotta e sicura: oggi è quasi vuota (scaffold), ma è il
// punto d'innesto pronto per l'IPC Steamworks futuro (achievement, presence, cloud save) —
// che andrà aggiunto QUI come metodi che inoltrano a `ipcRenderer.invoke(...)`, senza mai
// esporre l'intero `ipcRenderer` al renderer.
//
// Formato modulo: COMMONJS (vedi tsconfig.electron.json) → coerente con main.ts.
import { contextBridge } from 'electron';
import type { DesktopBridge } from './bridge';

// Ponte esposto al renderer. `isDesktop` permette al gioco web di sapere (in futuro)
// se gira dentro Electron senza throw — utile per gate condizionali lato gioco.
const bridge: DesktopBridge = {
  isDesktop: true,
  // Scaffold pronto per Steamworks: nessun canale IPC attivo ora (no-op intenzionale).
  // Esempio futuro: unlockAchievement: (id) => ipcRenderer.invoke('steam:achievement', id),
};

// `exposeInMainWorld` è l'unico canale verso `window` con contextIsolation attivo.
contextBridge.exposeInMainWorld('desktop', bridge);
