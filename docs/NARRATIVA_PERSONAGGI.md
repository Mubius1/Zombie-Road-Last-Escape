# NARRATIVA_PERSONAGGI.md — Character & Story Bible del Convoglio

> **Fonte di verità narrativa del progetto.** Questo documento è il *cosa raccontano* il gioco e
> le sue persone; le art bible coprono *come appaiono/suonano*, [`GAME_DESIGN.md`](GAME_DESIGN.md)
> *come si gioca*, [`BALANCE.md`](BALANCE.md) *quali numeri*.
>
> **I testi rivolti al giocatore NON vivono qui: vivono in i18n** (`src/locales/it.ts` canonica →
> `en/es/fr/de/pt`). Qui stanno il **design** (chi sono, voce, archi, regole) e le **chiavi i18n**
> con cui il contenuto è cablato. Quando questo doc cita una battuta, è una *copia di servizio* della
> stringa `it.ts`: la verità resta la stringa, e ogni modifica passa per `t()` (vedi [`I18N.md`](I18N.md)).
>
> **Stato:** allineato al codice su `dev` (`src/Convoy.ts`, `src/World.ts`, `src/Locations.ts`,
> `src/RunState.ts`, `src/locales/it.ts`). Il sistema descritto è **implementato**, non solo proposto.
> Dove [`CAMPAGNA_CONVOGLIO.md`](CAMPAGNA_CONVOGLIO.md) ancora si dichiara "v0.1, nessun codice",
> è quel doc a essere stantio: **questa bible riflette la realtà a runtime**.

---

## §0 — North star & tono

**"*This War of Mine* su ruote."** Il cuore del gioco non è la strada né i boss (i boss sono spenti:
`BOSSES_ENABLED=false`, vedi [`GAME_DESIGN.md`](GAME_DESIGN.md) §3): il cuore sono **le persone che
porti** e le **scelte che pesano**. La tratta è un transito breve e teso; la **sosta** è dove il gioco
respira, parla, e ti mette davanti a un bivio morale senza una risposta giusta.

Pilastri narrativi:

1. **Niente eroi, solo sopravvissuti.** Ogni personaggio porta una **colpa o una paura** dal prima del
   crollo, non un potere. L'abilità di gameplay è la *cicatrice* resa meccanica (il meccanico che non
   smette di aggiustare; la cecchina che non si fida più della sua mano).
2. **Le scelte costano, sempre.** Ogni beat scambia risorse fra loro (**morale ↔ cibo ↔ denaro**): non
   esiste l'opzione gratis. La scelta "buona" per il morale è quasi sempre cara in cibo o monete.
3. **Il mondo si spegne, non esplode.** L'orrore è ambientale e sonoro (penombra, radio che degrada),
   non spettacolare. La **radio** è il barometro del collasso (§5).
4. **Conta chi arriva.** Il finale non premia il punteggio: conta **quanti** del convoglio varcano il
   rifugio e **come** ci sono arrivati (§6).
5. **Registro italiano, asciutto, adulto.** Frasi brevi, niente retorica, niente splatter gratuito.
   La paura è nel non detto.

---

## §1 — La cornice: il Convoglio, gli atti, il rifugio

- **Il viaggio** è un **manifesto finito** (`STAGE_MANIFEST` in `src/World.ts`): oggi **31 tratte**
  (`CAMPAIGN_LENGTH = STAGE_MANIFEST.length`) distribuite su **6 atti**, + **2 varianti di diramazione**
  (leg 11 e 22). Non è più la formula ciclica `mod 7`: è una sequenza autorata con un inizio e una fine.
- **I 6 atti** (nomi i18n `campaign.act1.name`…`act6.name`, in `ACT_NAMES`) attraversano i biomi:
  città → autostrada → deserto → foresta → industriale/militare → città finale.
- **Ogni atto ha un climax con set-piece nominato** (campo `setPiece` nel manifest):

  | Atto | Bioma dominante | Climax (set-piece) |
  |---|---|---|
  | 1 | città / autostrada | **PONTE CHE CROLLA** (`roadblock`) |
  | 2 | deserto | **TEMPESTA DI SABBIA** (`storm`, con bivio F3) |
  | 3 | foresta | **TUNNEL A FARI SPENTI** (`night`) |
  | 4 | industriale / militare | **DIGA CHE CEDE** (`storm`, con bivio F3) |
  | 5 | città finale | **CITTÀ SOTTO ASSEDIO** (`roadblock`) |
  | 6 | città finale | **VARCO AL RIFUGIO** (`terminal: true` → **epilogo**) |

- **Il rifugio** è la meta: l'ultima tratta (`terminal`) non porta a una sosta ma all'**epilogo** (§6).
- **La sosta** a valle di ogni tratta è scelta dal descrittore `stopKind` del manifest (non più dal
  ciclo mod-7): è dove **incontri e parli** con i personaggi. Vedi [`SOSTE_DIEGETICHE.md`](SOSTE_DIEGETICHE.md)
  e [`docs/ART_BIBLE_SOSTE.md`](ART_BIBLE_SOSTE.md).

---

## §2 — Anatomia di un arco personale

Definito da `SurvivorArc` in [`src/Convoy.ts`](../src/Convoy.ts). **Cadenza** di ogni arco:

1. **Parli** col personaggio alla sosta (hub diegetico, `StopScene`). Finché l'atto corrente `< unlockAct`
   senti la sua **battuta in voce** (`talk`), **variata per stato emotivo** (vedi sotto).
2. Raggiunto l'**`unlockAct`** arriva il **BEAT** (`beatKey`): il personaggio si confessa e ti mette
   davanti a una **scelta che pesa** (`options`).
3. Ogni opzione applica **effetti su `morale` / `food` / `money`**, salva un **`flag`** in
   `RunData.choices`, e può marcare una **diramazione giocabile** (`detour`, §4).
4. Dopo la scelta, riparlandogli senti la sua **eco** (`after`, per flag).
5. A fine corsa l'**epilogo** legge il flag e mostra la sua **carta** (`endings`, §6).

**Stato emotivo (calm ↔ distressed).** Ogni `talk` ha due versioni: `calm` e `distressed`. La versione
mostrata dipende dal **morale del convoglio** (`RunData.morale`, §7): quando il morale scende sotto la
soglia di rottura, le voci diventano `distressed` e — meccanicamente — **le abilità dei sopravvissuti si
spengono** (`hasActiveSurvivor`, F5). Il tono della scrittura *è* il feedback del sistema morale.

> **Quando si sblocca chi** (`unlockAct`, 0-based → atto = `unlockAct + 1`):
>
> | Atto in cui arriva il beat | Personaggi |
> |---|---|
> | **Atto 1** | Sara (medico) · Bruno (meccanico) |
> | **Atto 2** | Nadia (esploratrice) · Vince (saccheggiatore) |
> | **Atto 3** | Marcus (soldato) · Eva (cecchina) |
> | **Atto 4** | Karim (artificiere) |

---

## §3 — Le sette schede personaggio

Identità da `SURVIVORS` ([`src/GameData.ts`](../src/GameData.ts)); abilità da `abilityParams` +
`survivor.*.ability`; voci/beat/finali da `it.ts`; struttura d'arco da `Convoy.ts`. **Effetti scelte**
nel formato `(morale / cibo / denaro)`.

---

### 3.1 — Sara Conti · *il Medico* `medic`
- **Abilità:** rigenera **0,3 salute/s** al veicolo. Colore firma `#ff6666`.
- **Prima:** infermiera al pronto soccorso — *«ai primi morsi, non è scappata»*.
- **Ferita:** sua **figlia Lena**, persa a un centro raccolta. È l'unico arco con **diramazione
  giocabile** (§4).
- **Beat (Atto 1, `dlg.medic.beat`):** *«Mia figlia, Lena… Possiamo deviare a cercarla?»*
- **Scelte:**
  - **Deviamo a cercarla** → `sara_search` **(+8 / −15 / 0)**, marca il **detour `lena`**.
  - **Non possiamo rischiare il convoglio** → `sara_skip` **(−10 / 0 / 0)**.
- **Finali (`endings`):** `sara_search`, `sara_skip`, + esiti della diramazione `lena_found` /
  `lena_late` / `lena_trap` (priorità sull'esito base), + `died`.
- **Voce calm/distressed:** *«Finché ho le mani ferme, qualcuno qui dentro resta in piedi.»* /
  *«Ho curato troppe ferite che non si chiudono. Anche le mie.»*

---

### 3.2 — Bruno Salerno · *il Meccanico* `mechanic`
- **Abilità:** ripara **8 hp** al componente peggiore ogni **5 s**. Colore `#44aaff`.
- **Prima:** *«gestiva un'autofficina in periferia: nessun motore gli ha mai detto di no.»*
- **Ferita:** un furgone che non partì in tempo; sentì gridare chi era dietro mentre girava la chiave.
  Da allora **aggiusta per non sentirli**.
- **Beat (Atto 1):** *«Finché aggiusto qualcosa, non li sento.»*
- **Scelte:**
  - **Fermati, dormi** → `mechanic_rest` **(−6 / 0 / 0)** — non si brucia.
  - **Se aggiustare ti tiene in piedi, aggiusta** → `mechanic_work` **(+8 / 0 / +40)** — ma si consuma.
- **Finali:** `rest` (impara a stare fermo) · `work` (non smette mai, fino all'ultima riparazione) · `died`.
- **Voce calm/distressed:** *«Finché il motore gira, giriamo anche noi.»* / *«Senti anche tu quel
  rumore? …è dietro di me da mesi.»*

---

### 3.3 — Marcus Hale · *il Soldato* `soldier`
- **Abilità:** torretta automatica ogni **1,6 s**. Colore `#ffcc44`.
- **Prima:** caporale dei reparti d'assalto, *«congedato un mese prima del crollo»*.
- **Ferita:** un **ordine sbagliato** (mandare i reparti a est) che costò mezza colonna. Cerca di redimersi
  al posto di blocco: *«chi tiene e chi resta indietro».*
- **Beat (Atto 3):** *«Stavolta l'ordine lo do io.»*
- **Scelte:**
  - **Nessuno resta indietro** → `soldier_save_all` **(+12 / −20 / −40)**.
  - **Precedenza ai nostri** → `soldier_sacrifice_few` **(−14 / +15 / +60)**.
- **Finali:** `save_all` (il conto torna) · `sacrifice_few` (comanda sapendo il prezzo) · `died` (copre la
  ritirata, ultimo ordine a se stesso).
- **Voce calm/distressed:** *«Tieni la fila stretta…»* / *«È lo stesso rumore di allora. E io sono di nuovo
  dalla parte sbagliata dell'ordine.»*

---

### 3.4 — Nadia Volkova · *l'Esploratrice* `explorer`
- **Abilità:** consumo carburante **−20 %**. Colore `#44ff88`.
- **Prima:** *«guida di montagna: conosce sentieri e scorciatoie che le mappe hanno scordato.»*
- **Ferita:** un **valico** dove perse un gruppo che guidava prima di te; *«ho smesso di voltarmi».*
- **Beat (Atto 2):** la scorciatoia passa proprio da dove li ha lasciati.
- **Scelte (3 opzioni):**
  - **Prendiamo il valico** → `explorer_take_pass` **(−6 / −5 / 0)** — guadagni strada, lei deve riguardare.
  - **Restiamo sulla statale lunga** → `explorer_long_road` **(+4 / −12 / −20)** — più cara, le risparmi il valico.
  - **Raccontami di loro** → `explorer_speak_them` **(+10 / −6 / 0)** — *«Erano sette. Una bambina cantava…»*.
- **Finali:** `take_pass` · `long_road` · `speak_them` (porta sette nomi invece di sette silenzi) · `died`.
- **Voce calm/distressed:** *«Stai dietro di me e mettiamo le ruote dove ho già camminato.»* / *«Questa
  strada la conosco, ed è proprio questo il problema… non lasciarmi guardare i lati.»*

---

### 3.5 — Vince Pagano · *il Saccheggiatore* `looter`
- **Abilità:** **+12 %** monete a fine missione. Colore `#d4af37`.
- **Prima:** *«sciacallo anche prima del crollo: trovava sempre qualcosa da rivendere.»*
- **Ferita / credo:** *«chi divide muore per primo».* La generosità come rischio.
- **Beat (Atto 2):** il doppiofondo pieno — *«Lo apro o lo tengo chiuso?»*
- **Scelte (3 opzioni):**
  - **Aprilo** → `looter_share` **(+12 / +15 / −60)** — sfami il convoglio.
  - **Barattalo come merce** → `looter_trade` **(−2 / −10 / +110)**.
  - **Lascialo chiuso** → `looter_keep` **(−14 / 0 / 0)** — nessuno gli regge lo sguardo.
- **Finali:** `share` (mangia con gli altri) · `trade` (monete e nessun amico) · `keep` (solo come ha
  sempre voluto) · `died` (nessuno gli resse la mano).
- **Voce calm/distressed:** *«C'è sempre qualcosa da prendere…»* / *«Non avvicinarti troppo… io ho imparato
  a guardare per primo.»*

---

### 3.6 — Eva Lindqvist · *la Cecchina* `sniper`
- **Abilità:** colpo forte automatico allo zombi più resistente ogni **2,2 s**. Colore `#88bbff`.
- **Prima:** *«campionessa di tiro a segno: un colpo, un bersaglio.»*
- **Ferita:** **l'unico colpo mancato** della sua vita; da allora **non si fida più della propria mano**.
- **Beat (Atto 3):** *«Dimmi tu cosa devo fare di questa mano.»*
- **Scelte (3 opzioni):**
  - **Torna a coprire il convoglio** → `sniper_cover_us` **(+12 / 0 / −30)**.
  - **Spara solo ai bersagli sicuri** → `sniper_perfect_shots` **(−6 / 0 / 0)** — nessuno si sente coperto.
  - **Spara quando ti chiamo io** → `sniper_carry_it` **(+4 / 0 / 0)** — il peso lo porti tu.
- **Finali:** `cover_us` · `perfect_shots` (mira perfetta, dietro il vuoto) · `carry_it` · `died`.
- **Voce calm/distressed:** *«Vento fermo. Se qualcosa si muove là fuori, lo prendo prima che vi tocchi.»* /
  *«Le mani mi tremano. Non chiedetemi un colpo difficile adesso.»*

---

### 3.7 — Karim Haddad · *l'Artificiere* `demolitionist`
- **Abilità:** **tasto `C`** → granata ad area, ricarica **5,5 s**. Colore `#ff7733`.
- **Prima:** *«genio militare: con due fili e poco altro fa saltare qualsiasi cosa.»*
- **Ferita:** i **ponti fatti saltare per ordine**, con chi era rimasto dall'altra parte. *«Ho un cimitero,
  di muri.»*
- **Beat (Atto 4):** il cancello blindato con gente che batte dall'interno — aprirlo richiama l'orda.
- **Scelte:**
  - **Apri il varco** → `demolitionist_open_gate` **(+12 / 0 / −40)** — rischio orda.
  - **Lascialo chiuso** → `demolitionist_keep_sealed` **(−14 / 0 / 0)** — sicuro, *«come allora».*
- **Finali:** `open_gate` (ha smesso di murare) · `keep_sealed` (un altro cancello chiuso nella testa) · `died`.
- **Voce calm/distressed:** *«Finché ho due fili e le mani ferme, una via la trovo.»* / *«Una carica innescata
  da mani che tremano uccide chi la innesca. Dammi un attimo.»*

---

## §4 — La diramazione giocabile «Cerca Lena» (Sara)

Unico arco che **biforca la mappa**. Scegliendo `sara_search`, l'opzione marca `detour: 'lena'` →
`RunData.pendingDetour = 'lena'`: la **prossima tratta diventa la deviazione** (sottotitolo
`detour.lena.sub`). L'esito della deviazione produce uno di tre flag, che **hanno priorità** sull'esito
base nell'epilogo di Sara:

| Flag | Significato | Carta-epilogo |
|---|---|---|
| `lena_found` | Lena trovata viva (`campaign.detour.lena.found.line`: «Era nel seminterrato… viva.») | `campaign.ending.sara.lena_found` |
| `lena_late` | arrivati troppo tardi | `campaign.ending.sara.lena_late` |
| `lena_trap` | il nome di Lena era un'esca per disperati | `campaign.ending.sara.lena_trap` |

> È il **modello di riferimento** per future diramazioni giocabili: una scelta al beat che cambia la
> *geografia* della corsa, non solo i numeri. Consumata a fine tratta-detour in `GameScene`.

---

## §5 — La Radio: il barometro del mondo

La radio (`RADIO_ACTS` / `RADIO_TRANSIT` in `Convoy.ts`, testi `radio.*` in `it.ts`) è **scrittura
procedurale dell'ambiente**: non parla dei tuoi personaggi, parla del **mondo che si spegne**. Tag
`📻 RADIO D'EMERGENZA` (`radio.tag`).

- **6 bollettini, uno per atto** (`radio.act0`…`act5`): il **segnale degrada** lungo il viaggio.

  | Atto | Messaggio (sintesi) |
  |---|---|
  | 0 | *«È tutto sotto controllo. Restate nelle case.»* — la bugia ufficiale |
  | 1 | *«I corridoi sono saltati. Non andate verso le città.»* |
  | 2 | *«Qualcosa si muove fra gli alberi… non lasciate i fari accesi.»* |
  | 3 | *«Attenti agli altri vivi. Chi vi promette riparo vuole quello che avete.»* |
  | 4 | *«(statica) …la città brucia… le coordinate del valico…»* |
  | 5 | *«(statica) …venite. Vi prego… venite…»* — l'ultimo segnale |

- **4 frasi di transito** (`radio.transit0`…`transit3`): brevi, ricorrenti durante la guida
  (*«contate i vostri ogni volta che ripartite»*).

> **Regola:** la radio non deve mai *spiegare* la trama. Suggerisce, contraddice la versione ufficiale,
> e accompagna l'arco emotivo dal "controllo" alla supplica. Il degrado del segnale è il tono.

---

## §6 — I finali: due livelli

L'epilogo (letto a `reachedRefuge = true`, tratta `terminal`) compone **due strati**:

### A) L'esito del Convoglio — *quanti* arrivano (4 carte)
Basato sul numero di sopravvissuti a bordo / caduti (`RunData.survivors`, `fallen`,
`campaign.survivorsArrived` `{n}`):

| Carta | Titolo (`campaign.ending.*.title`) | Quando |
|---|---|---|
| `convoy` | **IL CONVOGLIO REGGE** | arrivi in molti |
| `few` | **POCHI, MA VIVI** | convoglio decimato ma varca la soglia |
| `alone` | **ARRIVI SOLO** | il sedile accanto è vuoto |
| `fallen` | **IL RIFUGIO È CADUTO** | arrivi e nessuno risponde |

### B) Le carte personali — *come* ci sono arrivati
Per ogni sopravvissuto, l'epilogo legge il suo **flag in `RunData.choices`** (o `died` se è in `fallen`)
e mostra la sua carta da `endings`. Una corsa diversa = un mosaico di epiloghi diverso. **Esempio:**
Bruno `work` + Eva `perfect_shots` + Sara `lena_found` raccontano una storia distinta da Bruno `rest` +
Eva `cover_us` + Sara `skip`.

> Il finale non è "vittoria/sconfitta": è un **referto**. Conta chi hai portato e cosa hai scelto per lui.

---

## §7 — Stato narrativo persistente (RunData)

Tutto vive sul registry tipizzato ([`src/RunState.ts`](../src/RunState.ts), contratto in
[`ARCHITETTURA.md`](ARCHITETTURA.md) §6.1). Campi narrativi e default:

| Campo | Significato | Default |
|---|---|---|
| `legIndex` | posizione sul `STAGE_MANIFEST` (0…`CAMPAIGN_LENGTH−1`) | `0` |
| `actIndex` | atto corrente (cache, derivabile da `legIndex`) | `0` |
| `reachedRefuge` | corsa conclusa con epilogo | `false` |
| `morale` | morale del convoglio 0–100 (sotto `MORALE_BREAK` spegne le abilità) | `60` |
| `food` | scorta di campagna (drenata dai sopravvissuti a bordo) | `40` |
| `choices` | flag-conseguenza dei beat, letti dall'epilogo | `[]` |
| `fallen` | chiavi dei sopravvissuti caduti (morte/abbandono), nominati nell'epilogo | `[]` |
| `branchTaken` | ramo scelto a ogni biforcazione (coerenza retry + epilogo) | `{}` |
| `pendingDetour` | diramazione in sospeso (es. `'lena'`) | `''` |
| `survivors` | chi è a bordo | `[]` |
| `hungry` / `injured` | abilità spenta finché non sfamati/curati | `[]` |
| `nemesisState` / `nemesisHeat` | F6 (opzionale): la Nemesi che ti insegue | `0` / `0` |

`morale`, `food`, `choices`, `fallen` sono **azzerati** a Nuova Partita / game over (`resetRunState`) e
**persistiti** nel checkpoint (`snapshotRun`/`restoreRun`) per "CONTINUA" cross-sessione.

---

## §8 — Le persone come dramma in-run (eventi del morale)

Oltre ai beat, la presenza dei sopravvissuti genera **micro-eventi** durante la corsa (testi `it.ts`):

- `game.survivorInjured` — *«{name} è ferito!»* → entra in `injured`, **abilità spenta** finché non curato.
- `game.survivorLeft` — *«{name} se n'è andato — fame»* → abbandono per fame (`starveStreak`), va in `fallen`.
- `game.survivorLost` — *«{name} non ce l'ha fatta»* → morte, va in `fallen`.
- `game.survivorMourn` — *«{name} resta in silenzio.»* → reazione al lutto/morale basso.
- `survivor.barkRecruit` — *«{name}: «{bio}»»* alla reclutazione.

> **Principio (north star):** fame, ferite e morale non sono barre da ottimizzare, sono **persone in
> difficoltà**. Ogni stato ha una voce. Mai ridurre un sopravvissuto a un moltiplicatore muto — è il
> rischio segnalato in [`ART_BIBLE_OGGETTI.md`](ART_BIBLE_OGGETTI.md) §4.9 ("token, NON sprite").

---

## §9 — Mappa contenuto ↔ codice ↔ i18n

| Cosa | Dove vive | Chiavi i18n |
|---|---|---|
| Identità (nome, bio, abilità, colore) | `SURVIVORS` in `GameData.ts` | `survivor.<key>.name/bio/ability` |
| Archi (unlockAct, beat, scelte+effetti, after, finali, voci) | `SURVIVOR_ARCS` in `Convoy.ts` | `dlg.<key>.*`, `campaign.ending.<key>.*` |
| Radio | `RADIO_ACTS` / `RADIO_TRANSIT` in `Convoy.ts` | `radio.*` |
| Atti, tratte, climax, sosta a valle | `STAGE_MANIFEST` / `ACT_NAMES` in `World.ts` | `campaign.act<n>.name` |
| Soste & NPC ambientali | `STOP_LOCATIONS` in `Locations.ts` | `loc.*`, `hub.station.*` |
| Stato del viaggio | `RunData` in `RunState.ts` | — |
| Diramazione Lena | `pendingDetour` + esiti | `detour.lena.*`, `campaign.detour.lena.*` |
| Finali convoglio | epilogo (`GameScene`) | `campaign.ending.{convoy,few,alone,fallen}.*` |

**Sopravvissuti come figure d'ambiente nelle soste** (`hubNpcs` in `Locations.ts`): garage→`mechanic`,
campo→`medic`+`explorer`, posto di blocco→`soldier`, mercato→`looter`. È lì che li incontri/parli.

---

## §10 — Buchi noti / da autorare

Onesto, perché la bible serva da backlog narrativo:

- **Relazioni fra personaggi:** oggi gli archi sono indipendenti. Mancano beat che intrecciano due
  sopravvissuti (es. Marcus e Karim sull'ordine/il muro; Vince e chiunque sul cibo).
- **Sotto-beat / progressione intra-arco:** un solo beat per personaggio. Spazio per 2–3 battute che
  evolvono col morale prima del beat decisivo.
- **Voci campionate / audio:** le battute sono testo. Direzione sonora delle voci (registro, processing
  radio) non è in [`ART_BIBLE_AUDIO.md`](ART_BIBLE_AUDIO.md) — da aggiungere se si vocalizza.
- **La Nemesi (F6):** `nemesisState`/`nemesisHeat` esistono nello stato ma l'arco narrativo (presagio →
  resa dei conti) è da scrivere.
- **Bivi F3 (leg 11 / 22):** sono giocabili (varianti di manifest) ma **non hanno ancora un beat
  narrativo** che li incornici come scelta del convoglio.
- **Coerenza con [`CAMPAGNA_CONVOGLIO.md`](CAMPAGNA_CONVOGLIO.md):** quel doc va riconciliato (header
  "v0.1 nessun codice" + `MISSION_DIST` 18000 vs 6000 reale) — vedi `docs/INDEX.md`.

---

## §11 — Template: aggiungere un personaggio o un arco

1. **Identità** in `SURVIVORS` (`GameData.ts`): `key`, `properName`, `surname`, `bio`, `name`, `ability`,
   `abilityParams`, `color`. Numeri-abilità → vanno anche in [`BALANCE.md`](BALANCE.md) §11 (oggi attesa).
2. **Arco** in `SURVIVOR_ARCS` (`Convoy.ts`): `unlockAct`, `beatKey`, `options[]` (con `morale/food/money`
   + `flag` univoco + eventuale `detour`), `after[]`, `endings[]` (un flag-carta + sempre `died`),
   `talk{calm,distressed}`.
3. **Testi** in `src/locales/it.ts` (canonica) → poi `en/es/fr/de/pt`. Mai letterali nel codice.
   `npm run validate:i18n` verifica completezza.
4. **Presenza in sosta:** aggiungilo a `hubNpcs` di una `STOP_LOCATIONS` se deve comparire come figura.
5. **Scheda qui (§3):** identità + ferita + voce + arco + effetti, ancorata alle chiavi.

> **Regola della cicatrice:** prima decidi la *ferita*, poi derivane l'abilità. L'abilità è la ferita resa
> meccanica, non un bonus scelto a tavolino.
