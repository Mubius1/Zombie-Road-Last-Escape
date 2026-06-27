# 🏗️ Architettura tecnica — Zombie Road: Last Escape

> **Stato:** v1.1 · vivo (living document) · giugno 2026 (pivot survival-horror: gamepad, throttle, munizioni, drone, Track B).
> **Scopo:** raccogliere in un posto solo le **cose non ovvie dal codice** — il sistema di scaling in spazio di design + zoom camera, il sovracampionamento delle texture (`OS_G`/`OVERSAMPLE`), il flusso tra le scene e **come comunicano**. Salva ore a chi rientra nel codice.
> **Non è** una fonte di verità estetica né di bilanciamento: per *come appare/suona* vedi le **art bible** ([ZOMBIES](./ART_BIBLE_ZOMBIES.md) · [AMBIENTE](./ART_BIBLE_AMBIENTE.md) · [OGGETTI](./ART_BIBLE_OGGETTI.md) · [INTERFACCE](./ART_BIBLE_INTERFACCE.md) · [AUDIO](./ART_BIBLE_AUDIO.md)); per *come si gioca* e *quali numeri* vedi [GAME_DESIGN](./GAME_DESIGN.md) e [BALANCE](./BALANCE.md). Questo documento spiega **come è cucito insieme**.

---

## 1. Stack & pipeline di build

- **Engine:** Phaser 3.90 · **Linguaggio:** TypeScript (strict; vedi *Hardening* sotto) · **Bundler/dev server:** Vite.
- **Grafica:** 100% procedurale — geometria via Graphics API → `generateTexture`; post-processing via shader GLSL inline (`src/pipelines/`, vedi `src/PostFx.ts`). Nessun PNG, nessun asset esterno.
- **Audio:** 100% procedurale (Web Audio API). Vedi [`ART_BIBLE_AUDIO.md`](./ART_BIBLE_AUDIO.md).
- **UI/testi:** internazionalizzati su 6 lingue (`it · en · es · fr · de · pt`), italiano canonico. Vedi §6.3 e [`I18N.md`](I18N.md).

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Vite in sviluppo (+ plugin di ri-validazione a caldo, vedi sotto) |
| `npm run build` | **`validate:art` + `validate:balance` + `validate:audio` + `validate:i18n`** → `tsc` (solo type-check) → build di produzione |
| `npm run validate` | esegue i quattro validatori in sequenza |
| `npm run validate:art` | confronta le costanti visive del codice con i numeri nelle art bible; **fallisce se divergono** |
| `npm run validate:balance` | allineamento codice ↔ `BALANCE.md` (prezzi/HP/danno/cooldown/ricompense) |
| `npm run validate:audio` | allineamento codice ↔ `ART_BIBLE_AUDIO.md` (forme d'onda/frequenze/inviluppi) |
| `npm run validate:i18n` | dizionari `src/locales/` completi e coerenti vs `it.ts` (canonico) |
| `npm run lint` | **ESLint** type-checked (typescript-eslint): floating/misused-promises, inutilizzati, ecc. (`lint:fix` per l'autofix) |
| `npm run preview` | anteprima della build |

> **Anti-deriva (CLAUDE.md Regola n.2):** cambiare una costante visiva/di movimento, un valore di bilanciamento o un parametro audio nel codice **senza** aggiornare il documento corrispondente rompe il validatore relativo. I **quattro** validatori sono agganciati a `build` (gate duro) **e** attivi in `npm run dev` tramite un **plugin Vite** (`scripts/vite-plugin-validate.mjs`) che ri-valida a ogni salvataggio e segnala la deriva con banner + overlay, **senza** fermare il server.

> **Hardening del type-check ([`tsconfig.json`](../tsconfig.json)).** Oltre a `strict` sono attivi `noUnusedLocals`/`noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch` e — i due più impattanti sul codice — `noUncheckedIndexedAccess` (gli accessi indicizzati sono `T | undefined`: asserisci `!` alla fonte **solo** dove l'indice è provabilmente valido, vedi gli `this.items[i]!` di `MenuPad`) e `moduleResolution: "Bundler"`.

> **⚠️ I sorgenti sono SOLO `.ts` — nessun `.js` in `src/` (regola, non opinione).** A transpilare i `.ts` ci pensa **Vite**; `tsc` gira in **`noEmit`** ([`tsconfig.json`](../tsconfig.json)) e fa **solo type-check** durante `build`. Perché è vincolante: la risoluzione di default di Vite prova le estensioni nell'ordine `.mjs → .js → .ts`, quindi un `SoundManager.js` accanto a `SoundManager.ts` **verrebbe caricato al posto del `.ts`** (gli import sono senza estensione) → in `npm run dev` si eseguirebbe codice stantio senza alcun errore. Per questo `src/**/*.js` e `src/**/*.js.map` sono in `.gitignore` e in `src/` non deve **mai** comparire un `.js`. **Non rimuovere questi guard** (`noEmit` + righe `.gitignore`): se ne riemergono dei `.js`, cancellali. *(Storico: una run di `tsc` senza `noEmit` aveva committato un set di `.js` ombra accanto a ogni `.ts` — bonificato il 2026-06-17.)*

---

## 2. Mappa dei moduli

```
main.ts ─ avvia →  game.ts ─ configura Phaser (+ input.gamepad), registra le scene
                       │
   ┌───────────┬───────┼──────────┬───────────────┬───────────┬──────────┐
 MenuScene  GameScene ⇄ ShopScene → RouteScene  SettingsScene  PauseScene  DebugScene
                       │  (la scena "ricca": mondo, entità, HUD, boss, audio)
                       ▼
   Environment · Juice · SoundManager · Shadows · Ui · MenuPad · Config · GameData · Settings
                       (servizi e dati condivisi, senza stato di scena)
```

| Modulo | Responsabilità | Stato? |
|---|---|---|
| [`main.ts`](../src/main.ts) | entry point: `new Game().start()` | — |
| [`game.ts`](../src/game.ts) | config Phaser (canvas, `FIT`, physics arcade, **`input: { gamepad: true }`**, ordine scene) | — |
| [`Config.ts`](../src/Config.ts) | **scaling**: `DESIGN_W/H`, `OVERSAMPLE`, `RESOLUTIONS`, `setupCamera`, `designWidth` | costanti |
| [`Settings.ts`](../src/Settings.ts) | preferenze persistenti (volume, fx, risoluzione, fullscreen) ⇄ localStorage | **statico globale** |
| [`GameData.ts`](../src/GameData.ts) | dati-sorgente: `VEHICLES`, `WEAPONS`, `SURVIVORS`, `Upgrades` | costanti |
| [`Ui.ts`](../src/Ui.ts) | chrome condiviso: `FONT`, palette `UI`, helper `text`/`panel`/`button`/`enter`; `RoundRect` (helper `box`/`button`) espone `getBounds()`/`emit()` per `MenuPad` | — |
| [`MenuPad.ts`](../src/MenuPad.ts) | navigazione **menu col gamepad** riusabile (focus spaziale, "last input wins") — vedi §9 | per-istanza, no stato globale |
| [`Juice.ts`](../src/Juice.ts) | game-feel: transizioni (`go`/`fadeIn`/`fadeAndRun`), overlay filmico, `flash`, `muzzleFlash`/`bloomBurst`/`lightFlash` (l'hit-stop però vive in `GameScene`, deve gateare il suo `update()`) | texture `fx_*` bake-once |
| [`Environment.ts`](../src/Environment.ts) | strada, parallasse a strati, decal (sangue/scorch/skid), fari | texture `env_*` + tileSprite |
| [`Shadows.ts`](../src/Shadows.ts) | ombre 2.5D proiettate sotto veicolo/entità (look del branch visual-aaa) | texture ombra bake-once |
| [`SoundManager.ts`](../src/SoundManager.ts) | audio procedurale (vedi art bible audio): motore **+ drone d'angoscia** persistente | nodi motore + drone + master |
| [`Routes.ts`](../src/Routes.ts) | Track B: nodi rischio/ricompensa (`ROUTE_NODES`) scelti tra una missione e l'altra (vedi §12) | costanti |
| **scenes/** | `MenuScene` · `GameScene` · `ShopScene` · `RouteScene` · `SettingsScene` · `PauseScene` · `DebugScene` | stato di scena |

`GameScene.ts` resta il file più grande ma è stato **decomposto** per coesione in più moduli:
- **Texture procedurali** → [`EntityTextures.ts`](../src/EntityTextures.ts) (nemici, boss, oggetti) e [`VehicleTextures.ts`](../src/VehicleTextures.ts) (veicolo): funzioni pure su `scene.textures`, importate da `GameScene`/`ShopScene`/`DebugScene`/`MenuScene`.
- **HUD** → [`HudController.ts`](../src/HudController.ts): una "vista" che riceve lo stato (`build`/`update`) e aggiorna i display object (barre, % salute, combo, scatto, selettore armi, componenti, debug); non conosce la logica di gioco.
- **Sottosistema boss** → [`BossController.ts`](../src/BossController.ts): possiede stato e gruppi fisici del boss (spawn, attacchi per tipo, 2ª fase, barra HP, morte VFX) e dialoga con la scena tramite l'interfaccia **`BossHost`** (i membri di gameplay che il boss usa sono esposti pubblici su `GameScene`).
- **Dati di dominio neutri** → [`World.ts`](../src/World.ts): `BOSS_CONFIG`/`BOSS_ORDER`, geometria strada (`ROAD_*`) e i tipi condivisi (`ZombieType`/`ComponentKey`/`BossType`/`BossConfig`). Modulo senza import → importabile per valore sia da `GameScene` sia da `BossController` **senza ciclo** (A4).
- **Stato run/record** → [`RunState.ts`](../src/RunState.ts) (contratto tipizzato `RunData` + `getRun`/`setRun` + `resetRunState` sul registry) e [`SaveData.ts`](../src/SaveData.ts) (record persistente in localStorage).

In `GameScene` restano l'orchestrazione del game-loop, `buildWorld`, spawn nemici/pickup, `fireWeapon`, combo/scatto/carburante/sopravvissuti, `triggerMissionComplete`/`endGame`, i dati nemici (`ZOMBIE_STATS`/`ZOMBIE_MOTION`/`SPAWN_POOL`, letti dai validatori; i dati boss e la geometria strada stanno in `World.ts`) e l'**`hitStop`** (qui e non in `Juice`, perché deve mettere in pausa il proprio `update()`). Per i punti precisi vedi la *Mappa del codice* in [`CLAUDE.md`](../CLAUDE.md).
> ✅ Ciclo di moduli risolto (A4): `BossController` non importa più `GameScene` — i dati condivisi vivono in `World.ts`. I validatori art/balance leggono `BOSS_CONFIG` da `World.ts`.

---

## 3. Risoluzione & scaling — spazio di design + zoom camera

**Il concetto più importante da capire prima di toccare coordinate.** Tutta la simulazione vive in uno **spazio di design alto 600** (`DESIGN_H`), largo `DESIGN_W = 800` come riferimento 4:3. Il giocatore sceglie una **risoluzione nativa** (menu Impostazioni → `Config.RESOLUTIONS`, preset 4:3 e 16:9 + schermo intero); la camera di ogni scena viene messa in **zoom** per far riempire allo spazio di design l'intero canvas.

### Come funziona ([`Config.ts`](../src/Config.ts))

A inizio `create()` **ogni scena** chiama `setupCamera(this)`:

```ts
const S = scene.scale.height / DESIGN_H;     // fattore di zoom (es. 1080/600 = 1.8)
const designW = scene.scale.width / S;       // larghezza di design effettiva
cam.setZoom(S);
cam.centerOn(designW / 2, DESIGN_H / 2);
```

Conseguenze (da tenere a mente sempre):

- **Geometria del mondo invariata.** `H`, `ROAD_TOP/CENTER/BOTTOM`, velocità, timer restano in unità di design → **gameplay e bilanciamento identici a ogni risoluzione**. Nessuna costante da riscalare.
- **L'unica cosa che cambia col formato è la larghezza `designW`.** In 4:3 = 800; in 16:9 è **maggiore** (es. 1066 a 1920×1080) → si vede **più strada a destra** (widescreen vero): il veicolo resta a sinistra, gli spawn arrivano dal bordo destro. Per centri/ancoraggi orizzontali usa **sempre `designW`** (via `setupCamera`/`designWidth`), **mai** la costante 800.
- **Gli overlay a tutto schermo** (vignetta, grana, scanline, aberrazione, grading, flash) usano `setScrollFactor(0)` → **non** subiscono lo zoom → vanno dimensionati in **pixel nativi** (`scene.scale.width/height`), non in `designW`.
- Lo **Scale Manager** è in `Phaser.Scale.FIT` + `CENTER_BOTH` ([`game.ts`](../src/game.ts)): la risoluzione interna scelta viene poi adattata alla finestra/schermo mantenendo le proporzioni.

---

## 4. Nitidezza: sovracampionamento (`OS_G` / `OVERSAMPLE` / `AF`)

Se una texture è generata alla dimensione di design e la camera la ingrandisce (zoom `S` fino a 2), diventa **sfocata**. Soluzione: generare le texture **più osservate** a `OVERSAMPLE`× (= **2**) la dimensione di design, poi riportare gli sprite a scala design dividendo per `OVERSAMPLE`.

| Pezzo | Dove | Cosa fa |
|---|---|---|
| `OVERSAMPLE = 2` | [`Config.ts`](../src/Config.ts) | fattore di sovracampionamento; copre i preset fino a 1600×1200 (zoom S ≤ 2) |
| `OS_G(w,h)` | `EntityTextures.ts` → `buildEntityTextures()` | factory di `Graphics` **sovracampionato**: fa `setScale(OVERSAMPLE)` e fa override di `generateTexture` per moltiplicare `w·h` per `OVERSAMPLE` internamente |
| `AF(key,fw,fh,n)` | idem | aggiunge `n` frame a una spritesheet sovracampionata (coordinate × `OVERSAMPLE`) |
| `setScale(x / OVERSAMPLE)` | quando si istanzia lo sprite (es. `DebugScene`) | riporta lo sprite alla scala di design |
| `Ui.text(...) → setResolution(OVERSAMPLE)` | [`Ui.ts`](../src/Ui.ts) | il testo è renderato a DPI maggiore → resta nitido sotto lo zoom |

**Punti chiave (non sbagliare):**
- I **numeri di design** passati a `generateTexture`/`AF` **restano invariati** (il fattore OVERSAMPLE è applicato *dentro* la factory) → **il validatore art bible non cambia**, le schede restano in unità di design.
- Le **hitbox sono esplicite** (`setBodySize`/`setSize` in unità di design) → **invariate** dal sovracampionamento → bilanciamento intatto. Vedi la nota sui boss in [`ART_BIBLE_ZOMBIES.md`](./ART_BIBLE_ZOMBIES.md) (hitbox effettiva = `bodyW·scaleX/OVERSAMPLE × …`).
- L'**ambiente** (strada/parallasse in [`Environment.ts`](../src/Environment.ts)) resta a risoluzione di design: la morbidezza è trascurabile su superficie scura, e il guadagno di nitidezza non vale il costo. Sovracampiona **solo** ciò che il giocatore guarda da vicino (zombi, veicolo).

---

## 5. Flusso tra le scene

```
                 ┌──────────────┐
                 │  MenuScene   │  (titolo)
                 └──┬────────┬──┘
            GIOCA   │        │  IMPOSTAZIONI
                    ▼        ▼
            ┌──────────────┐  ┌────────────────┐
            │  GameScene   │  │ SettingsScene  │──INDIETRO──▶ Menu
            └──┬───────┬───┘  └────────────────┘
   missione    │       │  ESC = pausa
   completata  │       └───────▶ PauseScene (OVERLAY: launch + GameScene in pause)
   (SPAZIO)    ▼                    │  RIPRENDI → resume+stop · Esci → stop+Menu
        ┌──────────────┐            └─ "Impostazioni" ▶ SettingsScene { from: 'GameScene' }
        │  ShopScene   │──"AVANTI"──▶ RouteScene ──scelta percorso──▶ GameScene  (missione succ.)
        └──────────────┘
   game over → pedaggio + restart missione · boss → ShopScene/Menu · tasto 0 → DebugScene
```

### Transizioni — sempre via `Juice`, mai cut secchi

- **Cambio scena:** `Juice.go(scene, 'Key')` → fade-to-black 320 ms → `scene.start('Key')`. Ingresso: `Juice.fadeIn(scene)` (o `Ui.enter`).
- **Esempi reali:** Menu→Game / Menu→Settings ([`MenuScene`](../src/scenes/MenuScene.ts)); Shop→Route→Game ([`ShopScene`](../src/scenes/ShopScene.ts) → [`RouteScene`](../src/scenes/RouteScene.ts)); Game→Shop / Game→Menu ([`GameScene`](../src/scenes/GameScene.ts), su `keydown` post-esito); restart missione = `Juice.fadeAndRun(this, () => this.scene.restart())`.
- **Pausa = `PauseScene` come overlay (non più `SettingsScene`).** ESC in partita chiama `GameScene.openPauseMenu()` → `scene.pause()` (e ferma motore + drone audio) + `scene.launch('PauseScene')`. `PauseScene` è un overlay sopra la `GameScene` congelata con tre pulsanti: **RIPRENDI** = `scene.resume('GameScene')` + `scene.stop()`; **Esci al menu** = `scene.stop('GameScene')` + `Juice.go(this,'MenuScene')`; **Impostazioni** = `scene.launch('SettingsScene', { from: 'GameScene' })` + `scene.stop()` (il ritorno dalle Impostazioni riprende il gioco). Al `RESUME` `GameScene` riallinea volume e riavvia motore + drone.
- **`SettingsScene` ha due modi** (riceve `{ from }` in `init`):
  - **da Menu** → scena a sé; "INDIETRO" fa `Juice.go(this, 'MenuScene')`.
  - **da pausa (`from: 'GameScene'`, lanciata da `PauseScene`)** → **overlay** sopra la `GameScene` ancora in pausa; "RIPRENDI" = `scene.resume('GameScene')` + `scene.stop()`. È questo il `from` che il cambio-lingua a caldo usa per ricostruire l'HUD congelato (§6.3).
- **`RouteScene`** (Track B) si interpone tra negozio e missione (`ShopScene` → `RouteScene` → `GameScene`): mostra i nodi rischio/ricompensa di [`Routes.ts`](../src/Routes.ts), salva la scelta in `routeModifier` (registry) e avvia la missione. Dettaglio in §12.
- **`DebugScene`** (galleria modelli) si raggiunge col tasto **0** da `GameScene` ed è uno strumento di sviluppo: setta direttamente la `registry` (soldi, sblocca tutto, scegli veicolo/arma) e torna al gioco/negozio.

---

## 6. Come comunicano le scene — i due canali di stato

Le scene **non si passano oggetti direttamente**. Esistono due canali, con scopi distinti:

### 6.1 `registry` — stato della partita corrente (in memoria, per-run)

La `DataManager` globale di Phaser (`this.registry`, condivisa tra tutte le scene). È il "save game" volatile della run: `GameScene` lo legge in `create()`, `ShopScene` lo modifica con gli acquisti, `GameScene` lo riscrive a fine missione.

> **Accesso tipizzato (A3).** Il registry di Phaser è `any`. Le chiavi/tipi qui sotto sono il contratto `RunData` in [`RunState.ts`](../src/RunState.ts); leggi/scrivi sempre con `getRun(registry, 'chiave')` / `setRun(registry, 'chiave', valore)` (non `registry.get/set` grezzi) → refusi di chiave e valori del tipo sbagliato diventano errori di compilazione.

Le 18 chiavi del contratto `RunData` ([`RunState.ts`](../src/RunState.ts)):

| Chiave | Tipo | Significato | Scritta da |
|---|---|---|---|
| `missionNumber` | number | indice missione corrente | Game (`+1` a fine missione), Debug |
| `money` | number | valuta corrente | Game (a fine missione), Shop (acquisti), Debug |
| `survivors` | string[] | sopravvissuti reclutati | Shop, Debug |
| `upgrades` | `Upgrades` | potenziamenti **globali del convoglio** (portabili: comprati una volta, non ri-pagati al cambio mezzo; ogni veicolo applica solo quelli nel suo catalogo). Salvataggi vecchi (per-veicolo) fusi da `migrateUpgrades` | Shop |
| `vehicle` | string | veicolo equipaggiato | Shop, Debug |
| `ownedVehicles` | string[] | veicoli posseduti | Shop, Debug |
| `ownedWeapons` | WeaponType[] | armi possedute | Shop, Debug |
| `currentWeapon` | WeaponType | arma equipaggiata | Game (cambio arma), Shop, Debug |
| `ammo` | `Partial<Record<WeaponType, number>>` | **munizioni finite** (pivot horror): riserva per arma; la MG (∞) non è tracciata. Vedi §11 | Game (consumo/raccolta), Shop (restock) |
| `components` | `Record<ComponentKey, number>\|null` | salute (0..100) per componente tra missioni; `null` = veicolo fresco | Game (fine missione), Shop (riparazione → 100) |
| `lastScore` | number | punteggio ultima missione (overlay/record) | Game |
| `routeModifier` | string | Track B: chiave del nodo di percorso scelto (`'none'` = nessuno) | Route, Debug |
| `recruitLockMission` | number | missione in cui si è GIÀ reclutato (1 a sosta); `-1` = nessuno | Shop |
| `food` | number | M2: scorta di campagna di cibo (drenata a inizio missione dai sopravvissuti a bordo) | Game, Shop |
| `hungry` | string[] | M2: sopravvissuti affamati nella missione corrente (abilità spenta) | Game |
| `foodMission` | number | M2: missione per cui il cibo è già stato consumato (evita doppio addebito al retry) | Game |
| `injured` | string[] | M3: sopravvissuti feriti (abilità spenta finché non curati al negozio) | Game, Shop |
| `starveStreak` | number | M3: missioni consecutive con almeno un affamato (a soglia uno se ne va) | Game |

Letture difensive ovunque: `getRun(this.registry, 'money') ?? 0` (ritorna `undefined` se la chiave non c'è ancora). **Reset partita** (Nuova Partita / Debug) = `resetRunState(registry)`, che riscrive tutte le chiavi ai default in un solo punto (`money 0`, `vehicle 'civilian_car'`, `weapon 'mg'`, `food 40`, ecc.) — chiamato da `GameScene`, `MenuScene.newGame` e `DebugScene.startFresh`.

> **Checkpoint cross-sessione (campagna a checkpoint).** Il `registry` è volatile (perso a fine sessione). Per "CONTINUA" tra le sessioni del browser, `RunState` espone `snapshotRun(registry)` → cattura le 18 chiavi in un `RunData` serializzabile, e `restoreRun(registry, run)` → l'inverso. Lo snapshot d'**inizio missione** viene persistito su `localStorage` da [`SaveData.ts`](../src/SaveData.ts) (`zombieRoad.save.v1`, campo `run`, accanto a `bestMission`/`bestScore`): `SaveData.saveRun`/`loadRun`/`hasRun`/`clearRun`. Il game over **non** azzera (si rigioca la missione pagando un pedaggio); solo "Nuova Partita" (e il Debug) chiamano `clearRun()`.

### 6.2 `Settings` — preferenze persistenti (localStorage, cross-run)

[`Settings.ts`](../src/Settings.ts): cache statica letta da più scene, serializzata in `localStorage` (`zombieRoad.settings.v1`) → **sopravvive al reload**. Contiene **solo preferenze**, nessuno stato di partita:

| Campo | Default | Uso |
|---|---|---|
| `volume` | 1 | moltiplicatore master del `SoundManager` |
| `screenFx` | true | overlay filmico on/off (`Juice.addOverlay`) |
| `resolution` | 0 | indice in `RESOLUTIONS` (0 = 800×600) — letto da `game.ts` all'avvio |
| `fullscreen` | false | preferenza schermo intero (attivazione effettiva richiede un click — vincolo browser) |
| `colorblind` | false | barre di stato in palette daltonico-safe |
| `language` | `it`* | lingua dei testi (i18n) — *al primo avvio prova la lingua del browser, poi `it` |

> **Regola mentale:** se è *stato di gioco* (quanti soldi ho, che arma uso) → **`registry`**. Se è *preferenza dell'utente* (volume, risoluzione, lingua) → **`Settings`**. Non mescolarli.

### 6.3 Internazionalizzazione (i18n)

[`i18n.ts`](../src/i18n.ts) espone `t('chiave', params?)`: cerca la chiave nel dizionario della lingua corrente (`Settings.language`), con **fallback su italiano** e infine sulla chiave stessa. I dizionari sono `src/locales/<lang>.ts` (`it · en · es · fr · de · pt`); **`it` è canonico** (contiene ogni chiave).

- **Nessun letterale UI nel codice:** ogni testo passa da `t()`. I dati con testo (`GameData.VEHICLES/WEAPONS/SURVIVORS`, `BOSS_CONFIG`, `ENVIRONMENTS`, `SHOP_ITEMS`, gallerie debug) memorizzano **chiavi**, risolte al render.
- **Numeri di gameplay nelle stringhe** → iniettati via params (`t('hud.score', { n })`), mai duplicati a mano (singola fonte di verità, niente drift con BALANCE).
- **Cambio lingua a caldo:** Phaser non ri-traduce gli oggetti già creati → `SettingsScene.cycleLanguage()` fa `scene.restart()` dell'overlay. Se il cambio avviene **in pausa** (`fromKey === 'GameScene'`), chiama anche `GameScene.refreshLanguage()`: l'HUD vive nella scena congelata sotto e va ricostruito a parte (`HudController.build()` traccia i suoi oggetti in `objects` e li distrugge prima di ridisegnare).
- **Validatori:** `validate-art-bible.mjs` risolve i `name` di GameData attraverso `it.ts` per confrontarli con i nomi italiani delle art bible → la fonte di verità dei nomi italiani è ora `it.ts`.

Guida completa ("aggiungere una lingua / una chiave", insidie font/layout) in [`I18N.md`](I18N.md).

---

## 7. Audio — wiring (riassunto; dettaglio sonoro in ART_BIBLE_AUDIO)

- `GameScene.create()` legge l'`AudioContext` da Phaser (`(this.sound as WebAudioSoundManager).context`), istanzia `this.sfx = new SoundManager(ctx)`, applica `setVolume(Settings.volume)`, poi avvia **due voci persistenti**: `startEngine()` e `startAmbience()`.
- Tutti i trigger usano **optional chaining** (`this.sfx?.playShot()`) → niente crash se l'audio non è inizializzato.
- **Voce 1 — motore.** Loop del veicolo, modulato dal throttle (vedi §10). Ciclo di vita: stop allo `SHUTDOWN` scena / pausa / missione completata / game over; **restart + riallineo volume** all'evento `RESUME` (uscita dalla pausa).
- **Voce 2 — drone d'angoscia (pivot horror).** Bordone grave dissonante persistente, volutamente **sotto** il motore: due sine quasi all'unisono (≈2.5 Hz di battimento) + lowpass cupo + LFO lento. Avviato in `create()` con `startAmbience()` (idempotente). Ogni frame `GameScene.updateAmbience()` calcola un fattore di tensione 0..1 (prossimità boss, HP basso, sferzate, carburante basso) e lo passa a `setDread(factor)`, che alza livello + apertura del filtro + dissonanza. Stesso ciclo di vita del motore: `stopAmbience()` a pausa / missione completata / game over; allo `SHUTDOWN` scena `dispose()` ferma entrambe le voci (`stopEngine()` + `stopAmbience()`) e scollega la catena master.
- `SettingsScene` crea una **sua** istanza `SoundManager` solo per l'**anteprima** del volume (`playZombieKill()`).

---

## 8. Game loop & lifecycle di scena (modello mentale)

- Ogni scena: `init(data)` → `create()` (costruisce texture e oggetti **una volta**) → `update(time, delta)` (muta riferimenti memorizzati, **mai** ricrea oggetti).
- **Texture-once:** texture/spritesheet sono bakeate una sola volta (`generateTexture`) e protette da guardie tipo `if (textures.exists(key)) return;` (vedi `buildEntityTextures`, `Environment`, `Juice.addOverlay`). **Mai** ridisegnare ogni frame.
- **HUD:** `buildHUD()` crea, `updateHUD()` muta solo `displayWidth`/`setText`/`setFillStyle` su oggetti memorizzati. Stesso principio per il mondo che scorre (tileSprite → `tilePositionX`).
- **Effetti "vivi"** (respiro, rotazione, VFX) sono **solo visivi**: non toccano hitbox né bilanciamento (CLAUDE.md, Convenzioni).

### 8.1 Combat a mira col mouse (perché overlay, perché `getWorldPoint`)

Il combat è a **mira col mouse** (combat reboot, branch `aim-combat`), non più autofire frontale. Tre scelte tecniche non ovvie:

- **La torretta è un overlay rotante, non il corpo del veicolo.** La canna non è più "cotta" nelle 7 texture veicolo (in `buildVehicleTexture` resta solo il **mozzo/base**); è una texture separata per arma (`buildTurretTextures` in [`VehicleTextures.ts`](../src/VehicleTextures.ts): `aim_turret_mg/double_mg/rifle/rockets/flamethrower`) sovrapposta sul mozzo e ruotata verso il puntatore. **Motivo:** ruotare lo sprite del *corpo* veicolo ruoterebbe anche la sua hitbox fisica Arcade — rompendo il bilanciamento delle collisioni; ruotare solo l'overlay lascia la hitbox del veicolo invariata (coerente con la regola "effetti vivi = solo visivi"). Il perno per veicolo è `TURRET_DX` (offset x del mozzo, esportato da `VehicleTextures`); la torretta fa `setTexture` al cambio arma.
- **Mira via `cameras.main.getWorldPoint`.** Il puntatore arriva in pixel nativi; va riportato nello **spazio di design sotto lo zoom** (§3) prima di calcolare l'angolo (`atan2`), che è poi clampato all'arco frontale ±82° (costante di feel `MAX_AIM`, **non** validata). Senza questa conversione la mira sarebbe sfasata a ogni risoluzione ≠ 800×600.
- **Proiettili/razzi a `depth 12`.** Velocità **vettoriale** (`physics.velocityFromRotation`) verso il mirino e sprite ruotato; `depth 12` li mette **sopra** veicolo (10) e torretta (11) — prima erano a 8 ("fuoco da sotto il veicolo", bug risolto). Il fuoco col mouse è ignorato se il puntatore è sopra un elemento UI cliccabile (`input.hitTestPointer`) → cliccare l'HUD/selettore armi non spara.

> Le costanti di feel introdotte dal reboot (`MAX_AIM`, knockback `KNOCK`/`KNOCK_DECAY`, sferzate `SURGE_INTERVAL`/`SURGE_BASE`, densità orda) sono **derivate/in taratura** e **non** lette dai validatori 🔒.

---

## 9. Input gamepad & `MenuPad` (pivot horror: il pad pilota tutto)

Il gamepad è uno **schema di input alternativo** (tastiera+mouse restano il default); abilitato in [`game.ts`](../src/game.ts) con `input: { gamepad: true }`. La Gamepad API del browser non espone i pad finché l'utente non preme un tasto dopo il load → l'attivazione è al primo input.

- **In gioco ([`GameScene`](../src/scenes/GameScene.ts)).** `activePad()` ritorna `getPad(0)` se connesso. Lo stick sinistro guida la corsia, lo stick destro la mira; **LT (`L2`, analogico) = acceleratore** e **LB (`L1`) = freno** (throttle, §10); **RT (`R2`, analogico) spara**; START apre la pausa. Il flag `usingPad` realizza **"last input wins"**: un input mouse/tastiera lo spegne, un input pad (stick oltre la deadzone) lo riaccende → l'UI mostra/nasconde gli affordance pad di conseguenza.
- **Nei menu ([`MenuPad.ts`](../src/MenuPad.ts)).** Helper **riusabile** istanziato da ogni scena-menu (`MenuScene`, `PauseScene`, `RouteScene`, `ShopScene`, `SettingsScene`, `DebugScene`): croce/stick spostano il **focus** con **navigazione spaziale** (l'elemento più vicino nella direzione premuta, con penalità sull'asse trasversale → funziona per liste *e* griglie senza ordinamento per indice); A/Start attivano, B torna indietro. L'attivazione **riusa il `pointerdown` già esistente** dell'elemento (`go.emit('pointerdown', …)`) → zero logica duplicata ai call-site. Stesso "last input wins" di `GameScene` (mouse/tastiera spengono il cursore pad). Richiede che i focusable espongano `getBounds()`/`emit()`: per questo `Ui.RoundRect` (gli helper `box`/`button`) li espone, oltre ai `GameObject` nativi.

---

## 10. Throttle / `worldScale` — il "tempo del mondo"

Il giocatore controlla un **throttle** (gas/freno) che non sposta il veicolo nel mondo (resta a sinistra) ma **scala la velocità con cui il mondo scorre**: è la locomozione "soggettiva" di uno scroller a corsia fissa.

- `this.throttle` ∈ `[0, THROTTLE_MAX]`: `0` = freno/STOP totale, `1` = crociera di riferimento (`SCROLL_SPEED`), `THROTTLE_MAX` = tutto gas. Le due sorgenti (tasti/freccia e grilletti analogici) confluiscono in `throttleInput()`; `THROTTLE_ACCEL`/`THROTTLE_DRAG`/`THROTTLE_BRAKE` ne governano salita/inerzia/freno.
- `throttleScroll() = SCROLL_SPEED * throttle` è il fattore unico applicato ogni frame da `applyWorldScroll()` allo scroll di **ambiente, strisce di corsia, pickup/hazard/nubi** e da `update*` all'avanzamento (`distance`), al carburante e al **pitch del motore** (solo suono). Conseguenza: throttle = `0` congela visivamente il mondo ma il giocatore resta vulnerabile (orda).
- È un sistema di **game-feel/locomozione**, non un moltiplicatore di bilanciamento da validare: le costanti `THROTTLE_*` sono di feel, non lette dai validatori 🔒.

---

## 11. Munizioni finite (pivot horror)

Le armi (tranne la MG, ∞) hanno una **riserva finita** → tensione da gestione risorse.

- La capacità per arma vive in `WEAPON_AMMO` ([`GameData.ts`](../src/GameData.ts)); `weaponInfiniteAmmo(w)` è vero per la MG (`WEAPON_AMMO['mg'] === 0`). La **riserva corrente** è `RunData.ammo` (`Partial<Record<WeaponType, number>>`, §6.1): caricata a inizio missione, consumata sparando, ricaricata da casse/garage e dal **restock** del negozio, persistita a fine missione (e nello snapshot checkpoint).
- I numeri (capacità, costo restock) sono **valori di bilanciamento** → in [`BALANCE.md`](./BALANCE.md), non qui.

---

## 12. Track B — percorsi (`Routes.ts` / `RouteScene`)

Tra il negozio e la missione successiva il giocatore sceglie un **nodo di percorso** rischio/ricompensa.

- I nodi sono dati neutri in [`Routes.ts`](../src/Routes.ts) (`ROUTE_NODES`: ognuno con accent, etichette i18n e moltiplicatori). [`RouteScene`](../src/scenes/RouteScene.ts) li disegna come carte (navigabili anche col pad, §9), salva la chiave scelta in `routeModifier` (registry, §6.1) e avvia la missione.
- `GameScene.create()` legge `routeModifier` e applica i moltiplicatori (densità nemici, hazard, monete). `'none'` = nessun modificatore.

---

## 13. Dove guardare per…

| Devo… | Vai a |
|---|---|
| capire una coordinata/centratura | §3 (design space, `designW`) → [`Config.ts`](../src/Config.ts) |
| capire perché una texture è nitida/sfocata | §4 (`OS_G`/`OVERSAMPLE`) |
| seguire un passaggio tra schermate | §5 + `Juice.go`/`fadeAndRun` ([`Juice.ts`](../src/Juice.ts)) |
| sapere dove vive lo stato della run | §6.1 (`registry`/`RunData`) + checkpoint ([`SaveData.ts`](../src/SaveData.ts)) |
| toccare volume/risoluzione/fx | §6.2 ([`Settings.ts`](../src/Settings.ts)) |
| aggiungere/modificare un suono (motore/drone) | §7 + [`ART_BIBLE_AUDIO.md`](./ART_BIBLE_AUDIO.md) |
| far navigare un menu col gamepad | §9 ([`MenuPad.ts`](../src/MenuPad.ts)) |
| capire gas/freno e lo scroll del mondo | §10 (`throttle`/`worldScale`) |
| toccare munizioni / percorsi | §11 (`ammo`) · §12 ([`Routes.ts`](../src/Routes.ts)) |
| aggiungere un nemico/boss | [`ART_BIBLE_ZOMBIES.md`](./ART_BIBLE_ZOMBIES.md) §10 |
| cambiare un prezzo/HP/danno/munizioni | [`BALANCE.md`](./BALANCE.md) (+ `validate:art` se è visivo) |
| cambiare una regola di gioco | [`GAME_DESIGN.md`](./GAME_DESIGN.md) |
