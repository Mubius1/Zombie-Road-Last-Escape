# 🎓 Tutorial Design — Zombie Road: Last Escape

> **Stato:** v0.1 · bozza di design (non ancora implementato)
> **Ambito:** il **tutorial di onboarding** — cosa si insegna al primo avvio, dove, quando e come. Solo design e UX: nessun codice qui.
> **Cosa NON copre:** numeri di bilanciamento del director di spawn "scuola" → vanno in [`BALANCE.md`](BALANCE.md) quando si implementa; resa visiva fine dei prompt → vincolata da [`ART_BIBLE_INTERFACCE.md`](ART_BIBLE_INTERFACCE.md).
> **Documenti fonte:** regole di gioco in [`GAME_DESIGN.md`](GAME_DESIGN.md) (core loop §1, mira-col-mouse §0); chrome/HUD in [`ART_BIBLE_INTERFACCE.md`](ART_BIBLE_INTERFACCE.md).

Questo documento è la **fonte di verità** del tutorial. Se cambi cosa/come si insegna nel codice, aggiorna anche la scheda qui.

---

## §0 · Principi

Tre regole che guidano ogni decisione sotto.

1. **Si insegna giocando, non leggendo.** Niente schermata-tutorial separata che precede e blocca il gioco (è la cosa che i giocatori saltano). Il tutorial **è** la Missione 1: prompt contestuali *just-in-time* mentre il giocatore compie davvero l'azione, su uno spawn ridotto e indulgente ("missione-scuola"). Attrito minimo.
2. **Mai chiedere "vuoi il tutorial?".** È una decisione che il nuovo giocatore prende senza ancora sapere cosa sta decidendo → frizione inutile. Il tutorial **parte da solo** al primo avvio, è **sempre saltabile** e **rigiocabile** (§5).
3. **Adattivo al dispositivo, dal vivo.** I prompt mostrano i comandi del **dispositivo attualmente in uso** (tastiera/mouse vs gamepad) e cambiano **nel frame stesso** se il giocatore cambia dispositivo. L'infrastruttura esiste già (§4) — il tutorial la riusa, non la reinventa.

---

## §1 · Ambito — solo il *core* (3 passi)

Il combat reboot ha molti verbi; insegnarli tutti al primo giro sommerge il nuovo giocatore. Il tutorial copre **solo i tre verbi fondamentali**, quelli senza i quali non si gioca:

| # | Verbo | Perché è core |
|---|---|---|
| **1** | **Muoversi di corsia** (su/giù) | Senza questo non si schiva nulla. |
| **2** | **Acceleratore / Freno** (throttle) | È la doppia risorsa + il ritmo del gioco ([GAME_DESIGN §0](GAME_DESIGN.md), pilastro 1). |
| **3** | **Mira + Sparo** | È il **cuore del reboot** ([GAME_DESIGN §0](GAME_DESIGN.md), decisione combat reboot): spari **dove punti**, arco frontale ±82°. |

**Fuori ambito (deliberatamente):** scatto anti-aggancio, cambio arma, Overdrive/Sovraccarico, granata. Si imparano dopo, tramite **hint contestuali opportunistici** (sul modello dell'hint "🎮 Controller collegato" già esistente, [`GameScene.showPadHint()`](../src/scenes/GameScene.ts)) o al loro primo sblocco al negozio. Non in questo tutorial.

> 🔁 Se in futuro si vuole insegnare anche lo scatto/armi nel tutorial iniziale, **aggiorna prima questa sezione** (decisione di scope), poi il codice.

---

## §2 · Dove e quando si attiva

### Trigger di primo avvio
Oggi **non esiste** alcun flag "tutorial già visto" (verificato: nessun `tutorialSeen`/`firstRun` in `src/`). Va aggiunto — vedi §8.

Condizione di avvio automatico:

```
primaVolta = (SaveData.bestMission === 0) && !Settings.tutorialSeen
```

`SaveData.bestMission === 0` = nessuna missione mai completata; `Settings.tutorialSeen` = il giocatore non l'ha già visto/saltato. Entrambe vere → il tutorial parte.

### Punto nel flusso delle scene
Il tutorial **non è una scena nuova**: vive **dentro `GameScene`** durante la Missione 1, attivato a inizio `create()` quando `primaVolta` è vera. Motivazioni:

- riusa il mondo, il veicolo, gli input e l'HUD reali → il giocatore impara sui comandi *veri*, non in una sandbox finta;
- nessuna nuova transizione da gestire (tutte passano da [`Juice.go()`](../src/Juice.ts#L134)).

Quando attivo, un piccolo **stato tutorial** in `GameScene` fa due cose: (a) ammorbidisce il director di spawn (vedi §3), (b) mostra il prompt del passo corrente e avanza al soddisfacimento del criterio. Concluso il passo 3, lo stato si spegne, si setta `tutorialSeen`, e la missione prosegue come una normale Missione 1.

---

## §3 · I tre passi (curriculum)

Ogni passo ha: un **copione** (cosa dice il prompt), un **criterio di avanzamento** (cosa deve fare il giocatore per passare oltre), e il **contesto di spawn** durante quel passo. I comandi mostrati sono **dinamici** (§4): qui sotto la colonna *Tastiera/Mouse* e *Gamepad* sono i due copioni tra cui il sistema sceglie a runtime.

### Passo 1 — Muoviti
| | |
|---|---|
| **Obiettivo** | Cambiare corsia su e giù. |
| **Tastiera** | `↑ ↓` (o `W S`) per cambiare corsia. |
| **Gamepad** | Stick sinistro su/giù. |
| **Criterio di avanzamento** | Il giocatore ha raggiunto sia la fascia **alta** sia la fascia **bassa** della strada (oppure: input verticale cumulativo oltre soglia). |
| **Spawn** | Nessun nemico. Strada pulita, zero pressione. |

### Passo 2 — Accelera e frena
| | |
|---|---|
| **Obiettivo** | Capire che la velocità si modula (e che il carburante è una risorsa). |
| **Tastiera** | `→` (o `D`) accelera · `←` (o `A`) frena. |
| **Gamepad** | Grilletto destro/`LT` accelera · `LB` frena. *(allinea ai mapping reali in `GameScene.buildInput()` al momento dell'implementazione)* |
| **Criterio di avanzamento** | Ha **accelerato** fino a superare una velocità-soglia **e poi** rallentato/frenato almeno una volta. |
| **Spawn** | Ancora nessun nemico, o qualche relitto innocuo da costeggiare. Si può mostrare un micro-cenno al carburante nell'HUD. |

### Passo 3 — Mira e spara *(il climax)*
| | |
|---|---|
| **Obiettivo** | Il verbo centrale: punta e fai fuoco. Far percepire l'arco frontale ±82°. |
| **Tastiera/Mouse** | Muovi il **mouse** per mirare · **clic** (o `SPAZIO`) per sparare. |
| **Gamepad** | **Stick destro** per mirare · grilletto destro/`RT` per sparare. |
| **Criterio di avanzamento** | Ha abbattuto i primi **N** zombi (proposta: 3–5). |
| **Spawn** | Pochi `common` lenti, in arco frontale, uno alla volta. Bersagli-scuola, non un'ondata. |

Concluso il passo 3 → fade del prompt finale, lo stato tutorial si spegne, la missione torna alla curva di spawn normale.

> ⚠️ **Sottigliezza da non perdere:** la mira è l'unico passo dove tastiera e pad differiscono *concettualmente* (puntatore mouse vs stick destro a distanza fissa `PAD_AIM_DIST`). Non basta scambiare il nome del tasto: servono **due copioni veri** (muovi il mouse ≠ inclina lo stick). Vedi §4.

---

## §4 · Dinamicità input — riuso, non reinvenzione

Il gioco ha **già** un meccanismo "last-input-wins" robusto:

- il flag [`usingPad`](../src/scenes/GameScene.ts#L299) è `true` mentre l'ultimo input è da gamepad, `false` su mouse/tastiera; si aggiorna in `buildInput()`, `updateAim()` e durante gli esiti;
- l'adapter [`padKey(base)`](../src/scenes/GameScene.ts#L843) restituisce `base + 'Pad'` quando `usingPad`, e i prompt di esito si **rinfrescano dal vivo** ([`GameScene.ts:853–858`](../src/scenes/GameScene.ts#L853)).

Il tutorial **usa lo stesso pattern**: ogni passo definisce due chiavi i18n (`tutorial.move` / `tutorial.movePad`, ecc.) e sceglie con `usingPad`, ri-valutando ogni frame mentre il prompt è a schermo. Così se il giocatore stacca la tastiera e prende il pad a metà tutorial, il prompt cambia immediatamente — **costo di plumbing quasi nullo**.

---

## §5 · Skip e replay

- **Skip:** sempre disponibile. Proposta: **tieni premuto `ESC`** (tastiera) / **`START`** (pad) per saltare → setta `tutorialSeen = true`, spegne lo stato tutorial, la missione prosegue normale. Il prompt di skip è anch'esso dinamico (§4). "Tieni premuto" anziché un tap evita lo skip accidentale.
- **Replay:** voce **"Rivedi tutorial"** in [`SettingsScene`](../src/scenes/SettingsScene.ts) che azzera `tutorialSeen` (e, se si vuole, riporta a una missione-scuola). Serve a chi l'ha saltato o vuole ripassare i comandi.

---

## §6 · Resa visiva (vincolata dall'art bible interfacce)

I prompt sono **chrome** → seguono [`ART_BIBLE_INTERFACCE.md`](ART_BIBLE_INTERFACCE.md), non improvvisano:

- **Leggibilità batte decorazione** (regola d'oro): il prompt non copre mai una minaccia e non soffoca l'azione.
- **Posizione:** banda bassa/centrale come gli hint esistenti; coerente con `showPadHint()` (sopra la strada) e con la fascia hint comandi (`y H-6`). Da fissare in §6 dell'art bible interfacce quando si implementa.
- **Stile testo:** helper `Ui.text` (font canonico, `setResolution(OVERSAMPLE)`), scala tipografica "label/hint" (non titolo), palette del chrome (blu/grigio freddo = "voce del sistema").
- **Entrata/uscita:** fade/tween come ogni elemento UI (mai cut secco), coerente col game feel dichiarato.
- **Simboli coerenti** col set esistente (`▶` avanti, ecc.). Comandi tra parentesi quadre come i prompt di esito (`[ SPAZIO ]`, `[ A ]`).

> Quando si implementa: aggiungere una **scheda "Prompt di tutorial"** in `ART_BIBLE_INTERFACCE.md` (posizione, taglia, colore, tween) e ri-validare con `npm run validate:art` se introduce token/colori nuovi.

---

## §7 · Localizzazione

Vincolo di progetto: **nessun letterale rivolto al giocatore nel codice** → tutto via `t('chiave')`, italiano canonico in [`it.ts`](../src/locales/it.ts), e `npm run validate:i18n` **fallisce** se gli altri 5 dizionari non sono allineati.

- Nuova sezione **`tutorial.*`** in `it.ts`, con coppie comando-dipendenti sul modello `…`/`…Pad` (come `game.toShop`/`game.toShopPad`, [`it.ts:175–179`](../src/locales/it.ts#L175)).
- Chiavi proposte (bozza):

| Chiave | Tastiera/Mouse | Gamepad (`…Pad`) |
|---|---|---|
| `tutorial.move` | "Usa ↑ ↓ per cambiare corsia" | "Stick sinistro per cambiare corsia" |
| `tutorial.throttle` | "→ accelera · ← frena" | "RT/LT accelera · LB frena" |
| `tutorial.aim` | "Muovi il mouse per mirare · clic per sparare" | "Stick destro per mirare · RT per sparare" |
| `tutorial.aimGoal` | "Abbatti {n} zombi" | *(stesso)* |
| `tutorial.skip` | "Tieni premuto ESC per saltare" | "Tieni premuto START per saltare" |
| `tutorial.done` | "Pronto. Buona fortuna là fuori." | *(stesso)* |

(I numeri di gameplay nelle stringhe vanno passati via params: `t('tutorial.aimGoal', { n })`, non scritti a mano.) Tradurre poi in `en/es/fr/de/pt`.

---

## §8 · Persistenza del flag

- Aggiungere **`tutorialSeen: boolean`** (default `false`) a [`Settings`](../src/Settings.ts) — **non** a [`SaveData`](../src/SaveData.ts).
- **Perché Settings e non SaveData:** è una preferenza sul *giocatore*, non sullo stato della corsa. Deve **sopravvivere a "Nuova Partita"** (chi ricomincia da capo conosce già i comandi e non vuole rifare il tutorial). `SaveData.clearRun()` non deve toccarlo.
- Si setta a `true` in due casi: tutorial completato (fine passo 3) **oppure** saltato (§5).

---

## §9 · Checklist di implementazione (quando si parte)

Solo mappa dei tocchi previsti — nessun codice qui.

1. `src/Settings.ts` — campo `tutorialSeen` + load/save (chiave `zombieRoad.settings.v1`).
2. `src/scenes/GameScene.ts` — stato tutorial: rilevamento `primaVolta` in `create()`, macchina a 3 passi con criteri di avanzamento, softening del director di spawn mentre attivo, prompt dinamico via `usingPad`/`padKey`, gestione skip.
3. `src/locales/*.ts` — sezione `tutorial.*` in tutte e 6 le lingue → `npm run validate:i18n`.
4. `src/scenes/SettingsScene.ts` — voce "Rivedi tutorial".
5. `docs/ART_BIBLE_INTERFACCE.md` — scheda "Prompt di tutorial" → `npm run validate:art` se nuovi token.
6. Se il softening dello spawn introduce numeri-sorgente → tabella in `docs/BALANCE.md` → `npm run validate:balance`.

---

## §10 · Domande aperte (da decidere a implementazione)

- **N zombi** del passo 3: 3 o 5? (Tarare sul fun, non sulla durata.)
- **Criterio movimento** passo 1: "tocca entrambe le fasce" vs "input cumulativo"? La prima è più leggibile come obiettivo.
- **Skip su gamepad:** `START` tenuto premuto va in conflitto con la pausa (`START`)? Valutare un pulsante alternativo o un tap-vs-hold chiaro.
- **Carburante durante il tutorial:** congelato del tutto, o solo rallentato per accennare la risorsa senza punire?
