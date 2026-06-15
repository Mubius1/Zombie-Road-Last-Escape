# CLAUDE.md — Istruzioni di sistema del progetto

> **Leggi questo file PRIMA di ogni altra cosa, all'inizio di ogni sessione.**

## ⛔ Regola n.1 (prioritaria)

**Prima di scrivere codice, consulta [`docs/ART_BIBLE_ZOMBIES.md`](docs/ART_BIBLE_ZOMBIES.md) per verificare i vincoli di stile e i parametri di movimento.**

Vale per qualsiasi modifica a nemici, grafica procedurale, animazioni o effetti. L'art bible è la **fonte di verità** estetica e di game-feel: non improvvisare palette, pose o numeri di movimento — segui (o aggiorna esplicitamente) le sue schede.

## ⚠️ Regola n.2 (anti-deriva)

Se cambi una costante visiva o di movimento nel codice (`ZOMBIE_STATS`, `ZOMBIE_MOTION`, dimensioni dei frame, scala), **aggiorna la scheda corrispondente nell'art bible** e poi esegui:

```bash
npm run validate:art
```

Lo script confronta i numeri del codice con quelli scritti nell'art bible e **fallisce se divergono**. È agganciato anche a `npm run build`.

---

## Il progetto in breve

- **Nome:** Zombie Road: Last Escape
- **Genere:** arcade survival top-down (la strada scorre verso sinistra, il veicolo si muove su/giù).
- **Stack:** Phaser 3.90 + TypeScript + Vite. UI in **italiano**.
- **Grafica:** **100% procedurale** (Graphics API → `generateTexture`). **Nessun PNG / nessun asset esterno.**
- **Audio:** procedurale (Web Audio API) in `src/SoundManager.ts`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | avvia Vite in sviluppo |
| `npm run build` | **valida l'art bible** → `tsc` → build di produzione |
| `npm run validate:art` | controlla l'allineamento codice ↔ art bible |
| `npm run preview` | anteprima della build |

## Mappa del codice

| Area | File / simbolo |
|---|---|
| Scena di gioco principale | `src/scenes/GameScene.ts` |
| Negozio tra le missioni | `src/scenes/ShopScene.ts` |
| Modalità debug / galleria modelli | `src/scenes/DebugScene.ts` |
| Dati condivisi (veicoli, armi, sopravvissuti) | `src/GameData.ts` |
| Audio procedurale | `src/SoundManager.ts` |
| Texture & animazioni nemici | `GameScene.buildEntityTextures()` |
| Statistiche nemici | `ZOMBIE_STATS` |
| Personalità di movimento + VFX | `ZOMBIE_MOTION`, `updateZombieMotion()`, `emitZombieFx()` |
| Boss di fine regione | `BOSS_CONFIG`, `spawnBoss()`, `updateBoss()` |

## Convenzioni

- Mantieni lo stile/idioma del codice circostante (TypeScript stretto, niente PNG, niente dipendenze nuove senza motivo).
- UI e testi rivolti al giocatore: **in italiano**.
- Gli effetti "vivi" (rotazione, respiro, VFX) sono **solo visivi**: non devono alterare hitbox o bilanciamento.
- Quando aggiungi un nemico/boss/evento, parti dalla **scheda-template** in fondo all'art bible (§10).
