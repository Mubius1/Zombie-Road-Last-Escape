# 🖥️ Art Bible — Interfacce & HUD
### Zombie Road: Last Escape · Direzione Artistica (qualità AAA)

> **Stato:** v1.1 · vivo (living document) · **3 gap di rifinitura chiusi** (font esplicito · ShopScene coesa · palette centralizzata in [`src/Ui.ts`](../src/Ui.ts))
> **Ambito:** tutte le **interfacce** del gioco — la **schermata del titolo** (`MenuScene`), l'**HUD di gioco** (barre, punteggio, percorso, componenti, barra del boss, banner, avvisi), gli **overlay di esito** (missione completata, game over, boss sconfitto), il **negozio/garage** (`ShopScene`), le **impostazioni & pausa** (`SettingsScene`) e la **galleria di debug** (`DebugScene`). Tutto ciò che è **chrome** sopra il mondo di gioco: testo, pannelli, pulsanti, barre, icone.
> **Riferimento di stile:** survival-horror top-down ad alta densità (es. *Dead Nation*) — **HUD da consolle militare sporca**, pulito e leggibile sopra il caos, mai un'interfaccia "da editor" che soffoca l'azione.
> **Vincolo fondante:** UI **100% procedurale** (Phaser 3 `add.text` / `add.rectangle` / `add.graphics` + texture `Juice`). **Nessun PNG, nessuna icona importata, nessun font esterno.** UI e testi **in italiano**.

Questo documento è la **fonte di verità** per chiunque (umano o AI) tocchi un'interfaccia. Se modifichi un colore, una taglia di testo o un pannello, aggiorna anche la sua scheda qui.

> **📐 Risoluzione & scaling (giugno 2026):** le coordinate/taglie qui sono la **baseline di design 800×600**. La camera di ogni scena va in **zoom** per riempire la risoluzione nativa scelta dal giocatore — nuovo **menu Risoluzione** (cycler ◂ ▸) + toggle **Schermo intero** in `SettingsScene`, preset 4:3 e 16:9 in [`Config.RESOLUTIONS`](../src/Config.ts). Centri e ancoraggi a destra usano `designW` (più ampia in 16:9), **non** la costante 800. Il testo resta nitido grazie a `Ui.text` → `setResolution(OVERSAMPLE)`. Dettagli: sezione *Risoluzione & scaling* in [`CLAUDE.md`](../CLAUDE.md).

> **Documenti gemelli:**
> - [`ART_BIBLE_ZOMBIES.md`](./ART_BIBLE_ZOMBIES.md) — i nemici. Contiene la sezione **⭐ Standard di Produzione AAA**, che vale per **tutto il titolo**: è la **stella polare** condivisa. Qui **non la riscrivo** — la **applico alle interfacce**.
> - [`ART_BIBLE_AMBIENTE.md`](./ART_BIBLE_AMBIENTE.md) — la strada e lo sfondo.
> - [`ART_BIBLE_OGGETTI.md`](./ART_BIBLE_OGGETTI.md) — veicoli, armi, pickup, sopravvissuti.
>
> I tre documenti gemelli coprono i tre "personaggi" della scena (nemici · mondo · oggetti). **Questo è il quarto strato: la voce del sistema al giocatore.** Stessa mano, stessa luce di mood, stessa palette firma — ma con un **chrome funzionale freddo** che il mondo di gioco non usa (vedi §3).

---

## ⭐ Come le interfacce servono lo Standard AAA

I tre pilastri del titolo (coesione · game feel · rifinitura) tradotti sulla UI:

- **Coesione.** La UI vive nello **stesso buio desaturato** del mondo: superfici quasi nere blu-viola, **nessuna zona "piatta" chiara**. Gli accenti vivi sono limitati e codificati: i 3 colori firma del titolo (**malato-verde · arancio-fuoco · rosso-sangue**) restano i protagonisti emotivi (conferma, energia, pericolo), affiancati **solo nel chrome** da una famiglia **blu/grigia fredda** che dice "questo è il sistema, non il mondo". L'overlay filmico (`Juice.addOverlay`) e le transizioni in dissolvenza (`Juice.go`/`fadeIn`) avvolgono ogni schermata: la UI è **dentro** la stessa pellicola del gioco, non incollata sopra.

- **Game feel.** L'interfaccia **reagisce e pesa**. Ogni schermata entra in **fade-in** e esce in **fade-to-black** (mai un cut secco). I pulsanti hanno uno **stato di hover** (riempimento + bordo + scala). Le barre di salute/carburante/boss **cambiano colore** alla soglia critica (verde → ambra → rosso). Il banner d'ambiente e l'avviso "⚠ GIGANTE!" entrano in tween. Le impostazioni danno un'**anteprima sonora** al cambio volume. Niente elemento UI "muto".

- **Rifinitura.** Niente testo nudo su nero senza gerarchia. Ogni schermata ha **pannelli con bordo**, **divisori**, una **scala tipografica** chiara (display → titolo → label → valore → hint), **simboli** coerenti (★ valuta · ✓ posseduto · ● equipaggiato · ▶ avanti · ⚠ minaccia · 🔒 bloccato). La differenza tra "prototipo" e "AAA" è qui.

> **Regola d'oro delle interfacce:** *La leggibilità batte la decorazione, sempre. In 1 colpo d'occhio il giocatore deve leggere il suo stato vitale (salute/carburante) senza staccarsi dall'azione, e in un menu deve capire cosa può permettersi, cosa possiede e cosa è selezionato — dal solo colore. Se "bello" e "leggibile" sono in conflitto, vince **leggibile**. L'HUD non copre mai una minaccia.*

---

## 0. Mappa del codice (dove vive tutto)

| Cosa | Dove |
|---|---|
| **Chrome condiviso** (font esplicito, palette canonica, helper `text`/`panel`/`button`/`enter`) | `src/Ui.ts` → `FONT`, `UI`, classe `Ui` |
| **Config globale** (canvas 800×600, `backgroundColor #12121e`, ordine scene) | `src/game.ts` |
| **Schermata del titolo** (sfondo, titolo+alone, pulsanti, hint) | `src/scenes/MenuScene.ts` |
| **HUD di gioco** (pannello, barre, punteggio, percorso, componenti, hint) | `src/scenes/GameScene.ts` → `buildHUD()` + `updateHUD()` |
| **Banner d'ambiente** (nome regione, tween) | `GameScene.buildWorld()` (in fondo) |
| **Barra del boss** (label + barra HP) | `GameScene.showBossHUD()` / `hideBossHUD()` / `updateBoss()` |
| **Avviso "⚠ GIGANTE!"** | `GameScene` (spawn gigante) |
| **Overlay esito** (missione completata · game over · boss sconfitto) | `GameScene` → `missionComplete()`, `gameOver()`, sezioni boss |
| **Negozio / garage** (header, potenziamenti, armi, sopravvissuti, veicoli) | `src/scenes/ShopScene.ts` |
| **Impostazioni & pausa** (volume, effetti schermo, risoluzione, schermo intero, daltonismo, indietro/riprendi) | `src/scenes/SettingsScene.ts` |
| **Preferenze persistenti** (volume, screenFx → localStorage) | `src/Settings.ts` |
| **Galleria di debug** (titolo, card modelli, pulsanti test) | `src/scenes/DebugScene.ts` |
| **Transizioni + overlay filmico** (fade, vignetta, grana, scanline, aberrazione, flash) | `src/Juice.ts` → `go`/`fadeIn`/`addOverlay`/`jitterGrain`/`flash` |
| **Anteprima sonora UI** | `SettingsScene.playPreview()` + `src/SoundManager.ts` |

**Geometria di riferimento UI:** canvas **800×600**. HUD ancorato in alto in una fascia **`y 0–84`**; hint di comandi in basso (`y H-6`); overlay di esito centrati. Le scene-menu (`Menu`/`Shop`/`Settings`/`Debug`) usano l'intera area.

> **Nota tipografica strutturale:** la voce tipografica è ora **esplicita** in [`src/Ui.ts`](../src/Ui.ts) → `FONT = '"Courier New", Courier, monospace'`, applicata a **ogni** testo via l'helper `Ui.text(...)`. Look "consolle/terminale" coerente col tono, ma **deliberato e con fallback** (gap font chiuso — vedi §8).

---

## 1. I tre livelli di lettura (per le interfacce)

Come per i nemici (silhouette → movimento → texture), la UI ha un suo ordine di priorità. **Se devi tagliare, taglia dal fondo.**

1. **STATO** — in 1 colpo d'occhio: *come sto?* (salute/carburante/percorso nell'HUD), *cosa posso fare?* (comprabile/posseduto/equipaggiato/bloccato nel negozio). Questa lettura vive nel **colore funzionale** (§3.1) prima ancora della forma o del testo: verde = ok/possiedo, rosso = pericolo/no, oro = costa/vale, blu = azione/info, grigio = inattivo.
2. **GERARCHIA** — l'occhio deve sapere *dove guardare per primo*. La **scala tipografica** (§3.2) e i **pannelli** (§3.3) creano l'ordine: titolo grande → sezione → label piccola → valore → hint quasi invisibile. Nessuna schermata "tutta della stessa taglia".
3. **MATERIA & MOOD** — bordi, divisori, overlay filmico, alone emissivo dietro al titolo, tween di entrata: aggiungono il *premium* e legano la UI al mondo, ma sono l'ultimo 20%.

> **Regola d'oro:** *Colore funzionale corretto + gerarchia tipografica chiara + 1 accento emissivo per schermata + reazione (hover/soglia/transizione). Mai testo nudo, mai monotaglia, mai stato illeggibile dal colore.*

**Mai** un'interfaccia che è solo righe di testo bianco su nero. Mai un pulsante senza stato di hover. Mai un cut secco tra schermate.

---

## 2. Vincoli tecnici (non negoziabili)

- **Solo primitive UI di Phaser:** `add.text`, `add.rectangle` (con `setStrokeStyle`), `add.graphics` (`fillRect`/`fillGradientStyle`/`lineBetween`), `add.image`/`add.tileSprite` per le texture `Juice` (`fx_light`, `fx_grain`, `fx_scanline`). **Niente** DOM/HTML overlay, niente font web, niente immagini importate.
- **Passa dal modulo `Ui` condiviso** ([`src/Ui.ts`](../src/Ui.ts)). Testo via `Ui.text(scene, …)` (font garantito), pannelli via `Ui.panel(...)`, pulsanti via `Ui.button(...)` (hover gestito), ingresso schermata via `Ui.enter(scene)` (dissolvenza + overlay). I colori del chrome vengono dai token **`UI.*`**: **mai** un hex inline per ciò che è condiviso (resta inline solo un colore davvero locale e usato una volta sola).
- **Costruisci una volta, aggiorna i riferimenti.** L'HUD si **costruisce** in `buildHUD()` e poi `updateHUD()` muta **solo** `displayWidth`/`setText`/`setFillStyle` sugli oggetti memorizzati (`hudHealthFill`, `hudFuelFill`, `hudScore`…). **Mai** ricreare oggetti di testo o rettangoli ogni frame.
- **Profondità esplicita solo dove la UI coesiste col gioco.** Nell'HUD di `GameScene` la depth è codificata (`D = 20`, fill `D+2`, overlay esito `30–31`, vedi §3.4). Nelle scene-menu autonome (`Menu`/`Shop`/`Settings`/`Debug`) l'ordine è dato dalla **sequenza di creazione** (sfondo prima, interattivi dopo) — la depth esplicita non serve.
- **Hover = stato, non animazione costosa.** Lo stato di hover cambia `setFillStyle`/`setStrokeStyle`/`setScale` (tween brevi o set diretto). **Niente** emitter o timer persistenti sui pulsanti.
- **Transizioni via `Juice`, non a mano.** Ingresso schermata = `Juice.fadeIn(scene)`; cambio schermata = `Juice.go(scene, key)` (fade-to-black 320 ms poi `scene.start`). L'overlay filmico = `Juice.addOverlay(scene)` + `Juice.jitterGrain(grain)` in `update()`, **gated da `Settings.screenFx`**.
- **Cosmetico ≠ stato di gioco.** La UI **legge** e **scrive preferenze** (`Settings`) o registry, ma gli effetti visivi (alone, grana, hover, tween) **non** toccano bilanciamento o fisica. L'HUD riflette lo stato; non lo altera.
- **Rispetta `Settings`.** L'overlay filmico è **opzionale** (`screenFx`); il volume è un moltiplicatore globale. Una schermata che ignora le preferenze è un bug di coesione.
- **Performance budget:** la UI è "sempre accesa" → deve essere quasi gratis. Testo e pannelli statici costruiti una volta; in `update()` solo `jitterGrain` + le mutazioni dell'HUD. **60 fps** con HUD + gioco a densità massima.

---

## 3. Linguaggio visivo condiviso

### 3.1 Palette funzionale (la lettura #1)

Il colore dice *lo stato* prima ancora del testo. La UI estende i 3 colori firma del titolo con un **chrome freddo** (blu/grigi) che il mondo di gioco **non** usa: così l'occhio distingue "sistema" da "mondo". **Sei ruoli**, ciascuno con la sua famiglia:

| Ruolo | Significato | Famiglia (hex reali nel codice) |
|---|---|---|
| **Neutro / valore** | informazione pura: punteggio, valori, testo principale | `#ffffff` · `#dddddd` · muted `#888888` / `#bbbbcc` |
| **Oro / valuta** *(firma: arancio-fuoco)* | denaro, prezzo acquistabile, carburante, "vale/costa" | `#ffee44` (valuta) · `#ffcc44` · `#ffcc00` · `#ffaa00` · `#ffaa66`/`#ffaa44` (carburante) |
| **Conferma / possesso** *(firma: malato-verde)* | azione positiva, equipaggiato, comprato, salute alta, "sì" | `#88ff88` · `#88ff44` · `#9dff5a` · `#44cc44` · `#3acb3a` (barra volume) · spento `#446644` |
| **Info / navigazione** *(chrome freddo, solo UI)* | elemento interattivo secondario, percorso, "vai/usa/indietro" | `#88aaff` · `#9ab6ff` · `#4488ff` · `#aaaaff` · `#4466cc` (barra) · `#66ddff` (debug) |
| **Pericolo / blocco** *(firma: rosso-sangue)* | salute bassa, game over, boss, non acquistabile/bloccato | `#ff8888`/`#ff4444`/`#ff2222` (salute) · `#ff6666`/`#ffaaaa` (avvisi) · `#cc0000` (barra boss) · bloccato `#554444`/`#663333` |
| **Inattivo / disabilitato** | non disponibile, hint marginale, sfondo di testo spento | `#333333` · `#445577` · `#556677` · `#7777aa` · `#886677` |

> **Le 3 firme restano i protagonisti emotivi.** Verde = "vita/conferma", arancio-oro = "energia/valore", rosso = "morte/divieto" — gli stessi del mondo. Il **blu è il colore esclusivo dell'interfaccia**: dice "questo è un comando del sistema", e per questo non compare mai sugli oggetti di gioco (vedi `ART_BIBLE_OGGETTI` §3.1, dove il player parla coi 3 colori caldi). Tenerlo **desaturato e relegato al chrome**: mai un blu acceso che invade il campo di gioco.

> **Centralizzazione (gap drift chiuso, §8):** i toni canonici di ogni famiglia vivono ora **in un solo posto**, i token `UI.*` di [`src/Ui.ts`](../src/Ui.ts). Le scene **referenziano i token**, non hex sparsi: niente più 5 verdi quasi-uguali in 5 file. Quando aggiungi un elemento, **scegli il token della famiglia giusta** (`UI.green`/`UI.gold`/`UI.blue`/`UI.red`/`UI.text`…); aggiungi un token nuovo solo se manca davvero un ruolo. Restano inline solo i colori **davvero locali** (sfondo skyline del menu, tint di hover di una singola card, rossi-di-blocco specifici).

### 3.2 Superfici, pannelli e profondità materica

La UI vive su **superfici quasi nere blu-viola**, coerenti col `backgroundColor #12121e` globale. Gerarchia di scuri (dal mondo al primo piano):

| Superficie | Hex / alpha | Uso |
|---|---|---|
| Fondo globale | `#12121e` | colore di clear del canvas (`game.ts`) |
| Fondo scena-menu | `0x080810` (Shop/Settings) · `0x0a0a12` (Debug) | sfondo pieno delle schermate |
| Barra/intestazione | `0x0e0e22` (header negozio) | fascia titolo |
| Pannello | `0x0e0e1a` · `0x0e1e0e` (verde-comprato) · `0x131310` (sopravvissuti) | card e riquadri |
| Pannello modale | `0x0e0e1a` con bordo (Settings) · `#000000` alpha `0.62` (HUD) · `0.85–0.9` (esito/boss) | overlay sopra il gioco |
| Bordi / divisori | `0x222244` · `0x33344a` · `0x333333` | `setStrokeStyle` e `lineBetween` |

**Regole materiche:**
- **Pannello = riempimento scuro + bordo sottile** (`setStrokeStyle(1–2, colore, alpha)`). Mai un pannello senza bordo (sembra un buco).
- **Divisori** (`lineBetween` 1px in `0x222244`) separano le regioni di una schermata fitta (negozio).
- **Modale = velo + scatola.** Gli overlay sopra il gioco (pausa, esito) usano un **velo scuro semi-trasparente** a tutto schermo (così si intravede la scena congelata) + una **scatola** con bordo. Es. pausa: velo `0x080810` alpha `0.8` + scatola `0x0e0e1a` alpha `0.96` bordo `0x222244`.

### 3.3 Tipografia (la scala)

**Font:** codificato in [`src/Ui.ts`](../src/Ui.ts) come `FONT = '"Courier New", Courier, monospace'` e applicato a **ogni** testo tramite l'helper `Ui.text(...)`. Look "consolle/terminale" coerente, ora **deliberato e con fallback** — una sola voce tipografica per tutto il titolo. Per cambiarla, si tocca **un solo punto**.

**Scala tipografica canonica** (px, dai valori reali nel codice):

| Livello | Taglia | Stile | Uso |
|---|---|---|---|
| **Display** | `64px` | bold + stroke | titolo del gioco (`MenuScene`) |
| **Display 2** | `34px` | bold | titolo schermata (Impostazioni) |
| **Titolo** | `20–24px` | bold | titolo negozio, etichette pulsanti grandi, "CONTINUA ▶" |
| **Sezione** | `13–16px` | bold | header di sezione (POTENZIAMENTI, ARMI…), banner ambiente, titolo debug |
| **Valore / corpo** | `11–15px` | normal | punteggio, prezzo, valori, descrizioni |
| **Label** | `10–11px` | normal | etichette barre/componenti, nomi item |
| **Hint / micro** | `8–10px` | normal | comandi in basso, meta ("/ N km"), descrizioni minute |

**Regole:**
- **Bold per ciò che comanda** (titoli, header di sezione, pulsanti, stati attivi); **normal per i valori**.
- **Stroke solo sul testo sopra il gioco vivo** (banner ambiente `stroke #000000` 4px, titolo menu `stroke #2a0c08` 8px, boss label `stroke #000000` 3px): garantisce leggibilità su sfondo rumoroso. Nei menu su fondo scuro pieno lo stroke non serve.
- **Allineamento funzionale:** valuta/valori a destra (`setOrigin(1,0)`), titoli centrati (`setOrigin(0.5)`), label a sinistra.

### 3.4 Profondità di compositing della UI

Coerente con l'ordine del titolo (vedi `ART_BIBLE_ZOMBIES` ⭐): gameplay ≤15 · grading 16 · luci/FX additivi 17 · **vignetta + frangia 18 · scanline + grana 19 · HUD 20+ · flash globale 40**.

| Elemento | Depth | Note |
|---|---|---|
| Overlay filmico (vignetta, aberrazione) | 18 | `Juice.addOverlay` |
| Scanline + grana | 19 | sopra la vignetta |
| **Pannello HUD** | **20** (`D`) | fascia superiore |
| Testo/icone HUD | 21 (`D+1`) | |
| Riempimenti barre HUD | 22 (`D+2`) | salute/carburante/percorso/componenti |
| Banner ambiente | 18 | tween, poi si distrugge |
| Barra del boss (bg/fill/label) | 22–23 | sotto gli overlay di esito |
| Indicatore debug ("◆ GOD MODE") | 25 (`D+5`) | |
| **Overlay di esito** (missione/game over) | **30–31** | velo `30`, testo `31` |
| Flash globale | 40 | `Juice.flash`, sopra tutto |

> Le scene autonome (`Menu`/`Shop`/`Settings`/`Debug`) **non** usano depth esplicita: l'ordine è la sequenza di creazione (sfondo → pannelli → interattivi → overlay filmico per ultimo).

### 3.5 Simboli & icone (procedurali, da glyph)

Niente icone importate: usiamo **caratteri** coerenti, sempre con lo stesso significato.

| Simbolo | Significato | Famiglia colore |
|---|---|---|
| `★` | valuta / costo | oro `#ffee44` |
| `✓` | posseduto / completato | verde spento `#446644` |
| `●` | equipaggiato / attivo | verde `#88ff44` (veicolo) · oro `#ffcc44` (arma) |
| `▶` / `▸` | avanti / voce | verde (azione) · muted (lista) |
| `⚠` | minaccia / allerta | rosso/ambra |
| `🔒` | bloccato | inattivo `#333333` |
| `❚❚` | pausa | blu freddo `#667799` |
| `🔇` | muto | rosso `#ff6666` quando attivo |
| `◂` | indietro | blu `#9ab6ff` |
| `•` | voce di lista (sopravvissuti) | colore del token |

---

### 3.6 Tabella dei token `UI` (verità del codice — anti-deriva automatica)

> Questa è la **tabella-mirror** di [`src/Ui.ts`](../src/Ui.ts): ogni token `UI.<nome>` con il suo valore esatto. §3.1/§3.2 sono la **narrativa** (famiglie e ruoli); **questa** è la verità machine-checked. `npm run validate:art` confronta riga per riga col codice e **fallisce** se un valore diverge, se un token esiste nel codice ma non qui, o viceversa. Quando aggiungi/cambi un token in `src/Ui.ts`, aggiorna **anche** questa riga. (Il token `font` non è un colore e non è verificato qui.)

| Token | Valore | Famiglia · ruolo |
|---|---|---|
| `bg` | `0x080810` | superficie · sfondo scena-menu |
| `bgDeep` | `0x0a0a12` | superficie · sfondo debug |
| `panel` | `0x0e0e1a` | superficie · pannello/card base |
| `panelAlt` | `0x0e0e22` | superficie · header/barra titolo |
| `panelBought` | `0x0e1e0e` | superficie · card "comprato/attivo" |
| `panelWarm` | `0x131310` | superficie · card sopravvissuti |
| `black` | `0x000000` | superficie · velo modale / pannello HUD |
| `stroke` | `0x222244` | bordo · divisore principale |
| `strokeSoft` | `0x33344a` | bordo · tenue (celle) |
| `strokeDim` | `0x333333` | bordo · divisore HUD |
| `white` | `#ffffff` | neutro · valore primario |
| `text` | `#dddddd` | neutro · corpo |
| `muted` | `#888899` | neutro · secondario |
| `faint` | `#556677` | neutro · hint/inattivo |
| `ghost` | `#454a5c` | neutro · hint quasi invisibile |
| `disabled` | `#333333` | neutro · bloccato (🔒/BLOCCATO) |
| `gold` | `#ffee44` | oro · valuta/prezzo comprabile |
| `goldDim` | `#ffcc44` | oro · header/stato attivo arma |
| `amber` | `#ffaa00` | oro · azione "COMPRA"/soglia media |
| `amberSoft` | `#ffaa66` | oro · carburante (testo) |
| `fuelBar` | `0xff8800` | oro · riempimento barra carburante |
| `green` | `#88ff44` | verde · azione positiva/equip |
| `greenSoft` | `#88ff88` | verde · titolo/ok |
| `greenDim` | `#446644` | verde · spento (posseduto/comprato) |
| `greenOk` | `#44cc44` | verde · conferma forte/GRATIS |
| `greenSig` | `0x6cff3a` | verde · FIRMA emissiva (glow/bordo) |
| `greenCell` | `0x3acb3a` | verde · celle volume accese |
| `hpHigh` | `0x44cc44` | verde · barra salute ≥60% |
| `hpMid` | `0xffaa00` | oro · barra salute 30–60% |
| `hpLow` | `0xff2222` | rosso · barra salute <30% |
| `hpFill` | `0xff4444` | rosso · barra salute (iniziale) |
| `blue` | `#9ab6ff` | blu · navigazione (base) |
| `blueBright` | `#88aaff` | blu · header/azione |
| `blueUse` | `#4488ff` | blu · "Usa" (secondario) |
| `blueInfo` | `#aaaaff` | blu · valore informativo (distanza) |
| `cyan` | `#88ddff` | blu · label effetti schermo |
| `cyanDebug` | `#66ddff` | blu · titolo debug |
| `blueLine` | `0x88aaff` | blu · bordo pulsante (num. di blueBright) |
| `distBar` | `0x4466cc` | blu · riempimento barra percorso |
| `red` | `#ff6666` | rosso · avviso/pericolo (base) |
| `redSoft` | `#ffaaaa` | rosso · testo secondario di pericolo |
| `redText` | `#ff8888` | rosso · label salute |
| `redCrit` | `0xcc0000` | rosso · barra del boss |
| `barRed` | `0x331111` | barra HUD · dietro salute |
| `barAmber` | `0x331800` | barra HUD · dietro carburante |
| `barBlue` | `0x111122` | barra HUD · dietro percorso |
| `barGrey` | `0x1a1a1a` | barra HUD · dietro componenti |

---

## 4. Schede delle interfacce

> Ogni scheda: **Ruolo** (a cosa serve) · **Layout** (regioni e geometria) · **Palette/Tipografia** (hex e taglie reali) · **Reazione** (hover, soglie, transizioni) · **Note** (cosmetico ≠ stato).

---

### 4.1 SCHERMATA DEL TITOLO — `MenuScene` · *la prima impressione*

**Ruolo:** prima scena (`game.ts` la registra per prima). Due voci: **NUOVA PARTITA** (azzera il progresso nel registry e parte) e **IMPOSTAZIONI**. È la "copertina": deve dire *horror su strada, premium* in 1 schermata ferma.

**Layout (800×600):**
- **Sfondo procedurale** (`buildBackdrop`): cielo a gradiente `0x07070d → 0x141320/0x18121e` (alto quasi nero → orizzonte blu-grigio malato), terreno `0x090910`; **skyline in rovina** (edifici `0x04040a` con rare finestre ambra `0xcaa84a` alpha 0.5); **linea d'orizzonte rosso-sangue** `0x7a1e12` alpha 0.45 (unico accento saturo del fondo); carreggiata accennata `0x111119` con strisce consumate `0x3a3520` alpha 0.22.
- **Titolo** (`buildTitle`, y≈142): **"ZOMBIE ROAD"** display `64px` bold, colore `#c8d0a0`, `stroke #2a0c08` 8px; sotto **"Last Escape"** `22px` italic `#7a8a55`. Dietro, **alone emissivo malato-verde** (`fx_light` tint `0x6cff3a`, ADD, scala 8×3, alpha 0.16→0.30 **pulsante** in tween 1700ms yoyo).
- **Pulsanti** (`buildButtons`, y 330 / 402): box `340×58`, ognuno con base/hover/bordo/testo dedicati — NUOVA PARTITA verde (`base 0x13260f`, `hover 0x1f3a17`, `bordo 0x6cff3a`, testo `#9dff5a`), IMPOSTAZIONI blu (`base 0x101826`, `hover 0x1a2740`, `bordo 0x88aaff`, testo `#9ab6ff`); label `24px` bold.
- **Hint** (y 552): `"Premi INVIO per iniziare · clic per scegliere"` `12px` `#454a5c`.

**Reazione:** `Juice.fadeIn` all'ingresso; alone pulsante; **hover pulsante** = `setFillStyle(hover)` + bordo a piena alpha + `txt.setScale(1.04)`; `INVIO` = nuova partita; `Juice.go` (fade-to-black) verso `GameScene`/`SettingsScene`. Overlay filmico + `jitterGrain` se `Settings.screenFx`.

**Note:** il titolo è l'unico posto dove l'accento emissivo (verde firma) è **decorativo e ampio**; altrove gli emissivi sono parchi. La firma "rosso all'orizzonte + verde sul titolo" mette in scena due dei tre colori del titolo già in copertina.

---

### 4.2 HUD DI GIOCO — `GameScene.buildHUD()` / `updateHUD()` · *lo stato vitale*

**Ruolo:** l'unica UI che **coesiste col gioco vivo**. Deve dire salute, carburante, punteggio, missione, arma, percorso e stato dei 5 componenti **senza coprire le minacce**. È la scheda più delicata: qui "leggibile batte bello" non è negoziabile.

**Layout — fascia superiore `y 0–84`** (pannello `add.graphics`: `#000000` alpha `0.62`, linea divisoria `0x333333` alpha 0.7 a `y 46`):
- **SALUTE** (x 8): label `11px` `#ff8888`; barra `110×10` su fondo `0x331111`, fill `0xff4444` (vedi soglie).
- **CARBURANTE** (x 138): label `11px` `#ffaa66`; barra `110×10` su fondo `0x331800`, fill `0xff8800`; numero `%` `#ffaa66`.
- **PUNTEGGIO** (x 290, y 6): `13px` `#ffffff`. · **MISS.N** (x 620): `12px` `#88ff88`. · **[N aggrappati]** (x 700): `11px` `#ff8800`. · **arma** (x 620, y 22): `10px` `#ffaa44` (nome arma in maiuscolo).
- **COMBO** (x 470, y 6, visibile da catena ≥2): `13px` bold; testo `COMBO {n}  ×{mult}`; **colore per livello** del moltiplicatore (×1 `#888899` → ×2 oro `#ffee44` → ×3 ambra `#ffaa00` → ×4 `#ff8888` → ×5 rosso `#ff6666`) — `COMBO_COLORS` in `GameScene`; **pop di scala** a ogni uccisione.
- **SCATTO** (x W-10, y 22, allineato a destra): `11px` bold; `↯ SCATTO` verde `#44cc44` quando pronto, `↯ Ns` `#556677` durante la ricarica (`DASH_COOLDOWN` 5s).
- **SOVRACCARICO** (Overdrive, A3) (x 10, y 98, sotto il pannello a sinistra): label `10px` `#ffaa66` `SOVRACCARICO`; barra `120×9` su fondo `0x1a1a1a`, fill che sale di tono col carico — carica `#cc8a2a` → **pronto** `#ffcc33` → **attivo** `#fff0a0`; a destra `PRONTO ▶F` / `ATTIVO!` `10px` bold (oro) come ridondanza non cromatica. La barra si carica dalle uccisioni in combo; a piena, **F** la spende (vedi `GAME_DESIGN §7`, `BALANCE §1`). Palette ambra/oro **CB-safe**.
- **Selettore armi** (x 620, y 34): una **cifra-hotkey** (`1`–`5`) per ogni arma **posseduta**; quella attiva in **oro** `#ffee44`, le altre `#888899`. Il nome esteso dell'arma attiva resta in **arma** (y 22).
- **PERCORSO** (x 290, y 24): label `10px` `#7777aa`; valore km `#aaaaff`; barra `110×7` su fondo `0x111122`, fill `0x4466cc`; meta "/ N km" `9px` `#445577`.
- **Sopravvissuti** (in alto a destra, se presenti): icone testuali `[M] [+] [S] [E]` `11px` `#cccc44`.
- **Componenti** (5, fascia `y 49–72`): per ciascuno label `10px` `#888888` + barra `120×7` su fondo `0x1a1a1a`, fill = **`comp.baseColor`** (funzionale, vedi `ART_BIBLE_OGGETTI` §4.2: motore `#44cc44`, ruote `#44aa88`, serbatoio `#ff8800`, torretta `#8899ff`, corazza `#6688bb`).
- **Hint comandi** (basso, `y H-6`): `"↑↓ Muovi · SPAZIO Spara · 1-5/Q Arma · SHIFT Scatto · F Sovracc."` `11px` `#333333` centrato; "0=Debug" `9px` `#2a3a2a`; indicatore GOD MODE a destra `10px` `#00ff88` bold.

**Reazione (soglie in `updateHUD`):**
- **Salute** cambia colore alla soglia: `#44cc44` (≥60%) → `#ffaa00` (30–60%) → `#ff2222` (<30%). La barra è uno **strumento di lettura del rischio**, non solo un numero.
- Carburante/percorso aggiornano `displayWidth` e testo; il percorso può cambiare colore (`barColor`).

**Note:** l'HUD è tutto a **depth 20+** (sopra l'overlay filmico, sotto gli esiti). I colori dei componenti sono **funzionali** (distinti per leggibilità immediata dello stato), non estetici liberi. Le barre non alterano nulla: riflettono `hp`/`fuel`/`distance`/componenti.

---

### 4.3 BARRA DEL BOSS · BANNER · AVVISO — *gli stati di tensione*

**Ruolo:** comunicare gli eventi forti senza un overlay che ferma il gioco.

- **Banner d'ambiente** (`buildWorld`): nome regione in maiuscolo, `16px` bold `#ffffff` `stroke #000000` 4px, depth 18, **entra in tween** (alpha 0→1, sale di 8px in 400ms) e **si dissolve** dopo 1.6s. È il "cartello di livello" cinematografico.
- **Barra del boss** (`showBossHUD`, cx, y 96): scatola `448×20` `#000000` alpha 0.85 (depth 22); **fill HP** `440×14` `0xcc0000` origine sinistra (depth 23); **label** nome boss `13px` bold `#ff6666` `stroke #000000` 3px. Entra/esce in tween alpha (400/500ms). Il rosso-sangue firma segnala "questa è LA minaccia".
- **Avviso "⚠ GIGANTE!"** (centro schermo): testo d'allerta di breve durata all'arrivo del gigante — accento rosso/ambra, lettura immediata "in arrivo qualcosa di grosso".

**Reazione:** tutto via tween (entrata/uscita), mai pop secco. La barra boss si svuota mutando `displayWidth` del fill.

**Note:** questi elementi vivono **sopra l'HUD ma sotto gli overlay di esito** (depth 22–23). Sono "spezie" di tensione (coerente col budget shake del titolo): non devono mai coprire stabilmente il campo di gioco.

---

### 4.4 OVERLAY DI ESITO — missione completata · game over · boss sconfitto

**Ruolo:** i momenti di pausa narrativa. Velo + scatola centrata, depth **30–31** (sopra tutto tranne il flash).

- **Missione completata** (`missionComplete`): scatola `500×260` `#000000` alpha 0.9 (depth 30); titolo **"MISSIONE COMPLETATA!"** `32px` bold verde-conferma `#88ff44` stroke `#006600`; righe valore `20/16/18/15px` — Punteggio `#ffffff`, Distanza `#aaaaff` (blu-info), Monete `+N` `#ffee44` (oro), Totale `#ffcc00`; hint `"[ SPAZIO ] per il negozio"` `13px` `#556677` (faint).
- **Game over** (`gameOver`): scatola `440×300` `#000000` alpha 0.88 (depth 30); **"GAME OVER"** `46px` bold `#ff3333` stroke `#880000`; **motivo** `16px` `#ffaaaa` (rosso-pericolo); Punteggio `22px` `#ffffff`; Distanza `16px` `#aaaaff`; **"Riprendi dalla Missione N"** `14px` `#ffaa66` (campagna a checkpoint: si rigioca la missione) + eventuale **"Costo di recupero: −X★"** `12px` `#ffaaaa` (il pedaggio del 25%, solo se >0); hint `"[ SPAZIO ] riprova la missione"` `14px` `#556677` (faint). Più "[ M ] Torna al menu".
- **Boss sconfitto:** testo centrale `"BOSS SCONFITTO! +N monete"` + nascondi barra boss; lega col **flash a schermo** (`Juice.flash`) e l'hit-stop dell'uccisione boss (vedi budget `ART_BIBLE_ZOMBIES`).

**Reazione:** transizione verso `ShopScene`/restart via `Juice.go` (fade). Il game over e l'uccisione boss sono accompagnati dal feedback schermo del titolo (flash/shake/hit-stop) — l'UI è l'**ultimo strato** di una risposta multisensoriale sincronizzata.

**Note:** gerarchia chiarissima — titolo grande, valori medi color-codati per ruolo, hint piccolo e spento. Il giocatore legge l'esito in <1s.

---

### 4.5 NEGOZIO / GARAGE — `ShopScene` · *la schermata più densa*

**Ruolo:** tra una missione e l'altra. Quattro regioni: **potenziamenti**, **armi**, **sopravvissuti**, **veicoli**, + header valuta e pulsante continua. Qui la **palette funzionale** (§3.1) fa tutto il lavoro: dal solo colore il giocatore sa cosa può permettersi, cosa possiede, cosa è equipaggiato, cosa è bloccato.

**Layout:**
- **Sfondo** `0x080810`; **header** `800×64` `0x0e0e22`. Titolo **"GARAGE — Fine Missione N"** `20px` bold `#88ff88`; **valuta** in alto a destra `★ N monete` `18px` `#ffee44`; sottotitolo prossima missione `12px` `#555577`. Divisori `0x222244` 1px a separare le regioni.
- **Sezioni** con header `13px` bold color-codato per area: POTENZIAMENTI `#aaaaff` · ARMI `#ff9944` · SOPRAVVISSUTI `#ffcc44` · VEICOLI `#88aaff`.
- **Card potenziamento** `440×42`: base `0x0e0e1a`, **comprato** `0x0e1e0e` (verde), hover `0x181830`. Label `13px` bold (`#dddddd` comprabile · `#446644` comprato · `#554444` bloccato), descrizione `10px` `#555566`, prezzo `13px` `#ffee44` (o `✓` se comprato, o `#663333` se bloccato).
- **Card arma** `82×72` (striscia): selezionata `0x1a1200`, posseduta `0x0e0e0e`, non posseduta `0x080808`; **swatch colore arma** `50×8` (= `WEAPONS[].color`); nome `8px`; stato `● ATTIVA` `#ffcc44` / `Usa` `#4488ff`; prezzo `★N` `#ffee44` + `COMPRA` `#ffaa00` / `🔒` `#333333`; descrizione attiva `▸ …` `10px` `#888866`.
- **Card sopravvissuto** `290×66`: base `0x131310`, hover `0x1e1e14`; nome `14px` bold nel **colore del token** (`SURVIVORS[].color`), abilità `10px` `#666655`, stato `GIÀ RECLUTATO` `#446644` / `GRATIS` `#44cc44`.
- **Card veicolo** `106×96`: selezionato `0x0e1e2e` (teal), posseduto `0x0e0e1e`, non posseduto `0x08080e`; **swatch colore veicolo** `76×18` (= `VEHICLES[].color`); nome `8px`; stato `● ATTIVO` `#88ff44` / `Usa` `#4488ff`; prezzo `★ N` `#ffee44` + `COMPRA` `#ffcc00` / `BLOCCATO` `#333333`.
- **Continua** (basso, centro): box `240×44` `0x1a3a1a` (hover `0x224422`), testo **"CONTINUA ▶"** `20px` bold `#88ff44`.

**Reazione:** ogni card interattiva ha **hover** (riempimento più chiaro di ~8–10 per canale) + hand cursor; click → acquisto/seleziona/recluta. Uscita via `Juice.go` verso `GameScene`.

**Note (coesione, §8 gap chiuso):** la ShopScene ora **entra in dissolvenza** (`Juice.fadeIn`) e monta l'**overlay filmico** opzionale (`Juice.addOverlay` + `jitterGrain` in `update()`), come Menu/Settings. Poiché ogni acquisto fa `scene.restart`, un flag **`replay`** (passato a `restart({ replay: true })`) evita di rifare il fade ad ogni acquisto: dissolvenza solo al **primo** ingresso, overlay sempre presente. Gli swatch colore di armi/veicoli riusano i colori-dato di `GameData` → la UI **non duplica** la palette degli oggetti, la cita: ottima coesione.

---

### 4.6 IMPOSTAZIONI & PAUSA — `SettingsScene` · *un componente, due usi*

**Ruolo:** doppio: da **MENU** è scena a sé ("◂ INDIETRO" torna al menu); da **PARTITA** (ESC) è **overlay di pausa** sopra la scena congelata ("▶ RIPRENDI" + "Esci al menu"). Gestisce **volume**, **effetti schermo**, **risoluzione**, **schermo intero** e **daltonismo** (persistiti in `Settings`/localStorage).

**Layout (modale centrato):**
- Velo `0x080810` (alpha 0.8 in pausa, 1 da menu) + scatola `540×480` `0x0e0e1a` (alpha 0.96 in pausa) bordo `0x222244`.
- In pausa, sopra: `❚❚ PAUSA · ESC per riprendere` `13px` bold `#9ab6ff`. Titolo **"IMPOSTAZIONI"** `34px` bold `#9ab6ff`.
- **VOLUME AUDIO** (label `15px` bold `#ffcc44`): **barra a 10 celle** `38×30` (fondo `0x1a1a24`, bordo `0x33344a`); celle accese `0x3acb3a` (verde), spente `0x1a1a24`; etichetta `%`/"Muto" a destra `#dddddd`; **🔇 Muto** `14px` `#888899` (→ `#ff6666` quando attivo). Click su una cella imposta il volume e **suona un'anteprima**.
- **EFFETTI SCHERMO** (label `15px` bold `#88ddff`, sub `"Vignetta · grana · scanline CRT"` `11px` `#556677`): toggle `130×38` — ON `0x16301a` bordo `0x44cc44` testo `ATTIVI #88ff88`; OFF `0x301616` bordo `0x995544` testo `DISATTIVI #ffaa88`. Il toggle fa `scene.restart` per riapplicare/rimuovere l'overlay all'istante.
- **RISOLUZIONE** (label `15px` bold `#ffaa00`): valore/aspetto al centro con frecce `◂ ▸` (`24px` `#9ab6ff`) per ciclare i preset; in pausa è di sola lettura (si cambia dal menu).
- **SCHERMO INTERO** (label `15px` bold `#88ddff`): toggle `130×38` ON/OFF (`ATTIVO`/`ATTIVA`); l'attivazione effettiva richiede il click (vincolo browser).
- **DALTONISMO** (label `15px` bold `#88ddff`, sub `"Barre di stato blu/giallo (no rosso↔verde)"`): toggle `130×38` ON/OFF — quando attivo le barre HP/componenti dell'HUD usano una palette daltonico-safe (vedi `Settings.colorblind`).
- **Indietro/Riprendi** (basso): box `240×46` `0x14141f` bordo `0x88aaff`, testo `20px` bold `#9ab6ff` (`▶ RIPRENDI · ESC` o `◂ INDIETRO`). In pausa, sotto: "Esci al menu principale" `12px` `#886677` (→ `#ffaaaa` hover).

**Reazione:** hover su tutti i pulsanti (cambio fill/colore); ESC = indietro/riprendi; **anteprima sonora** al cambio volume (`playPreview` riproduce `playZombieKill` al volume scelto). Da menu: `Juice.fadeIn` + overlay filmico opzionale.

**Note:** è l'**unica schermata che scrive preferenze**. Rispetta `screenFx` e `volume` ovunque. Il colore "info/navigazione" blu domina (è una schermata di sistema puro).

---

### 4.7 GALLERIA DI DEBUG — `DebugScene` · *strumento, non vetrina al pubblico*

**Ruolo:** test interno (modelli, animazioni, boss, armi a scala reale e ingrandita). Non è UI rivolta al giocatore finale, ma **segue le stesse regole** (coesione anche negli strumenti).

**Layout:** sfondo `0x0a0a12`; titolo **"MODALITÀ DEBUG — Galleria Modelli & Test"** `16px` bold `#66ddff` (blu-info), sub `10px` `#556677`; card modello `add.rectangle(...,0x33343c)` bordo `0x4a4a55` con nomi/etichette color-codate (`#bbbbcc` veicoli, `#aaddaa` zombi, `#ffaaaa` boss, `#ddcc99`/`#ffddaa` oggetti); pulsanti test `0x...` con testo `#ffffff` bold; messaggio di stato `14px` `#88ff88`.

**Note:** mantiene la palette funzionale (blu = strumento, verde = ok). Anche un debug screen non è "fuori stile": è parte della rifinitura "una sola mano".

---

## 5. Pipeline: aggiungere / modificare una schermata o un elemento UI

1. **Ruolo prima del pixel:** una frase — *cosa deve leggere il giocatore in 1 colpo d'occhio?* Da lì discende la gerarchia.
2. **Scegli i colori dalla palette funzionale (§3.1):** stato → famiglia (verde/oro/blu/rosso/neutro/inattivo). **Non inventare un nuovo accento**: pesca dalla famiglia giusta (preferendo i toni già usati). Gli emissivi vivi restano i 3 firma.
3. **Costruisci su un pannello (§3.2):** riempimento scuro + bordo; divisori se la schermata è fitta; per un modale sopra il gioco usa velo + scatola.
4. **Applica la scala tipografica (§3.3):** display/titolo/sezione/valore/label/hint. Bold per ciò che comanda, stroke solo sopra il gioco vivo.
5. **Aggiungi la reazione (§ pilastro game feel):** hover su ogni interattivo; soglie di colore sulle barre di stato; **`Juice.fadeIn` all'ingresso** e **`Juice.go` all'uscita** (mai cut secco); overlay filmico opzionale gated da `Settings.screenFx` + `jitterGrain` in `update()`.
6. **Profondità:** se la UI coesiste col gioco (`GameScene`), usa la banda depth di §3.4 (HUD 20+, esiti 30–31). Nelle scene autonome, ordina per sequenza di creazione.
7. **Rispetta `Settings`:** leggi `volume`/`screenFx`; se aggiungi una preferenza, passa da `src/Settings.ts` (persistenza localStorage), non da variabili sparse.
8. **Costruisci una volta:** memorizza i riferimenti e muta `setText`/`displayWidth`/`setFillStyle` nell'update; **mai** ricreare oggetti per frame.
9. **Verifica** a 60 fps con gioco a densità massima (l'HUD non deve mai coprire una minaccia) e con `screenFx` ON e OFF.
10. **Aggiorna questa scheda** (§4) e, se hai introdotto un colore/taglia nuovi, anche §3.

---

## 6. Checklist di qualità (Definition of Done — interfacce)

- [ ] **Stato leggibile dal solo colore:** comprabile/posseduto/equipaggiato/bloccato e salute/carburante distinguibili senza leggere il testo (palette funzionale §3.1).
- [ ] **Gerarchia tipografica** presente: nessuna schermata monotaglia; titolo > sezione > valore > hint.
- [ ] **Pannelli con bordo** e divisori dove serve; nessun testo nudo su nero.
- [ ] **Hover** su ogni elemento interattivo (fill/bordo/scala) + hand cursor.
- [ ] **Soglie di colore** sulle barre di stato (salute verde→ambra→rosso).
- [ ] **Transizioni** in dissolvenza (`Juice.fadeIn` in entrata, `Juice.go` in uscita) — **nessun cut secco**.
- [ ] **Overlay filmico opzionale** rispettato (`Settings.screenFx`) + `jitterGrain` in `update()`.
- [ ] **Preferenze** lette/scritte via `Settings` (non variabili sparse).
- [ ] **HUD non copre mai le minacce**; depth corretta (§3.4).
- [ ] **Costruito una volta**, aggiornato per riferimento (niente oggetti ricreati per frame).
- [ ] **Accenti emissivi limitati** ai 3 colori firma; il blu resta confinato al chrome di sistema.
- [ ] **60 fps** con HUD + gioco a densità massima, con `screenFx` ON e OFF.

---

## 7. Antipattern da evitare

- ❌ **Testo bianco su nero senza gerarchia né pannelli** → "prototipo da editor". L'errore #1.
- ❌ **Stato illeggibile dal colore** (comprabile e bloccato dello stesso tono) → il giocatore sbaglia acquisto.
- ❌ **Pulsante senza hover** → l'interfaccia sembra "morta", non reattiva.
- ❌ **Cut secco tra schermate** (niente `Juice.go`/`fadeIn`) → rompe la coesione filmica. *(Oggi la ShopScene ne soffre, §8.)*
- ❌ **Blu acceso che invade il campo di gioco** → confonde "sistema" e "mondo" (il blu è solo chrome UI).
- ❌ **Inventare un accento nuovo** invece di pescare dalla palette funzionale → drift di colore.
- ❌ **Ricreare testo/rettangoli ogni frame** invece di mutare i riferimenti → cali di fps.
- ❌ **HUD che copre una minaccia** o vignetta/overlay che nasconde ciò che uccide → muore la leggibilità (vince sempre "leggibile").
- ❌ **Ignorare `Settings`** (overlay sempre acceso, volume non rispettato) → bug di coesione.
- ❌ **`fontFamily` diverse o casuali** se/quando verranno introdotte → l'UI deve avere **una sola voce** tipografica.

---

## 8. Stato implementazione & roadmap

> Onestà sul gap (come i documenti gemelli).

**✅ Implementato:**
1. **5 superfici UI** complete: titolo (`MenuScene`), HUD di gioco (`GameScene`), negozio (`ShopScene`), impostazioni/pausa (`SettingsScene`), debug (`DebugScene`).
2. **Palette funzionale** a 6 ruoli applicata ovunque; stati (comprabile/posseduto/equipaggiato/bloccato, salute a soglie) leggibili dal colore.
3. **Overlay filmico opzionale** (`Juice.addOverlay` + `jitterGrain`) gated da `Settings.screenFx`; **transizioni in dissolvenza** (`Juice.fadeIn`/`go`) su Menu/Settings + esiti di GameScene.
4. **HUD** con barre a soglie, percorso, 5 componenti color-codati, barra boss, banner ambiente, avvisi, depth coerente.
5. **Impostazioni persistenti** (`Settings.ts` → localStorage): volume (barra 10 segmenti + anteprima sonora), effetti schermo, risoluzione, schermo intero e **daltonismo** (palette barre di stato).
6. **Negozio** con 4 regioni, swatch che **citano** i colori-dato di `GameData` (no duplicazione palette).
7. **Modulo chrome condiviso** [`src/Ui.ts`](../src/Ui.ts) — `FONT` esplicito, palette canonica `UI.*`, helper `Ui.text`/`panel`/`button`/`enter`. Tutte e 5 le scene vi sono migrate (`npx tsc --noEmit` pulito · `npm run build` verde).

**✅ v1.1 — i 3 gap di rifinitura chiusi** (centralizzati in `src/Ui.ts`):
- **Font esplicito.** `FONT = '"Courier New", Courier, monospace'` applicato a ogni testo via `Ui.text(...)`: una sola voce tipografica, con fallback, modificabile in un punto. *(era: default di Phaser implicito.)*
- **Coesione transizioni della ShopScene.** Ora entra in `Juice.fadeIn` + overlay filmico opzionale (`addOverlay` + `jitterGrain`), con flag `replay` che evita il fade ad ogni acquisto. *(era: cut secco senza grana.)*
- **Drift di colore.** Le famiglie funzionali sono token `UI.*` referenziati dalle scene, non più 5+ sfumature sparse per file. *(era: hex inline scena per scena.)* Inclusa l'estrazione degli helper di stile (`Ui.text`/`panel`/`button`) che il gap citava.

**Aperto (rifinitura futura):**
- **Riduzione completa a 3 toni/famiglia.** La centralizzazione è fatta; resta da accorpare gli ultimi token quasi-duplicati (es. `green`/`greenSoft`/`greenOk`) dove la distinzione non serve davvero, e i pochi colori ancora inline (rossi-di-blocco `#663333`/`#443333`, olive `#888866`/`#777755`) → portarli a token o unirli.
- **Accessibilità:** opzione dimensione testo / contrasto alto; il monospace piccolo (8–9px) può essere duro su schermi piccoli.
- **Stati di danno sull'HUD** più ricchi (flash della barra salute al colpo, oltre alla soglia di colore).
- **Profiling 60 fps** della UI a densità massima con overlay attivo.

---

## 9. Anti-deriva (validazione)

Gli hex e le taglie di questo documento **non devono divergere** dal codice. `npm run validate:art` (vedi `scripts/validate-art-bible.mjs`) copre **nemici** (`ZOMBIE_STATS`/`ZOMBIE_MOTION`), **veicoli/armi** (`VEHICLES`/`WEAPONS`) e — da v1.1 — i **token UI** (`UI` ↔ §3.6).

> **✅ Validazione colori UI (automatica):** lo script **parsa l'oggetto `UI`** di [`src/Ui.ts`](../src/Ui.ts) e lo confronta **riga per riga** con la tabella §3.6, **bidirezionalmente**: fallisce se un valore diverge, se un token esiste nel codice ma non in §3.6, o se §3.6 elenca un token assente dal codice. È agganciato a `npm run build` come per nemici e oggetti. Quando aggiungi/cambi un token in `src/Ui.ts`, aggiorna **anche** la riga §3.6 e rilancia `npm run validate:art`. *(Il token `font` non è un colore e non è verificato.)*

**Ancora in sincronia manuale (non coperti dallo script — aggiorna a mano):**
- Famiglie/ruoli narrativi §3.1 e superfici §3.2 ↔ token `UI` (la **§3.6** è la mirror verificata; §3.1/§3.2 restano descrittive).
- Scala tipografica §3.3 ↔ `fontSize` nel codice.
- Banda di profondità §3.4 ↔ `setDepth`/`D` in `GameScene`.
- Geometrie HUD (barre `110×10`/`110×7`/`120×7`, fascia `0–84`) §4.2 ↔ `buildHUD`.
- Colori indicatore componenti §4.2 ↔ `this.components` (vedi anche `ART_BIBLE_OGGETTI` §4.2).
- Soglie salute §4.2 ↔ `updateHUD`.

---

*Fine documento. Mantienilo allineato al codice: se cambi un colore, una taglia di testo, un pannello, una soglia di barra o una transizione, aggiorna la scheda corrispondente — e tieni d'occhio `npm run validate:art`.*
