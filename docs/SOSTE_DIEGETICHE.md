# 🚶 Soste Diegetiche & Autista Giocabile — design

> **Stato:** v0.3 · **Fasi 1+2 + grosso della Fase 3 (qualità) implementate** (hub a piedi + autista + Galleria debug + **sistema d'illuminazione**: pozza cotta nel terreno, rim nei prop, ombre lunghe direzionali, edge-darkening, shading a 3 toni, skyline a strati, stazioni-eroe, NPC a figura intera, flicker) + **pompa diegetica** (Fase 4, parziale). Fase 4 incontri da fare. Vedi §10 e *Stato implementazione* in coda.
> **Ambito:** trasformare le **soste di fine missione** (oggi menu — vedi [Track B3](ROADMAP_RIGIOCABILITA.md#b3--soste--luoghi-di-fine-missione-idea-1--fatto)) in **luoghi giocabili** percorsi da un **personaggio a piedi** (l'autista).
> **Natura del documento:** è un **piano**, non una fonte di verità. Le fonti di verità restano [`GAME_DESIGN.md`](GAME_DESIGN.md) (regole), [`BALANCE.md`](BALANCE.md) (numeri) e le [art bible](ART_BIBLE_ZOMBIES.md) (estetica). Man mano che una fase viene implementata, i suoi numeri/regole/visual **migrano** nei documenti canonici.
> **Vincolo fondante (invariato):** grafica e audio **100% procedurali**, **nessun asset esterno**. Vedi [CLAUDE.md](../CLAUDE.md).

---

## §0 · La visione — "Sei l'autista"

Oggi il tuo avatar **è il veicolo**: in missione guidi un guscio su ruote, vincolato all'asse verticale. La sosta (`ShopScene`) è un **menu**. La mossa non è sostituire il veicolo, è **aggiungere un secondo avatar** e far diventare la sosta un **posto in cui sei**, non un posto che guardi:

- **In missione** → **sei il veicolo** (tutto invariato: la guida tesa, vincolata, su ruote; mira col mouse; doppia risorsa; dread→burst).
- **Alla sosta** → **scendi dal mezzo** e percorri l'hub **a piedi**. Cammini fino alla pompa, al banco da lavoro, al fuoco dei sopravvissuti. Il menu diventa **spaziale**: i servizi sono **cose a cui ti avvicini**, non voci di lista.

È il modello di **Death Road to Canada** (cugino strettissimo di questo gioco): in viaggio sei l'auto, alle tappe **scendi e cammini** — ed è lì che sei più umano e più fragile. Un personaggio giocabile è la **chiave di volta** che tiene insieme tutto: rende le soste *luoghi*, i sopravvissuti *equipaggio* e l'horror *personale*.

> Coerenza col **pivot survival horror** ([GAME_DESIGN §0](GAME_DESIGN.md#0--visione-e-pilastri)): la **sicurezza completa** (il garage, la luce, il menu tranquillo) non è la norma ma una sosta fra tante; e fuori dal mezzo, al buio, sei vulnerabile. Il loop emotivo è **"auto = salvezza, a piedi = rischio"**.

---

## §1 · Cosa sblocca (e che un menu non potrà mai dare)

1. **L'equipaggio diventa tuo.** Tu sei chi guida; i sopravvissuti sono chi *porti con te*. Scendere a reclutare mentre la tua crew aspetta nel mezzo è una scena forte. Il gioco acquista un **protagonista** — e *"Last Escape"* finalmente ha un **chi**.
2. **La vulnerabilità diventa concreta.** A piedi, lontano dal tuo guscio corazzato, al buio: è qui che i *twist* horror (assedio, saccheggio sotto minaccia, pedaggio) **mordono davvero**. Se la sosta si fa ostile, **devi tornare al mezzo**. Il veicolo smette di essere ovvio e diventa qualcosa che **vali** perché fuori sei niente.
3. **Movimento libero, per contrasto.** La guida è costretta (solo su/giù); a piedi ti muovi nelle **due dimensioni**. Quel contrasto, da solo, rinfresca il ritmo: tratta tesa e vincolata ↔ sosta libera ma esposta.

---

## §2 · Il modello a doppio avatar

| | In missione (`GameScene`) | Alla sosta (hub diegetico) |
|---|---|---|
| **Avatar** | il veicolo | l'autista a piedi |
| **Movimento** | verticale vincolato + throttle | libero su 2 assi (WASD / stick sinistro) |
| **Verbo** | mira col mouse + spara | cammina · interagisci (prossimità) |
| **Camera** | mondo che scorre verso sinistra | hub **fermo**, camera che segue il personaggio (entro i bordi del luogo) |
| **Stato** | salute/carburante/munizioni | vulnerabilità del personaggio (vedi §7) |

**Flusso d'ingresso (cinematico).** A fine missione il mezzo **entra nella sosta** da destra (rispecchia lo scroll della missione) e **parcheggia**. Il giocatore **scende** (un tasto) → il controllo passa al **personaggio**, che compare accanto alla portiera. Da lì cammina l'hub. La **portiera/il veicolo stesso** è una "stazione": avvicinarsi e confermare = **riparti** → porta alla [`RouteScene`](../src/scenes/RouteScene.ts) (il flusso "continua" già esistente).

**Parità gamepad.** Il gioco ha **già il pad completo** ([GAME_DESIGN §2](GAME_DESIGN.md#2--comandi), `MenuPad`): a piedi → stick sinistro cammina, **A** interagisce, **B** chiude il pannello. Riusa gli stessi hook input, nessuna logica duplicata.

---

## §3 · Qualità della scena — *"elevatissima"* 🎯

> **Requisito esplicito del designer:** la scena della sosta deve essere **qualitativamente altissima**. Vale lo **Standard di Produzione AAA** dichiarato in [`ART_BIBLE_ZOMBIES.md`](ART_BIBLE_ZOMBIES.md) §"Standard di Produzione AAA" (che si applica a **tutto il titolo**). L'hub non è un fondale: è una **vignetta vivente**.

Tutto **100% procedurale** (geometria → `generateTexture`; post-processing GLSL via [`PostFx.ts`](../src/PostFx.ts)). Leve di qualità, da rispettare tutte:

- **Illuminazione come regia.** Coerente con la **penombra globale** ([ART_BIBLE_AMBIENTE](ART_BIBLE_AMBIENTE.md), pilastro 3): il luogo è buio, e ogni hub ha **una o due fonti di luce-firma** che lo definiscono e ne dettano l'umore — il **fuoco** dell'accampamento (caldo, tremolante), il **faro/generatore** del deposito (freddo, ronzante), i **neon** del mercato (magenta, intermittenti), il **faro di posizione** del posto di blocco (bianco accecante, conico). I fari del **tuo mezzo** restano l'ancora di luce affidabile. Ombre di contatto via [`Shadows.ts`](../src/Shadows.ts).
- **Profondità a strati.** Riusa il renderer d'ambiente / parallasse: fondale lontano (skyline, alberi, recinzioni), piano medio (i prop interagibili), primo piano (detriti, erba, cavi) che incornicia. Niente piattezza top-down.
- **Densità procedurale e materia.** Decal e prop a profusione ma leggibili: casse, taniche vuote, barili, ruote, teli, sacchi di sabbia, carcasse d'auto — **specifici del luogo**. La materia "racconta" (ruggine, fango, sangue secco, polvere).
- **Atmosfera viva (particelle).** Brace e scintille sul fuoco, polvere nel cono di luce, foschia che mangia i bordi, falene attorno ai neon, fiato visibile. Sono **solo VFX** (mai hitbox/bilanciamento).
- **Animazione e vita.** NPC **idle** credibili (il meccanico che lavora sul mezzo, i sopravvissuti che si scaldano le mani, il mercante che sistema la merce), fuoco che ondeggia, bandiere/teli che si muovono, luci che pulsano. Il luogo deve sembrare **abitato** anche mentre stai fermo.
- **Audio diretto** ([ART_BIBLE_AUDIO](ART_BIBLE_AUDIO.md), [`SoundManager.ts`](../src/SoundManager.ts)). Ambienza per-luogo: crepitio del fuoco, ronzio del generatore, sferragliare di lamiere, **lamenti lontani** (il silenzio è minaccia). **Passi del personaggio** che cambiano per superficie (asfalto/terra/metallo). Stinger sottili sull'interazione.
- **Game-feel / juice** ([`Juice.ts`](../src/Juice.ts)). Micro-sbando della camera all'ingresso, vignetta, bloom sulle fonti di luce, leggero "respiro" del mondo. Il personaggio ha peso (accelerazione/inerzia dolci, non scatto digitale).
- **Nitidezza nativa.** Texture più osservate (personaggio, prop in primo piano) generate a `OVERSAMPLE`× via `OS_G`, sprite riportati a scala design (vedi [CLAUDE.md → Risoluzione & scaling](../CLAUDE.md)).

> **Criterio di "elevatissima":** una **schermata ferma** dell'hub deve reggere come **key-art** — leggibile, atmosferica, con una gerarchia di luce chiara e un punto d'interesse. Se sembra un livello di test, non è finita.

---

## §4 · I cinque luoghi (identità + arredo + incontro)

Riusa il roster già in [`src/Locations.ts`](../src/Locations.ts) (Track B3). Ogni `StopLocation` si **arricchisce** di dati d'arredo (vedi §8). Per ogni luogo: **fonte di luce**, **arredo-firma**, **NPC**, **stazioni** presenti, e il **micro-incontro Tier C** (opzionale, vedi §7).

| Luogo | Luce-firma | Arredo & NPC | Stazioni | Incontro (Tier C) |
|---|---|---|---|---|
| **Garage** | lampada al neon dell'officina, scintille di saldatura | banco da lavoro, ponte sollevatore, il **meccanico** | ripara · potenzia · armi · sopravvissuti · veicoli · *riparti* | il meccanico lavora sul mezzo: **scegli cosa riparare prima** |
| **Deposito** | faro/generatore freddo, conico | pompe, casse sparse, barili | rifornisci · munizioni · *riparti* | **saccheggio**: raccogli fisicamente le casse, sotto blanda pressione di tempo/minaccia |
| **Accampamento** | **fuoco** caldo e tremolante | tende, fuoco, i **sopravvissuti** | recluta · cura · razioni · *riparti* | **parli** coi sopravvissuti (la personalità emerge *prima* di reclutare); condividi cibo → si fidano |
| **Posto di blocco** | faro di posizione bianco, accecante | sacchi di sabbia, barriere, la **sentinella** | armi · munizioni · *riparti* | **cancello sorvegliato**: paghi il pedaggio o gestisci uno **stallo teso** |
| **Mercato nero** | **neon** magenta intermittenti | carovana, merce su teli, il **mercante** | potenziamenti · armi · veicoli · *riparti* | **contratti** col mercante; merce rara stesa sul telo, che **ruota** |

> Le stazioni presenti seguono i `services` già definiti in `Locations.ts` (Track B3): **i rifornimenti essenziali — ripara/rifornisci/munizioni — sono in ogni luogo** (la stazione c'è sempre); variano gli extra. La stazione *riparti* (il veicolo) è ovunque.

---

## §5 · Stazioni & interazione (ibrido *place + panel*)

Lo **spazio** dà l'atmosfera; il **pannello** dà l'usabilità. Non si sacrifica l'uno per l'altro:

1. Ogni servizio è un **oggetto fisico** (stazione) con un'area di prossimità — **identico all'overlap delle taniche di carburante** in [`GameScene.ts`](../src/scenes/GameScene.ts).
2. Avvicinandosi compare un **prompt diegetico** ("▸ Ripara · **E**"), con icona coerente all'[iconografia](ART_BIBLE_ICONE.md).
3. Confermando si apre il **pannello contestuale** *di quel solo servizio* (riparazioni, oppure armi, oppure la terna di reclute…), come overlay che mette in pausa il movimento. **Riusa la logica dei pannelli di `ShopScene`** — non si riscrive l'economia, la si **scompone** in pannelli richiamabili.
4. Chiudendo il pannello torni a camminare. Quando hai finito, vai alla stazione **riparti** (il mezzo) → [`RouteScene`](../src/scenes/RouteScene.ts).

> **Ritmo.** La sosta è un **respiro**, non una corvée: le stazioni essenziali devono restare **rapide** da raggiungere (vicine al punto di spawn); esplorazione e incontri sono **opzionali**. Metti frizione **solo** dove la frizione *è* la tensione voluta (il saccheggio, il pedaggio).

---

## §6 · Decisione presa — chi è il personaggio? ✅

La domanda che fa convergere tutto il resto del design:

| Opzione | Cosa dà | Costo/conseguenze |
|---|---|---|
| **A. Autista-protagonista fisso** *(raccomandata)* | un **eroe**: faccia del gioco, la crew è *tua*, identità che cresce; gancio per la **meta** (Track D: autista scegliibile con perk a inizio partita) | un solo sprite/identità da curare; va "scritto" un minimo (chi è) |
| **B. Il sopravvissuto che scegli** (crew a rotazione) | **varietà**: scendi col Meccanico, o col Soldato… ognuno con un tocco diverso a piedi | nessun protagonista forte; più sprite/animazioni; regole "chi può scendere" |

> ✅ **Decisione (2026-06-24): A — l'autista-protagonista fisso.** Il personaggio giocabile è **"tu"**, un protagonista **unico** che acquista identità nel tempo; l'opzione B (sopravvissuto a rotazione) è **scartata**. Dà un baricentro narrativo a *"Last Escape"* e rende l'equipaggio davvero tuo: la **varietà** la portano i **luoghi** (§4), non l'avatar. Gli **autisti sbloccabili** (perk di partenza diversi, [Track D](ROADMAP_RIGIOCABILITA.md#5--track-d--meta-progressione--retention)) restano un'estensione *compatibile*, non un cambio di rotta. Questa decisione **sblocca la Fase 2** (§10).

---

## §7 · Profondità & rischio (e contenimento dello scope)

Si parte **leggeri** e si aggiunge solo se diverte:

- **Fase base — interazione + rischio leggero.** Cammini, parli, saccheggi; se arriva la minaccia, **corri al mezzo**. Vulnerabilità minima del personaggio (es. "non farti agguantare", o una piccola barra che non deve svuotarsi). **Niente** stat complesse né inventario del personaggio (è la porta da cui entra lo scope-creep).
- **Incontri Tier C** (uno per volta, dove rende di più): **saccheggio** al deposito e **mercante che ruota la merce** sono i due col ritorno più alto; **pedaggio**/stallo al posto di blocco e **dialogo** all'accampamento a seguire.
- **Estensione potente, per dopo — bail-out d'emergenza.** Se il **mezzo viene distrutto a metà missione**, *esci a piedi* per una fuga disperata fino al prossimo riparo. Beat horror puro, ma è **scope grosso** (porta il personaggio *dentro* la missione): segnato come **possibilità**, non come base. **Non** in questo piano.

> ⚠️ **Identità a rischio.** Un avatar a piedi *non* deve diluire il "su ruote": lo **deepenizza per contrasto** (il mezzo conta perché fuori sei fragile). Regola dura: **il personaggio vive negli hub delle soste**, non in missione (salvo il bail-out, esplicitamente fuori scope).

---

## §8 · Architettura tecnica (proposta)

**Riusa quasi tutto** ([cfr. ARCHITETTURA](ARCHITETTURA.md)). Non si parte da zero:

| Serve | Dove riusarlo / aggiungerlo |
|---|---|
| **Sprite personaggio** (top-down, procedurale) | **riusa la pipeline dei sopravvissuti** `buildSurvivorTextures` ([`EntityTextures.ts`](../src/EntityTextures.ts)) — sono già umanoidi; aggiungi walk a 4 direzioni |
| **Movimento a piedi** | nuovo controller 2D (accel/inerzia dolci) — distinto dai comandi veicolo; confluisce con gli **stessi hook input** del pad |
| **Collisione** | bordi dell'hub + prop, via Arcade (come gli hazard/relitti) |
| **Interazione** | **overlap di prossimità** (identico a `spawnFuelCan`/taniche) → prompt → pannello |
| **Pannelli servizio** | **scomponi i pannelli di [`ShopScene.ts`](../src/scenes/ShopScene.ts)** in componenti richiamabili come overlay |
| **Ambiente/luce/ombre** | renderer ambiente + parallasse, [`Shadows.ts`](../src/Shadows.ts), [`PostFx.ts`](../src/PostFx.ts), [`Juice.ts`](../src/Juice.ts) |
| **Audio** | [`SoundManager.ts`](../src/SoundManager.ts): nuove ambienze/passi per luogo |
| **Camera/scaling** | `setupCamera` / spazio design 800×600 / `OVERSAMPLE` (invariato) |

**Scheletro a hub condiviso + arredo data-driven.** Una sola scena hub (`StopScene` nuova, *oppure* evoluzione spaziale di `ShopScene`) + una **tabella d'arredo per luogo** — esattamente il modello di `ENVIRONMENTS`. Estendere `StopLocation` ([`src/Locations.ts`](../src/Locations.ts)) con: fonte di luce (colore/tipo/posizione), set di prop, layout NPC, posizioni delle stazioni. **Un sistema, cinque vestiti.**

**File da toccare (proposta):**
- **Nuovo** `src/scenes/StopScene.ts` (l'hub spaziale) — *oppure* refactor di [`ShopScene.ts`](../src/scenes/ShopScene.ts) in scena spaziale + pannelli estratti.
- **Nuovo** `src/HubEnvironment.ts` (rendering procedurale dell'hub: fondale, luci, prop, particelle, NPC idle) — sul modello del renderer ambiente.
- [`src/Locations.ts`](../src/Locations.ts) — estendere `StopLocation` con i dati d'arredo/luce/stazioni.
- [`src/EntityTextures.ts`](../src/EntityTextures.ts) — sprite + walk del personaggio; prop d'arredo per luogo.
- [`src/SoundManager.ts`](../src/SoundManager.ts) — ambienze e passi.
- [`src/scenes/GameScene.ts`](../src/scenes/GameScene.ts) — l'overlay di fine missione passa a `StopScene` (oggi → `ShopScene`).
- `src/game.ts` — registra la nuova scena.
- [`src/i18n.ts`](../src/i18n.ts) + `src/locales/*` — prompt d'interazione, dialoghi, nomi stazioni (italiano canonico, poi 5 lingue).

---

## §9 · Modalità debug — anteprima del luogo 🔍

> **Richiesta esplicita del designer.** La scena "elevatissima" va **rifinita in isolamento**, senza dover rigiocare missioni per arrivarci.

Estendere la [`DebugScene`](../src/scenes/DebugScene.ts) (la galleria modelli, già gatata da `import.meta.env.DEV` → **fuori dal bundle di produzione**) con una **"Galleria Luoghi"**:

- **Carica ogni hub completo e renderizzato** — arredo, illuminazione, particelle, NPC idle, mezzo parcheggiato, personaggio — **scorrendo i 5 luoghi** (es. `←/→` o tasti `1–5`).
- **Free-walk**: muovi il personaggio liberamente per ispezionare ogni angolo, vedere le stazioni e le distanze.
- **Toggle d'ispezione**: luci on/off, **box di collisione**, marker delle stazioni e dei punti di spawn, particelle on/off, griglia.
- **Sandbox di luce** (utile per la qualità): cursore intensità/colore della fonte-firma e dell'ambiente per tarare l'umore.
- Accesso dalla `DebugScene` esistente (entry "GALLERIA LUOGHI"); stesso gating `DEV` → **zero impatto sul bundle di produzione** (come gli altri strumenti debug, già verificato in [ROADMAP — debito A8](ROADMAP_RIGIOCABILITA.md#debito-tecnico-residuo-migrato-dallaudit-storico)).

**File da toccare:** [`src/scenes/DebugScene.ts`](../src/scenes/DebugScene.ts) (sotto-modalità) + riuso di `HubEnvironment`/`StopScene`. Hotkey debug coerenti con `hud.godMode`/`hud.debugHint` esistenti.

---

## §10 · Fasi di implementazione (incrementali, spedibili una alla volta)

| # | Fase | Stato | Contenuto | Criterio di uscita |
|---|---|---|---|---|
| 1 | **Atmosfera (Tier A)** | ✅ | sfondo procedurale del luogo, terreno, silhouette, luce-firma, particelle, mezzo parcheggiato (assorbita direttamente nell'hub di Fase 2) | la sosta *sembra* un posto; zero regressioni |
| 2 | **Hub a piedi (Tier B)** | ✅ | `StopScene`: personaggio giocabile (tastiera+pad), walk-up a 2 stazioni (servizi → `ShopScene` filtrato per luogo · *riparti* → `RouteScene`), prompt di prossimità · **+ Galleria Luoghi in debug (§9)** | cammini l'hub e attivi i servizi avvicinandoti; il dev ispeziona in isolamento |
| 3 | **Qualità "elevatissima" (§3)** | ⬜ | rifinitura luci/particelle, **NPC idle animati**, ciclo di camminata a 4 direzioni, **passi per superficie**, **drive-in cinematico**, schede art bible | una schermata ferma regge come key-art |
| 4 | **Incontri (Tier C)** | ⬜ | uno per volta: **saccheggio** (deposito) → **mercante rotante** (mercato) → pedaggio/stallo → dialogo · split delle stazioni per-servizio | due run alla stessa sosta si *giocano* diverse |

> **Ordine = rischio gestito.** La Fase 1 dà valore subito senza il personaggio; la Fase 2 introduce l'avatar dove costa meno (hub chiusi) **con** lo strumento debug per rifinire; la qualità e gli incontri si stratificano sopra una base che già funziona. Ci si può **fermare dopo qualsiasi fase** con un gioco migliore di prima.

---

## §11 · Impatto su validatori, art bible e i18n

Da rispettare a ogni fase (gate anti-deriva, [CLAUDE.md Regola n.2/n.3](../CLAUDE.md)):

| Cosa | Documento da aggiornare | Validatore |
|---|---|---|
| Sprite personaggio, prop, oggetti-stazione (dimensioni-firma) | [ART_BIBLE_OGGETTI](ART_BIBLE_OGGETTI.md) (+ personaggio: nuova scheda) | `validate:art` |
| Ambienti hub, fonti di luce, palette per luogo | [ART_BIBLE_AMBIENTE](ART_BIBLE_AMBIENTE.md) | `validate:art` |
| Pannelli contestuali, prompt d'interazione, HUD a piedi | [ART_BIBLE_INTERFACCE](ART_BIBLE_INTERFACCE.md) · [ART_BIBLE_ICONE](ART_BIBLE_ICONE.md) | `validate:art` |
| Ambienze/passi/stinger della sosta | [ART_BIBLE_AUDIO](ART_BIBLE_AUDIO.md) | `validate:audio` |
| Numeri d'incontro (timer saccheggio, costo pedaggio, soglia minaccia) | tabella 🔒 in [BALANCE.md](BALANCE.md) | `validate:balance` |
| Regola "sei l'autista", flusso sosta a piedi | [GAME_DESIGN §1/§9](GAME_DESIGN.md#9--progressione-e-meta-negozio) | — |
| Prompt, dialoghi, nomi stazioni (italiano canonico → 5 lingue) | `src/locales/*` (vedi [I18N.md](I18N.md)) | `validate:i18n` |

> Promemoria: l'italiano ([`src/locales/it.ts`](../src/locales/it.ts)) è la locale **canonica**; ogni nuova stringa nasce lì, poi si traduce nelle altre 5 (`en · es · fr · de · pt`).

---

## §12 · Rischi & contenimento

- **Scope-creep del personaggio.** Un avatar a piedi *invita* combattimento on-foot, inventario, ecc. **Contenimento:** il personaggio vive **solo negli hub**; niente stat/inventario nella fase base; il bail-out è esplicitamente **fuori scope**.
- **Costo ×5 luoghi.** Cinque set procedurali. **Contenimento:** scheletro hub **unico** + tabella d'arredo data-driven (§8); la qualità si concentra sulle **fonti di luce-firma** (massimo ritorno visivo).
- **Ritmo.** La sosta non deve diventare lenta. **Contenimento:** stazioni essenziali vicine allo spawn; esplorazione/incontri opzionali.
- **Identità "su ruote".** **Contenimento:** il contrasto vehicle↔a-piedi *rafforza* il core, non lo tradisce (modello Death Road to Canada).
- **Pressione validatori.** Ogni fase aggiunge schede art/righe 🔒/chiavi i18n: non saltare l'aggiornamento o `npm run build` fallisce (è il comportamento voluto).

---

## §13 · Stato implementazione

### v0.3 — overhaul qualità (grosso della Fase 3) + pompa diegetica
Riscrittura di **`src/HubEnvironment.ts`** alla barra "elevatissima" (su spec dell'orchestrazione *hub-visual-overhaul*, ancorata al DNA provato del gioco). **Sistema d'illuminazione condiviso**: pozza di luce **cotta nel terreno** (bake) + **rim-light cotto nei prop** orientato alla sorgente + **ombre lunghe direzionali** (`fx_shadow` stampato lontano dalla luce) + **edge-darkening** della periferia + penombra globale. **Shading a 3 toni** (`drawLitProp`/`shadeCyl`) su ogni volume; **skyline a 3 fasce** con prospettiva aerea (`drawFarBox` copiato da Environment); **stazioni-eroe** per luogo (banco+neon / pompe / falò a strati / sacchi+sbarra+faro / bancarella+lanterne); **NPC a figura intera** (no più busti); **terreno dettagliato** baked (blotch/grana/olio); **flicker a rumore** della luce calda; ombra di contatto **dinamica** del personaggio (`Shadows`). **Fix:** accento del **depot** `0x44aacc`→`0xff7722` (il blu è riservato al chrome UI). **Pompa diegetica** (Fase 4, parziale): stazione *Fai benzina* a deposito+garage → rifornimento **diretto** (costo letto da `SHOP_ITEMS`, niente deriva; persiste il checkpoint). i18n: +`hub.refuel`/`refuelDone`/`tankFull`/`noMoney` ×6.
> ⚠️ Verificato con `tsc`+validatori+lint+`vite build` (verdi), **non ancora a schermo**: la resa va giudicata dalla Galleria (rischi noti da spec: banding della pozza, ombre lunghe a lozenge, fuoco "diorama"). Le **schede art bible** dei nuovi visual restano da scrivere (i validatori non scansionano `HubEnvironment.ts`).

### v0.2 — Fasi 1+2

**Fatto (build verde: `validate` + `tsc` + `lint` + `vite build`):**
- **`src/scenes/StopScene.ts`** — l'hub a piedi. Si arriva da `GameScene` (fine missione), si cammina (tastiera WASD/frecce + stick sinistro del pad), prompt di prossimità, due stazioni: **servizi** → `ShopScene` (filtrato per luogo, Track B3) · **riparti** (il veicolo) → `RouteScene`. Il negozio è un **andirivieni**: da `ShopScene` si **esce tornando all'hub** (pulsante *◂ INDIETRO*), non si è obbligati a proseguire — il viaggio riprende solo dal veicolo. *(L'offerta sopravvissuti è ora marcata per missione → uscire/rientrare non rerolla.)* In **Galleria** le stazioni sono attive (banco → negozio, veicolo → torna al debug). Vignetta filmica gated da `Settings.vignetteFx`.
- **`src/HubEnvironment.ts`** — rendering procedurale per-luogo: cielo notturno, silhouette d'orizzonte, terreno + decal, recinzione, **stazione-firma** distinta per luogo, **luce-firma** additiva (con flicker per i luoghi "caldi"), arredo, **figure ambientali** (sopravvissuti), **particelle** (brace calda / pulviscolo freddo). Texture procedurale del **personaggio-autista**.
- **`src/Locations.ts`** — `StopLocation` esteso coi dati d'arredo (`hubGround`/`hubSky`/`hubNpcs`/`stationKey`).
- **`DebugScene`** — pulsante **GALLERIA LUOGHI** → apre `StopScene` in modalità ispezione: free-walk, **tasti 1–5** per ciclare i 5 luoghi, **ESC** per uscire. Gated `DEV` → fuori dal bundle di produzione.
- **`GameScene`** → la fine missione va a `StopScene` (era `ShopScene`). **i18n**: 11 chiavi `hub.*`/`debug.locations` ×6 lingue.

**Decisione di scope (semplificazione consapevole rispetto al piano):** in questa fondazione c'è **una sola stazione-servizi** per luogo, che apre il negozio **già filtrato per luogo** (Track B3), invece di N stazioni per-servizio. Lo split per-servizio (pompa = solo carburante, fuoco = solo reclute, …) è in **Fase 4**.

**Rinviato (Fase 3/4):** drive-in cinematico, ciclo di camminata a 4 direzioni (ora solo flip orizzontale), passi per superficie, NPC animati, **schede art bible** dei nuovi visual (texture hub in `HubEnvironment.ts` → *non* ancora validate da `validate:art`, per scelta di fase), incontri Tier C (saccheggio/mercante/pedaggio/dialogo), risk/assedio.

**Da playtestare a occhio:** leggibilità delle stazioni e delle distanze d'interazione, resa della luce-firma per ciascun luogo, che le figure ambientali non sembrino "teste fluttuanti" (eventuale rifinitura del corpo in Fase 3).

---

> **Manutenzione.** Quando una fase viene implementata: (1) aggiorna lo stato qui, (2) migra numeri/regole/visual nei documenti canonici, (3) verifica `npm run validate`. Questo documento descrive *intenti e piano*; la verità eseguibile resta nel codice e nei documenti di §11.
