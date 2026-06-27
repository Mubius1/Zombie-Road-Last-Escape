# 🧟 Zombie Road: Last Escape

Arcade survival top-down: guidi un veicolo lungo una strada infinita che scorre verso sinistra, falci orde di zombi, sopravvivi al **boss di regione** e usi il bottino tra una missione e l'altra per potenziarti — finché carburante o scocca non cedono.

- **Genere:** arcade survival top-down (la strada scorre, il veicolo si muove su/giù).
- **Stack:** [Phaser 3.90](https://phaser.io/) + TypeScript + [Vite](https://vitejs.dev/). UI in **italiano**.
- **Grafica:** **100% procedurale** — geometria via Phaser Graphics API → `generateTexture`; post-processing via shader GLSL inline. **Nessun PNG, nessun asset esterno.**
- **Audio:** procedurale (Web Audio API) in `src/SoundManager.ts`.

---

## Avvio rapido

```bash
npm install      # installa le dipendenze
npm run dev      # avvia Vite in sviluppo (apri l'URL mostrato)
```

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo con hot-reload |
| `npm run build` | **valida le art bible** → `tsc` → build di produzione |
| `npm run validate:art` | controlla l'allineamento codice ↔ art bible |
| `npm run preview` | anteprima della build di produzione |

> ⚠️ La build **fallisce** se i numeri nel codice divergono dalle art bible (vedi *anti-deriva* sotto). È voluto.

---

## Come si gioca

| Input | Azione |
|---|---|
| **↑ / ↓** | muovi il veicolo nella strada |
| sparo | automatico, in avanti |
| **Shift** | scatto: sbalza via gli zombi aggrappati (ricarica 5 s) |
| **1–5** | cambia arma posseduta |
| **ESC** | pausa / impostazioni |
| **SPAZIO** | avanza nelle schermate di esito |

Sopravvivi gestendo **salute** *e* **carburante**: a zero dell'uno o dell'altro è game over, e il game over **azzera l'intera corsa** (soldi, veicolo, armi, sopravvissuti). Tra le missioni, nel **Garage**, spendi le monete in riparazioni, potenziamenti, armi e veicoli, e recluti gratis un sopravvissuto.

→ Regole complete in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) · numeri in [`docs/BALANCE.md`](docs/BALANCE.md).

---

## Documentazione

> **Leggi sempre [`CLAUDE.md`](CLAUDE.md) per primo.** È il contratto di lavoro del progetto (regole prioritarie, comandi, convenzioni).

📑 **Indice completo e navigabile della documentazione: [`docs/INDEX.md`](docs/INDEX.md)** — ogni doc con scopo, stato e validatore che lo copre. Punti d'ingresso più usati:

- **Cosa è il gioco** → [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) · numeri in [`docs/BALANCE.md`](docs/BALANCE.md)
- **Le persone & la campagna** → [`docs/NARRATIVA_PERSONAGGI.md`](docs/NARRATIVA_PERSONAGGI.md) · [`docs/CAMPAGNA_CONVOGLIO.md`](docs/CAMPAGNA_CONVOGLIO.md)
- **Come appare/suona** → le art bible (`docs/ART_BIBLE_*.md`)
- **Com'è cucito** → [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md) · QA in [`docs/TESTING.md`](docs/TESTING.md)
- **Verso Steam** → [`docs/RELEASE_STEAM.md`](docs/RELEASE_STEAM.md) · packaging in [`docs/DESKTOP.md`](docs/DESKTOP.md)

---

## Mappa del codice

| Area | File / simbolo |
|---|---|
| Scena di gioco principale | `src/scenes/GameScene.ts` |
| Negozio tra le missioni (Garage) | `src/scenes/ShopScene.ts` |
| Menu principale | `src/scenes/MenuScene.ts` |
| Impostazioni / pausa | `src/scenes/SettingsScene.ts` |
| Debug / galleria modelli | `src/scenes/DebugScene.ts` |
| Dati condivisi (veicoli, armi, sopravvissuti) | `src/GameData.ts` |
| Statistiche/movimento nemici · boss | `ZOMBIE_STATS`, `ZOMBIE_MOTION`, `BOSS_CONFIG` (in `GameScene.ts`) |
| Ambiente (strada, parallasse, luce) | `src/Environment.ts` |
| Audio procedurale | `src/SoundManager.ts` |
| Juice / game-feel | `src/Juice.ts` |
| Risoluzione, zoom camera, sovracampionamento | `src/Config.ts` |
| Token e helper UI | `src/Ui.ts` |

---

## Architettura in breve

- **Spazio di design.** Tutto è simulato in uno spazio alto **600** px; la camera di ogni scena va in **zoom** per riempire la risoluzione nativa scelta dal giocatore (menu Impostazioni). In 16:9 si vede **più strada** a destra. Dettagli in [`CLAUDE.md` → Risoluzione & scaling](CLAUDE.md) e `src/Config.ts`.
- **Flusso scene:** `MenuScene → GameScene → ShopScene → GameScene → …`; `SettingsScene` come overlay di pausa. Lo stato della corsa vive nel `registry` di Phaser (in memoria, nessun salvataggio su disco).
- **Anti-deriva.** `npm run validate:art` (agganciato a `build`) confronta i numeri del codice con quelli scritti nelle art bible e fallisce se divergono. Se cambi una costante visiva, **aggiorna la scheda** corrispondente.

---

## Convenzioni

- TypeScript stretto, stile del codice circostante. **Niente PNG, niente dipendenze nuove senza motivo.**
- UI e testi rivolti al giocatore: **in italiano**.
- Gli effetti "vivi" (rotazione, respiro, VFX) sono **solo visivi**: non alterano hitbox o bilanciamento.
- Prima di toccare grafica/animazioni/numeri, **consulta l'art bible pertinente** (vedi `CLAUDE.md`, Regola n.1).
