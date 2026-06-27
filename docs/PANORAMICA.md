# 🧟 Zombie Road: Last Escape — panoramica & guida

> Questo file era il README originale del progetto. È stato spostato qui quando la landing della repo è diventata il [case-study](../README.md). Contenuto allineato allo stato attuale del gioco.

Arcade survival top-down: guidi un veicolo lungo una **campagna finita** verso un rifugio, falci orde di zombi con la **mira col mouse**, e tra una tratta e l'altra spendi il bottino per tenere in vita il **convoglio** (mezzo, armi, sopravvissuti) — finché carburante o scocca non cedono. Registro *This War of Mine*: non basta arrivare tu, devi portarci i tuoi.

- **Genere:** arcade survival top-down (la strada scorre, il veicolo si muove su/giù).
- **Stack:** [Phaser 3.90](https://phaser.io/) + TypeScript + [Vite](https://vitejs.dev/). UI **internazionalizzata** (it · en · es · fr · de · pt); l'italiano è la locale canonica.
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
| `npm run build` | **valida (art + balance + audio + i18n)** → `tsc` → build di produzione |
| `npm run validate` | i quattro validatori anti-deriva |
| `npm run lint` | ESLint type-checked |
| `npm run preview` | anteprima della build di produzione |

> ⚠️ La build **fallisce** se i numeri nel codice divergono dai documenti (art bible / balance), vedi *anti-deriva* sotto. È voluto.

---

## Come si gioca

| Input | Azione |
|---|---|
| **↑ / ↓** (o **W / S**) | muovi il veicolo nella corsia |
| **→ / D**, **← / A** | acceleratore / freno (throttle) |
| **MOUSE** | mira: la torretta segue il puntatore (arco frontale ±82°) |
| **CLIC** (tieni premuto) o **SPAZIO** | spara verso il mirino |
| **1–5** (o **Q**) | cambia arma posseduta |
| **SHIFT** | scatto: sbalza via gli zombi aggrappati (ricarica 5 s) |
| **F** · **C** | Sovraccarico · granata (se disponibili) |
| **ESC** | pausa / impostazioni |

Sopravvivi gestendo **salute** *e* **carburante**: a zero dell'uno o dell'altro è game over — ma il game over **non azzera la corsa**: rigiochi la tratta da un **checkpoint** (−25% monete, build intatta). Solo *Nuova Partita* azzera. Alle **soste** spendi le monete in riparazioni, potenziamenti, armi e veicoli, e gestisci i **sopravvissuti** (li recluti gratis, li sfami, li proteggi).

→ Regole complete in [`GAME_DESIGN.md`](GAME_DESIGN.md) · numeri in [`BALANCE.md`](BALANCE.md).

---

## Documentazione

> **Leggi sempre [`CLAUDE.md`](../CLAUDE.md) per primo.** È il contratto di lavoro del progetto (regole prioritarie, comandi, convenzioni).

📑 **Indice completo e navigabile: [`INDEX.md`](INDEX.md)** — ogni doc con scopo, stato e validatore che lo copre. Punti d'ingresso più usati:

- **Cosa è il gioco** → [`GAME_DESIGN.md`](GAME_DESIGN.md) · numeri in [`BALANCE.md`](BALANCE.md)
- **Le persone & la campagna** → [`NARRATIVA_PERSONAGGI.md`](NARRATIVA_PERSONAGGI.md) · [`CAMPAGNA_CONVOGLIO.md`](CAMPAGNA_CONVOGLIO.md)
- **Come appare/suona** → le art bible (`ART_BIBLE_*.md`)
- **Com'è cucito** → [`ARCHITETTURA.md`](ARCHITETTURA.md) · QA in [`TESTING.md`](TESTING.md)
- **Packaging desktop** → [`DESKTOP.md`](DESKTOP.md)

---

## Mappa del codice

| Area | File / simbolo |
|---|---|
| Scena di gioco principale | `src/scenes/GameScene.ts` |
| Negozio tra le tratte | `src/scenes/ShopScene.ts` |
| Soste a piedi (hub diegetici) | `src/scenes/StopScene.ts` |
| Setup Nuova Partita (difficoltà + loadout) | `src/scenes/NewRunScene.ts` |
| Menu principale | `src/scenes/MenuScene.ts` |
| Impostazioni · pausa | `src/scenes/SettingsScene.ts` · `src/scenes/PauseScene.ts` |
| Debug / galleria modelli | `src/scenes/DebugScene.ts` |
| Dati condivisi (veicoli, armi, sopravvissuti, difficoltà) | `src/GameData.ts` |
| Dati di dominio neutri (boss, manifest tappe, diramazioni) | `src/World.ts` — `BOSS_CONFIG`, `STAGE_MANIFEST`, `DETOUR_OUTCOMES` |
| Stato run tipizzato (registry) | `src/RunState.ts` — `RunData` + `getRun`/`setRun` |
| Meta-profilo (sblocchi cross-corsa) | `src/MetaProfile.ts` |
| Archi & diramazioni dei sopravvissuti | `src/Convoy.ts` |
| Statistiche/movimento nemici | `ZOMBIE_STATS`, `ZOMBIE_MOTION` (in `GameScene.ts`) |
| Ambiente (strada, parallasse, luce) | `src/Environment.ts` |
| Audio procedurale | `src/SoundManager.ts` |
| Juice / game-feel | `src/Juice.ts` |
| Risoluzione, zoom camera, sovracampionamento | `src/Config.ts` |
| Token e helper UI | `src/Ui.ts` |

---

## Architettura in breve

- **Spazio di design.** Tutto è simulato in uno spazio alto **600** px; la camera di ogni scena va in **zoom** per riempire la risoluzione nativa scelta dal giocatore (menu Impostazioni). In 16:9 si vede **più strada** a destra. Dettagli in [`CLAUDE.md` → Risoluzione & scaling](../CLAUDE.md) e `src/Config.ts`.
- **Flusso scene:** `MenuScene → NewRunScene → GameScene → StopScene → ShopScene → GameScene → …`; `SettingsScene`/`PauseScene` come overlay. Lo stato della corsa vive nel `registry` di Phaser, con **checkpoint su disco** (`localStorage` via `src/SaveData.ts`): *Continua* riprende la corsa, anche cross-sessione.
- **Anti-deriva.** I validatori (`npm run validate`, agganciati a `build`) confrontano i numeri del codice con quelli scritti nei documenti (art bible + balance) e falliscono se divergono. Se cambi una costante, **aggiorna la scheda** corrispondente.

---

## Convenzioni

- TypeScript stretto, stile del codice circostante. **Niente PNG, niente dipendenze nuove senza motivo.**
- UI e testi rivolti al giocatore: **mai letterali nel codice → sempre `t('chiave')`** (i18n). L'italiano è la locale canonica.
- Gli effetti "vivi" (rotazione, respiro, VFX) sono **solo visivi**: non alterano hitbox o bilanciamento.
- Prima di toccare grafica/animazioni/numeri, **consulta l'art bible pertinente** (vedi [`../CLAUDE.md`](../CLAUDE.md), Regola n.1).