# CLAUDE.md — Istruzioni di sistema del progetto

> **Leggi questo file PRIMA di ogni altra cosa, all'inizio di ogni sessione.**

## ⛔ Regola n.1 (prioritaria)

**Prima di scrivere codice, consulta l'art bible pertinente per verificare i vincoli di stile e i parametri:**

- [`docs/ART_BIBLE_ZOMBIES.md`](docs/ART_BIBLE_ZOMBIES.md) — nemici/boss + **Standard di Produzione AAA** (vale per tutto il titolo).
- [`docs/ART_BIBLE_AMBIENTE.md`](docs/ART_BIBLE_AMBIENTE.md) — strada, sfondo a strati, illuminazione del mondo.
- [`docs/ART_BIBLE_OGGETTI.md`](docs/ART_BIBLE_OGGETTI.md) — veicoli, armi/proiettili, pickup, componenti, sopravvissuti.
- [`docs/ART_BIBLE_INTERFACCE.md`](docs/ART_BIBLE_INTERFACCE.md) — UI/HUD: titolo, HUD di gioco, negozio, impostazioni/pausa, overlay di esito, debug.
- [`docs/ART_BIBLE_ICONE.md`](docs/ART_BIBLE_ICONE.md) — iconografia: dottrina icona-vs-testo, glifi HUD procedurali (`IconTextures.ts`), teach-once.
- [`docs/ART_BIBLE_AUDIO.md`](docs/ART_BIBLE_AUDIO.md) — suoni & loop del motore: forma d'onda, frequenze, inviluppi, gerarchia di mix (`SoundManager.ts`).

Vale per qualsiasi modifica a nemici, veicoli, armi, oggetti, **interfacce/HUD**, **suoni**, grafica procedurale, animazioni o effetti. Le art bible sono la **fonte di verità** estetica e di game-feel: non improvvisare palette, pose o numeri — segui (o aggiorna esplicitamente) le loro schede.

## ⚠️ Regola n.2 (anti-deriva)

Se cambi un numero nel codice, aggiorna il documento corrispondente e ri-valida:

- **costante visiva/di movimento** (`ZOMBIE_STATS.scale`, `ZOMBIE_MOTION`, dimensioni frame, colori/token UI) → aggiorna l'**art bible** → `npm run validate:art`;
- **valore di bilanciamento** (`VEHICLES`, `WEAPONS`, `ZOMBIE_STATS` velocità/hp/danno/punteggio, `BOSS_CONFIG`, `SHOP_ITEMS`, costanti di missione di `GameScene.ts`) → aggiorna la tabella 🔒 di [`docs/BALANCE.md`](docs/BALANCE.md) → `npm run validate:balance`.

```bash
npm run validate        # art + balance + audio + i18n insieme
npm run build           # esegue tutti i validatori come gate duro, poi tsc + vite build
```

Gli script confrontano i numeri del codice con quelli scritti nei documenti e **falliscono se divergono**. Sono agganciati a `npm run build` **e** attivi durante `npm run dev` (un plugin Vite ri-valida a ogni salvataggio e segnala la deriva con banner + overlay, senza fermare il server).

## 📐 Regola n.3 (design)

Le art bible coprono *come appare/suona* il gioco. Per *come si gioca* e *quali numeri* la fonte di verità sono i documenti di design — consultali prima di toccare regole, progressione o bilanciamento:

- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — core loop, regioni/boss, progressione, condizioni di vittoria/sconfitta.
- [`docs/BALANCE.md`](docs/BALANCE.md) — economia, curve di difficoltà, formule, costi.

Se cambi una **regola di gioco** (core loop, game over, ruoli) aggiorna `GAME_DESIGN.md`; se cambi un **valore-sorgente** (prezzi, HP, danno, cooldown, ricompense) aggiorna le tabelle di `BALANCE.md`.

---

## Il progetto in breve

- **Nome:** Zombie Road: Last Escape
- **Genere:** arcade survival top-down (la strada scorre verso sinistra, il veicolo si muove su/giù).
- **Combat:** **mira col mouse** — la torretta è un overlay che ruota verso il puntatore (clamp all'arco frontale ±82°) e si spara attivamente tenendo premuto il mouse (o `SPAZIO`) verso il mirino. Non è più autofire dritto in avanti: questa è la nuova fondazione del combat (combat reboot, branch `aim-combat`). I sistemi di Track A (Overdrive/Caricatore/Sputatore/Hazard) restano e convivono.
- **Stack:** Phaser 3.90 + TypeScript + Vite. UI **internazionalizzata** (it · en · es · fr · de · pt); l'italiano è la locale di default e canonica. Vedi [`docs/I18N.md`](docs/I18N.md).
- **Grafica:** **100% procedurale** — geometria via Graphics API → `generateTexture`; **post-processing via shader GLSL inline** (`src/pipelines/`, gestiti da `src/PostFx.ts`). **Nessun PNG / nessun asset esterno** (il GLSL è una stringa nel `.ts`, non un file). Deroga documentata in [`docs/ART_BIBLE_ZOMBIES.md`](docs/ART_BIBLE_ZOMBIES.md) §"Standard di Produzione AAA".
- **Audio:** **100% procedurale** (Web Audio API) in `src/SoundManager.ts`. Direzione sonora in [`docs/ART_BIBLE_AUDIO.md`](docs/ART_BIBLE_AUDIO.md).
- **Risoluzione & scaling:** il gioco è **simulato in spazio di design 800×600** e la camera di ogni scena va in **zoom** per riempire la risoluzione nativa scelta dal giocatore (menu Impostazioni → `Config.RESOLUTIONS`, preset 4:3 e 16:9, + schermo intero). Vedi **Risoluzione & scaling** sotto.
- **Architettura tecnica:** per il quadro d'insieme non ovvio dal codice (scaling design+zoom, sovracampionamento `OS_G`/`OVERSAMPLE`, flusso e comunicazione tra le scene via `registry`/`Settings`) vedi [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md).

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | avvia Vite in sviluppo |
| `npm run build` | **valida art + balance + audio + i18n** → `tsc` → build di produzione |
| `npm run validate` | esegue i quattro validatori (art + balance + audio + i18n) |
| `npm run validate:art` | allineamento codice ↔ art bible |
| `npm run validate:balance` | allineamento codice ↔ `BALANCE.md` |
| `npm run validate:audio` | allineamento codice ↔ `ART_BIBLE_AUDIO.md` |
| `npm run validate:i18n` | dizionari `src/locales/` completi e coerenti vs `it.ts` |
| `npm run lint` | **ESLint** type-checked (typescript-eslint): floating/misused-promises, inutilizzati, ecc. — `lint:fix` per l'autofix |
| `npm run preview` | anteprima della build |

> **CI:** `.github/workflows/ci.yml` esegue `npm run build` + `npm run lint` a ogni push/PR (gate anti-deriva + type-check + lint + build). Strategia di QA e checklist di playtest manuale in [`docs/TESTING.md`](docs/TESTING.md); test unitari delle formule pure restano da aggiungere.
>
> **Type-check stretto** (`tsconfig.json`): oltre a `strict`, sono attivi `noUnusedLocals`/`noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess` (→ gli accessi indicizzati sono `T | undefined`: asserisci `!` alla fonte solo dove l'indice è provabilmente valido), e `moduleResolution: "Bundler"`.

## Mappa del codice

| Area | File / simbolo |
|---|---|
| Scena di gioco principale | `src/scenes/GameScene.ts` |
| Negozio tra le missioni | `src/scenes/ShopScene.ts` |
| Modalità debug / galleria modelli | `src/scenes/DebugScene.ts` |
| Dati condivisi (veicoli, armi, sopravvissuti) | `src/GameData.ts` (i campi `name`/`desc`/`ability` sono **chiavi i18n**) |
| Dati di dominio neutri (boss, geometria strada, tipi) | `src/World.ts` — `BOSS_CONFIG`/`BOSS_ORDER`, `ROAD_*`, `ZombieType`/`ComponentKey`/`BossType` (modulo senza import → rompe il ciclo GameScene↔BossController) |
| Testi / internazionalizzazione | `src/i18n.ts` → `t()` · dizionari in `src/locales/<lang>.ts` (vedi [`docs/I18N.md`](docs/I18N.md)) |
| Audio procedurale | `src/SoundManager.ts` |
| Texture & animazioni nemici/boss/oggetti | `src/EntityTextures.ts` → `buildEntityTextures()` |
| Texture veicolo | `src/VehicleTextures.ts` → `buildVehicleTexture()` |
| Statistiche nemici | `ZOMBIE_STATS` (in `GameScene.ts`) |
| Personalità di movimento + VFX | `ZOMBIE_MOTION`, `updateZombieMotion()`, `emitZombieFx()` |
| Boss di fine regione | dati `BOSS_CONFIG`/`BOSS_ORDER` (in `src/World.ts`) + sottosistema in `src/BossController.ts` (`spawn`/`update`/`onBulletHit`/`enterPhase2`, dialoga con la scena via interfaccia `BossHost`) |
| HUD di gioco (vista) | `src/HudController.ts` (barre, % salute, combo, scatto, selettore armi, componenti, debug, palette daltonico-safe) |
| Stato run sul registry (tipizzato) | `src/RunState.ts` → contratto `RunData` + `getRun`/`setRun` (accesso type-checked) + `resetRunState()` |
| Record persistente (localStorage) | `src/SaveData.ts` (bestMission/bestScore) · preferenze in `src/Settings.ts` |
| Juice / game-feel (hit-stop, vignetta, bloom, muzzle-flash, transizioni) | `src/Juice.ts` |
| Risoluzione, preset, zoom camera, sovracampionamento | `src/Config.ts` |

## Risoluzione & scaling

Tutto vive in uno **spazio di design alto 600** (`DESIGN_H`); larghezza di riferimento `DESIGN_W=800` (4:3). A inizio `create()` ogni scena chiama `setupCamera(this)` che mette la camera in **zoom S = altezzaCanvas / 600** e la centra, così lo spazio di design riempie la risoluzione nativa.

- **Larghezza `designW`** = `larghezzaCanvas / S` (= 800 in 4:3, **maggiore in 16:9** → si vede **più strada**: il veicolo resta a sinistra, gli spawn arrivano dal bordo destro). Usa `designW` per centri/ancoraggi orizzontali; **mai** la vecchia costante 800.
- **Geometria del mondo** (`H`, `ROAD_TOP/CENTER/BOTTOM`, velocità, timer) **invariata** in spazio design → gameplay e bilanciamento identici a ogni risoluzione.
- **Overlay a tutto schermo** (vignetta/grana/scanline/aberrazione/grading/flash) usano `setScrollFactor(0)`: **NON** subiscono lo zoom → vanno dimensionati in **pixel nativi** (`scene.scale.width/height`), non in `designW`.
- **Nitidezza nativa:** le texture più osservate (zombie, veicolo) sono generate a **`OVERSAMPLE`× (=2)** via la factory `OS_G` e gli sprite tornano a scala design con `setScale(x / OVERSAMPLE)`; il testo è nitido grazie a `Ui.text` → `setResolution(OVERSAMPLE)`. Le **hitbox** sono esplicite (`setBodySize`/`setSize` in unità design) → invariate dal sovracampionamento. L'ambiente (strada/parallasse) resta a risoluzione design (morbidezza trascurabile su superficie scura).
- I numeri di design nelle chiamate `generateTexture`/`AF` restano invariati (il fattore OVERSAMPLE è applicato internamente) → il validatore art bible **non** cambia.

## Convenzioni

- Mantieni lo stile/idioma del codice circostante (TypeScript stretto, niente PNG, niente dipendenze nuove senza motivo).
- **Sorgenti solo `.ts`: mai un `.js` in `src/`.** Transpila Vite; `tsc` è in `noEmit` (solo type-check). Un `.js` ombra accanto a un `.ts` verrebbe caricato da Vite al posto del sorgente → codice stantio silenzioso. `src/**/*.js` è in `.gitignore`: non rimuovere i guard. Dettaglio in [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md) §1.
- UI e testi rivolti al giocatore: **mai letterali nel codice** → sempre `t('chiave')` (vedi [`docs/I18N.md`](docs/I18N.md)). L'italiano (`src/locales/it.ts`) è la locale **canonica**: ogni nuova stringa nasce lì, poi si traduce nelle altre. I numeri di gameplay nelle stringhe vanno passati via params (`t('k', { n })`), non scritti a mano.
- Gli effetti "vivi" (rotazione, respiro, VFX) sono **solo visivi**: non devono alterare hitbox o bilanciamento.
- Quando aggiungi un nemico/boss/evento, parti dalla **scheda-template** in fondo all'art bible (§10).
