# 🚐 IL CONVOGLIO — Documento di design della campagna survival-horror

> **Stato:** v0.1 · piano (planning document) · **nessuna riga di codice ancora scritta.**
> **Ambito:** progetta la **campagna lunga e finibile** "Il Convoglio" — un viaggio a senso unico verso un rifugio, in registro *This War of Mine / Oregon Trail*, dove la posta in gioco non è solo sopravvivere **tu**, ma portare i **tuoi** sopravvissuti alla meta.
> **Natura del documento:** è un **piano**, non una fonte di verità. Le fonti di verità restano [`GAME_DESIGN.md`](GAME_DESIGN.md) (regole), [`BALANCE.md`](BALANCE.md) (numeri), le [art bible](ART_BIBLE_ZOMBIES.md) (estetica) e [`ART_BIBLE_AUDIO.md`](ART_BIBLE_AUDIO.md) (suono). Man mano che una fase viene implementata, i suoi numeri/regole/visual **migrano** nei documenti canonici (vedi §8/§9). Questa passata **non** tocca i doc canonici né il codice: l'unico file creato è questo.
> **Vincolo fondante (invariato):** grafica e audio **100% procedurali**, **nessun asset esterno**, **nessuna dipendenza nuova**. Massimo riuso dei sistemi esistenti; minimo contenuto bespoke; niente fase monolitica. Vedi [CLAUDE.md](../CLAUDE.md).

> ⚠️ **Disclaimer sui riferimenti di codice.** I riferimenti `file:linea` qui sotto sono **indicativi** e relativi allo stato del branch alla stesura (`GameScene.ts` risulta `M` nel git status): **verifica col grep del simbolo prima di toccare il codice**. I riferimenti-**simbolo** (`triggerMissionComplete`, `hasActiveSurvivor`, `envIndex`, `STOP_CYCLE`, `snapshotRun`/`restoreRun`, `EVENT_FRACTIONS`) non marciscono e vanno preferiti. I **valori-costante** citati sono invece verificati contro il codice (vedi appendice A).

---

## §0 · Sintesi (TL;DR)

"Il Convoglio" sostituisce il **contatore infinito** odierno — `envIndex = (missionNumber − 1) mod 7`, 7 regioni che ciclano e cambiano **solo colore**, vittoria "di ciclo" ripetibile, ~14 min per giro — con un **arco finito e terminale**: un `STAGE_MANIFEST` ordinato di **~33 entry** raggruppate in **6 atti** a senso unico verso il **RIFUGIO**, una **tratta terminale** che **chiude** la corsa con un **epilogo**, e una durata-tipo di **~2-4 ore**.

Quattro idee portano il salto **senza disegnare una sola mappa bespoke**:

1. **Odometro lineare finibile** — la posizione diventa uno scalare `legIndex` su un manifest finito (modello *Oregon Trail*, non grafo FTL); l'HUD mostra un nastro `0 → 6000 km` con le tacche degli atti. La varietà nasce dalle **combinazioni dei descrittori di tappa**, non da livelli scritti a mano.
2. **Descrittori di tappa (Track C2 a spina dorsale)** — ogni tratta è una riga-dati su 10 assi che mappano **1:1 sui sistemi esistenti** (bioma = `ENVIRONMENTS`, densità = director dread→burst, minaccia = 8 `ZombieType`, scarsità = casse/fuel-drain, climax = 5 eventi B2, sosta = 5 `StopLocation`). Zero nemici, zero scene, zero asset nuovi nel primo taglio.
3. **Strato gestionale del convoglio** — riusa **interamente** il loop sopravvissuti M1-M4 (capienza, cibo, ferite, perdita permanente, salvataggio su strada) e aggiunge **un solo asse nuovo** (MORALE) + le **scelte agli incontri**, agganciati al gate già centralizzato `hasActiveSurvivor`. L'**epilogo** legge chi/cosa è arrivato vivo.
4. **Climax = luogo, non boss** — i boss restano **disattivati** (`BOSSES_ENABLED = false`); il climax di ogni atto è un **set-piece di sopravvivenza** (ponte che crolla, tunnel a fari spenti, città sotto assedio, diga che cede) costruito **forzando** un evento B2 esistente. Una **Nemesi-con-memoria** opzionale (modello *Alien Isolation*) bracca il convoglio tra gli atti: si **semina, non si batte**.

Tutto questo è **design-intent**: nulla è ancora implementato. La roadmap (§8) lo spezza in **6 fasi spedibili e testabili da sole**, ordinate per valore/rischio; la prima (F1) è **già una campagna finibile a zero sistemi nuovi**.

---

## §1 · Pilastri della campagna

> **Ambito.** Definisce *cosa rende "Il Convoglio" una campagna* — gli assi portanti del viaggio finibile — distinti dai **7 pilastri di game-feel** del [§0 di `GAME_DESIGN.md`](GAME_DESIGN.md#0--visione-e-pilastri) (linee 18-26), che restano la fonte di verità della tensione momento-per-momento. Il §0 dice *com'è teso il singolo istante*; questa sezione dice *perché si guida, verso cosa, e cosa resta quando si arriva*. Ogni pilastro di campagna **eredita** uno o più pilastri horror e li proietta sull'arco lungo (~2-4h). I pilastri sono **5**; ognuno chiude con la destinazione documentale e lo stato di implementazione.

### P1 — Una meta, non un punteggio (il viaggio finisce)

**Eredita:** è il pilastro *strutturale* che riformula la cornice "Campagna a checkpoint" del §0 ([`GAME_DESIGN.md:28`](GAME_DESIGN.md)). Non eredita un pilastro di game-feel: **li abilita tutti**, dando loro un orizzonte.

**Tesi.** Oggi la posizione è un solo scalare `missionNumber` da cui si deriva tutto per modulo-7 (`envIndex = (missionNum−1)%7`; sosta per regione in `locationForMission`; `difficultyMult` su `⌊(missionNumber−1)/7⌋`), e la "vittoria" è **di ciclo e ripetibile** (`missionNumber % 7 === 0` → endless+, documentata in [`GAME_DESIGN.md:272`](GAME_DESIGN.md#10--condizioni-di-vittoria-e-sconfitta)). Il pilastro impone l'opposto: un `STAGE_MANIFEST` **ordinato e finito**, una tratta **terminale** (il rifugio) che **chiude** la run, e una curva di difficoltà **con tetto** (non una rampa infinita).

**Traduzione meccanica.** *Riuso:* `MISSION_DIST = 18000` resta 🔒 invariato; la durata 2-4h nasce dal **numero di tratte** + un `lengthMult` per-tratta (0.6-1.5), **mai** allungando la costante. Lo stato persiste già "gratis": i campi di posizione (`legIndex`, `actIndex`, `reachedRefuge`) sono serializzati da `snapshotRun`/`restoreRun`/`SaveData` che salvano l'intero `RunData`. *Nuovo:* disaccoppiare `envIndex`/`locationForMission`/`difficultyMult`/vittoria dal modulo-7, leggendo `STAGE_MANIFEST[legIndex]`; la vittoria su `legIndex` terminale lancia l'**epilogo** nel chokepoint `triggerMissionComplete`.

**Destinazione:** regola → `GAME_DESIGN` §1 (il diagramma del core loop termina in un nodo RIFUGIO, non si richiude) e §10 (vittoria-di-ciclo → vittoria-finale unica). Numeri (`lengthMult`, tetto difficoltà) → nuova §11 `BALANCE` (documentata). **Stato: design-intent, non implementato.**

### P2 — Logoramento gestito (porta i tuoi, non solo te stesso)

**Eredita:** Pilastro 1 *Tensione a doppia risorsa + throttle* ("andare veloce ti svuota, fermarti ti circonda") e Pilastro 2 *Scarsità — munizioni finite* ("ogni raffica è una scelta").

**Tesi.** Sopravvivere **tu** non basta: la vittoria è portare il **convoglio** al rifugio. Il pilastro promuove le risorse da contorno a **decisione di atto**. Lo scaffold gestionale M1-M4 esiste già ed è tematicamente pronto (reclutamento 1/sosta, cibo `FOOD.perSurvivor = 10`, fame→abbandono dopo `STARVE_MISSIONS_TO_LEAVE = 2`, ferite curabili, perdita permanente alla morte, salvataggio su strada `rescue`). Manca la **pressione differenziata** che lo renda significativo lungo l'arco.

**Traduzione meccanica.** *Riuso:* il carburante-viaggio è già persistente (`BASE_FUEL_DRAIN = 0.5`, un pieno ~3 tratte); le munizioni sono già finite e portate avanti (`ammo` in `RunData`). *Nuovo (solo dati):* due assi-descrittore di scarsità per-tratta — `fuelDrainMult` e `ammoCrateMult` — fanno dell'Atto 2 (deserto) la maratona-carburante e dell'Atto 4 (industriale) l'atto delle munizioni preziose, **modulando** `getEffectiveFuelDrain` e `spawnAmmoCrate` senza nemici o sistemi nuovi.

**Destinazione:** regola → `GAME_DESIGN` §3/§9 (la scarsità diventa un asse di tappa). Numeri (`fuelDrainMult`/`ammoCrateMult` per-tratta) → §11 `BALANCE` (documentata; lock opzionale futuro), modellati sulla tabella M1-M4. **Stato: scaffold M1-M4 implementato; assi-scarsità per-tratta design-intent, non implementati.**

### P3 — Il peso delle perdite (morale del convoglio + scelte con conseguenza)

**Eredita:** Pilastro 7 *Atmosfera che pesa* e Pilastro 2 (la scarsità che costringe a scegliere). È il pilastro che dà **costo umano** alla sopravvivenza.

**Tesi.** Oggi un sopravvissuto è un'abilità binaria ON/OFF (gate unico `hasActiveSurvivor`): nessuno strato di stato collettivo, nessuna scelta con conseguenza persistente. Il pilastro introduce **MORALE del convoglio** (0..100) come risorsa di campagna e **incontri con scelta** (Tier C delle soste diegetiche, oggi marcati "in arrivo"): saccheggiare = +risorse / −morale; salvare un sopravvissuto = +morale; razionare = −morale. Le scelte si sedimentano e l'**epilogo** le legge.

**Traduzione meccanica.** *Riuso:* MORALE è modellato 1:1 sul pattern `FOOD` (struct condivisa anti-drift): soglia, decadimento per evento. Sotto-soglia spegne le abilità **al gate unico** `hasActiveSurvivor` — aggancio centralizzato, basso rischio, senza toccare le 6 abilità singole. Le scelte vivono in `RunData.choices`. *Nuovo:* campi `morale`/`choices` in `RunData` (da aggiungere **a mano** nei 4 punti coordinati di `RunState.ts`, con default difensivo `??`); incontri come campi opzionali sul descrittore di tappa renderizzati in `StopScene`/`RouteScene`.

**Destinazione:** regola → `GAME_DESIGN` §9 (morale come strato del loop sopravvissuti; incontri Tier C). Numeri (soglie morale, delta per evento) → §11 `BALANCE`. Stringhe (nomi incontro, opzioni, esiti) → i18n ×6, canoniche in `it.ts`. Visual (indicatore morale, overlay scelta) → art bible interfacce/icone. **Stato: design-intent, non implementato (~16-24h di codice — sistema nuovo, da spezzare in fasi).**

### P4 — Il climax è un luogo, non un boss (set-piece di sopravvivenza)

**Eredita:** Pilastro 3 *Penombra e visione limitata* ("le minacce emergono dall'oscurità") e Pilastro 4 *Ritmo del terrore dread→burst* ("il silenzio è minaccia").

**Tesi.** I boss sono **disattivati** per decisione di design — erano "spugne di HP noiose" (`BOSSES_ENABLED = false`; il codice resta intatto ma spento). Il pilastro sostituisce il climax-duello con un **set-piece ambientale** a fine atto: ponte che crolla, tempesta + posto di blocco, tunnel a fari spenti, diga/raffineria che cede, città sotto assedio, varco al rifugio. Non si batte un nemico: si **attraversa una soglia**.

**Traduzione meccanica.** *Riuso totale, zero codice-evento nuovo nel primo taglio:* i 5 eventi B2 sono lo scheletro dei set-piece. Una tratta-climax **forza** un evento esistente invece del random a `EVENT_FRACTIONS`: ponte = `roadblock`+`storm`; tunnel = `night` (`eventNightHorde`); diga = `oil`+`mine` (loop hazard A1); assedio = burst continuo dal director dread→burst. La pressione di throttle (P-feel 1) e la penombra (P-feel 3) rendono il **luogo** l'avversario. *Nuovo (solo dati):* un asse-descrittore `setPiece`/`forcedEvent` che disattiva il random e impone l'evento d'atto.

**Destinazione:** regola → `GAME_DESIGN` §1 passo 2, §4 "Sequenza", §3 (smettere di descrivere il boss come climax strutturale). Numeri (soglie/intensità per set-piece) → §11 `BALANCE`. Visual (velo notte/tempesta, muro hazard) → art bible ambiente. **Stato: eventi B2 implementati; forzatura per-tratta design-intent, non implementata.** I 4 `BossType` restano spenti; al più diventano l'archetipo visivo della Nemesi (P5), non il climax.

### P5 — La Nemesi-con-memoria (opzionale, dread cross-atto)

**Eredita:** Pilastro 4 *Ritmo del terrore* e Pilastro 7 *Atmosfera che pesa*. Dà **continuità di paura** tra gli atti, nel modello *Alien Isolation*.

**Tesi.** Un inseguitore **persistente** che bracca il convoglio tra gli atti: non un boss-arena (rispetta il no-duello-a-barra-HP), ma un'entità che **si semina, non si batte**. Ha **memoria**: `nemesisHeat` (0..100) cresce se la semini male o spari troppo, cala se la eviti; `nemesisState` scala da presagio (solo audio/spawn-pattern anomalo) a resa-dei-conti finale (set-piece-fuga). È l'**ultima fase spedibile**, e l'unica davvero bespoke.

**Traduzione meccanica.** *Riuso:* lo scheletro "giant" fuori-pool a spawn temporizzato (`GIANT_SPAWN_INTERVAL = 22000`, già escluso da `SPAWN_POOL`) è la base dell'entità; la persistenza cross-atto sfrutta i campi `RunData`. *Nuovo:* `nemesisState`/`nemesisHeat` in `RunData` (4 punti coordinati); logica di inseguimento e transizione presagio→caccia.

**Destinazione:** regola → `GAME_DESIGN` §5 (voce di roster speciale) + §12 (gancio roadmap). Numeri (soglie heat, cadenze) → §11 `BALANCE`. **Stato: design-intent NON implementato, esplicitamente opzionale; marcare ovunque per non far divergere doc e codice.**

### Mappa pilastro horror (§0) → pilastro campagna

| Pilastro di campagna | Pilastri horror §0 ereditati | Aggancio al codice reale |
|---|---|---|
| **P1** Una meta, non un punteggio | cornice campagna-a-checkpoint | `STAGE_MANIFEST`/`legIndex` ↔ `missionNumber`%7 (`envIndex`, vittoria-ciclo) |
| **P2** Logoramento gestito | 1 doppia-risorsa, 2 scarsità | `fuelDrainMult`/`ammoCrateMult` ↔ `getEffectiveFuelDrain`/`spawnAmmoCrate`; M1-M4 |
| **P3** Il peso delle perdite | 7 atmosfera, 2 scarsità | MORALE su pattern `FOOD`; gate `hasActiveSurvivor`; `RunData.choices` |
| **P4** Climax = luogo | 3 penombra, 4 dread→burst | `setPiece` ↔ eventi B2; boss spenti (`BOSSES_ENABLED = false`) |
| **P5** Nemesi-con-memoria | 4 dread→burst, 7 atmosfera | scheletro "giant" fuori-pool; `nemesisState`/`Heat` in `RunData` |

> **Nota anti-deriva (CLAUDE.md Regole 2-3).** P1 e P3 cambiano **regole di gioco** (vittoria, strato gestionale) → obbligano l'aggiornamento di `GAME_DESIGN.md` §1/§3/§9/§10 nella stessa passata in cui si tocca il codice. Tutti i numeri nuovi (morale, moltiplicatori-tratta, soglie nemesi) vanno tabellati in `BALANCE.md` §11 prima/insieme all'implementazione. Ogni nome di atto/tratta/incontro/finale è una chiave da tradurre in **tutte e 6 le locale** o `validate:i18n` rompe la build.

---

## §2 · Struttura del viaggio: Atti → Tratte → Soste + mappa-odometro

> **Ambito.** È la **spina dorsale strutturale** della campagna: il modello-dati `STAGE_MANIFEST`, i 6 atti, il conteggio quadrato di tratte/soste, la mappa-odometro, e come estende `RouteScene`/`RunState`. Tutte le altre sezioni si appoggiano qui.

### 2.1 Il modello: `STAGE_MANIFEST` (odometro lineare, non grafo)

Il viaggio è un **array ordinato di descrittori di tappa** (`STAGE_MANIFEST`) in [`src/World.ts`](../src/World.ts), accanto a `BOSS_CONFIG`/`BOSS_ORDER`, **una entry per riga** sul pattern validator-friendly già usato (slice testuale letto da `validate-balance.mjs`). La posizione è uno scalare `legIndex` (indice nel manifest) + `actIndex` derivato. **Non** è un grafo FTL globale (niente colonne, niente topologia generata): è una **linea retta** (modello *Oregon Trail*) con **poche biforcazioni LOCALI dichiarate** che convergono entro 1-2 tratte. Alla meta, `legIndex` raggiunge la **tratta terminale** e la run **chiude** con l'epilogo.

> Differenza con oggi: la posizione cessa di essere `missionNumber` (scalare infinito, mod-7) e diventa `legIndex` su un manifest **finito**. `missionNumber` può sopravvivere in parallelo (record/telemetria) finché non è certo che nessun sistema lo legga per derivare bioma/sosta/difficoltà.

### 2.2 I 6 atti

| Atto | Nome | Biomi | `legIndex` | Odometro | Tono | Minaccia dominante | Set-piece climax |
|---|---|---|---|---|---|---|---|
| **1** | LA FUGA | city → highway | 0-5 | ~0 → ~1000 km | caos dell'esodo, le risorse abbondano ancora; insegna il loop del convoglio | **MASSA** (l'orda che dilaga) | **Ponte che crolla** con inseguitore (leg 5) |
| **2** | LA STRADA LUNGA | highway → desert | 6-11 | ~1000 → ~2200 km | maratona arida; il carburante è il vero nemico (*This War of Mine*) | **LOGORAMENTO + AGGUATO** | **Tempesta di sabbia + posto di blocco rivale** (leg 11) · 1ª biforcazione |
| **3** | IL BOSCO MORTO | forest → industrial | 12-17 | ~2200 → ~3400 km | claustrofobia, buio fitto, agguati (pilastro penombra) | **AGGUATO NEL BUIO** | **Tunnel a fari spenti** (leg 17) |
| **4** | LA CINTURA INDUSTRIALE | industrial → military | 18-23 | ~3400 → ~4600 km | assedio, raffinerie in fiamme, la civiltà come trappola | **PRESSIONE COSTANTE** | **Raffineria/diga che cede** (leg 23) · 2ª biforcazione (leg 22) |
| **5** | L'ULTIMA CITTÀ | finalCity | 24-29 | ~4600 → ~5800 km | tutto converge; le scelte degli atti precedenti pesano qui | **TUTTO INSIEME** | **Città sotto assedio + resa dei conti** (leg 29) |
| **6** | IL RIFUGIO | finalCity | 30 | ~5800 → 6000 km = META | il cancello della zona d'evacuazione, l'ultima notte | imbuto finale | **Varco al rifugio** (leg 30, terminale) → **EPILOGO** |

L'**escalation** è leggibile nelle colonne dei descrittori (§3), non in mappe disegnate: la scarsità stringe scendendo (`ammoCrateMult` 1.4 → 0.5; `fuelDrainMult` 1.0 → 1.6), la densità sale (`spawnMult` 1.3 → 0.6; `burstMult` 0.9 → 1.6), il `poolBias` ruota la minaccia dominante (massa → logoramento → agguato → muri → tutto-insieme), la `diffMult` cresce per `actIndex` **con tetto** (§2.5).

### 2.3 Conteggio quadrato (tratte, varianti, soste, km)

Il deliverable e la revisione interna richiedono che l'aritmetica torni. Numeri canonici di questo documento (usati ovunque):

- **Atti 1-5:** 6 leg ciascuno → 30 leg. **Atto 6:** 1 leg terminale (`legIndex 30`). **Tot. leg-base = 31** (`legIndex 0…30`).
- **Climax leg:** il 6° leg di ogni atto 1-5 → `legIndex 5, 11, 17, 23, 29` (5 set-piece) + `legIndex 30` (set-piece finale/varco). **Tratte normali = 31 − 5 − 1 = 25.**
- **Biforcazioni:** 2 punti dichiarati (`legIndex 11` e `22`), ciascuno con **2 varianti** (`altOf`, es. 11A/11B) **della stessa lunghezza** (1 leg) — differiscono per gli **assi** del descrittore (scorciatoia rischiosa vs strada lunga e sicura), **non** per il numero di leg. → **Manifest = 31 leg-base + 2 varianti-extra = ~33 entry.** Una corsa **percorre sempre 31 tratte**: a ogni bivio gioca **1 delle 2 varianti**, che **sostituisce**, non aggiunge (niente conteggi ambigui "30-34").
- **Soste:** una dopo **ogni leg tranne il terminale** → dopo i leg `0…29` = **30 soste** (durata variabile: pit-stop rapidi al `depot` ~1.5 min, soste gestionali a `garage`/`camp` ~3.5 min; media ~2.5 min). I 5 `StopLocation` esistenti sono istanziati dal descrittore (`stopKind`), **non** dal ciclo `STOP_CYCLE` mod-7.

### 2.4 La mappa-odometro (0 → 6000 km)

L'unica vera **UI nuova** necessaria è un **nastro-odometro** in HUD: una barra `0 → 6000 km` con le **6 tacche d'atto** e la posizione corrente, così l'arco finibile è sempre leggibile ("sai sempre quanto manca"). Riusa `Ui.box`/`rectangle` e i token daltonico-safe già in `HudController`.

**Riconciliazione dei km (anti-incoerenza).** Il km mostrato per tratta è `MISSION_DIST × KM_PER_UNIT × lengthMult = 18000 × 0.01 × lengthMult = 180 × lengthMult` km. La **META è fissata a 6000 km** (numero diegetico tondo). Perché la somma torni, i `lengthMult` delle 31 tratte (tabella §11 `BALANCE`) sono **tarati perché la loro somma ≈ 33.3** → `Σ(180 × lengthMult) ≈ 6000 km`. In altre parole: **6000 km non è hand-waved**, è il vincolo di taratura della colonna `lengthMult` (media ~1.07). Senza questa nota, un giocatore che somma "180 km/tratta × 31" otterrebbe 5580 km e non 6000: la differenza è proprio la somma dei `lengthMult > 1` delle maratone (Atto 2/4/5).

### 2.5 Come estende `RouteScene` e `RunState`

**`RouteScene` — da picker a mappa.** Oggi `RouteScene` è un picker one-shot di **3 carte fisse** (`ROUTE_NODES` da `Routes.ts`) che alla scelta salva solo `routeModifier` (usa-e-getta, azzerato a `'none'` a fine missione in `GameScene`). Estensione: diventa la **schermata-mappa** che legge dal `STAGE_MANIFEST`. Su tratta lineare mostra **1 carta "PROSEGUI"** + anteprima del descrittore (bioma · minaccia dominante · scarsità · sosta in arrivo via `stopKind`); ai **2 soli** punti di biforcazione mostra **2 carte** (scorciatoia vs strada lunga). Si **separa il concetto**: `choose(tratta)` **avanza `legIndex`** (persistente) **e**, separatamente, imposta `routeModifier` ai moltiplicatori della tratta scelta (consumabile, come oggi). Il punto di branch è già isolato (`RouteScene.choose`); `drawCard` si arricchisce con bioma/minaccia/scarsità. Il flusso `ShopScene.continueGame → StopScene → RouteScene → GameScene` resta **identico**: cambia solo **cosa** `RouteScene` legge e scrive.

**`RunData` — campi di viaggio persistenti.** Aggiungere a [`RunState.ts`](../src/RunState.ts) i campi PERSISTENTI in **4 PUNTI COORDINATI** (interface + `resetRunState` + `snapshotRun` + `restoreRun`), con default difensivo `??` per i save vecchi (il guard `isRun` di `SaveData` controlla solo `missionNumber`):

| Campo | Tipo | Default | Ruolo |
|---|---|---|---|
| `legIndex` | `number` | `0` | posizione nel manifest |
| `actIndex` | `number` | `0` | atto corrente (derivabile, cacheato per l'HUD-odometro) |
| `branchTaken` | `Record<string,string>` | `{}` | quale ramo a ogni biforcazione (coerenza retry + epilogo) |
| `morale` | `number` | `60` | risorsa convoglio 0..100 (§4) |
| `choices` | `string[]` | `[]` | flag-conseguenza degli incontri Tier C (letti dall'epilogo) |
| `reachedRefuge` | `boolean` | `false` | la run ha raggiunto la meta |
| `nemesisState` | `number` | `0` | (opz.) 0=presagio → 3=resa-dei-conti |
| `nemesisHeat` | `number` | `0` | (opz.) 0..100, memoria della Nemesi |

> ⚠️ **`snapshotRun`/`restoreRun`/`resetRunState` NON usano spread** — ogni campo nuovo va aggiunto **a mano in tutti e 4 i punti** o sparisce silenziosamente al reload. `routeModifier` **resta com'è** (consumabile, separato dalla posizione). Una volta fatto, `SaveData` serializza tutto **gratis** (salva l'intero `RunData`) → CONTINUA cross-sessione e checkpoint-alla-morte funzionano senza altro lavoro (un solo slot = corretto per una corsa-per-volta *Oregon Trail*).

**Disaccoppiare da `missionNumber`.** `envIndex` legge `STAGE_MANIFEST[legIndex].biome`; `locationForMission` legge `stopKind` dal descrittore (non da `STOP_CYCLE`); `difficultyMult` passa a una **curva finita con tetto** su `actIndex`. La curva attuale è una **rampa illimitata** legata a `⌊(missionNumber−1)/7⌋` (formula da verificare con grep di `difficultyMult` prima di toccare il codice); proposta di sostituzione: **`diffMult(actIndex) = 1 + 0.15 · actIndex`, con tetto a `actIndex = 5` → max 1.75** (vs rampa infinita). La vittoria-ciclo (`missionNumber % 7 === 0`) è sostituita dalla **vittoria-finale** su `legIndex` terminale (epilogo).

---

## §3 · Descrittori di tappa (Track C2 a spina dorsale)

> **Stato:** design-intent — *non implementato*. Track C2 era già nella roadmap come `REGION_MODIFIERS` (⬜ da fare); qui lo **promuoviamo da modificatore-leggero a spina dorsale**.

### 3.1 Cos'è un descrittore di tappa

Oggi una "tratta" è una missione `GameScene` indistinguibile: stessa `MISSION_DIST`, stesso `SPAWN_POOL` fisso, stesso director, e l'**unica** variabile è `missionNumber` → `envIndex` (cioè **solo il colore**). Il descrittore di tappa è la **riga-dati** che configura *una* tratta su **10 assi** che mappano 1:1 sui sistemi esistenti, senza disegnare mappe bespoke. La campagna è l'array ordinato di questi descrittori (`STAGE_MANIFEST`), e `legIndex` ne è l'indice (§2).

Il modello strutturale è **`BOSS_CONFIG`** ([`World.ts`](../src/World.ts)): tabella dati neutra, una entry su **riga singola**, letta dai validatori per slice testuale. Replichiamo esattamente quel pattern. `STAGE_MANIFEST` referenzia i **tipi già esistenti** (non li ridefinisce): `ZombieType` per il `poolBias`, le chiavi `StopLocation` per lo `stopKind`, i nomi-evento B2 per il `setPiece`, l'indice in `ENVIRONMENTS` per il `biome`.

> ⚠️ **Vincolo duro (validator-friendly):** ogni entry **DEVE** restare su **una sola riga**, come `BOSS_CONFIG`/`VEHICLES`/`WEAPONS`. Il parser testuale dei validatori non legge entry multi-riga → una entry spezzata = deriva non rilevata.

### 3.2 Gli assi (colonne del descrittore)

| # | Asse (campo) | Tipo | Range / valori | Sistema esistente che pilota | Migra in |
|---|---|---|---|---|---|
| 1 | `biome` | `EnvKey` | una di 7: `city`·`highway`·`desert`·`forest`·`industrial`·`military`·`finalCity` | `ENVIRONMENTS[envIndex]` — **solo palette/atmosfera** | art bible ambiente (già validato) |
| 2 | `lengthMult` | `number` | `0.6 … 1.5` (1.0 = oggi) | leva su `MISSION_DIST` letta da `updateDistance`/`eventThresholds` — **NON tocca** la costante 🔒 | §11 BALANCE |
| 3 | `spawnMult` | `number` | `0.6` (assedio) … `1.5` (quiete) | compone con `calmInterval`/`burstInterval` (già ×`routeSpawnMult`) | §11 BALANCE |
| 4 | `burstMult` | `number` | `0.8 … 1.6` | scala `BURST_MS_BASE` + durata ondata | §11 BALANCE |
| 5 | `fuelDrainMult` | `number` | `1.0 … 1.6` | leva *This War of Mine* su `getEffectiveFuelDrain` | §11 BALANCE |
| 6 | `ammoCrateMult` | `number` | `0.5` (scarso) … `1.5` (abbondante) | frequenza casse munizioni (`spawnAmmoCrate`) | §11 BALANCE |
| 7 | `hazardMult` | `number` | `0.4 … 2.0` | loop hazard (`HAZARD_SPAWN_INTERVAL`/`route.hazardMult`) | §11 BALANCE |
| 8 | `poolBias` | `Partial<Record<ZombieType, number>>` | moltiplicatori sul peso-base degli 8 tipi (`{}` = pool invariato) | pesa `SPAWN_POOL` in `spawnZombie` — **nessun nemico nuovo** | §11 BALANCE (composizione) |
| 9 | `setPiece` | `EventKey \| 'none'` | `none`·`night`·`roadblock`·`storm`·`convoy`·`rescue` (5 eventi B2) | **forza** l'evento invece del random a `EVENT_FRACTIONS` | `GAME_DESIGN` (regola: climax) |
| 10 | `stopKind` | `StopKey` | una di 5: `garage`·`depot`·`camp`·`checkpoint`·`market` | istanzia la sosta a valle da descrittore, NON da `STOP_CYCLE` | `GAME_DESIGN` (struttura soste) |

> **Forma-dati di `poolBias`** (fix di coerenza): è un `Partial<Record<ZombieType, number>>` — moltiplicatori sul **peso base** di `SPAWN_POOL` (es. `{ runner: 2.5, jumper: 1.8, common: 0.5 }` per una tratta-agguato). Tabellabile come riga in §11. Default `{}` = pool invariato.

**Campi opzionali** (fasi successive, marcati `?` e *non implementati*): `altOf?: string` (flag biforcazione, §2 — solo `legIndex 11` e `22`), `moraleShift?: number` e `encounter?: string` (strato gestionale / incontri Tier C, §4/§5). `weatherVeil` **non** è un asse separato: la penombra/velo è prodotta da `setPiece` (`night`/`storm`), coerente col fatto che nel pivot horror la penombra è un pilastro **globale** e l'asse-visibilità è dismesso. **Meteo/landmark** non richiedono nuovi sistemi: il "landmark" (ponte/tunnel/diga) è reso dal `setPiece` + `biome`; il "meteo" è il velo degli eventi `night`/`storm`.

### 3.3 Tabella esempio — 8 tappe in escalation attraverso gli atti

Forma leggibile; la **forma di codice** sarà una entry mono-riga per `legIndex` in `STAGE_MANIFEST`. `poolBias` indicato per famiglia.

| `legIndex` | Atto | `biome` | `lengthMult` | `spawnMult` | `burstMult` | `fuelDrainMult` | `ammoCrateMult` | `hazardMult` | `poolBias` | `setPiece` | `stopKind` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 1 — Fuga | `city` | 1.0 | 1.3 | 0.9 | 1.0 | 1.4 | 0.8 | common·runner (massa) | `none` | `garage` |
| 5 | 1 — Fuga | `highway` | 0.9 | 0.9 | 1.3 | 1.1 | 1.0 | 1.6 | common·runner·charger | `roadblock` (ponte) | `garage`† |
| 8 | 2 — Strada lunga | `desert` | 1.5 | 1.4 | 0.9 | 1.5 | 0.7 | 1.0 | toxic·spitter·charger | `none` | `depot` |
| 11 | 2 — Strada lunga | `desert` | 1.2‡ | 1.0 | 1.2 | 1.6 | 0.5 | 1.2 | toxic·charger | `storm` (tempesta) | `market` |
| 17 | 3 — Bosco morto | `forest` | 1.0 | 0.8 | 1.5 | 1.2 | 0.8 | 1.0 | runner·jumper (agguato) | `night` (tunnel) | `camp` |
| 23 | 4 — Cintura ind. | `industrial` | 1.0 | 0.7 | 1.4 | 1.3 | 0.6 | 2.0 | armored·charger (muri) | `storm` (diga) | `checkpoint` |
| 29 | 5 — Ultima città | `finalCity` | 1.1 | 0.6 | 1.6 | 1.4 | 0.5 | 1.8 | misto saturo | `roadblock` (assedio) | `market` |
| 30 | 6 — Rifugio | `finalCity` | 0.6 | 0.6 | 1.6 | 1.0 | 0.5 | 1.0 | misto saturo | `roadblock` (varco) | — (terminale) |

† Dopo il set-piece la sosta-completa apre l'atto seguente (garage garantito a inizio atto). ‡ `legIndex 11` è un **punto di biforcazione** (`altOf`): il ramo "scorciatoia-deserto" ha `lengthMult` corto + `fuelDrainMult 1.6` + niente sosta; il ramo "strada lunga" ha `lengthMult ~1.2` + sosta garantita (**stessa lunghezza in leg**, §2.3).

### 3.4 Impatto sul validatore e sulle art bible

**Serve una nuova tabella 🔒?** I moltiplicatori di tappa sono **numeri-sorgente** → vanno in una **nuova §11 di `BALANCE.md`** ("IL CONVOGLIO"), modellata sulla tabella M1-M4 (formato `Leva | Valore | Dove`). Finché vivono in costanti nuove **non coperte** dalla lista del validatore, la build non fallisce, ma documentarli è obbligatorio (deriva silenziosa). Se si vuole la **rete anti-deriva piena** (raccomandato per ~33 righe), si clona il blocco boss di `validate-balance.mjs` (`sliceObject(world, 'const STAGE_MANIFEST')` + estrattori per `legIndex`), confrontato con una tabella 🔒 in BALANCE — **richiede entry mono-riga**. Costo: la tabella si allunga a ~33 righe → carico di manutenzione. *Decisione raccomandata in §9.6: **documentata, NON lockata riga-per-riga**; solo le costanti-cardine restano 🔒.*

**Art bible:** il `biome` riusa `ENVIRONMENTS`, **già validato** contro `ART_BIBLE_AMBIENTE.md` → **nessun nuovo lavoro art bible** finché il descrittore referenzia i 7 biomi esistenti senza cambiarne i colori. I set-piece del primo taglio riusano gli overlay degli eventi B2 esistenti (`announceEvent`/`showEventOverlay`), già coperti.

**Composizione `routeModifier`(B1) × descrittore(C2).** `routeSpawnMult` (B1) **già** moltiplica gli intervalli di spawn. Aggiungere `spawnMult` di tappa (C2) significa **comporre due moltiplicatori** → taratura non banale (ingenuamente moltiplicati → run troppo facili o impossibili). **La decisione canonica è in §9.4** (raccomandazione: C2 base, B1 come modulazione clampata ±30% sulle tratte lineari; ai 2 bivi il ramo *è* un descrittore C2 e non serve `routeModifier` separato). Le sezioni §3.2 (asse density) rimandano lì.

**i18n:** servono nuove chiavi solo per i **nomi-tappa/atto** e le righe di anteprima del descrittore in `RouteScene` (i biomi `region.*` e i 5 luoghi `loc.*` hanno già le chiavi). Ogni chiave ×6 lingue o `validate:i18n` rompe la build.

**File coinvolti:** `src/World.ts` (nuovo `STAGE_MANIFEST`); `src/scenes/GameScene.ts` (`envIndex`/`difficultyMult`/`spawnAmmoCrate`/director, da disaccoppiare da `missionNumber`%7); `src/Locations.ts` (`locationForMission` legge `stopKind`); `scripts/validate-balance.mjs`; doc `BALANCE.md §11` + `GAME_DESIGN.md §3`.

---

## §4 · Strato gestionale del convoglio

> **Stato:** design-intent. MORALE e SCELTE-incontro **non sono implementati**: vanno marcati "da fare" nei doc. I numeri esistenti (cibo/ferite/perdita/salvataggio) sono reali e già in [`BALANCE.md §8`](BALANCE.md#8--negozio-ed-economia).

Lo strato gestionale trasforma il convoglio da "veicolo con buff passivi" a "gruppo di persone da portare vive al rifugio" (*This War of Mine / Oregon Trail*). Regola di disegno: **massimo riuso**. Il loop M1-M4 regge tutto il peso; si aggiunge **un solo asse nuovo** (MORALE) più le **scelte-incontro**, agganciati al gate già centralizzato `hasActiveSurvivor`.

### 4.1 RIUSA vs NUOVO

| Meccanica | Stato | Dove vive oggi | Ruolo nel Convoglio |
|---|---|---|---|
| **Capienza per veicolo** (`survivorSlots`) | RIUSA | `GameData.ts` (4/2/5/4/4/3/2); cap letta in `ShopScene` | Tensione "quante bocche posso portare": cambiare veicolo verso uno più piccolo droppa gli eccedenti. Scelta morale negli atti tardi. |
| **Cibo** (`FOOD`) | RIUSA | `GameData.ts` (`max 120, perSurvivor 10, start 40, rationFood 40, rationCost 100`); consumo a inizio tratta | Risorsa di logoramento per-tratta. L'asse `scarcity` (Atto 2/5) ne modula prezzo/disponibilità alla sosta. |
| **Fame → abbandono** (`STARVE_MISSIONS_TO_LEAVE = 2`) | RIUSA | `GameScene` | Razionare male perde un membro **per scelta**, non per morte. |
| **Ferite** (`INJURY_CHANCE = 0.25`) | RIUSA | `GameScene.maybeInjure()`; cura `HEAL_COST = 60` (30 col Medico) | Abilità spenta finché non curi. Penombra/agguati dell'Atto 3 aumentano la probabilità di subire ferite. *(Soglie d'innesco "<35% salute, ≥8 danno" citate dai draft — da verificare in `maybeInjure()`.)* |
| **Perdita permanente alla morte** (`−25%` monete + 1 sopravvissuto) | RIUSA | `DEATH_MONEY_PENALTY = 0.25`; rimozione random | Il "peso delle perdite". Negli atti tardi il rischio è massimo. Va **letta dall'epilogo**. |
| **Salvataggio su strada** (evento `rescue`) | RIUSA | `GameScene.rescueSucceeded()`; ripiego in monete | Unico modo di **recuperare** una perdita; principale fonte di **morale positivo** (§4.2). |
| **Gate abilità unico** (`hasActiveSurvivor`) | RIUSA | `GameScene` (a-bordo ∧ ¬affamato ∧ ¬ferito) | Punto d'innesto a costo zero per MORALE: un terzo predicato, senza toccare le 6 abilità singole. |
| **MORALE / coesione del convoglio** | **NUOVO** | — (struct nuova, modellata su `FOOD`) | Asse 0..100 che chiude/apre le abilità sotto-soglia e alimenta l'epilogo. |
| **Scelte-incontro (Tier C)** | **NUOVO** | — (campo `encounter?` sul descrittore) | 2-3 opzioni con conseguenza persistente in `RunData.choices`, lette dall'epilogo. |

Oggi un sopravvissuto è **solo una key in 3 liste binarie** (`survivors`/`hungry`/`injured`); non esiste stato per-individuo. MORALE è deliberatamente uno **scalare di gruppo** (non per-individuo) per evitare il refactoring da liste-di-key a struct-per-sopravvissuto — riusa il pattern `FOOD`.

### 4.2 MORALE: regole concrete e numeri proposti

**Modello.** Scalare `morale: number` (0..100, **default `MORALE_START = 60`**) su `RunData`, persistito gratis **a patto di aggiungerlo a mano nei 4 punti coordinati** con default `?? 60`.

**Decadimento e recupero (proposta, da tarare):**

| Evento | Δ morale | Note |
|---|---|---|
| Tratta completata senza perdite | **+2** | deriva positiva lenta di base |
| Sosta sicura tipo `camp` | **+8** | il campo è il luogo del recupero morale |
| Reclutamento riuscito | **+6** | il gruppo cresce |
| `rescue` su strada riuscito | **+12** | il gesto più forte; riusa `rescueSucceeded()` |
| Almeno un affamato a fine tratta | **−10** | si compone con la `starveStreak` esistente |
| Razionamento forzato (qualcuno lasciato a digiuno per scelta) | **−8** | §4.3 |
| Ferita non curata che persiste alla sosta successiva | **−5** | |
| Perdita di un sopravvissuto (morte o abbandono) | **−25** | la batosta; può innescare la spirale |
| Scelta morale "dura" a un incontro (saccheggio, pedaggio umano) | **−6 … −15** | dichiarata per-incontro (§4.4) |

**Effetti sul gameplay (a soglie) — registro *This War of Mine*: il morale è "non crollare", non "potenziarsi".**

- **MORALE ≥ 40 (default 60) — normale:** tutte le abilità attive, **nessun bonus**. *(Un piccolo bonus di coesione a morale alto era stato considerato ma è tagliato: un buff positivo è fuori-tono col registro, dove il morale alto è assenza di crollo, non potere.)*
- **MORALE < 40 (`MORALE_BREAK`) — demoralizzato:** il gate `hasActiveSurvivor` **si spegne globalmente** (terzo predicato `&& morale >= MORALE_BREAK`) → **nessuna abilità funziona** finché non si risale sopra soglia. È il modo coerente col pivot per dire "un convoglio a pezzi rende meno" senza toccare le 6 abilità.
- **MORALE < 15 (`MORALE_ROUT`) — rotto (opzionale, atti 4-5):** rischio per-tratta che un membro affamato/ferito **diserti** anche fuori dalla `starveStreak` (riusa il meccanismo `leaver`).

Costanti nuove: `MORALE_START = 60`, `MORALE_BREAK = 40`, `MORALE_ROUT = 15`, più i delta della tabella. Vivendo in costanti nuove non coperte dal validatore, **non rompono la build**, ma vanno tabellate (§4.5).

### 4.3 Bocche-vs-mani (tensione gestionale)

Il consumo cibo e gli effetti abilità sono **già separati**: si paga cibo per ogni testa a bordo, ma il valore (abilità) lo danno solo i sani. Questo crea il dilemma:

- **Mano (utile):** un sopravvissuto sano e nutrito dà la sua abilità ma costa `FOOD.perSurvivor = 10`/tratta.
- **Bocca (costo):** un ferito/affamato costa comunque cibo ma **non dà abilità** (gate spento).
- **Scelta di razionamento (NUOVO):** alla sosta, se il cibo non basta, il giocatore sceglie **chi** lascia a digiuno (oggi è automatico: `hungry = activeSurvivors.slice(fed)`). Renderlo esplicito trasforma il "buff numerico" in "costo umano" → `−8` morale per ogni razionamento forzato. **Vincolo tecnico:** qualsiasi rimodulazione del cibo deve rispettare il guard `foodMission` o causa **doppio addebito al retry post-morte**.

### 4.4 Scelte agli incontri (Tier C) e cosa succede a una perdita

**Scelte-incontro.** Completano la Fase 4 di [`SOSTE_DIEGETICHE.md`](SOSTE_DIEGETICHE.md) (oggi ⬜ da fare; gli NPC dell'hub sono "atmosfera, non reclutabili"). Si modellano come **campo opzionale sul descrittore** (`encounter?`) renderizzato in `StopScene`/`RouteScene`, con 2-3 opzioni a conseguenza persistente salvata in `RunData.choices`. Dettaglio per-luogo in §5.1.

**Cosa succede a una perdita** (morte in tratta o abbandono per fame/morale):
1. Rimozione di **1 sopravvissuto** dal checkpoint (morte: random; abbandono: `leaver`).
2. **−25 morale** (rischio spirale: morale basso → diserzioni → morale più basso).
3. Il nome esce dal roster e l'epilogo lo conterà tra i **caduti** (lista perduti, letta alla tratta-finale).
4. Recupero possibile solo via `rescue` su strada — è ciò che rende il salvataggio prezioso e morale-positivo.

### 4.5 Dove migra ogni cosa

- **Regole (→ `GAME_DESIGN.md` §9/§10):** MORALE come pilastro gestionale, le soglie (normale/demoralizzato/rotto), "razionamento = scelta esplicita", "perdita = −morale + conta nell'epilogo", e l'epilogo come **funzione di stato**. Dichiarare esplicitamente "design-intent, non ancora implementato".
- **Numeri (→ nuova `BALANCE.md §11`, formato `Leva | Valore | Dove`):** `MORALE_START/BREAK/ROUT` e tutti i delta. **Non serve marcarli 🔒 subito** (il validatore copre solo le sezioni lockate e le entità note); se in futuro si vogliono lockare, va aggiunta una lista al validatore. *Coerenza con lo stato attuale: cibo/ferite/rescue oggi sono già NON validati a numero pur stando sotto un titolo 🔒.*
- **Visual (→ art bible):** indicatore morale nell'HUD → `ART_BIBLE_INTERFACCE` (HUD) + `ART_BIBLE_ICONE` (glifo procedurale + teach-once); l'arredo `camp` come luogo-recupero è già in `HubEnvironment` ma le sue texture **non sono validate**.
- **Stringhe (→ i18n ×6, `it.ts` canonico):** nome/descrizione morale, testi delle soglie, **ogni opzione di ogni incontro Tier C**. Numeri nelle stringhe via params.

**Punti di codice toccati (fase F5, non in questa passata):** `RunState.ts` (4 punti per `morale`+`choices`), `GameScene` (terzo predicato del gate; razionamento esplicito + Δ morale a fine tratta; Δ morale alla perdita; epilogo nel chokepoint `triggerMissionComplete`), `StopScene`/`RouteScene` (render incontri).

---

## §5 · Soste/incontri (Tier C) e set-piece climax (1/atto)

> **Ambito.** Due famiglie di contenuto *opzionale-ma-strutturante*: (a) gli **incontri Tier C** alle soste — scelte morali agganciate ai 5 `StopLocation`; (b) un **set-piece climax di sopravvivenza per atto** (NON boss-arena) sull'ultima tratta. Entrambi riusano sistemi già in codice. Niente qui è implementato; le destinazioni sono a fine sezione.

### 5.1 Soste & incontri Tier C — la scelta dal "costo umano"

**Stato di partenza (codice reale).** Le soste sono già luoghi giocabili a piedi: `StopScene` rende l'hub, l'autista cammina e attiva *stazioni* per prossimità. Oggi esistono solo **3 tipi di stazione** (`service` → `ShopScene`, `depart` → `RouteScene`, `refuel` → pompa diegetica), con un singolo `tryInteract()`. I 5 luoghi sono dati neutri in `Locations.ts`; il descrittore `StopLocation` ha 14 campi ma **nessun campo evento/scelta**. Gli NPC dell'hub sono dichiaratamente *atmosfera* ("dialoghi = Tier C, in arrivo"). L'incontro Tier C è quindi lo **slot già previsto** da [`SOSTE_DIEGETICHE.md §4/§7`](SOSTE_DIEGETICHE.md) (Fase 4, ⬜ da fare), non un'invenzione.

**Cosa aggiunge.** Il descrittore-tappa può dichiarare un campo opzionale `encounter?` letto **all'arrivo alla sosta**. L'incontro è una **stazione interagibile in più** nell'hub (nuovo `Station.kind = 'encounter'`), o un overlay all'ingresso. Confermando si apre un pannello a 2-3 opzioni con **conseguenza persistente** in `RunData.choices`. Le opzioni spostano la decisione dal "buff numerico" al **costo umano**.

| Luogo (`key`) | Incontro | Le 2-3 opzioni e il loro costo umano | Risorse toccate |
|---|---|---|---|
| **camp** (accampamento) | **Chi salvare / il fuoco condiviso** | *Condividi le razioni* (−cibo, +morale) · *Razionamento duro* (cibo intatto, −morale, qualcuno resta affamato → gancio `hungry`/`starveStreak`) · *Recluta il ferito* (occupa uno `survivorSlot`, costa cura) | cibo, morale, `survivors`/`hungry` |
| **depot** (deposito) | **Saccheggio sotto pressione** | *Saccheggia a fondo* (+munizioni/+monete, −morale, rischio: spawn-batch d'agguato alla partenza) · *Prendi e fuggi* (poco bottino, morale intatto) | munizioni, monete, morale |
| **market** (mercato nero) | **Il mercante che ruota la merce** | *Compra l'arma rara* (−molte monete) · *Baratta un sopravvissuto-bocca* (cinico: −1 `survivor`, +risorse, −morale forte → flag `choices`) · *Rifiuta* | monete, `survivors`, morale, `choices` |
| **checkpoint** (posto di blocco) | **Pedaggio / stallo teso** | *Paga il pedaggio* (−monete, passaggio sicuro) · *Forza il blocco* (gratis ma −integrità veicolo + spawn ostile) · *Negozia* (esito legato a morale: alto = sconto, basso = scontro) | monete, componenti, morale |
| **garage** (officina) | **Triage delle riparazioni** | *Cosa riparare prima* col budget limitato (motore vs ruote vs serbatoio vs torretta) — non morale ma **scelta gestionale** sotto scarsità d'atto | monete, `components` |

**Riuso, zero scena nuova.** L'incontro **non** introduce una scena: estende l'array `stations` e lo switch `tryInteract` già generici di `StopScene`, e il pannello a opzioni riusa la logica-pannello di `ShopScene`. La conseguenza persiste col canale già usato dal refuel diegetico (`snapshotRun` + `SaveData.saveRun`). **Vincolo di equità invariato:** l'incontro è sempre *opzionale e saltabile* — i core `repair`/`refuel`/`restock` restano disponibili, nessuna scelta causa softlock.

**Scorciatoia rischiosa vs strada lunga.** La terza forma di scelta morale vive in `RouteScene` ai **2 punti di biforcazione** (legIndex 11 e 22): "scorciatoia" promette risparmio (scarsità/minaccia maggiore) vs "strada lunga" sicura e povera. Stessa lunghezza in leg (§2.3); riusa `drawCard` arricchita e il branch già isolato (`RouteScene.choose`), separando `legIndex` (persistente) da `routeModifier` (consumabile).

### 5.2 Set-piece climax — uno per atto, sopravvivenza non boss-arena

**Principio.** Il climax di ogni atto **non** è un duello a barra HP (boss spenti, `BOSSES_ENABLED = false`) ma un **evento forzato sull'ultima tratta dell'atto**: il descrittore porta `setPiece`, che **scavalca il random** dello scheduler eventi B2 invece di pescare a `EVENT_FRACTIONS`. Tutti i 5 set-piece del primo taglio **riusano gli eventi B2 già in codice** (`eventNightHorde`, `eventRoadblock`, `eventStorm`), composti e tarati — zero codice-evento bespoke nel taglio minimo.

**Atto 1 — PONTE CHE CROLLA con inseguitore (leg 5).** *Meccanica:* `roadblock`+`storm` forzati — muro di relitti con varco da centrare + velo-polvere; throttle obbligato alto; niente sosta-riparo finché non sei dall'altra parte. *Telegrafo:* banner `announceEvent` + drone-nemesi più basso + spawn-pattern anomalo negli ultimi 30 s (solo presagio). *Fail/Success:* fail = carburante/salute a 0 nel collo di bottiglia (→ checkpoint d'inizio tratta); success = raggiungere `MISSION_DIST`. *Riuso:* eventi B2 + loop hazard A1 + throttle/scroll.

**Atto 2 — TEMPESTA DI SABBIA + posto di blocco rivale (leg 11).** *Meccanica:* `storm`+`roadblock` forzati; tratta a `fuelDrainMult` alto (lo stress è il **carburante**). Coincide col **1° punto di biforcazione**. *Telegrafo:* velo tempesta che monta + carta-bivio in `RouteScene` **prima** della tratta. *Fail/Success:* fail = carburante a secco; success = uscire dalla tempesta. La Nemesi **esordisce** come inseguitore (se attiva). *Riuso:* eventi B2 + `fuelDrainMult` + biforcazione `altOf`.

**Atto 3 — TUNNEL A FARI SPENTI (leg 17).** *Meccanica:* `night` forzato a velo quasi totale, visione ridotta al cono dei fari, **burst continuo dal buio**; gli spari "rivelano la posizione" e richiamano la Nemesi. *Telegrafo:* le luci calano progressivamente + stinger; l'ingresso del tunnel è leggibile come soglia. *Fail/Success:* fail = sopraffatti al buio; success = uscita = **seminare la Nemesi** (primo inseguimento attivo). *Riuso:* `eventNightHorde` con dim aumentato + director (`burstMult` alto / `calmInterval` corto).

**Atto 4 — RAFFINERIA/DIGA CHE CEDE (leg 23).** *Meccanica:* muro mobile di `oil`+`mine` con varco che si sposta — **throttle gestito** per centrare il varco; riusa il loop hazard A1 con bias verso oil+mine. *Telegrafo:* allarme/sirena audio + il varco lampeggia prima di muoversi. *Fail/Success:* fail = danno cumulato motore fino a stallo; success = attraversare. Coincide col **2° bivio** (leg 22: città-assediata loot-ricco/mortale vs aggiramento sicuro/povero). *Riuso:* hazard A1 con `hazardMult`/bias + throttle + biforcazione.

**Atto 5 — CITTÀ SOTTO ASSEDIO + resa dei conti (leg 29).** *Meccanica:* burst continuo (**niente fasi calme**) + `roadblock` a strati + `storm`; eventi a catena. Set-piece-**fuga**, non duello: la Nemesi (se attiva) bracca ma non ha barra HP. *Telegrafo:* l'intera tratta è "rossa" (densità massima), il silenzio non torna mai. *Fail/Success:* fail = sopraffatti (qui il convoglio **può perdere un membro**, gancio M3); success = attraversare. *Riuso:* director forzato in `burst` + eventi B2 concatenati + M3.

**Atto 6 — VARCO AL RIFUGIO (finale terminale, leg 30).** *Meccanica:* tratta breve e intensissima (`lengthMult ~0.6`, burst massimo) — l'ultimo strappo verso il cancello. *Telegrafo:* odometro che tocca 6000 km + cambio di musica. *Fail/Success:* l'arrivo **chiude la run**: `triggerMissionComplete` sulla tratta-finale lancia l'**EPILOGO** invece dell'overlay standard e della missione N+1 (sostituisce la vittoria-ciclo). Caccia finale della Nemesi se attiva: si deve solo **arrivare**, non vincere. *Riuso:* chokepoint `triggerMissionComplete` (unico punto da deviare) + `lengthMult`.

> **Telegrafo come regola generale.** Ogni set-piece deve essere **annunciato** (banner `announceEvent` + stinger + segnale visivo) prima di mordere: il pattern `announceEvent`/`showEventOverlay`/`endTimedEvent` è lo scheletro pronto. Un set-piece non telegrafato è una morte ingiusta, non tensione.

### 5.3 Nemesi ricorrente — minimo bespoke, opzionale, ultima fase

La Nemesi (modello *Alien Isolation*) è la fase **F6 spedibile per ultima**, marcata *design-intent, non implementata*. È l'unica meccanica davvero bespoke, ma circoscrivibile al minimo riusando lo scheletro **`giant`** già fuori-pool: il gigante è già spawnato a timer (`GIANT_SPAWN_INTERVAL = 22000`), escluso da `SPAWN_POOL`, con stat proprie. La Nemesi è "un gigante che ricorda".

- *Stato persistente:* `nemesisState` (0=presagio → 3=resa-dei-conti) + `nemesisHeat` (0..100). Serializzati **gratis** dall'intero `RunData`, purché aggiunti a mano ai 4 punti coordinati — rischio noto: dimenticarne uno = sparizione silenziosa al reload.
- *Memoria:* `nemesisHeat` cresce se la semini male o spari troppo nei set-piece (il tunnel la richiama), cala se la eviti; modula l'aggressività all'apparizione successiva.
- *Comportamento:* non è boss-arena. **Si semina, non si batte** — appare come inseguitore a timer fuori-pool durante le tratte tra gli atti; arrivare in fondo a un set-piece = seminarla. Nessuna barra HP, nessun fine-vittoria su di lei.
- *Riuso:* scheletro `giant` (spawn/texture/stat esistenti) + persistenza `RunData`. Il vero costo nuovo è la **logica di stato cross-atto** + il pattern d'inseguimento, da spezzare in 3 stadi spedibili.

### 5.4 Dove migra ogni cosa (gate anti-deriva)

| Contenuto | Documento canonico | Validatore |
|---|---|---|
| Regole incontri Tier C, set-piece = climax (sostituisce il boss), Nemesi "si semina non si batte", epilogo come funzione di stato | `GAME_DESIGN.md` §1/§3/§10 (riscrittura: climax-boss → set-piece; vittoria-ciclo → rifugio) — **Regola n.3** | — |
| Numeri incontro (costo pedaggio, timer/bottino saccheggio, Δ morale per opzione, soglia negoziazione) e Nemesi (`nemesisHeat` decay/gain, intervallo spawn, soglie stato) | nuova **§11** in `BALANCE.md` (formato M1-M4) — **Regola n.2** | `validate:balance` se lockati (oggi le costanti nuove non sono coperte finché non toccano entità note) |
| Stazione-incontro nell'hub, overlay di scelta, telegrafi visivi dei set-piece, sprite/VFX Nemesi | `ART_BIBLE_INTERFACCE` · `ART_BIBLE_AMBIENTE` · `ART_BIBLE_OGGETTI`/`ART_BIBLE_ZOMBIES` | `validate:art` |
| Stinger/allarmi dei set-piece, ambienza Nemesi (drone più basso) | `ART_BIBLE_AUDIO` | `validate:audio` |
| Testi opzioni-scelta, nomi/flavor incontri, banner set-piece, righe epilogo, nome Nemesi | `src/locales/it.ts` canonico → ×6 | `validate:i18n` |

---

## §6 · Consegna narrativa (procedurale, senza cutscene)

> **Vincolo fondante.** Nessuna cutscene, nessun asset esterno, nessun doppiaggio campionato. La storia si racconta con i mezzi che il gioco già possiede — voce sintetica via Web Audio, testo i18n, geometria procedurale — e con **lo stato della run** (`legIndex`/`actIndex`/`morale`/`choices`/`survivors`) come unica sceneggiatura. Quattro canali, in ordine di costo crescente.

### 6.1 Radio e bollettini — la voce del mondo che si spegne

**Cosa.** Una **radio del cruscotto** è il narratore invisibile: brevi bollettini d'emergenza che, atto dopo atto, si fanno più rari, più disperati, infine **statica**. È il termometro diegetico dell'avanzamento.

**Come suona (100% procedurale).** Niente parlato campionato: la radio è un **timbro**, non parole. Tre strati Web Audio su pattern già in `SoundManager.ts`: **portante + statica** (`noise()` attraverso un `bandpass` stretto stile "altoparlante AM", sul modello del bandpass di `playMoan()`); **cadenza "parlato"** (`sawtooth` grave modulato in ampiezza da un LFO veloce — la tecnica del *chug* del motore — dà l'impressione di voce filtrata senza pronunciare una parola; il **testo reale** lo legge il giocatore a schermo); **stinger di canale** (riuso di `playFuelPickup`/`playMissionComplete` per "agganciato", gesto discendente per "segnale perso"). Tutto sotto il motore e il drone (atmosfera, mai protagonista — gerarchia di `ART_BIBLE_AUDIO.md`).

**Cadenza e come segna l'atto** (nessun nuovo scheduler): bollettino "di apertura atto" alla transizione `actIndex` (gancio narrativo del cambio-bioma); commento del set-piece imminente alle soglie `EVENT_FRACTIONS = [0.3, 0.62]`; **degrado progressivo** del segnale come funzione di `legIndex/30` (atto 1 voce pulita → atto 5 quasi solo statica → atto 6 silenzio radio); **mai durante un'ondata/`burst`** (come `playMoan()` è sospeso col boss in campo, la radio parla nella quiete tesa).

**Migrazione.** Regola ("la radio scandisce gli atti e si spegne verso il rifugio") → `GAME_DESIGN.md` §3/§10. Suono → nuova scheda `playRadioBlip()` in `ART_BIBLE_AUDIO.md` (i tre strati sono *atmosfera*, quindi **descritti, non validati a numero** — salvo la frequenza-firma del bandpass "AM", da mettere nella sezione 🔒 frequenze di `ART_BIBLE_AUDIO` sul modello di `shot_filter_hz`; verificare la sezione corretta nel doc reale). Testo → chiavi i18n (`radio.act1.open`, `radio.act3.signal_fade`, …) ×6.

### 6.2 Voci ed eventi dei sopravvissuti — riuso di nome + storia esistenti

**Cosa.** I 7 sopravvissuti hanno **già** identità completa (nome + cognome + bio pre-epidemia in `SURVIVORS`, tradotti in `it.ts`): Bruno Salerno il meccanico, Sara Conti l'infermiera, Marcus Hale il soldato, Nadia Volkova l'esploratrice, Vince Pagano il saccheggiatore, Eva Lindqvist la cecchina, Karim Haddad l'artificiere. Oggi questa ricchezza è **inerte** (solo riga-abilità nel negozio). *Il Convoglio* la attiva in **battute diegetiche** ancorate ai momenti M1-M4 che già esistono.

**Come (zero nuovi sistemi di dialogo).** Le battute sono **testo a schermo** (banner/overlay di `announceEvent`/`showEventOverlay`), con un breve **blip-voce procedurale** facoltativo (timbro radio di 6.1, intonato sul `color` del personaggio). Si agganciano ai trigger già cablati: **reclutamento** (`recruitSurvivor` → "si presenta" leggendo la `bio`), **fame/abbandono** (riga di tensione / riga amara), **ferita/cura** (commento situazionale), **salvataggio** (`rescue` → +morale), **perdita** (l'epilogo ne *ricorderà il nome*). Una battuta per evento, **throttellata** come `playHit()`; priorità ai momenti rari (abbandono, morte) sopra quelli frequenti.

**Migrazione.** Regola → `GAME_DESIGN.md §9`. Dati: nessun nuovo campo *obbligatorio* in `SurvivorData`; le battute sono **chiavi i18n per-personaggio-per-momento** (`survivor.mechanic.recruit`, `survivor.medic.starving`, …) ×6 (i nomi propri restano non tradotti, già da contratto). Suono → riusa il timbro-radio.

### 6.3 Oggetti-ambiente "esodo fallito" — racconto senza testo

**Cosa.** Il mondo racconta che *altri ci hanno provato e non ce l'hanno fatta*: auto incolonnate e abbandonate, valigie sventrate, posti di blocco sfondati, falò spenti. È environmental storytelling: **dettaglio visivo, zero parole**, quindi **zero carico i18n**.

**Come (riuso della pipeline procedurale).** Nessun asset nuovo: si estende ciò che è già procedurale. **In corsa**, gli `hazard` di corsia sono già `wreck`/`oil`/`mine`: i `wreck` diventano **relitti dell'esodo** (auto cariche, sportelli aperti), il loro *bias* per atto è già un asse del descrittore (`hazardMult` + `poolBias` hazard). **Alle soste**, `HubEnvironment` disegna già terreno/muro/relitti/NPC ambientali: il palcoscenico perfetto per il "campo dell'esodo fallito", variato per `stopKind`. **Densità crescente** col `legIndex`: pochi relitti nell'atto 1, file intere e barricate negli atti 4-5.

**Migrazione.** Visual → schede in `ART_BIBLE_AMBIENTE.md` (relitti dell'esodo) e — appena le texture hub entrano nel validatore — scheda hub dedicata (oggi `HubEnvironment.ts` **non** è coperto da `validate:art`: deriva possibile, da chiudere). Numeri (densità/bias) → assi `hazardMult`/`poolBias` → §11 BALANCE. i18n: nullo per i props muti; minimo per eventuali scritte-sui-muri (×6).

### 6.4 L'epilogo con peso — la fine come funzione di stato

**Cosa.** L'arrivo alla tratta-terminale (`legIndex` finale, il rifugio) **non** apre l'overlay-missione standard: lancia l'**EPILOGO**, una sequenza testuale + sonora che chiude la run e *legge cosa è arrivato vivo*. Tono **survival horror, spesso amaro**: anche "arrivare" può costare tutto. È il `triggerMissionComplete` dirottato sulla tratta finale (oggi `missionNumber % 7 == 0` → vittoria-ciclo, da sostituire).

**Come (funzione pura dello stato di `RunData`, senza nuovi asset).** *Input:* quanti `survivors` vivi *e quali nomi*, `morale` finale, integrità veicolo (`components`), somma di `choices[]`. *Output:* **4 finali** (proposti) in registro *This War of Mine / Oregon Trail*. Ogni finale è **testo i18n** + un **gesto sonoro** assemblato da voci esistenti (fanfara *attenuata e incompleta* per i finali agri da `playMissionComplete` troncata; gesto discendente da `playGameOver`; drone che **non si spegne** da `setDread` per la coda amara). *Memoria nominale:* l'epilogo **nomina i caduti** (i `properName`/`surname` rimossi alla morte) e i salvati.

**I 4 finali (proposti, condizioni-soglia da tarare in §11):**

| # | Finale | Condizione (su stato `RunData`) | Tono |
|---|---|---|---|
| 1 | **"Il convoglio regge"** | ≥4 sopravvissuti vivi **e** `morale ≥ 50` | il più speranzoso, ma sobrio: arrivate in molti, il rifugio accoglie |
| 2 | **"Pochi, ma vivi"** | 1-3 sopravvissuti vivi **e** `morale ≥ 25` | arrivi decimato ma non solo; i caduti sono nominati |
| 3 | **"Arrivi solo"** | 0 sopravvissuti a bordo **o** `morale < 25` | il prezzo è stato tutto; arrivi e il sedile accanto è vuoto |
| 4 | **"Il rifugio è caduto"** | flag-`choices` peggiori **o** `morale < 15` **o** veicolo in rovina | finale amaro horror: arrivi e non c'è più niente ad accoglierti |

**Cadenza.** Un solo evento, **terminale**: chiude la corsa, niente missione N+1. È l'unico nodo del manifest che termina.

**Migrazione.** Regola (cambio di *condizione di vittoria*: "vittoria di ciclo ripetibile + endless+" → "rifugio-finale unico, esito sui sopravvissuti") → **riscrittura** di `GAME_DESIGN.md §1/§10`, dichiarando la vittoria-ciclo attuale "da reimplementare" (oggi marcata ✅ in §12.1). Numeri (soglie morale/integrità/conteggio → finale) → §11 BALANCE. Suono → nessuna voce nuova portante. Testo → chiavi i18n ×6 (`epilogue.full`, `epilogue.alone`, `epilogue.fallen` con `{name}` via params).

### 6.5 Sintesi impatto su SoundManager / art bible audio / i18n

| Canale | SoundManager | `ART_BIBLE_AUDIO.md` | i18n ×6 |
|---|---|---|---|
| **6.1 Radio/bollettini** | 1 nuovo `playRadioBlip()` (riusa `noise()`+`bandpass` + tecnica LFO→trem) | nuova scheda + voce mappa; frequenza-firma bandpass nella sezione 🔒, resto *descritto* | molte chiavi `radio.*` |
| **6.2 Voci sopravvissuti** | riuso del timbro-radio (nessun metodo portante nuovo) | nota (intonazione su `color`) | chiavi `survivor.<key>.<momento>` |
| **6.3 Oggetti-esodo** | nessuno (visual + hazard esistenti) | impatto su `ART_BIBLE_AMBIENTE`; hub fuori `validate:art`, da chiudere | nullo (eventuali scritte = poche chiavi) |
| **6.4 Epilogo** | nessun metodo nuovo: assembla `playMissionComplete`/`playGameOver`/`setDread` | nota di assemblaggio | chiavi `epilogue.*` (4 finali + `{name}`) |

**Costo audio reale:** **un solo** nuovo metodo portante (`playRadioBlip`); tutto il resto è ricomposizione di voci esistenti. **Costo i18n:** significativo ma lineare e tracciato (`radio.*`, `survivor.*.<momento>`, `epilogue.*`), tutto canonico in `it.ts` e ×6 o `validate:i18n` blocca la build.

---

## §7 · Budget contenuto

> **Scopo.** Dimostrare con i numeri che la finestra **2-4 ore** si raggiunge dal **numero di tratte × durata + set-piece + soste**, senza allungare costanti validate; e distinguere cosa **scala procedurale** (quasi gratis) da cosa è **bespoke** (costoso).

### 7.1 Baseline odierno (~14 min, 7 regioni che ciclano)

Oggi una "corsa" non ha durata di progetto: il loop è **infinito** (`envIndex = (missionNumber−1) % 7`). I ~14 min sono **un giro completo delle 7 regioni** prima che ricomincino solo cambiando colore:

| Voce | Valore reale (ancorato) |
|---|---|
| Durata guida pura / missione | ~75 s (`MISSION_DIST = 18000` ÷ `SCROLL_SPEED = 240`) |
| km mostrati / missione | 180 km (`18000 × KM_PER_UNIT 0.01`) |
| Regioni prima del riciclo | 7 (solo colore, gameplay identico) |
| Guida pura, un giro | ~9 min (7 × ~75 s) |
| + soste/overlay/shop fra missioni | ~5 min |
| **Totale percepito, un giro** | **~14 min** poi **ricomincia uguale** |

**Problema strutturale:** zero finale, zero escalation di contenuto, varietà = 7 palette.

### 7.2 Unità di costo: la "tratta percepita"

La tratta è una missione `MISSION_DIST` **invariata (🔒)**: si modula la durata percepita con `lengthMult` (0.6-1.5), **mai** toccando la costante. I 75 s di guida *pura* diventano **3,5-4,5 min percepiti**, perché alla guida si sommano combat sotto pressione, eventi a soglia, throttle modulato e l'overlay+sosta tra una e l'altra:

| Componente della tratta-tipo | Minuti |
|---|---|
| Guida pura (`MISSION_DIST` × `lengthMult` medio ~1.07, motore non sempre sano) | ~1,3-1,8 |
| Combat/eventi/throttle che dilatano il tempo reale | ~1,5-2,0 |
| Overlay fine-tratta + camminata hub + decisione | ~0,7-1,0 |
| **Tratta-tipo** | **~3,5-4,5** |
| **Tratta di climax / assedio** (set-piece) | **~6-8** |
| **Tratta-rifugio finale** (`lengthMult ~0.6`, burst max) | **~3-4** intensissimi (il burst-max dilata i ~45 s di guida pura a ~3 min reali) |

### 7.3 Stima per arrivare a 2-4 h (numeri quadrati con §2.3)

Manifest a **6 atti**, **~33 entry**; una corsa singola percorre **31 tratte** (i 2 bivi a `legIndex 11`/`22` sono varianti mutuamente esclusive, §2.3). Tratte normali = 25, climax = 5, terminale = 1. Soste = **30** (una dopo i leg 0-29, durata media ~2,5 min — pit-stop rapidi vs soste gestionali).

| Blocco | Conteggio | Minuti unitari | Subtotale |
|---|---|---|---|
| Tratte normali | 25 | ~3,75 | ~94 min |
| Tratte di climax di fine atto (set-piece, atti 1-5) | 5 | ~7 | ~35 min |
| Tratta-rifugio terminale | 1 | ~3,5 | ~3,5 min |
| Soste (gestione + shop + camminata hub) | 30 | ~2,5 | ~75 min |
| **Corsa-tipo (zero morti, scelte medie)** | — | — | **~207 min ≈ 3h27** |
| Corsa "veloce" (skip soste, throttle alto, pochi eventi) | — | — | **~2h05-2h20** |
| Corsa "completa" (morti+retry checkpoint, esplora rami alt., legge incontri) | — | — | **~3h30-4h00** |

**Conclusione:** la finestra 2-4 h è centrata **per costruzione**. Le leve che la spostano dentro la finestra sono tutte **dati**, non codice nuovo: numero di entry nel `STAGE_MANIFEST`, `lengthMult` per-tratta, densità soste — nessuna tocca `MISSION_DIST` (🔒). Per allungare/accorciare si aggiungono/tolgono righe del manifest.

### 7.4 Cosa scala PROCEDURALE (quasi gratis)

È il moltiplicatore 5-10× del contenuto: la varietà nasce dalle **combinazioni dei 10 assi-descrittore**, non da livelli scritti a mano — **zero asset, zero nemici, zero scene nuove**:

| Cosa scala | Da dove (riuso) | Costo marginale per tratta |
|---|---|---|
| **Le ~33 entry** (bioma, lunghezza, densità, scarsità, poolBias, hazard) | 1 riga nel `STAGE_MANIFEST` (pattern mono-riga di `BOSS_CONFIG`) | ~quasi nullo |
| **Bioma/palette** | 7 `ENVIRONMENTS` come libreria-colore, già validate | 0 (riferimento) |
| **Composizione minaccia** | pesatura degli 8 `ZombieType`/`SPAWN_POOL`, nessun nemico bespoke | 0 |
| **Ritmo ondata** | director dread→burst H1 già parametrico | 0 |
| **Scarsità** (carburante/munizioni/cibo) | `ammoCrateMult`/`fuelDrainMult` su loop esistenti | 0 |
| **Hazard di corsia** | loop A1 `wreck/oil/mine` | 0 |
| **Tipo di sosta** | i 5 `StopLocation` come `stopKind` | 0 |

**Anche semi-procedurali (riuso + poco testo):** eventi B2 (già 5 mattoni, il descrittore li **forza**); radio/flavor (solo i18n ×6, zero codice una volta esistente il canale).

### 7.5 Cosa è BESPOKE (costoso, da scrivere a mano)

| Elemento bespoke | Perché non scala | Quantità minima | Stima |
|---|---|---|---|
| **Set-piece di climax** | è regia, non combinazione | **6** (1/atto), ma i **primi 5 riusano** eventi B2 esistenti → il bespoke è il *wiring/tuning* | F4 ~8-14 h |
| **Epilogo finale** | scritto a mano: legge sopravvissuti × morale × integrità × `choices` | **1** sistema + **4** schermate-testo | parte di F5 |
| **Scelte agli incontri (Tier C)** | conseguenze persistenti scriptate | **~5-8** incontri, campo `encounter?` | parte di F5 (~16-24 h totali con morale) |
| **MORALE del convoglio** | nuovo strato gestionale | 1 sistema modellato su `FOOD`, gate unico `hasActiveSurvivor` | dentro F5 |
| **Nemesi ricorrente** | inseguitore persistente cross-atto (**opzionale**) | riusa scheletro `giant` + `nemesisState/Heat` | F6 ~10-16 h |

**Quanto bespoke serve:** per una **prima campagna finibile e spedibile** servono **0 elementi bespoke** (F1: `legIndex` + manifest lineare + meta sostituiscono il mod-7 → già finibile). Il contenuto "vivo" arriva poi con 6 set-piece (5 riusano eventi) + 1 epilogo + ~5-8 incontri + 1 strato morale. La Nemesi è **extra** rimandabile. Tutto il resto — le 31 tratte, la loro varietà, le 30 soste — **non è bespoke**: è il manifest.

> **Marcatura obbligatoria.** Set-piece, morale, incontri, epilogo e Nemesi vanno scritti nei doc come **"design-intent — NON implementato"** finché non esistono nel codice, o `GAME_DESIGN`/`BALANCE` divergono dal sorgente.

### 7.6 Confronto netto col baseline

| | Oggi | IL CONVOGLIO |
|---|---|---|
| Struttura | ciclo infinito mod-7 | manifest finito ~33 entry, terminale |
| Durata | ~14 min poi ricomincia uguale | ~2h05-4h00, **con un finale** |
| Fonte della varietà | 7 palette | combinazioni di 10 assi-descrittore + 6 set-piece |
| Contenuto bespoke | 0 (e 0 longevità) | 6 set-piece + 1 epilogo + ~6 incontri + morale (+ Nemesi opz.) |
| Mappe disegnate a mano | 0 | **0** (varietà procedurale dai descrittori) |
| Moltiplicatore tempo-gioco | 1× | **~9-13×**, ~quasi tutto da dati |

Il salto 14 min → ~3 h (~12×) si ottiene **senza disegnare una sola mappa bespoke**: la varietà nasce da righe di manifest, e il bespoke resta confinato ai ~6 momenti-firma + l'epilogo.

---

## §8 · Roadmap a fasi

> Principio: **niente big-bang**. Ogni fase è uno *slice verticale* spedibile — compila, supera `npm run build` (validatori inclusi), è giocabile e si testa da sola. Si parte dal massimo **valore/rischio** (sostituire il loop infinito con un arco finibile vale moltissimo e costa poco) e si rimanda a coda ciò che è *sistema nuovo* (morale, incontri, Nemesi). Ordine **F1 → F6**; ogni fase assume implementate solo le precedenti.

### F1 — Odometro lineare: il manifest finito sostituisce il mod-7 · **Valore/rischio: ALTISSIMO / BASSO-MEDIO**

*È già una campagna finibile a zero sistemi nuovi.*

**Obiettivo.** Introdurre `STAGE_MANIFEST` + `legIndex`/`actIndex` persistenti, e disaccoppiare da `missionNumber` i quattro call-site che assumono il ciclo (bioma, sosta, difficoltà, vittoria). Alla tratta-terminale la run **chiude**. Il descrittore in questa fase può contenere **solo** `biome` + `stopKind` (gli altri 8 assi in F2).

**File-impatto.** `src/World.ts` (nuova `STAGE_MANIFEST` mono-riga + tipo `StageDescriptor`); `src/RunState.ts` (`legIndex`/`actIndex` nei **4 punti**, default `?? 0`); `src/scenes/GameScene.ts` (`envIndex` legge il manifest; `difficultyMult` → curva su `actIndex` con tetto; `triggerMissionComplete` incrementa `legIndex` e, alla terminale, sostituisce la vittoria-ciclo con un esito-finale placeholder); `src/Locations.ts` (`locationForMission` legge `stopKind`, fallback `?? 'garage'` anti-softlock).

**Impatto validatori.** `validate:balance` — **nessuna riga 🔒 obbligatoria** finché il manifest ha solo `biome`/`stopKind`; `MISSION_DIST` resta 🔒 invariato. `validate:art` — invariato (`ENVIRONMENTS` non cambia). `validate:i18n ×6` — nuove chiavi: nomi dei 6 atti + etichetta tratta-finale + 1 schermata-esito placeholder. **`GAME_DESIGN.md` — obbligatorio in questa fase** (Regola n.3): §3 da "regioni cicliche" a "atti lineari + tratta terminale"; §1 passo 5 da "Loop a cicli" a catena con finale; §10 da "vittoria di ciclo" a "vittoria-finale unica", dichiarando la vittoria-ciclo *da reimplementare*.

**Come si testa.** Tasto debug `N` (salta a fine missione): percorrere il manifest fino al terminale e verificare che (a) bioma e sosta cambino *secondo il manifest*; (b) al terminale parta lo schermo-esito e **non** una missione N+1; (c) `CONTINUA` cross-sessione riprenda allo stesso `legIndex`. Galleria hub debug per ispezionare ogni `stopKind`.

### F2 — Descrittori-tappa a spina dorsale (Track C2 promosso) · **Valore/rischio: ALTO / MEDIO**

*Dà i 5-10× contenuto da combinazioni senza mappe bespoke.*

**Obiettivo.** Espandere il descrittore con gli assi numerici/di-composizione e iniettarli nei punti già parametrici: `lengthMult`, `spawnMult`/`burstMult`, `ammoCrateMult`/`fuelDrainMult`, `poolBias`, `hazardMult`.

**File-impatto.** `src/World.ts` (estendere `StageDescriptor`, resta mono-riga); `src/scenes/GameScene.ts` (iniezione: durata via `lengthMult` su `updateDistance`/`eventThresholds` **senza toccare `MISSION_DIST` 🔒**; densità su `calmInterval`/`burstInterval`/`BURST_MS_BASE`; scarsità su `spawnAmmoCrate`/`getEffectiveFuelDrain`; `poolBias` su `SPAWN_POOL`; `hazardMult` sul loop hazard).

**Punto critico di taratura.** `routeSpawnMult` (B1) **già** moltiplica gli intervalli. Comporre `routeModifier × descrittore` ingenuamente → run troppo facili o impossibili. Decisione in **§9.4** (clamp di B1 ±30% sulle tratte lineari).

**Impatto validatori.** `validate:balance` — gli assi vanno documentati in **nuova §11 BALANCE**; non obbligatoriamente 🔒 (vedi §9.6); `MISSION_DIST` intoccato. `validate:art`/`i18n` — nessun nuovo obbligo se i biomi restano i 7 esistenti.

**Come si testa.** Manifest di prova con tratte-estreme contigue ("maratona deserto" `lengthMult 1.5` + `fuelDrainMult 1.5` vs "sprint assedio" `lengthMult 0.6` + `spawnMult 0.6`): verificare a occhio che durata, densità ondata e consumo divergano in modo percepibile e che il carburante diventi il collo di bottiglia atteso nell'Atto 2.

### F3 — RouteScene-mappa + nastro-odometro + 2 biforcazioni locali · **Valore/rischio: MEDIO-ALTO / BASSO-MEDIO**

*Rende l'arco leggibile e introduce la prima vera scelta di percorso.*

**Obiettivo.** Trasformare `RouteScene` da picker one-shot a **schermata-mappa** che legge dal manifest: 1 carta "PROSEGUI" su tratta lineare (con anteprima), 2 carte ai **2 soli** punti di biforcazione (`altOf`). Aggiungere il nastro-odometro 0→6000 km in HUD.

**File-impatto.** `src/scenes/RouteScene.ts` (separare: `choose(tratta)` avanza `legIndex` persistente **e** imposta `routeModifier` consumabile; `drawCard` arricchita); `src/RunState.ts` (`branchTaken` nei 4 punti, default `?? {}`); HUD (nastro-odometro come overlay leggero, riusa `Ui.box`/rectangle — l'**unica UI davvero nuova**).

**Impatto validatori.** `validate:i18n ×6` — etichette carte-biforcazione + anteprime + tacche-atto. `validate:art` — l'odometro/carte sono UI/HUD → aggiornare la scheda HUD in `ART_BIBLE_INTERFACCE` (token, colori daltonico-safe già in `HudController`). `validate:balance` — i moltiplicatori delle due tratte-biforcazione entrano in §11.

**Come si testa.** Percorrere fino a `legIndex 11` e `22`: compaiono 2 carte; scegliere il ramo corto vs lungo deve (a) salvare `branchTaken`, (b) far convergere il percorso entro 1-2 tratte, (c) sopravvivere a un retry-post-morte. L'odometro avanza monotòno verso 6000 km su entrambi i rami.

### F4 — Set-piece forzati di fine atto (sui 5 eventi B2) · **Valore/rischio: MEDIO / BASSO**

*Dà il climax horror riusando eventi già self-contained.*

**Obiettivo.** Sull'asse `setPiece` del descrittore, la tratta-climax di ogni atto **forza** un evento B2 esistente invece del random a `EVENT_FRACTIONS`.

**File-impatto.** `src/scenes/GameScene.ts` (`triggerRandomEvent` e il pool `['night','roadblock','storm','convoy','rescue']`: se il descrittore dichiara un `setPiece`, bypassa il random e invoca l'evento a soglia. Eventi già self-contained → **zero codice-evento nuovo** nel primo taglio).

**Impatto validatori.** `validate:i18n ×6` — banner/announce dei set-piece (se diversi). `GAME_DESIGN.md` — §1 passo 2 / §4 / §3: il climax passa da "duello boss all'82%" a "set-piece di sopravvivenza". Boss restano `BOSSES_ENABLED = false`.

**Come si testa.** Saltare (tasto `N`) fino a ogni tratta-climax e verificare che l'evento forzato parta **sempre e in modo deterministico** (scavalcando sia la selezione casuale dal pool sia il tiro di probabilità ~80% degli eventi normali) alla soglia giusta, e che non si possa accedere alla sosta-riparo prima di averlo superato.

### F5 — Morale + incontri Tier C + epilogo · **Valore/rischio: ALTO / ALTO**

*È sistema nuovo (~16-24 h codice), non solo dati: va in coda e **spezzato**.*

**Obiettivo.** (1) **Morale** 0..100 (default 60), modellato su `FOOD`, agganciato al gate unico `hasActiveSurvivor` (sotto-soglia spegne le abilità). (2) **Incontri Tier C** (Fase 4 SOSTE_DIEGETICHE): 2-3 opzioni con conseguenza persistente in `RunData.choices`. (3) **Epilogo** come funzione di stato → **4 finali** (§6.4), lanciato da `triggerMissionComplete` sulla tratta terminale.

**File-impatto.** `src/RunState.ts` (`morale` default **60**, `choices` default `[]`, `reachedRefuge`; **4 punti**); `src/GameData.ts` (struct `MORALE` accanto a `FOOD`); `src/scenes/GameScene.ts` (decadimento morale + gate + epilogo); `src/scenes/StopScene.ts`/`src/Locations.ts` (incontri come `encounter?`, infrastruttura `Station`+`tryInteract` già generica).

**Impatto validatori.** `validate:balance` — numeri morale + delta-scelte in §11 (come cibo/ferite oggi: NON validati a numero salvo lock esplicito). `validate:i18n ×6` — testi incontri (prompt + opzioni + esiti) + 4 finali: **carico i18n significativo**. `GAME_DESIGN.md` — §9 collegato all'esito; §10 vittoria-finale. **Marcare "design-intent, non implementato"** finché il codice non c'è.

**Come si testa.** Forzare scenari (debug): perdere un sopravvissuto → morale cala → sotto-soglia le abilità si spengono. Percorrere fino al rifugio con stati diversi (molti/pochi vivi, morale alto/basso) e verificare che l'epilogo selezioni **finali diversi** secondo le soglie di §6.4.

### F6 — Nemesi-con-memoria (opzionale, ultima fase spedibile) · **Valore/rischio: MEDIO / ALTO**

*Bespoke ma circoscritta; **opzionale**, marcata "non implementata" finché non esiste.*

**Obiettivo.** Inseguitore persistente cross-atto: `nemesisState` (0=presagio → 3=resa-dei-conti) + `nemesisHeat` (0..100). **Si semina, non si batte**. Riusa lo scheletro `giant` fuori-pool (`GIANT_SPAWN_INTERVAL = 22000`) con persistenza in `RunData`.

**File-impatto.** `src/RunState.ts` (`nemesisState`/`nemesisHeat`, **4 punti**, default `?? 0`); `src/scenes/GameScene.ts` (innesco su transizione; il giant è già fuori-`SPAWN_POOL`; boss restano spenti); `src/World.ts` (i 4 `BossType` al più forniscono l'archetipo visivo, **non** un climax).

**Impatto validatori.** `validate:i18n ×6` — nome/banner Nemesi. `validate:art` — se ha skin propria, scheda in `ART_BIBLE_ZOMBIES`; altrimenti riuso `giant` = nessun nuovo gate. `validate:balance` — HP/velocità/heat in §11 o §5/§6.

**Come si testa.** Run completa: presagio in atto 1 (solo audio/pattern, nessuna entità), esordio-inseguitore in atto 2-3, e `nemesisHeat` che sale sparando/seminandola male e scende evitandola (persistenza cross-tratta dopo reload).

### Riepilogo roadmap

| Fase | Contenuto | Valore/Rischio | Sistemi nuovi | Spedibile da sola? |
|---|---|---|---|---|
| **F1** | Odometro lineare (manifest finito + meta) | ALTISSIMO / BASSO-MEDIO | nessuno | ✅ già campagna finibile |
| **F2** | Descrittori-tappa (C2 spina dorsale) | ALTO / MEDIO | solo dati | ✅ |
| **F3** | RouteScene-mappa + odometro + 2 bivi | MEDIO-ALTO / BASSO-MEDIO | 1 UI (odometro) | ✅ |
| **F4** | Set-piece forzati (5 eventi B2) | MEDIO / BASSO | nessuno (wiring) | ✅ |
| **F5** | Morale + incontri Tier C + epilogo | ALTO / ALTO | sì (~16-24 h) | ✅ (spezzabile) |
| **F6** | Nemesi-con-memoria (opzionale) | MEDIO / ALTO | sì (bespoke) | ✅ (extra) |

---

## §9 · Rischi e decisioni aperte

> Da **sciogliere prima del codice**. Per ognuna: opzioni + raccomandazione. Le decisioni **[SCELTA DEL DESIGNER]** non vanno risolte qui: sono bivi di game-design, non tecnici.

### 9.1 [SCELTA DEL DESIGNER] Checkpoint-save attuale vs permadeath più netto

Il modello oggi è **non-roguelite, forgiving**: il game over **non azzera** — ripristina lo snapshot d'inizio missione con un pedaggio (`DEATH_MONEY_PENALTY = 0.25`) e la perdita di **1 sopravvissuto**; un solo slot persistente (`zombieRoad.save.v1`). Una campagna *finibile* "Oregon Trail / This War of Mine" tende a far **pesare** le perdite — il rischio è che un retry quasi-gratis svuoti di tensione l'epilogo "chi è arrivato vivo".

- **A — Conserva il checkpoint com'è.** Retry alla tratta corrente con pedaggio. *Pro:* zero lavoro, rispetta il registro forgiving di `GAME_DESIGN §10`, single-slot corretto. *Contro:* l'esito-finale conta meno (puoi ri-tentare ogni climax all'infinito); le scelte morali "perdo un membro" si attenuano.
- **B — Permadeath morbido (checkpoint per-atto, non per-tratta).** Morte → riparti dall'**inizio dell'atto**. *Pro:* le perdite pesano senza essere brutali; preserva il single-slot. *Contro:* va spostato il punto di salvataggio del checkpoint (oggi a inizio missione + a ogni acquisto) all'inizio-atto; tuning della frustrazione.
- **C — Permadeath pieno.** Morte = fine corsa, epilogo "fallimento". *Pro:* massimo peso, vero registro survival. *Contro:* rottura netta del modello attuale e dell'aspettativa; alto rischio di abbandono in una campagna da 2-4h.

**Raccomandazione (tecnica, non di design):** default **A** per F1-F4 (sblocca subito l'arco finibile senza toccare `SaveData`); **promuovere B come opzione di difficoltà** quando arriva F5. La **decisione finale è del designer** e va presa **prima di F5**: se il retry è gratis, l'epilogo è meno significativo.

### 9.2 Disaccoppiamento da `missionNumber`: il chokepoint della vittoria-ciclo

Più call-site assumono il mod-7: `envIndex`, `locationForMission`, `difficultyMult`, e soprattutto la **vittoria-ciclo** `missionNumber % 7 === 0` (mostra `game.victoryCycle` e **prosegue endless**). *Rischio medio*, concentrato nel chokepoint `triggerMissionComplete`.
**Raccomandazione:** fare l'intero disaccoppiamento **in F1**, in un'unica passata sul chokepoint, con `missionNumber` mantenuto in parallelo a `legIndex` finché non è certo che nessun sistema lo legga più (record `SaveData`, scaling). **Non spalmarlo:** rompe la fine-ciclo a metà.

### 9.3 `snapshot`/`restore`/`reset` non sono spread: campi che spariscono al reload

Ogni campo nuovo (`legIndex`, `actIndex`, `branchTaken`, `morale`, `choices`, `reachedRefuge`, `nemesisState`, `nemesisHeat`) va aggiunto **a mano in 4 punti**. Dimenticarne uno = bug *silenzioso*: sparisce al cambio scena o reload, e `isRun` di `SaveData` (controlla solo `missionNumber`) lascia passare i save vecchi come validi. **È il rischio tecnico più importante del documento**, confermato dal codice (`snapshotRun`/`restoreRun` elencano ogni campo a mano).
**Raccomandazione:** **default difensivo `??`** su ogni nuovo campo, e una checklist "4 punti" obbligatoria in ogni PR che tocca `RunData`. *Nessuna alternativa: è disciplina, non scelta.*

### 9.4 [SCELTA] Composizione `routeModifier`(B1) × descrittore-tappa(C2) — *fonte canonica*

Entrambi moltiplicano gli stessi intervalli di spawn. Moltiplicarli ingenuamente → run troppo facili o impossibili. **Questa è la decisione canonica cui rimandano §3.2/§3.4.**

- **A — Moltiplicazione piena** (B1 × C2). *Contro:* estremi incontrollabili, tuning fragile.
- **B — C2 base, B1 come modulazione clampata** attorno a 1.0 (es. ±30%). *Pro:* il descrittore definisce la difficoltà *attesa*, la scelta-rotta la *perturba* entro un range sicuro. *Contro:* B1 meno incisivo.
- **C — Le due tratte-biforcazione SONO descrittori C2** (niente `routeModifier` separato ai bivi): il ramo scelto *è* la tratta successiva coi suoi assi.

**Raccomandazione:** **B** per le tratte lineari (clamp di B1), **C** ai 2 punti di biforcazione. Da fissare prima di F2/F3.

### 9.5 Durata 2-4h SENZA toccare `MISSION_DIST` (🔒)

`MISSION_DIST = 18000` è **🔒** (BALANCE §1): allungarlo rompe le soglie eventi/boss e fallisce la build. La durata deve venire dal **numero di tratte** (31 in una corsa) **+ `lengthMult` per-tratta** (0.6-1.5), mai dalla costante. **Vincolo non negoziabile**; documentarlo esplicitamente in §11 accanto a `lengthMult`. Vedi anche §2.4 (la somma dei `lengthMult` ≈ 33.3 perché l'odometro chiuda a ~6000 km).

### 9.6 [SCELTA] Carico di manutenzione: ~33 tratte × tabelle 🔒 + i18n ×6

Con ~33 tratte la §11 BALANCE si allunga; ogni nome-tappa/atto/incontro/finale è una chiave ×6 o `validate:i18n` rompe la build.

- **A — Tutti i 10 assi per tratta lockati 🔒.** *Pro:* anti-deriva totale. *Contro:* 33 righe × molti campi nel validatore; alto carico; ingessa il level-design procedurale.
- **B — Manifest *non* lockato a numero, solo documentato in §11** (come oggi cibo/ferite/director, NON validati). *Pro:* leggero, coerente con lo stato attuale. *Contro:* nessuna rete anti-deriva sui moltiplicatori-tappa.

**Raccomandazione:** **B** — il manifest è *contenuto in taratura continua*, non valori-sorgente stabili; lockarlo riga-per-riga ingessa il level-design. Tenere 🔒 solo le **costanti-cardine** (`MISSION_DIST`, curve base) e documentare il resto in §11. *Questa decisione uniforma lo stato 🔒 in tutto il documento: le destinazioni dei pilastri (§1) dicono "§11 BALANCE (documentata)", non 🔒.*

### 9.7 GAME_DESIGN.md: cambio di REGOLA, non estensione

La vittoria passa da "di ciclo ripetibile" (marcata **✅ implementata** in §12.1) a "rifugio-finale unico": è un **cambio di regola** → per CLAUDE.md Regola n.3 obbliga ad aggiornare `GAME_DESIGN.md` **nella stessa passata** (F1), dichiarando l'attuale vittoria-ciclo *da reimplementare*. Rischio: doc che afferma due vittorie incompatibili.
**Raccomandazione:** in F1, riscrivere §1/§3/§10 e annotare in §12 le feature **non ancora implementate** (set-piece, morale, Nemesi) come "design-intent", così il documento resta coerente con un codice che le implementa a fasi.

### 9.8 [SCELTA] Posizione delle biforcazioni: dichiarata vs seedabile

Il modello scelto è **odometro lineare con branch *dichiarati* nel manifest** (Oregon Trail), non grafo globale (FTL). Track D0 (RNG seedabile) potrebbe in futuro *seedare* solo la posizione dei pochi branch.

- **A — Branch fissi nel manifest** (legIndex 11, 22). *Pro:* finibile, testabile, single-save, massima leggibilità. *Contro:* rigiocabilità del percorso bassa.
- **B — Posizioni branch seedate (D0).** *Pro:* varietà tra le corse. *Contro:* dipende da D0 (⬜ da fare), complica retry/epilogo.

**Raccomandazione:** **A** per tutte le fasi F1-F6 (la rigiocabilità arriva da poolBias/scarsità/Nemesi, non dalla topologia). B resta un *opzionale post-campagna*.

### 9.9 Sintesi delle decisioni da prendere prima del codice

| # | Decisione | Tipo | Raccomandazione | Entro |
|---|---|---|---|---|
| 9.1 | Permadeath: A/B/C | **Designer** | A ora, valutare B a F5 | prima di F5 |
| 9.4 | Composizione B1×C2 | tecnica/tuning | B (lineari) + C (bivi) | prima di F2/F3 |
| 9.6 | §11 lockata o no | tecnica | B (documentata, non 🔒 riga-per-riga) | prima di F2 |
| 9.8 | Branch dichiarati o seedati | design/tecnica | A (dichiarati) | F3 |
| — | Numero di finali | **Designer** | 4 (proposti, §6.4) | prima di F5 |

---

## Appendice A · Valori-costante verificati contro il codice

Ancore usate in tutto il documento (verificate; i **riferimenti di riga** restano indicativi, §disclaimer in testa):

| Costante | Valore | Dove |
|---|---|---|
| `MISSION_DIST` | `18000` (🔒) | `GameScene.ts` |
| `SCROLL_SPEED` | `240` | `GameScene.ts` |
| `BOSS_TRIGGER` | `0.82` | `GameScene.ts` |
| `BOSSES_ENABLED` | `false` | `GameScene.ts` |
| `BASE_FUEL_DRAIN` | `0.5` | `GameScene.ts` |
| `MAX_FUEL` | `100` | `GameScene.ts` |
| `CALM_INTERVAL` / `BURST_INTERVAL` / `BURST_MS_BASE` | `3300` / `760` / `3000` | `GameScene.ts` |
| `STARVE_MISSIONS_TO_LEAVE` | `2` | `GameScene.ts` |
| `GIANT_SPAWN_INTERVAL` | `22000` | `GameScene.ts` |
| `EVENT_FRACTIONS` | `[0.3, 0.62]` | `GameScene.ts` |
| `DEATH_MONEY_PENALTY` | `0.25` | `GameScene.ts` |
| `KM_PER_UNIT` / `KM_PER_FUEL` | `0.01` / `4.8` | `World.ts` |
| `FOOD` | `{ max:120, perSurvivor:10, start:40, rationFood:40, rationCost:100 }` | `GameData.ts` |
| `survivorSlots` (7 veicoli) | `4 / 2 / 5 / 4 / 4 / 3 / 2` | `GameData.ts` |
| `ZombieType` | 8 tipi | `World.ts` |
| `StopLocation` | 5 luoghi (`STOP_CYCLE` mod-7) | `Locations.ts` |
| `ENVIRONMENTS` | 7 biomi | `GameScene.ts` |
| `RunData` snapshot/restore/reset | **non-spread, 4 punti a mano** | `RunState.ts` |

> *Da verificare prima del codice (citati dai draft, non confermati in questa passata):* formula esatta di `difficultyMult`; soglie d'innesco di `maybeInjure()` ("<35% salute, ≥8 danno"); `INJURY_CHANCE = 0.25` e `HEAL_COST = 60`.

---

> **Manutenzione.** Quando una fase viene implementata: (1) aggiorna il suo stato qui, (2) migra numeri/regole/visual nei documenti canonici (`GAME_DESIGN` / `BALANCE` §11 / art bible / i18n), (3) verifica `npm run validate`. Questo documento descrive *intenti e piano*; la verità eseguibile resta nel codice e nei documenti canonici.
