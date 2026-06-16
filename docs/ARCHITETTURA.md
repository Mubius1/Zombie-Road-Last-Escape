# 🏗️ Architettura tecnica — Zombie Road: Last Escape

> **Stato:** v1.0 · vivo (living document) · giugno 2026.
> **Scopo:** raccogliere in un posto solo le **cose non ovvie dal codice** — il sistema di scaling in spazio di design + zoom camera, il sovracampionamento delle texture (`OS_G`/`OVERSAMPLE`), il flusso tra le scene e **come comunicano**. Salva ore a chi rientra nel codice.
> **Non è** una fonte di verità estetica né di bilanciamento: per *come appare/suona* vedi le **art bible** ([ZOMBIES](./ART_BIBLE_ZOMBIES.md) · [AMBIENTE](./ART_BIBLE_AMBIENTE.md) · [OGGETTI](./ART_BIBLE_OGGETTI.md) · [INTERFACCE](./ART_BIBLE_INTERFACCE.md) · [AUDIO](./ART_BIBLE_AUDIO.md)); per *come si gioca* e *quali numeri* vedi [GAME_DESIGN](./GAME_DESIGN.md) e [BALANCE](./BALANCE.md). Questo documento spiega **come è cucito insieme**.

---

## 1. Stack & pipeline di build

- **Engine:** Phaser 3.90 · **Linguaggio:** TypeScript (strict) · **Bundler/dev server:** Vite.
- **Grafica:** 100% procedurale (Graphics API → `generateTexture`). Nessun PNG, nessun asset esterno.
- **Audio:** 100% procedurale (Web Audio API). Vedi [`ART_BIBLE_AUDIO.md`](./ART_BIBLE_AUDIO.md).
- **UI/testi:** in italiano.

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Vite in sviluppo |
| `npm run build` | **`validate:art`** → `tsc` → build di produzione |
| `npm run validate:art` | confronta le costanti del codice con i numeri nelle art bible; **fallisce se divergono** |
| `npm run preview` | anteprima della build |

> **Anti-deriva (CLAUDE.md Regola n.2):** cambiare una costante visiva/di movimento nel codice **senza** aggiornare l'art bible corrispondente rompe `validate:art`, che è agganciato a `build`. Le `.js` accanto ai `.ts` in `src/` sono output compilato: **non** si modificano a mano.

---

## 2. Mappa dei moduli

```
main.ts ─ avvia →  game.ts ─ configura Phaser, registra le scene
                       │
       ┌───────────────┼─────────────────────────────────────────┐
   MenuScene      GameScene ⇄ ShopScene        SettingsScene   DebugScene
                       │  (la scena "ricca": mondo, entità, HUD, boss, audio)
                       ▼
        Environment · Juice · SoundManager · Ui · Config · GameData · Settings
                       (servizi e dati condivisi, senza stato di scena)
```

| Modulo | Responsabilità | Stato? |
|---|---|---|
| [`main.ts`](../src/main.ts) | entry point: `new Game().start()` | — |
| [`game.ts`](../src/game.ts) | config Phaser (canvas, `FIT`, physics arcade, ordine scene) | — |
| [`Config.ts`](../src/Config.ts) | **scaling**: `DESIGN_W/H`, `OVERSAMPLE`, `RESOLUTIONS`, `setupCamera`, `designWidth` | costanti |
| [`Settings.ts`](../src/Settings.ts) | preferenze persistenti (volume, fx, risoluzione, fullscreen) ⇄ localStorage | **statico globale** |
| [`GameData.ts`](../src/GameData.ts) | dati-sorgente: `VEHICLES`, `WEAPONS`, `SURVIVORS`, `Upgrades` | costanti |
| [`Ui.ts`](../src/Ui.ts) | chrome condiviso: `FONT`, palette `UI`, helper `text`/`panel`/`button`/`enter` | — |
| [`Juice.ts`](../src/Juice.ts) | game-feel: transizioni (`go`/`fadeIn`), overlay filmico, `flash`, `muzzleFlash`/`bloomBurst`/`lightFlash` (l'hit-stop però vive in `GameScene`, deve gateare il suo `update()`) | texture `fx_*` bake-once |
| [`Environment.ts`](../src/Environment.ts) | strada, parallasse a strati, decal (sangue/scorch/skid), fari | texture `env_*` + tileSprite |
| [`SoundManager.ts`](../src/SoundManager.ts) | audio procedurale (vedi art bible audio) | nodi motore + master |
| **scenes/** | `MenuScene` · `GameScene` · `ShopScene` · `SettingsScene` · `DebugScene` | stato di scena |

`GameScene.ts` è di gran lunga il file più grande: contiene `buildEntityTextures` (texture/animazioni nemici, veicolo, proiettili), `buildWorld`, `buildHUD`/`updateHUD`, spawn nemici/pickup, `fireWeapon`, `spawnBoss`/`updateBoss`, `missionComplete`/`gameOver` e l'**`hitStop`** (qui e non in `Juice`, perché deve mettere in pausa il proprio `update()`). Per i punti precisi vedi la *Mappa del codice* in [`CLAUDE.md`](../CLAUDE.md).

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
| `OS_G(w,h)` | `GameScene.buildEntityTextures()` | factory di `Graphics` **sovracampionato**: fa `setScale(OVERSAMPLE)` e fa override di `generateTexture` per moltiplicare `w·h` per `OVERSAMPLE` internamente |
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
   completata  │       └───────▶ SettingsScene (OVERLAY: launch + pause)
   (SPAZIO)    ▼                    │  RIPRENDI → resume+stop · Esci → stop+Menu
        ┌──────────────┐
        │  ShopScene   │──"AVANTI"──▶ GameScene   (missione successiva)
        └──────────────┘
   game over → (M) Menu · boss → ShopScene/Menu · tasto 0 → DebugScene
```

### Transizioni — sempre via `Juice`, mai cut secchi

- **Cambio scena:** `Juice.go(scene, 'Key')` → fade-to-black 320 ms → `scene.start('Key')`. Ingresso: `Juice.fadeIn(scene)` (o `Ui.enter`).
- **Esempi reali:** Menu→Game / Menu→Settings ([`MenuScene`](../src/scenes/MenuScene.ts)); Shop→Game ([`ShopScene`](../src/scenes/ShopScene.ts)); Game→Shop / Game→Menu ([`GameScene`](../src/scenes/GameScene.ts), su `keydown` post-esito); restart missione = `Juice.fadeAndRun(this, () => this.scene.restart())`.
- **`SettingsScene` ha due modi** (riceve `{ from }` in `init`):
  - **da Menu** → scena a sé; "INDIETRO" fa `Juice.go(this, 'MenuScene')`.
  - **da partita (ESC)** → **overlay di pausa**: `GameScene` fa `scene.pause()` + `scene.launch('SettingsScene', { from: 'GameScene' })` (e ferma il motore audio). "RIPRENDI" = `scene.resume('GameScene')` + `scene.stop()`; "Esci al menu" = `scene.stop('GameScene')` + `Juice.go(this,'MenuScene')`. Al `RESUME` `GameScene` riallinea volume e riavvia il motore.
- **`DebugScene`** (galleria modelli) si raggiunge col tasto **0** da `GameScene` ed è uno strumento di sviluppo: setta direttamente la `registry` (soldi, sblocca tutto, scegli veicolo/arma) e torna al gioco/negozio.

---

## 6. Come comunicano le scene — i due canali di stato

Le scene **non si passano oggetti direttamente**. Esistono due canali, con scopi distinti:

### 6.1 `registry` — stato della partita corrente (in memoria, per-run)

La `DataManager` globale di Phaser (`this.registry`, condivisa tra tutte le scene). È il "save game" volatile della run: `GameScene` lo legge in `create()`, `ShopScene` lo modifica con gli acquisti, `GameScene` lo riscrive a fine missione.

| Chiave | Tipo | Significato | Scritta da |
|---|---|---|---|
| `money` | number | valuta corrente | Game (a fine missione), Shop (acquisti), Debug |
| `missionNumber` | number | indice missione corrente | Game (`+1` a fine missione), Debug |
| `vehicle` | string | veicolo equipaggiato | Shop, Debug |
| `ownedVehicles` | string[] | veicoli posseduti | Shop, Debug |
| `currentWeapon` | WeaponType | arma equipaggiata | Game (cambio arma), Shop, Debug |
| `ownedWeapons` | WeaponType[] | armi possedute | Shop, Debug |
| `upgrades` | Upgrades | potenziamenti (armor/engine/turret/fuelTank) | Shop, Debug |
| `survivors` | string[] | sopravvissuti reclutati | Shop, Debug |
| `components` | {engine,wheels,tank,turret,armor}\|null | salute componenti riportata tra missioni | Game (fine missione), Shop (riparazione → 100) |
| `lastScore` | number | punteggio ultima missione | Game |

Letture difensive ovunque: `this.registry.get('money') ?? 0`. **Reset partita** (nuova run / game over → menu) = riscrivere tutte le chiavi ai default (`money 0`, `vehicle 'civilian_car'`, `weapon 'mg'`, ecc.) — vedi `GameScene` (sezioni reset) e `DebugScene.reset`.

### 6.2 `Settings` — preferenze persistenti (localStorage, cross-run)

[`Settings.ts`](../src/Settings.ts): cache statica letta da più scene, serializzata in `localStorage` (`zombieRoad.settings.v1`) → **sopravvive al reload**. Contiene **solo preferenze**, nessuno stato di partita:

| Campo | Default | Uso |
|---|---|---|
| `volume` | 1 | moltiplicatore master del `SoundManager` |
| `screenFx` | true | overlay filmico on/off (`Juice.addOverlay`) |
| `resolution` | 0 | indice in `RESOLUTIONS` (0 = 800×600) — letto da `game.ts` all'avvio |
| `fullscreen` | false | preferenza schermo intero (attivazione effettiva richiede un click — vincolo browser) |

> **Regola mentale:** se è *stato di gioco* (quanti soldi ho, che arma uso) → **`registry`**. Se è *preferenza dell'utente* (volume, risoluzione) → **`Settings`**. Non mescolarli.

---

## 7. Audio — wiring (riassunto; dettaglio sonoro in ART_BIBLE_AUDIO)

- `GameScene.create()` legge l'`AudioContext` da Phaser (`(this.sound as WebAudioSoundManager).context`), istanzia `this.sfx = new SoundManager(ctx)`, applica `setVolume(Settings.volume)` e `startEngine()`.
- Tutti i trigger usano **optional chaining** (`this.sfx?.playShot()`) → niente crash se l'audio non è inizializzato.
- **Ciclo di vita motore:** stop allo `SHUTDOWN` scena / pausa / missione completata / game over; **restart + riallineo volume** all'evento `RESUME` (ritorno dalla pausa Impostazioni).
- `SettingsScene` crea una **sua** istanza `SoundManager` solo per l'**anteprima** del volume (`playZombieKill()`).

---

## 8. Game loop & lifecycle di scena (modello mentale)

- Ogni scena: `init(data)` → `create()` (costruisce texture e oggetti **una volta**) → `update(time, delta)` (muta riferimenti memorizzati, **mai** ricrea oggetti).
- **Texture-once:** texture/spritesheet sono bakeate una sola volta (`generateTexture`) e protette da guardie tipo `if (textures.exists(key)) return;` (vedi `buildEntityTextures`, `Environment`, `Juice.addOverlay`). **Mai** ridisegnare ogni frame.
- **HUD:** `buildHUD()` crea, `updateHUD()` muta solo `displayWidth`/`setText`/`setFillStyle` su oggetti memorizzati. Stesso principio per il mondo che scorre (tileSprite → `tilePositionX`).
- **Effetti "vivi"** (respiro, rotazione, VFX) sono **solo visivi**: non toccano hitbox né bilanciamento (CLAUDE.md, Convenzioni).

---

## 9. Dove guardare per…

| Devo… | Vai a |
|---|---|
| capire una coordinata/centratura | §3 (design space, `designW`) → [`Config.ts`](../src/Config.ts) |
| capire perché una texture è nitida/sfocata | §4 (`OS_G`/`OVERSAMPLE`) |
| seguire un passaggio tra schermate | §5 + `Juice.go`/`fadeAndRun` ([`Juice.ts`](../src/Juice.ts)) |
| sapere dove vive lo stato della run | §6.1 (`registry`) |
| toccare volume/risoluzione/fx | §6.2 ([`Settings.ts`](../src/Settings.ts)) |
| aggiungere/modificare un suono | [`ART_BIBLE_AUDIO.md`](./ART_BIBLE_AUDIO.md) |
| aggiungere un nemico/boss | [`ART_BIBLE_ZOMBIES.md`](./ART_BIBLE_ZOMBIES.md) §10 |
| cambiare un prezzo/HP/danno | [`BALANCE.md`](./BALANCE.md) (+ `validate:art` se è visivo) |
| cambiare una regola di gioco | [`GAME_DESIGN.md`](./GAME_DESIGN.md) |
