# 🏚️ Art Bible — Soste (luoghi di fine percorso)
### Zombie Road: Last Escape · Direzione Artistica (qualità AAA)

> **Stato:** v1.0 · **tarata sul pass visivo** (5 hub catturati dalla Galleria a 1600×1200 e giudicati a schermo + diagnosi multi-agente, vedi ⭐ Verdetto). Estratta da [`SOSTE_DIEGETICHE.md`](SOSTE_DIEGETICHE.md) §3-4 e dal codice reale ([`src/HubEnvironment.ts`](../src/HubEnvironment.ts), [`src/Locations.ts`](../src/Locations.ts)). I numeri delle tabelle 🔒 sono **verità del codice attuale**; i **target di rifinitura** (ciò che va cambiato) vivono nel ⭐ Verdetto e nelle schede §5. **Non ancora agganciata a `validate:art`** (vedi §9).
> **Ambito:** gli **hub diegetici** dove il convoglio approda dopo ogni tratta — i 5 luoghi (`garage` · `depot` · `camp` · `checkpoint` · `market`): terreno, muro/edificio di fondo, **luce-firma**, stazione-eroe, arredo, NPC, particelle e composizione. È la **fonte di verità estetica** di tutto ciò che `StopScene` mette a schermo.
> **Riferimento di stile:** *Death Road to Canada* (cugino diretto: in viaggio sei l'auto, alle tappe scendi e cammini) filtrato dalla **penombra survival-horror** del titolo. La sosta non è un fondale: è una **vignetta vivente**.
> **Vincolo fondante:** grafica **100% procedurale** (Phaser Graphics API → `generateTexture`; post-processing GLSL via [`PostFx.ts`](../src/PostFx.ts)). **Nessun PNG / nessun asset esterno.**

Questo documento è la **fonte di verità** per chiunque (umano o AI) tocchi l'aspetto delle soste. Se cambi una palette, una luce-firma o una dimensione-firma di un prop, **aggiorna la scheda qui** e ri-valida (quando il gancio §9 sarà attivo, la build fallirà sulla deriva).

> **Documento gemello:** [`ART_BIBLE_ZOMBIES.md`](./ART_BIBLE_ZOMBIES.md) §"⭐ Standard di Produzione AAA" è la **stella polare** del titolo e vale per **tutto** — qui non la riscrivo, la **applico alle soste**. Per la *regola* ("sei l'autista", flusso a piedi) la verità è [`GAME_DESIGN.md`](GAME_DESIGN.md); per il *piano e lo scope* è [`SOSTE_DIEGETICHE.md`](SOSTE_DIEGETICHE.md); per i *numeri d'incontro/economia* è [`BALANCE.md`](BALANCE.md).

---

## ⭐ Come la sosta serve lo Standard AAA

I tre pilastri del titolo (coesione · game feel · rifinitura) tradotti sull'hub:

- **Coesione.** La sosta usa la **stessa regola di luce** del mondo di gioco (**alto-sinistra schiarisce, basso-destra in ombra**) e gli **stessi 3 accenti emissivi firma**: malato-verde · arancio-fuoco · rosso-sangue. Il **blu è riservato al chrome UI** — nessun accento-luogo è blu (per questo il `depot` usa arancio-fuoco e non il ciano del primo abbozzo).
- **Game feel.** L'hub **vive anche da fermo**: il fuoco tremola, le insegne pulsano, le braci salgono, il personaggio ha peso (squash/stretch del passo, ombra di contatto dinamica). Una sosta statica è fuori firma.
- **Rifinitura.** Niente bande piatte: il terreno ha grana, crepe, gomma, pozze, segnaletica sbiadita; ogni volume ha **shading a 3 toni + rim**; la scena è **chiusa** da un muro di fondo (no cielo vuoto). La differenza tra "livello di test" e "AAA" è qui.

> **Regola d'oro della sosta:** *Una schermata ferma dell'hub deve reggere come **key-art** — un punto d'interesse, una gerarchia di luce chiara, materia che racconta. Se sembra un livello di test, non è finita.* (criterio §3 di SOSTE_DIEGETICHE, qui promosso a **gate di accettazione**.)

---

## ⭐ Verdetto del pass visivo (v1.0) — dove siamo e cosa fixare per primo

I 5 hub sono stati **catturati dalla Galleria a 1600×1200 e giudicati a schermo** (diagnosi adversariale per-hub + pass di coerenza). Esito netto: **nessun hub regge ancora come key-art**; 2 sono *vicini* (garage, camp), 3 *falliscono* (depot, checkpoint, market). I difetti sono **sistemici** — quasi tutti comuni a tutti e 5 → si correggono toccando **funzioni condivise**, non 5 luoghi a mano.

| Hub | key-art | Difetto specifico più grave | Cosa già funziona |
|---|---|---|---|
| `garage` | **near** | firma OFFICINA sul muro invisibile; pozza a "due dischi impilati" | verde freddo centrato; focal sul banco regge; terreno materico |
| `depot` | **fail** | **deriva temperatura**: legge caldo-da-falò, non freddo-industriale; serbatoi-firma invisibili | pompe gemelle vincono il focal; micro-firma "carburante" |
| `camp` | **near** | **fuoco "diorama"** (2 triangoli di cartone); volti NON scaldati dal fuoco | il fuoco È il focal giusto; scena correttamente calda |
| `checkpoint` | **fail** | torretta-firma invisibile (1/5); faro = "macchia + lampadina", non cono | sbarra a strisce rosse legge come confine |
| `market` | **fail** | pozza a "decalcomania" a bordo duro; muro-container invisibile; **deriva fredda** | magenta-firma unico e riconoscibile a colpo d'occhio |

### I 7 difetti sistemici (comuni a più hub)

1. **Muro-firma invisibile (tutti e 5)** — la feature diegetica sul muro di fondo (serranda/serbatoi/tende/torretta/container) è `mix(wc, nero, 0.30–0.50)` su un muro **già** scuro → si fonde e non legge **mai**. *È la causa n.1 per cui i 5 posti non si distinguono se non per colore della luce.*
2. **Pozza-luce a "due dischi impilati" (tutti e 5)** — ellisse larga + core-glow stretto quasi-bianco → "disco su disco" / "macchia + lampadina" / "decalcomania a bordo duro", non un volume con falloff. `lightQuality 2/5` ovunque.
3. **Veicolo annegato + vuoto centrale (tutti e 5)** — il mezzo è sempre a sinistra **fuori** dalla pozza, e tra mezzo e stazione c'è una fascia di cortile buio e morto. Composizione **monopolare**, secondo polo sprecato.
4. **Figure-giocattolo (tutti e 5)** — stesse figure ~24×38 con testone chibi a `1/OVERSAMPLE`: troppo piccole, spesso fuori dalla luce, **senza rim-light** dalla sorgente → birilli/puntini, non *persone*. `figureReadability 1–2/5`.
5. **Deriva temperatura (depot & market, speculare)** — la temperatura è decisa dal solo numero `warmth` + tint della pozza, **scollegata** da pulviscolo/particelle/cielo → depot **caldo** invece che freddo-industriale; market **gelido** invece che caldo-sporco.
6. **Architettura non differenziante (tutti e 5)** — stesso muro a tetto seghettato, stessa scaletta nello stesso punto, stessa banda di testo, stesso layout veicolo-sinistra/stazione-66%.
7. **Ombre a losanga (tutti e 5)** — `dropShadow` proietta ellissi allungate uniformi (`alpha 0.34` fisso), identiche sotto ogni prop, senza relazione con la forma né la distanza.

### Roadmap di fix prioritizzata (massimo salto a sforzo minimo)

> Ordine per **impatto/sforzo**. I primi 4 toccano **funzioni condivise** → un fix migliora tutti e 5 i frame. Vincolo: ogni modifica numerica aggiorna le tabelle 🔒 §6 + (a gancio attivo) `validate:art`.

| # | Fix | Dove (funzione) | Hub | Perché |
|---|---|---|---|---|
| **1** | **Rendere leggibili le feature-firma del muro**: faccia illuminata `mix(wc,bianco,0.08–0.12)` + cresta-rim verso la luce `mix(wc,L.color,0.18–0.25)`; `shadeCyl` a 3 toni sui cilindri; mini-bloom additivo dietro la silhouette; insegna emissiva dove serve (OFFICINA, banda-pericolo, vetri-cabina) | `drawBackdropFeature` | tutti | **identità del luogo** — il muro deve *dichiarare* "questo è un X" (difetto n.1) |
| **2** | **Pozza come volume con falloff**: stack di **3** `fx_light` concentriche (core ~1.1/α0.42 · medio ~2.6/α0.22 · ampio ~4.2–6.0/α0.10), core più basso; **ramo conico** (triangolo/fan additivo dalla sorgente) per depot+checkpoint | `renderHub` | tutti | `lightQuality 2/5` ovunque; il "disco a due strati" è il difetto-killer ripetuto |
| **3** | **Figure persone-non-giocattoli**: testa più piccola + gambe più lunghe (meno chibi); NPC-eroe a ~1.25–1.4/OVERSAMPLE; ambientali ridotte e **vincolate dentro la reach** della luce; **rim-light per-figura** color-firma sul lato verso la sorgente (volti scaldati al camp) | `buildFigure` + loop NPC in `renderHub` | tutti | cuore della north-star "persone, non veicoli"; NB: depot resta **vuoto** (`hubNpcs=[]`) → rendere il conteggio NPC **per-luogo** |
| **4** | **Collegare i due poli + riempire il vuoto**: avvicinare il veicolo alla pozza o fill-light di raccordo a metà corridoio (`fx_light` ~3.0×2.0 α0.18); 1–2 volumi medi diegetici sull'asse centrale; rim-light color-firma sul mezzo | `renderHub` / `StopScene` / `drawProps` | tutti | recupera il **secondo polo** già presente; alto impatto compositivo a basso costo |
| **5** | **Temperatura dal CAMPO completo** (vedi decisione §3): depot `warmth 0.70→0.42` + pozza desaturata verso bianco-freddo (arancio solo come accento-valvole); market `warmth 0.45→0.62` + pulviscolo/brace caldi; derivare `warm` da `warmth ≥ 0.6` | `Locations.ts` + `renderHub`/`drawParticles` | depot · market | risolve la rottura di coerenza più grave (depot e camp indistinguibili per temperatura) |
| **6** | **Ombre**: ridurre l'allungamento (`1+long*0.8 → 1+long*0.45`), `alpha` legato alla distanza (`0.20+0.18·falloff`), ellisse di contatto più stretta/scura | `dropShadow` | tutti | aggancio-a-terra di tutti i prop/figure; sostiene la leggibilità delle figure |

> **Nota tecnica.** La formula `falloff()` (esponente 1.6) **non** è il problema: è il **layering delle immagini** `fx_light` a tradire l'effetto. Il fix #2 è di composizione delle immagini, non di matematica.

### ✅ Stato roadmap: IMPLEMENTATA (e ri-validata a schermo)

Tutti e 6 i fix sono in codice ([HubEnvironment.ts](../src/HubEnvironment.ts) + [Locations.ts](../src/Locations.ts); `StopScene.ts` **non toccato**), `tsc` verde, e i 5 hub sono stati **ri-catturati** dalla Galleria. Esito del secondo pass:

| Hub | prima | dopo (osservato) |
|---|---|---|
| `garage` | near | **insegna OFFICINA emissiva** dichiara il luogo; pozza a falloff morbido; figure staccate dal buio |
| `depot` | fail | **freddo-industriale** (pozza desaturata, arancio solo bande-pericolo + fascio conico); **serbatoi leggibili**; resta vuoto (transito) |
| `camp` | near | **fiamme stratificate** + nucleo bianco-caldo (no cartone); **tende leggibili**; volti scaldati dal rim |
| `checkpoint` | fail | **cono di luce** sulla sbarra + **torretta visibile** coi vetri illuminati |
| `market` | fail | **muro di container** leggibile (3 colori a gradoni); pozza magenta non più "decalcomania"; rim magenta sulle figure |

Implementazione per fix: **#1** `drawBackdropFeature` riscritta (faccia chiara + cresta-rim + insegne/bande/vetri emissivi + mini-bloom di stacco) · **#2** pozza = stack di 3 `fx_light` + `drawLightCone` per depot/checkpoint + bloom abbassato/ri-saturato · **#3** `buildFigure` testa meno chibi + helper `litFigure` (alone-rim color-firma) + NPC-eroe 1.3×, ambientali vincolate nella reach e contate per-luogo (depot=0) · **#4** fill-light di raccordo veicolo↔stazione in `renderHub` · **#5** `warmth` depot 0.42 / market 0.62 + `warm` derivato da `warmth ≥ 0.6` + pozza depot desaturata + pulviscolo caldo per i luoghi caldi · **#6** `dropShadow` allungamento ridotto + alpha∝falloff.

> **Polish residuo (eventuale v1.1, NON bloccante):** esposizione globale ancora un filo bassa (camp/market scuri ai bordi); le figure sono migliorate ma restano piccole; il veicolo a sinistra è illuminato ma tenue. Le **schede §5 "Reso reale"** qui sotto fotografano la diagnosi **PRE-fix** (il *perché* di ogni intervento) — non riscritte apposta, restano il razionale.

---

## 0. Mappa del codice (dove vive tutto)

| Cosa | Dove |
|---|---|
| **Scena hub a piedi** (camera che segue il personaggio, stazioni per prossimità) | [`src/scenes/StopScene.ts`](../src/scenes/StopScene.ts) |
| **Renderer procedurale dell'hub** (sfondo, luci, terreno, stazione, prop, NPC, particelle) | [`src/HubEnvironment.ts`](../src/HubEnvironment.ts) → `renderHub()` |
| Dati neutri per-luogo (palette, NPC, luce-firma) | [`src/Locations.ts`](../src/Locations.ts) → `STOP_LOCATIONS` |
| Terreno bakeato denso per-luogo | `HubEnvironment.groundTexture()` |
| Sfondo: cielo ridotto + skyline + **muro/edificio di fondo** | `HubEnvironment.drawBackground()` |
| **Elemento-firma sul muro** (serranda/serbatoi/tende/torretta/container) | `HubEnvironment.drawBackdropFeature()` |
| **Stazione-eroe** per luogo (banco/pompe/falò/blocco/bancarella) | `HubEnvironment.drawStation()` |
| Arredo sparso (cassa/barile/sacchi/gomma/pallet/cono/tanica/relitto) | `HubEnvironment.drawProps()` + helper `crate`/`barrel`/`sandbags`/`tire`/`pallet`/`cone`/`jerrycan`/`drawWreck` |
| **Shading materiale** (3 toni + rim, cilindri, far-box) | `drawLitProp` · `shadeCyl` · `rimTL` · `drawFarBox` |
| **Luce** (pozza a terra additiva, bloom-sorgente, falloff/direzione) | `renderHub()` + `falloff`/`lightDir`/`dropShadow` |
| Figura full-body (autista + equipaggio + NPC) | `buildFigure()` · `buildCrewFigure()` · `CREW_LOOK` |
| Veicolo parcheggiato (vista laterale per-veicolo) | `buildHubCar()` · `CAR_SHAPES` |
| Ombra di contatto dinamica del personaggio | [`src/Shadows.ts`](../src/Shadows.ts) |
| Particelle (brace / pulviscolo / atmosfera) | `HubEnvironment.drawParticles()` |
| Vignetta/grana filmica (gated `Settings.vignetteFx`) | [`src/Juice.ts`](../src/Juice.ts) → `addOverlay` |
| **Galleria Luoghi** (anteprima isolata, gated `DEV`) | [`src/scenes/DebugScene.ts`](../src/scenes/DebugScene.ts) → `StopScene` con `hubGallery` |

**Geometria di riferimento (non spostare senza motivo — il walk ci dipende):**
```
y=0    ┌─────────────────────────────┐  ← cielo notturno (gradiente, poco spazio)
y=60   │   skyline lontana            │  ← WALL_TOP   (sommità muro di fondo)
       │ ░ MURO / EDIFICIO di fondo ░ │     (chiude la scena, riempie il frame)
y=210  ├═════════════════════════════┤  ← HUB_HORIZON (linea terreno = base muro)
       │                              │
y=372  │   ◎ STAZIONE-EROE   🚶       │  ← sy=372 (stazione), sx≈0.66·designW
       │       (luce-firma)           │
y=432  │   🚗 veicolo parcheggiato    │  ← vx=150, vy=432
y=556  ├ - - - - - - - - - - - - - - -┤  ← HUB_WALK.maxY (limite calpestabile)
y=600  └─────────────────────────────┘
```
> Terreno calpestabile: `HUB_WALK = { minX:44, minY:352, maxY:556 }`, `maxX = designW − minX`. La **larghezza è `designW`** (≥800; in 16:9 più cortile a destra) → ancora orizzontali su `designW`, **mai** 800 fisso. Geometria invariata dallo scaling (vedi [CLAUDE.md → Risoluzione & scaling](../CLAUDE.md)).

---

## 1. I tre strati di lettura (se devi tagliare, taglia dal fondo)

1. **PROFONDITÀ** — lo sguardo legge la scena in 1 frame: cielo → skyline → **muro di fondo** → cortile illuminato → primo piano (pali, cavi). La scena è **chiusa**: niente "senso di vuoto" da cielo vuoto, niente piattezza top-down. La luce-firma indica **dove guardare**.
2. **MATERIA** — terreno e prop devono sembrare *cose vissute e abbandonate*: crepe, gomma, olio, ruggine, segnaletica sbiadita, lamiere corrugate. Mai un colore uniforme.
3. **VITA** — la sosta *è abitata*: NPC idle che respirano, fuoco che ondeggia, insegne che pulsano, braci e pulviscolo, l'autista col passo molleggiato. È l'ultimo 20%, ma è ciò che vende "vignetta vivente, non fondale".

> **Mai** un hub a tinta unita, statico, senza una fonte di luce che lo definisca. Mai.

> 🎯 **Regola di differenziazione (target v1.0) — il muro deve dichiarare il luogo.** Il pass visivo ha dato verdetto **"5 posti distinti? NO"**: i 5 hub condividono lo stesso scheletro (muro a tetto seghettato, scaletta nello stesso punto, layout veicolo-sinistra/stazione-66%) e si distinguono **quasi solo per il colore della luce** — garage/depot/checkpoint hanno muri quasi pixel-identici. La causa è che la **feature-firma** del muro (serranda, serbatoi, tende, torretta, container) è sempre disegnata troppo scura per leggersi. **Regola:** l'identità di un luogo nasce dall'**architettura** del muro di fondo (silhouette + feature emissiva leggibile), **non** dalla sola tinta della pozza. Un hub deve essere riconoscibile **anche in bianco e nero**.

---

## 2. Vincoli tecnici (non negoziabili)

- **Solo primitive Graphics** (`fillRect`/`fillRoundedRect`/`fillEllipse`/`fillCircle`/`fillTriangle`/`fillPoints`/`lineBetween`/`fillGradientStyle`) → `generateTexture`. Niente shader per la geometria; il filmico (grana/vignetta) vive in `Juice`/`PostFx`.
- **Bake-once.** Il terreno (`groundTexture`) e ogni texture-figura/auto sono **bakeate una sola volta** (guard `textures.exists`) e cacheate per-luogo/per-veicolo. Il muro, la stazione e i prop sono `Graphics` disegnati a `create()`, **non** ridisegnati per-frame. Solo il **flicker** della luce calda e l'**ombra di contatto** si aggiornano in `update`.
- **Nitidezza nativa.** Le texture osservate da vicino (figure, auto) sono generate a **`OVERSAMPLE`× (=2)** via `osGraphics`/`OS_G` e riportate a scala design con `setScale(1/OVERSAMPLE)`. Il terreno e l'arredo-graphics restano a risoluzione design (superficie scura, morbidezza trascurabile).
- **Cosmetico ≠ gameplay.** Luci, particelle, idle, flicker e ombre **non toccano** i `colliders` (cerchi espliciti) né le distanze d'interazione (`INTERACT_RADIUS=80`). La vita è **solo visiva**.
- **Depth ordering esplicito** (`setDepth`): cielo `0` · skyline `1` · muro `1.2` · feature-firma `1.4` · terreno `2` · penombra globale `2.9` · pozza a terra `3` · prop/NPC/stazione `= y` (y-sort) · bloom-sorgente `sy+1` · primo piano `560` · particelle `700-801` · prompt/overlay `1000+`.
- **Equità invariata.** I core (`repair`/`refuel`/`restock`) esistono in **ogni** luogo: nessuna palette o composizione può nascondere la stazione-servizi o la stazione-riparti (no softlock visivo).

---

## 3. Modello di luce condiviso (la regia)

Ogni hub ha **una luce-firma** (`StopLocation.hubLight`) che lo definisce e ne detta l'umore. È un dato a 4 campi letto da `renderHub`:

| Campo | Significato | Effetto a schermo |
|---|---|---|
| `warmth` | 0 = freddo (generatore/neon) → 1 = caldo (fuoco) | tinta dell'orizzonte sul muro + scelta brace/pulviscolo |
| `reach` | raggio della pozza a terra (px design) | `falloff()` dei prop = quanto lontano arriva la luce |
| `offX` / `offY` | scostamento della sorgente rispetto alla stazione (`sx,sy`) | dove "nasce" il bloom e da dove cadono le ombre |

**Sorgente.** `L = { x: sx+offX, y: sy+offY, color: accent, warmth, reach }`, con `sx=round(0.66·designW)`, `sy=372`.

**Tre componenti di luce (tutte additive, `BlendMode.ADD`), cotte nella scena:**

1. **Pozza a terra** (`fx_light` tint = `accent`, sotto gli oggetti, **flattened**, mai disco che galleggia): scala **caldo `4.4×2.6` α0.40** · **freddo `3.8×2.2` α0.30**.
2. **Bloom-sorgente stretto** (`fx_light` tint = `mix(accent, bianco, 0.4)`, alla sorgente): scala **caldo `1.9` α0.85** · **freddo `1.5` α0.60**. È il punto che "accende", non un disco scenico.
3. **Penombra globale** (rettangolo `#000000` **α0.18**) su tutta la scena: il luogo è buio, la luce-firma è l'unica isola calda.

> 🎯 **Regola anti-disco-piatto (target v1.0, da pass visivo).** Oggi la pozza è **due ellissi impilate** (pozza larga + bloom-core stretto quasi-bianco) → legge come "disco-core su disco" / "macchia + lampadina" / "decalcomania a bordo duro": **il difetto-killer ripetuto in tutti e 5 gli hub**. La pozza deve essere un **volume con falloff continuo**, costruito come **stack di 3 `fx_light` concentriche** a scala crescente / alpha decrescente (core ~1.1·α0.42 → medio ~2.6·α0.22 → ampio ~4.2–6.0·α0.10), col **core più basso** così non spicca come lampadina. La **direzionalità** (depot generatore, checkpoint faro) si rende con un **ramo conico** — un triangolo/fan additivo orientato dalla sorgente verso il cortile — **non** con un'ellisse radiale. *La formula `falloff()` (esp. 1.6) resta valida: il fix è il layering delle immagini, non la matematica.*

> 🎯 **Coerenza di esposizione (target v1.0).** Il pass ha trovato l'esposizione **incoerente**: garage/depot tendono al **piatto/neutro** (luce larga, core spinto verso il bianco), camp/market sono **troppo bui** (cortile quasi nero con un solo nucleo + vuoto morto). Target: un **range condiviso** — la luce-firma domina sempre, ma esiste un **fill-light di raccordo** nel corridoio centrale e il **veicolo non è mai sotto-esposto** (oggi annega nel nero in tutti e 5).

**Rim & ombre (regola di luce del titolo).** `drawLitProp` orienta il rim verso la sorgente (`lightDir`) e ne scala l'intensità col `falloff` (più vicino alla luce = rim più acceso). `dropShadow` stampa un'**ombra lunga direzionale** (`fx_shadow`) che si **allunga con la distanza dalla luce** (lozenge ruotato lungo `atan2(ny,nx)`) + un'ellisse di contatto.

**Flicker (solo luoghi "caldi").** Per `camp` e `market` il bloom pulsa a **somma di seni incommensurabili** (rumore organico, no loop percepibile):
```
f = 0.82 + 0.10·sin(11.3·t) + 0.06·sin(23.7·t) + 0.04·sin(37.1·t)
```
applicato a `scale` e `alpha` del bloom-sorgente.

> ✅ **DECISIONE (v1.0, post pass visivo) — la temperatura deriva dal CAMPO completo.** Il pass ha **confermato a schermo** una deriva speculare: il `depot` (warmth 0.70 + pozza arancio puro) legge **caldo-da-falò**, indistinguibile dal `camp`, invece che freddo-industriale; il `market` (flag `warm` ma pulviscolo azzurro-grigio `0x99a4b8`) legge **gelido** invece che caldo-sporco. Causa: la temperatura è decisa dal solo numero `warmth` + tint della pozza, **scollegata** da pulviscolo/particelle/cielo. **Decisione presa:**
> 1. **`depot.warmth` 0.70 → 0.42** (sotto 0.5 → ramo cielo freddo) e **pozza desaturata** verso bianco-freddo (`tint = mix(L.color, 0x8fb4d8, 0.45)`): l'arancio resta solo come **accento-pericolo** sulle valvole, non come bagno globale.
> 2. **`market.warmth` 0.45 → 0.62** + **pulviscolo/particelle caldi** (`0xbfa090` + emettitore-brace `[0xffaa55, 0xcc7733]`).
> 3. **Derivare `warm` da `warmth ≥ 0.6`** (unica fonte di verità), eliminando il cablaggio `key === 'camp' || 'market'`. Esito: caldi = camp (1.0) + market (0.62); freddi = garage (0.30) + depot (0.42) + checkpoint (0.55) → **coincide con l'intento** e fixa il depot.
>
> Finché il fix non è in codice, la tabella 🔒 §6.2 **fotografa lo stato attuale** (0.70/0.45); i valori-target sono qui e nella roadmap (fix #5). Principio generale: **pozza + pulviscolo + particelle + cielo seguono SEMPRE il flag `warm` in modo coerente.**

---

## 4. Dottrina di shading materiale

Ogni volume passa per uno di questi helper (mai fill piatto):

| Helper | Uso | Firma |
|---|---|---|
| `drawLitProp(g,L,x,y,w,h,base)` | prop a parallelepipedo (cassoni, lanterne, banchi) | 3 toni (ombra/mezzotono/luce) + rim orientato alla sorgente + falloff + 2 piedini scuri |
| `shadeCyl(g,x,y,w,h,base)` | cilindri (pompe, morsa, legna del falò) | 4 fasce verticali + lip-highlight in arco sul bordo alto |
| `rimTL(g,x,y,w,h,base,amt)` | bordo-luce universale | linea chiara su lato alto + lato sinistro (regola alto-sx) |
| `drawFarBox(g,x,baseY,w,h,color)` | volumi lontani (skyline sopra il muro) | shear `FAR_SHEAR=0.18` (prospettiva) + faccia dx in ombra + cornicione |
| `dropShadow(scene,L,x,y,w,depth)` | ombra di qualsiasi oggetto | lozenge `fx_shadow` allungato per distanza + ellisse di contatto |

**Palette materiali metallo** (stazioni): `M=0x4a4a52` (mezzotono) · `MD=0x26262c` (ombra) · `ML=0x70707a` (luce). Legno arredo: `0x4a3a24`/`0x3a2c18`. Gomma: `0x16161c`. Sacchi: `0x6a6244`/`0x7a7050`.

> 🎯 **Dottrina figure (target v1.0) — persone, non giocattoli.** Il pass ha bocciato le figure in **tutti e 5** gli hub (`figureReadability 1–2/5`): testone chibi a `1/OVERSAMPLE`, troppo piccole, spesso **fuori dalla luce** e **senza rim-light**. Regole:
> - **Silhouette meno chibi**: testa più piccola e gambe più lunghe in `buildFigure` (oggi testa Ø~5.4 su corpo ~12 largo = testone). La proporzione testa/corpo è ciò che fa "bambola".
> - **NPC-eroe ingrandito** (~1.25–1.4/OVERSAMPLE) e **dentro la pozza**; ambientali **ridotte** e **vincolate entro la `reach`** della luce (mai macchie scure che galleggiano nel buio).
> - **Rim-light per-figura** color-firma sul lato verso la sorgente (in `falloff`): i volti del `camp` devono essere **scaldati dal fuoco**, il soldato del `checkpoint` avere un rim oliva, il mercante un rim magenta. È ciò che trasforma una sagoma piazzata in "qualcuno che vive qui".
> - **Conteggio NPC per-luogo**: il `depot` per brief è **vuoto** (`hubNpcs=[]`, transito) — il loop ambientale **non** deve aggiungervi figure (oggi ne mette 2). Derivare il numero da `hubNpcs.length`.

---

## 5. Schede dei cinque luoghi

> Formato per-luogo: **identità** (una riga d'umore) · **luce-firma** · **muro/feature di fondo** · **stazione-eroe** · **arredo & NPC** · **focal point** (dove cade l'occhio) · **criterio key-art** (cosa deve reggere nella schermata ferma). Palette e luce numeriche stanno nelle **tabelle 🔒 §6** (non duplicare i numeri qui).

### 5.1 `garage` — OFFICINA (la sosta completa)
- **Identità.** L'unico rifugio *sicuro e completo*: luce di lavoro fredda, ordine meccanico nel caos. Verde-malato firma (accento). Servizi tutti aperti (ripara · potenzia · armi · sopravvissuti · veicoli).
- **Luce-firma.** Neon d'officina freddo e fermo (no flicker), `warmth` bassa, pozza media.
- **Muro di fondo.** Serranda metallica `92×86` a doghe + insegna OFFICINA + **tubo al neon verticale** in accento (l'unica fonte viva sul muro).
- **Stazione-eroe.** Banco da lavoro `100×30` (3 toni metallo) + cassettiera a 4 cassetti + **morsa** (`shadeCyl 11×10`) + insegna luminosa `66`.
- **Arredo & NPC.** Gomme, pallet, taniche; il **meccanico** (`mechanic`) accanto al mezzo.
- **Focal point.** Il banco illuminato sotto l'insegna; il veicolo entra nella pozza.
- **Criterio key-art.** "Un garage dove qualcuno *ripara per vivere*": metallo graffiato, luce di lavoro, profondità data dalla serranda.
- **Reso reale (v1.0 · verdetto: NEAR).** Il focal sul banco verde **regge** e la temperatura fredda è centrata. Da fixare: la **serranda OFFICINA è invisibile** (no insegna emissiva, neon verticale spento → non additivo); **pozza a due dischi** (core verso il bianco-verde neutro → de-satura il verde); banco **3-toni piatto** senza graffi/usura, morsa minuscola; veicolo **fuori dalla pozza** → vuoto centrale. *Fix: roadmap #1 (insegna OFFICINA + neon additivo), #2, #4; graffi+morsa più grande sul banco.*

### 5.2 `depot` — DEPOSITO (rifornimento)
- **Identità.** Stazione di servizio post-collasso: arancio-fuoco dei serbatoi, ronzio di generatore. Solo core (rifornisci/ripara/munizioni) + pompa diegetica. **Due** stazioni (pompa a sx, banco a dx).
- **Luce-firma.** Generatore/faro, `reach` ampia; **vedi deriva §3** (warmth alta ma freddo nei VFX).
- **Muro di fondo.** Due **serbatoi cilindrici** `70×104` + tubo orizzontale.
- **Stazione-eroe.** Due **pompe** (`shadeCyl 18×44`) con display in accento + cabina `40×36` + insegna `38`; secondo bloom sulla cabina.
- **Arredo & NPC.** Barili, taniche, casse; **nessun NPC fisso** (luogo di transito, pit-stop rapido).
- **Focal point.** Le pompe gemelle nella pozza arancio; i serbatoi che bucano il muro.
- **Criterio key-art.** "Una pompa nel buio che potrebbe esplodere": tubi, valvole, l'arancio come avvertimento.
- **Reso reale (v1.0 · verdetto: FAIL).** Le pompe gemelle **vincono il focal**, ma il deposito legge **caldo-da-falò**, indistinguibile dal `camp` — **deriva temperatura confermata** (warmth 0.70 + pozza arancio puro). La pozza è **radiale, non conica** (manca il "fascio di generatore"); i **serbatoi-firma** del muro spariscono nel buio; figure-giocattolo e — contro brief — il loop ambientale piazza 2 NPC dove dovrebbe essere **vuoto**. *Fix: roadmap #5 (warmth→0.42 + pozza fredda + arancio solo accento), #1 (serbatoi con `shadeCyl` + banda-pericolo), #2 (ramo conico), #3 (depot vuoto).*

### 5.3 `camp` — ACCAMPAMENTO (il recupero)
- **Identità.** L'unico luogo *caldo e umano*: fuoco, voci, fiducia. Il posto del morale (+8 alla sosta, §BALANCE). Recluta · cura · razioni.
- **Luce-firma.** **Fuoco** `warmth 1.0`, **flicker attivo**, brace che sale (particelle calde `0xffd24a/0xff7a22/0xff5520`).
- **Muro di fondo.** **Tende** triangolari + barricata di lamiere (con sottile glow d'accento).
- **Stazione-eroe.** **Falò a strati**: cerchio di pietre (9 ellissi) + legna (`shadeCyl 32×8`) + braci + **fiamme** (triangolo arancio `0xff7a22` su giallo `0xffd24a`).
- **Arredo & NPC.** Il **medico** (`medic`) e l'**esploratrice** (`explorer`) accanto al fuoco; più figure ambientali (luogo "caldo" → 3 ambientali).
- **Focal point.** Il fuoco — l'unica vera sorgente calda del gioco; i volti scaldati intorno.
- **Criterio key-art.** "Un fuoco a cui vorresti sederti": calore credibile (non "diorama"), persone che lo circondano, buio premuto ai bordi.
- **Reso reale (v1.0 · verdetto: NEAR).** Miglior **umore** dei 5: il fuoco È il focal giusto e la scena è correttamente calda. Ma le **fiamme sono 2 triangoli di cartone** ("diorama" confermato): servono 4-5 lingue irregolari + **nucleo bianco-caldo** `0xfff0c0` + jitter delle punte nel flicker. I **volti NON sono scaldati** dal fuoco (manca rim-light per-figura); pozza-disco piatta; **tende-firma** invisibili; braci/pietre del focolare si perdono. *Fix: fiamme stratificate + nucleo caldo; roadmap #3 (volti scaldati), #2, #1 (tende con cresta chiara).*

### 5.4 `checkpoint` — POSTO DI BLOCCO (lo stallo teso)
- **Identità.** Autorità militare residua: faro accecante, sacchi, sbarra. Verde-oliva firma. Armi · munizioni + (futuro) pedaggio/stallo.
- **Luce-firma.** **Faro di posizione** bianco, `reach` massima (240), fermo, conico.
- **Muro di fondo.** **Torretta di guardia** `52×114` con vetri illuminati + muro blast.
- **Stazione-eroe.** Sacchi di sabbia (2 file) + **sbarra a strisce** rosse `0xcc4422` + **faro conico** caldo-bianco `0xfff4d0`.
- **Arredo & NPC.** Sacchi, casse, coni; il **soldato** (`soldier`) di guardia.
- **Focal point.** La sbarra sotto il faro; la torretta che incombe dal muro.
- **Criterio key-art.** "Un confine che non ti fiderai di attraversare": sacchi, ferro, luce che acceca e nasconde.
- **Reso reale (v1.0 · verdetto: FAIL).** La sbarra a strisce rosse **legge** come confine, ma la **torretta-firma è invisibile** (`backdropIdentity 1/5`, il peggiore) e il faro legge come **"macchia + lampadina"**, non come **cono accecante**. Manca il "bianco che acceca" (warmth 0.55 dà un tiepido-neutro indeciso → core a `0xffffff` puro). Sacchi minuscoli; figure-giocattolo (soldato-eroe indistinto); banding ai bordi della pozza. *Fix: roadmap #1 (torretta più alta + vetri additivi), #2 (ramo conico verticale), #3 (soldato in pozza + rim oliva); sacchi più grandi su 3 file.*

### 5.5 `market` — MERCATO NERO (la tentazione)
- **Identità.** Bazar al neon, merce che ruota, etica sospesa. Magenta firma. Potenziamenti · armi · veicoli.
- **Luce-firma.** **Neon** magenta, **flicker attivo**, brace-pulviscolo caldo.
- **Muro di fondo.** **Muro di container** impilati (7, 3 colori `0x3a2a2a/0x2a3a3a/0x3a3a2a`, altezze variate).
- **Stazione-eroe.** Bancarella `84×9` + montanti + **tendone a festoni** in accento + **6 lanterne** (`drawLitProp`) appese.
- **Arredo & NPC.** Casse, teli, merce; il **saccheggiatore/mercante** (`looter`); 3 figure ambientali.
- **Focal point.** Il tendone illuminato a festoni; la merce nelle lanterne magenta.
- **Criterio key-art.** "Un mercato dove tutto ha un prezzo, anche le persone": neon sporco, container, abbondanza inquietante.
- **Reso reale (v1.0 · verdetto: FAIL).** Il magenta-firma è **unico e riconoscibile** a colpo d'occhio, ma la pozza è una **"decalcomania" a bordo duro** (difetto-killer); il **muro di container** è invisibile (3 colori non si separano); le figure sono **puntini** (`figureReadability 1/5`, il peggiore); **deriva fredda** (flag `warm` ma pulviscolo azzurro-grigio); i festoni del tendone sono **triangoli piatti** indistinti (servono 6 lanterne a cerchi distinti con micro-glow ciascuna). *Fix: roadmap #2 (pozza stratificata), #1 (container a gradoni + stacchi chiari), #5 (pulviscolo/brace caldi), #3 (mercante ingrandito + rim magenta).*

---

## 6. 🔒 Tabelle bloccate (verità numerica · gancio validatore)

> Prima cella = **chiave del luogo** (in backtick) per il match riga-per-riga del validatore (`bibleRow`). I valori sono estratti da `STOP_LOCATIONS` in [`Locations.ts`](../src/Locations.ts). **Se cambi un numero nel codice, cambialo anche qui** (e viceversa) o la build fallirà quando il gancio §9 sarà attivo.

### 6.1 Palette & accento per luogo
| Luogo | accento | terreno (`hubGround`) | cielo (`hubSky`) | NPC firma | stazione |
|---|---|---|---|---|---|
| `garage` | `#66cc66` | `#1c1c22` | `#0c0c14` | mechanic | `hub.station.workshop` |
| `depot` | `#ff7722` | `#20201a` | `#0a0c10` | — | `hub.station.pump` |
| `camp` | `#ffaa55` | `#1e1813` | `#120b0a` | medic · explorer | `hub.station.fire` |
| `checkpoint` | `#aabb55` | `#1a1c16` | `#0c0e0b` | soldier | `hub.station.guard` |
| `market` | `#cc66cc` | `#191320` | `#0f0a14` | looter | `hub.station.stall` |

### 6.2 Luce-firma per luogo (`hubLight`)
| Luogo | `warmth` | `reach` | `offX` | `offY` | flicker (`warm`) |
|---|---|---|---|---|---|
| `garage` | 0.30 | 200 | -6 | -40 | no |
| `depot` | 0.42 | 230 | 0 | -30 | no (freddo-industriale) |
| `camp` | 1.00 | 210 | 0 | -22 | **sì** |
| `checkpoint` | 0.55 | 240 | 0 | -34 | no |
| `market` | 0.62 | 220 | 0 | -28 | **sì** |

> ✅ **Implementato (fix #5).** Il flag `warm` è **derivato da `warmth ≥ 0.6`** (in `renderHub`), non più cablato `key === 'camp'||'market'`. Con i valori sopra: caldi = camp (1.0) + market (0.62); freddi = garage (0.30) + depot (0.42) + checkpoint (0.55). La pozza del `depot` è inoltre desaturata verso bianco-freddo (`mix(L.color, 0x8fb4d8, 0.45)`) → l'arancio resta accento sulle valvole.

### 6.3 Geometria-firma della scena (costanti `HubEnvironment`)
| Costante | Valore | Ruolo |
|---|---|---|
| `HUB_HORIZON` | 210 | linea terreno = base del muro di fondo |
| `WALL_TOP` | 60 | sommità del muro di fondo |
| `FAR_SHEAR` | 0.18 | lean prospettico dei volumi distanti |
| `HUB_WALK.minX` | 44 | margine calpestabile sx (maxX = designW − minX) |
| `HUB_WALK.minY` / `maxY` | 352 / 556 | banda calpestabile verticale |
| stazione (`sx`,`sy`) | `0.66·designW`, 372 | ancora della stazione-eroe e della luce |
| veicolo (`vx`,`vy`) | 150, 432 | parcheggio (vista laterale) |
| figura (W×H) | 24×38 | frame autista/equipaggio/NPC (`buildFigure`) |
| auto-hub (frame) | 116×72, `CAR_GY`=60 | frame fisso `buildHubCar` (origine a terra costante) |

### 6.4 Luce — parametri di resa (additivi)
| Componente | Caldo (`camp`/`market`) | Freddo (altri) |
|---|---|---|
| Pozza a terra (`fx_light` tint accento) | scala 4.4×2.6 · α0.40 | scala 3.8×2.2 · α0.30 |
| Bloom-sorgente (`fx_light` tint mix+bianco 0.4) | scala 1.9 · α0.85 | scala 1.5 · α0.60 |
| Penombra globale (`#000000`) | α0.18 | α0.18 |

---

## 7. Vocabolario prop (dimensioni-firma)

Catalogo riusabile (`HubEnvironment`), con dimensione-firma per coerenza di scala. Ogni prop spinge un `collider` esplicito (no walk-through).

| Prop | Helper | Dim-firma | Note |
|---|---|---|---|
| Cassa | `crate` | 16×13 | croce diagonale + rim alto-sx |
| Barile | `barrel` | r=6 (+ ombra 13×12) | lip-highlight in arco |
| Sacchi di sabbia | `sandbags` | 13×9 ×N | alternati `0x6a6244`/`0x7a7050` |
| Gomma abbandonata | `tire` | ellisse 16×8 | nero `0x16161c`, mozzo nudo |
| Pallet | `pallet` | 28×6 | legno `0x4a3a24` |
| Cono stradale | `cone` | h≈15 | arancio + banda riflettente |
| Tanica | `jerrycan` | 12×13 | colore per-istanza |
| Relitto d'auto | `drawWreck` | ≈66 largo | clutter-eroe narrativo (collider r=30) |

> **Densità.** `drawProps` posa su **griglia 8×4 jitterata** su tutto il cortile, con zone *bloccate* attorno a veicolo/stazione/spawn-personaggio (leggibilità d'interazione). I prop "caldi" non devono mai coprire la stazione-servizi o la stazione-riparti.

---

## 8. Impatto su i18n & audio (rimandi)

- **i18n** ([I18N.md](I18N.md)): ogni luogo ha `loc.<key>.name` + `loc.<key>.flavor` (registro horror) e la stazione `hub.station.*`; i prompt/azioni sono `hub.*`. Italiano canonico in [`it.ts`](../src/locales/it.ts) → ×6 lingue o `validate:i18n` rompe la build. **Nessun letterale** nel renderer.
- **Audio** ([ART_BIBLE_AUDIO.md](ART_BIBLE_AUDIO.md)): ambienza per-luogo (crepitio del fuoco / ronzio del generatore / sferragliare di lamiere / neon ronzante) + **passi del personaggio per superficie** + stinger d'interazione. **Da fare** (Fase 3 di SOSTE): oggi l'hub è silenzioso oltre alla UI.

---

## 9. Gancio `validate:art` ✅ ATTIVO

`scripts/validate-art-bible.mjs` (blocco **5c. SOSTE**) confronta `STOP_LOCATIONS` con le tabelle 🔒 di questo documento → `npm run validate:art` riporta "**N soste verificati**" e **fallisce la build** sulla deriva. Coperto:

1. **§6.1 palette** — `accent` · `hubGround` · `hubSky` (esadecimali) per i 5 luoghi.
2. **§6.2 luce-firma** — `hubLight` `warmth` · `reach` · `offX` · `offY` per i 5 luoghi.

Implementazione: ogni entry di `STOP_LOCATIONS` è **mono-riga** → estrazione per-riga (`stopLine(key)` + `lineHexF`/`lineNumF`); le righe della tabella si leggono col `bibleRow` esistente, distinguendo §6.1 da §6.2 via `sliceSection('### 6.1')`/`sliceSection('### 6.2')`. **`ART_BIBLE_SOSTE.md` è in Regola n.1 di [CLAUDE.md](../CLAUDE.md).**

**Non ancora lockato** (documentato ma fuori dal validatore): §6.3 (geometria-firma — costanti in `HubEnvironment.ts`), §6.4/§7 (parametri di resa luce e dim-prop — vivono in chiamate inline; lockabili estraendoli in costanti nominate). **Vincolo:** le entry di `STOP_LOCATIONS` **devono restare mono-riga** o il parser testuale non le legge.

---

## 10. Stato & problemi aperti

> ✅ **Pass visivo eseguito (v1.0).** I 5 hub sono stati catturati dalla **Galleria Luoghi** ([DebugScene](../src/scenes/DebugScene.ts) → tasti 1-5) a 1600×1200 e giudicati a schermo (diagnosi adversariale per-hub + coerenza cross-hub). Il **verdetto, i 7 difetti sistemici e la roadmap prioritizzata** sono in testa al documento (⭐ Verdetto). Aggiorna il quadro di [SOSTE_DIEGETICHE §13](SOSTE_DIEGETICHE.md) ("verificato con build verde, **non ancora a schermo**"): **ora è a schermo**.

**Rischi sospettati → esito del pass (tutti CONFERMATI):**
- **Banding/disco-piatto della pozza** → confermato, in *tutti* e 5 (difetto sistemico #2). È il difetto-killer.
- **Ombre a "lozenge"** → confermato, in tutti e 5 (#7).
- **Fuoco "diorama"** (camp) → confermato (2 triangoli di cartone); il festone del market ha lo stesso vizio.
- **Deriva `warm`↔`warmth`** → confermata e **speculare**: depot caldo (doveva essere freddo) **e** market gelido (doveva essere caldo). **Risolta come decisione in §3 / fix #5.**
- **Figure "teste fluttuanti"/giocattolo** → confermato, in tutti e 5 (#4); peggiore al market (1/5).
- **Vuoto centrale + veicolo annegato** → confermato, in tutti e 5 (#3).
- **(nuovo dal pass) Muro-firma invisibile** → il difetto **n.1**: i 5 luoghi non leggono come distinti (#1, #6).

**Stato:** ✅ **roadmap #1-#6 implementata e ri-validata a schermo** (vedi "Stato roadmap" nel ⭐ Verdetto). Tabelle 🔒 §6 allineate al codice (warmth depot 0.42 / market 0.62).

**Prossimo passo raccomandato:** (a) eventuale **polish v1.1** (esposizione globale + scala figure, vedi nota nel ⭐ Verdetto); (b) **attivare il gancio §9** + aggiungere il file alla Regola n.1 di [CLAUDE.md](../CLAUDE.md) — così gli hub entrano sotto `validate:art` come il resto del titolo.

---

> **Manutenzione.** Questo è un **living document**. Ogni modifica visiva agli hub aggiorna la scheda pertinente + le tabelle 🔒; ogni numero che cambia nel codice si rispecchia in §6 (e, quando attivo, `npm run validate:art` lo impone). La fonte di verità *estetica* delle soste è qui; il *piano/scope* resta in [SOSTE_DIEGETICHE.md](SOSTE_DIEGETICHE.md), le *regole* in [GAME_DESIGN.md](GAME_DESIGN.md), i *numeri d'economia* in [BALANCE.md](BALANCE.md).
