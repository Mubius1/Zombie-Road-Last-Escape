# Zombie Road: Last Escape

**🇬🇧 English** · [🇮🇹 Italiano](#italiano)

> A finite, hand-authored survival campaign on wheels — get your **convoy of survivors** to the refuge, not just yourself.

**Zombie Road: Last Escape** is an arcade top-down survival game built solo in TypeScript. The road scrolls past, your vehicle holds the left edge, and you fight with **mouse-aim combat** — a turret overlay that tracks the cursor and clamps to a ±82° frontal arc. It is not an endless score loop: the campaign is a **31-stage, single-pass run** through six acts toward a terminal refuge, in a *This War of Mine* register where the people you carry — their morale, your choices, who you leave behind — are the point. Everything you see and hear is generated at runtime: there are **zero PNGs and zero audio samples** in the source tree.

This is a personal side project. I built it to push on the engineering *around* a game, not just the game itself: strict types, a custom code↔spec validation pipeline, deterministic E2E testing, and a multi-target build.

**Play it:** [Web (live)](https://zombie-road-last-escape.vercel.app) · [itch.io](https://massimomanda.itch.io/zombie-road-last-escape)
**Built with:** TypeScript (strict) · Phaser 3.90 · Vite · WebGL (inline GLSL) · Web Audio API · Playwright · ESLint 9 (typescript-eslint) · Electron

---

## Engineering highlights

- **A custom Vite plugin that enforces code ↔ spec alignment.** Four validators (art, balance, audio, i18n) run on dev-server startup and re-run on save with a 150ms debounce across 15+ watched files. Drift surfaces instantly as a browser overlay — **without blocking the dev server** — and the *same* validators are hard gates in CI.
- **Deterministic E2E testing for a procedural game.** A three-level Playwright harness (smoke + UI-bounds at 8 resolution presets → input-fuzzing monkey → invariant-checking bot) seeds a Mulberry32 PRNG before boot, so runs are reproducible. Instead of brittle screenshots, it polls **9 runtime invariants** every frame (health/fuel/score/distance/combo finite and in range, score non-decreasing, vehicle within world bounds).
- **A typed game-state contract.** Shared run state lives on Phaser's registry but is wrapped by typed `getRun`/`setRun` accessors over a single `RunData` interface — so renaming a key or changing its type is a **compile error, not a silent runtime bug**. Defaults are centralized in a single `resetRunState()`.
- **Strict TypeScript across two configs.** The game compiles under `strict: true` plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `noUncheckedIndexedAccess`. The desktop wrapper has its own `tsconfig.electron.json` (CommonJS, ES2022, strict) so platform-specific code is type-checked independently of the browser build (ES2020 / ESNext / `moduleResolution: "Bundler"`).
- **Six-language i18n with consistency enforced by the build.** A function-based `t(key, params)` resolves through a fallback chain (current → Italian canonical → key), with UI numbers injected as params to prevent drift against balance changes. A validator checks all six locales (it/en/es/fr/de/pt) for matching key sets *and* consistent placeholders, so a missing translation can't quietly fall back to mixed-language UI.

---

## Architecture

- **Data-driven campaign.** An ordered, single-pass `STAGE_MANIFEST`: 31 legs, each a `StageDescriptor` combining biome, length/spawn/burst multipliers, fuel drain, ammo/hazard ratios, zombie-pool bias, and set-piece events (night/storm/roadblock). Two fixed bifurcation points and seven narrative detours swap descriptors **without breaking the linear `legIndex` progression** — branching content, no branching complexity.
- **A neutral, import-free domain module.** `World.ts` imports nothing and defines all shared domain data and types (boss config, stage manifest, road geometry, enemy/component/boss kinds). Because it depends on nothing, both `GameScene` and `BossController` can import from it without a dependency cycle — a deliberate, documented decision.
- **Controllers over a monolith.** `GameScene` delegates to focused subsystems: `HudController` (display only, no game logic), `BossController` (spawn/attack/death, owning its own groups and talking to the scene through an explicit 8-method `BossHost` interface rather than mutating the scene), and an `Environment` controller for parallax and decals. The boss subsystem is testable in isolation by construction.
- **Resolution-independent by design.** All gameplay lives in an 800×600 "design space"; a camera zoom of `S = nativeHeight / 600` fills any native resolution, and widescreen simply reveals more road. Sprites are oversampled at 2× then scaled down for crisp rendering under zoom, while **hitboxes stay in design units** — so balance is identical across every resolution.
- **Resolution-invariant aim.** The turret is a separate overlay (its rotation never touches the body hitbox); the mouse target is converted from native pixels to design space via `camera.getWorldPoint()` before `atan2`, so aim doesn't drift at non-native resolutions. A gamepad variant drives the crosshair from the right stick.
- **Gamepad as a first-class input.** A reusable `MenuPad` helper gives every menu spatial-focus navigation (nearest element in a direction, with transverse-axis penalties — works for both lists and grids without manual index ordering) and a "last input wins" model that swaps cleanly between pad and mouse. It activates elements by re-emitting `pointerdown`, so there's zero duplicated activation logic.
- **Checkpoint persistence.** `snapshotRun`/`restoreRun` form a symmetric serialize/deserialize pair; the snapshot is written to `localStorage` so "Continue" survives both a death-retry and a closed browser. Only "New Game" clears it.

---

## Quality & tooling

- **Two-stage validation: friendly locally, strict in CI.** In dev, validators run via the Vite plugin with a non-blocking overlay. In CI, `npm run build` chains all four validators → `tsc` → `vite build`, then `npm run lint` runs type-checked ESLint — and a failure blocks merge.
- **Validators that actually parse the code.** They regex-extract numeric constants and display names straight from the TypeScript sources and compare them against `🔒`-locked tables in the design docs: balance checks ~33 numeric fields across vehicles/zombies/bosses/weapons/shop (including **derived DPS** from cooldown and damage) with bidirectional coverage so an orphaned entity in either code or docs fails the build; the art validator cross-links Italian display names to i18n keys so UI text can't drift from the design bibles.
- **Pragmatic, type-checked lint.** ESLint 9 flat config with `projectService: true` (type-checking with no manual tsconfig listing). Phaser's loosely-typed APIs have `no-unsafe-*` deliberately silenced to cut noise, while the high-value rules — floating/misused-promise checks and `no-unused-vars` (with a `_`-prefix opt-out) — stay on.
- **A hardened test environment.** Playwright runs on an isolated port (5174, separate from dev's 5173), disables HMR under test so a mid-run reload can't crash the suite, clears `localStorage` before each test, and launches Chromium with SwiftShader so it needs no GPU on CI.

---

## 100% procedural — no external assets

- **Graphics.** Every texture is authored at runtime through Phaser's Graphics API and baked with `generateTexture()` — 8 zombie types and 4 bosses, 7 survivors, and all 7 vehicles, every sprite composed from shape primitives and oversampled 2× for sharpness under zoom. No image files in `src/`.
- **Post-processing.** Two custom WebGL PostFX pipelines written as **inline GLSL**: a film pipeline (chromatic aberration → ACES tone mapping → grading → vignette → animated grain → CRT scanlines, with edge-only speed streaks) exposing ~11 live parameters tweakable per frame without recompiling, and an asphalt pipeline using FBM noise to weather and de-tile the road. A Canvas-renderer fallback degrades gracefully.
- **Audio.** A full sound library built from oscillators, biquad filters, procedural noise, and gain envelopes — 14+ weapon/impact/gameplay sounds, a procedurally-computed reverb impulse, a `tanh` saturation curve for punch, and a brick-wall master limiter against clipping. The engine loop is *load-responsive*: a `setEngineLoad(factor)` call modulates frequency (46–86 Hz), tremolo rate, and filter cutoff so the engine audibly strains under throttle. Signature frequencies are locked and checked by the audio validator.

---

## Run locally

```bash
npm install
npm run dev        # Vite dev server (live validators via custom plugin)
npm run validate   # art + balance + audio + i18n consistency checks
npm run lint       # type-checked ESLint
npm run build      # validators → tsc → vite build (production)
```

End-to-end (Playwright):

```bash
npm run test:e2e          # all levels
npm run test:e2e:level0   # smoke + UI bounds across 8 resolution presets
npm run test:e2e:level1   # input-fuzzing monkey
npm run test:e2e:level2   # deterministic bot + invariant oracle
```

---

## Credits

A personal side project by **Massimo Manda**.
[LinkedIn](https://www.linkedin.com/in/massimo-manda/) · [GitHub — TODO]

---
---

## Italiano

[🇬🇧 English ↑](#zombie-road-last-escape)

> Una campagna survival finita e scritta a mano, su ruote — porta il tuo **convoglio di sopravvissuti** al rifugio, non solo te stesso.

**Zombie Road: Last Escape** è un gioco arcade survival top-down sviluppato in TypeScript. La strada scorre, il veicolo tiene il bordo sinistro, e si combatte con **mira col mouse** — una torretta-overlay che insegue il cursore, bloccata in un arco frontale di ±82°. Non è un loop di punteggio infinito: la campagna è una **corsa a senso unico di 31 tappe** attraverso sei atti verso un rifugio terminale, in registro *This War of Mine*, dove le persone che porti con te — il loro morale, le tue scelte, chi lasci indietro — sono il punto. Tutto ciò che vedi e senti è generato a runtime: nel sorgente non c'è **nessun PNG e nessun campione audio**.

È un progetto personale. L'ho costruito per spingere sull'ingegneria *attorno* a un gioco, non solo sul gioco: tipi stretti, una pipeline custom di validazione codice↔specifica, test E2E deterministici e una build multi-target.

**Gioca:** [Web (live)](https://zombie-road-last-escape.vercel.app) · [itch.io](https://massimomanda.itch.io/zombie-road-last-escape)
**Costruito con:** TypeScript (strict) · Phaser 3.90 · Vite · WebGL (GLSL inline) · Web Audio API · Playwright · ESLint 9 (typescript-eslint) · Electron

---

### Highlight ingegneristici

- **Un plugin Vite custom che impone l'allineamento codice ↔ specifica.** Quattro validatori (arte, bilanciamento, audio, i18n) girano all'avvio del dev-server e a ogni salvataggio con un debounce di 150 ms su 15+ file osservati. La deriva emerge subito come overlay nel browser — **senza bloccare il dev-server** — e gli *stessi* validatori sono gate duri in CI.
- **Test E2E deterministici per un gioco procedurale.** Un harness Playwright a tre livelli (smoke + bounds-UI su 8 preset di risoluzione → monkey che fuzza l'input → bot che verifica le invarianti) semina un PRNG Mulberry32 prima del boot, così le run sono riproducibili. Invece di screenshot fragili, controlla **9 invarianti a runtime** a ogni frame (salute/carburante/punteggio/distanza/combo finiti e nel range, punteggio non decrescente, veicolo entro i bordi del mondo).
- **Un contratto di stato tipizzato.** Lo stato della corsa vive sul registry di Phaser ma è incapsulato da accessori tipizzati `getRun`/`setRun` su un'unica interfaccia `RunData` — così rinominare una chiave o cambiarne il tipo è un **errore di compilazione, non un bug silenzioso a runtime**. I default sono centralizzati in un solo `resetRunState()`.
- **TypeScript stretto su due config.** Il gioco compila con `strict: true` più `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch` e `noUncheckedIndexedAccess`. Il wrapper desktop ha il suo `tsconfig.electron.json` (CommonJS, ES2022, strict), così il codice platform-specifico è type-checkato indipendentemente dalla build browser (ES2020 / ESNext / `moduleResolution: "Bundler"`).
- **i18n a sei lingue con coerenza imposta dalla build.** Una `t(key, params)` risolve lungo una catena di fallback (corrente → italiano canonico → chiave), con i numeri della UI iniettati come parametri per evitare la deriva rispetto al bilanciamento. Un validatore controlla tutte e sei le locale (it/en/es/fr/de/pt) per insiemi di chiavi coincidenti *e* segnaposto coerenti, così una traduzione mancante non può ricadere di nascosto in una UI mista.

---

### Architettura

- **Campagna data-driven.** Uno `STAGE_MANIFEST` ordinato a senso unico: 31 tappe, ognuna uno `StageDescriptor` che combina bioma, moltiplicatori di lunghezza/spawn/ondata, consumo carburante, rapporti munizioni/hazard, bias del pool zombie ed eventi set-piece (notte/tempesta/blocco). Due biforcazioni fisse e sette diramazioni narrative scambiano i descrittori **senza rompere la progressione lineare di `legIndex`** — contenuto ramificato, zero complessità ramificata.
- **Un modulo di dominio neutro, senza import.** `World.ts` non importa nulla e definisce tutti i dati e i tipi di dominio condivisi (config boss, manifest tappe, geometria strada, tipi nemico/componente/boss). Non dipendendo da nulla, sia `GameScene` sia `BossController` possono importarne senza un ciclo di dipendenze — una decisione deliberata e documentata.
- **Controller invece del monolite.** `GameScene` delega a sottosistemi mirati: `HudController` (solo display, niente logica), `BossController` (spawn/attacco/morte, possiede i propri gruppi e parla con la scena tramite un'esplicita interfaccia `BossHost` a 8 metodi invece di mutarla) e un controller `Environment` per parallasse e decal. Il sottosistema boss è isolatamente testabile per costruzione.
- **Indipendente dalla risoluzione per design.** Tutto il gameplay vive in uno "spazio di design" 800×600; uno zoom della camera `S = altezzaNativa / 600` riempie qualsiasi risoluzione, e il 16:9 mostra semplicemente più strada. Gli sprite sono sovracampionati a 2× e poi riscalati per una resa nitida sotto zoom, mentre le **hitbox restano in unità di design** — così il bilanciamento è identico a ogni risoluzione.
- **Mira invariante alla risoluzione.** La torretta è un overlay separato (la sua rotazione non tocca mai la hitbox del corpo); il bersaglio del mouse è convertito da pixel nativi a spazio di design via `camera.getWorldPoint()` prima dell'`atan2`, così la mira non deriva alle risoluzioni non native. Una variante gamepad pilota il mirino dallo stick destro.
- **Gamepad come input di prima classe.** Un helper riusabile `MenuPad` dà a ogni menu la navigazione a fuoco spaziale (l'elemento più vicino in una direzione, con penalità sull'asse trasversale — funziona sia per liste sia per griglie senza ordinare gli indici a mano) e un modello "vince l'ultimo input" che alterna pulito tra pad e mouse. Attiva gli elementi ri-emettendo `pointerdown`: zero logica di attivazione duplicata.
- **Persistenza a checkpoint.** `snapshotRun`/`restoreRun` formano una coppia simmetrica serializza/deserializza; lo snapshot è scritto in `localStorage` così "Continua" sopravvive sia al retry-dopo-morte sia al browser chiuso. Solo "Nuova Partita" lo cancella.

---

### Qualità & tooling

- **Validazione a due stadi: clemente in locale, severa in CI.** In dev i validatori girano col plugin Vite con overlay non bloccante. In CI, `npm run build` concatena i quattro validatori → `tsc` → `vite build`, poi `npm run lint` lancia ESLint type-checked — e un fallimento blocca il merge.
- **Validatori che leggono davvero il codice.** Estraggono per regex costanti numeriche e nomi-display direttamente dai sorgenti TypeScript e li confrontano con tabelle `🔒` bloccate nei doc di design: il bilanciamento controlla ~33 campi numerici su veicoli/zombie/boss/armi/negozio (incluso il **DPS derivato** da cooldown e danno) con copertura bidirezionale, così un'entità orfana nel codice o nei doc fa fallire la build; il validatore d'arte collega i nomi-display italiani alle chiavi i18n, così la UI non può divergere dalle bibbie di design.
- **Lint pragmatico e type-checked.** ESLint 9 flat config con `projectService: true` (type-checking senza elencare i tsconfig a mano). Le API a tipizzazione lasca di Phaser hanno i `no-unsafe-*` silenziati di proposito per ridurre il rumore, mentre le regole ad alto valore — controlli su promise floating/misused e `no-unused-vars` (con opt-out per prefisso `_`) — restano attive.
- **Un ambiente di test blindato.** Playwright gira su una porta isolata (5174, separata dalla 5173 del dev), disabilita l'HMR sotto test così una ricarica a metà run non manda in crash la suite, pulisce `localStorage` prima di ogni test e avvia Chromium con SwiftShader, così non serve GPU in CI.

---

### 100% procedurale — nessun asset esterno

- **Grafica.** Ogni texture è creata a runtime con la Graphics API di Phaser e cotta con `generateTexture()` — 8 tipi di zombie e 4 boss, 7 sopravvissuti e tutti e 7 i veicoli, ogni sprite composto da primitive geometriche e sovracampionato 2× per la nitidezza sotto zoom. Nessun file immagine in `src/`.
- **Post-processing.** Due pipeline WebGL PostFX custom scritte come **GLSL inline**: una pipeline film (aberrazione cromatica → tone mapping ACES → grading → vignetta → grana animata → scanline CRT, con scie di velocità solo ai bordi) che espone ~11 parametri vivi modificabili a ogni frame senza ricompilare, e una pipeline asfalto che usa rumore FBM per invecchiare e de-tilizzare la strada. Un fallback su renderer Canvas degrada con grazia.
- **Audio.** Una libreria sonora completa costruita da oscillatori, filtri biquad, rumore procedurale e inviluppi di gain — 14+ suoni di arma/impatto/gameplay, un riverbero a impulso calcolato proceduralmente, una curva di saturazione `tanh` per il "corpo" e un limiter brick-wall sul master contro il clipping. Il loop motore è *sensibile al carico*: una chiamata `setEngineLoad(factor)` modula frequenza (46–86 Hz), velocità del tremolo e taglio del filtro, così il motore "fatica" udibilmente sotto gas. Le frequenze-firma sono bloccate e verificate dal validatore audio.

---

### Eseguire in locale

```bash
npm install
npm run dev        # dev server Vite (validatori live via plugin custom)
npm run validate   # coerenza arte + bilanciamento + audio + i18n
npm run lint       # ESLint type-checked
npm run build      # validatori → tsc → vite build (produzione)
```

End-to-end (Playwright):

```bash
npm run test:e2e          # tutti i livelli
npm run test:e2e:level0   # smoke + bounds UI su 8 preset di risoluzione
npm run test:e2e:level1   # monkey che fuzza l'input
npm run test:e2e:level2   # bot deterministico + oracolo a invarianti
```

---

### Crediti

Un progetto personale di **Massimo Manda**.
[LinkedIn](https://www.linkedin.com/in/massimo-manda/) · [GitHub — TODO]
