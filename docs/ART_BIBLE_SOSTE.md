# 🏚️ Art Bible — Soste (luoghi di fine percorso)
### Zombie Road: Last Escape · Direzione Artistica (qualità AAA)

> **Stato:** v0.1 · **BOZZA** · estratta da [`SOSTE_DIEGETICHE.md`](SOSTE_DIEGETICHE.md) §3-4 e dal codice reale ([`src/HubEnvironment.ts`](../src/HubEnvironment.ts), [`src/Locations.ts`](../src/Locations.ts)). I numeri delle tabelle 🔒 sono **verificati contro il codice** alla stesura; il resto è **target visivo da validare a schermo** (Galleria Luoghi). **Non ancora agganciata a `validate:art`** (vedi §9).
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

**Rim & ombre (regola di luce del titolo).** `drawLitProp` orienta il rim verso la sorgente (`lightDir`) e ne scala l'intensità col `falloff` (più vicino alla luce = rim più acceso). `dropShadow` stampa un'**ombra lunga direzionale** (`fx_shadow`) che si **allunga con la distanza dalla luce** (lozenge ruotato lungo `atan2(ny,nx)`) + un'ellisse di contatto.

**Flicker (solo luoghi "caldi").** Per `camp` e `market` il bloom pulsa a **somma di seni incommensurabili** (rumore organico, no loop percepibile):
```
f = 0.82 + 0.10·sin(11.3·t) + 0.06·sin(23.7·t) + 0.04·sin(37.1·t)
```
applicato a `scale` e `alpha` del bloom-sorgente.

> ⚠️ **Deriva nota da risolvere (design decision).** Il flag `warm` che attiva flicker+brace è oggi `key === 'camp' || 'market'`, **scollegato** dal campo `warmth`. Risultato: il `depot` ha `warmth 0.70` (tinte calde) ma riceve **pulviscolo freddo e nessun flicker** — coerente col brief "generatore freddo" di SOSTE §4, ma **incoerente col suo stesso `warmth`**. Da decidere: abbassare `depot.warmth` (≈0.30) **oppure** derivare `warm` da `warmth ≥ 0.6`. Finché non deciso, la tabella 🔒 §6 fotografa lo stato attuale.

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

### 5.2 `depot` — DEPOSITO (rifornimento)
- **Identità.** Stazione di servizio post-collasso: arancio-fuoco dei serbatoi, ronzio di generatore. Solo core (rifornisci/ripara/munizioni) + pompa diegetica. **Due** stazioni (pompa a sx, banco a dx).
- **Luce-firma.** Generatore/faro, `reach` ampia; **vedi deriva §3** (warmth alta ma freddo nei VFX).
- **Muro di fondo.** Due **serbatoi cilindrici** `70×104` + tubo orizzontale.
- **Stazione-eroe.** Due **pompe** (`shadeCyl 18×44`) con display in accento + cabina `40×36` + insegna `38`; secondo bloom sulla cabina.
- **Arredo & NPC.** Barili, taniche, casse; **nessun NPC fisso** (luogo di transito, pit-stop rapido).
- **Focal point.** Le pompe gemelle nella pozza arancio; i serbatoi che bucano il muro.
- **Criterio key-art.** "Una pompa nel buio che potrebbe esplodere": tubi, valvole, l'arancio come avvertimento.

### 5.3 `camp` — ACCAMPAMENTO (il recupero)
- **Identità.** L'unico luogo *caldo e umano*: fuoco, voci, fiducia. Il posto del morale (+8 alla sosta, §BALANCE). Recluta · cura · razioni.
- **Luce-firma.** **Fuoco** `warmth 1.0`, **flicker attivo**, brace che sale (particelle calde `0xffd24a/0xff7a22/0xff5520`).
- **Muro di fondo.** **Tende** triangolari + barricata di lamiere (con sottile glow d'accento).
- **Stazione-eroe.** **Falò a strati**: cerchio di pietre (9 ellissi) + legna (`shadeCyl 32×8`) + braci + **fiamme** (triangolo arancio `0xff7a22` su giallo `0xffd24a`).
- **Arredo & NPC.** Il **medico** (`medic`) e l'**esploratrice** (`explorer`) accanto al fuoco; più figure ambientali (luogo "caldo" → 3 ambientali).
- **Focal point.** Il fuoco — l'unica vera sorgente calda del gioco; i volti scaldati intorno.
- **Criterio key-art.** "Un fuoco a cui vorresti sederti": calore credibile (non "diorama"), persone che lo circondano, buio premuto ai bordi.

### 5.4 `checkpoint` — POSTO DI BLOCCO (lo stallo teso)
- **Identità.** Autorità militare residua: faro accecante, sacchi, sbarra. Verde-oliva firma. Armi · munizioni + (futuro) pedaggio/stallo.
- **Luce-firma.** **Faro di posizione** bianco, `reach` massima (240), fermo, conico.
- **Muro di fondo.** **Torretta di guardia** `52×114` con vetri illuminati + muro blast.
- **Stazione-eroe.** Sacchi di sabbia (2 file) + **sbarra a strisce** rosse `0xcc4422` + **faro conico** caldo-bianco `0xfff4d0`.
- **Arredo & NPC.** Sacchi, casse, coni; il **soldato** (`soldier`) di guardia.
- **Focal point.** La sbarra sotto il faro; la torretta che incombe dal muro.
- **Criterio key-art.** "Un confine che non ti fiderai di attraversare": sacchi, ferro, luce che acceca e nasconde.

### 5.5 `market` — MERCATO NERO (la tentazione)
- **Identità.** Bazar al neon, merce che ruota, etica sospesa. Magenta firma. Potenziamenti · armi · veicoli.
- **Luce-firma.** **Neon** magenta, **flicker attivo**, brace-pulviscolo caldo.
- **Muro di fondo.** **Muro di container** impilati (7, 3 colori `0x3a2a2a/0x2a3a3a/0x3a3a2a`, altezze variate).
- **Stazione-eroe.** Bancarella `84×9` + montanti + **tendone a festoni** in accento + **6 lanterne** (`drawLitProp`) appese.
- **Arredo & NPC.** Casse, teli, merce; il **saccheggiatore/mercante** (`looter`); 3 figure ambientali.
- **Focal point.** Il tendone illuminato a festoni; la merce nelle lanterne magenta.
- **Criterio key-art.** "Un mercato dove tutto ha un prezzo, anche le persone": neon sporco, container, abbondanza inquietante.

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
| `depot` | 0.70 | 230 | 0 | -30 | no ⚠️ (vedi deriva §3) |
| `camp` | 1.00 | 210 | 0 | -22 | **sì** |
| `checkpoint` | 0.55 | 240 | 0 | -34 | no |
| `market` | 0.45 | 220 | 0 | -28 | **sì** |

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

## 9. Gancio `validate:art` (proposto, NON ancora attivo)

Oggi `scripts/validate-art-bible.mjs` **non scansiona** `HubEnvironment.ts`/`Locations.ts` → gli hub sono l'unica area visiva **non protetta** dall'anti-deriva. Proposta per chiudere il buco, sul modello del blocco boss esistente:

1. `const locations = readFileSync('src/Locations.ts')`; `const hubenv = readFileSync('src/HubEnvironment.ts')`.
2. `sliceObject(locations, 'STOP_LOCATIONS')` → per ogni chiave, confronta `accent`/`hubGround`/`hubSky` (esadecimali) con la **§6.1**; `warmth`/`reach`/`offX`/`offY` (dentro `hubLight:{…}`, serve un estrattore *nested-aware* come per `BOSS_CONFIG`) con la **§6.2**.
3. Estrai le costanti `HUB_HORIZON`/`WALL_TOP`/`FAR_SHEAR`/`HUB_WALK`/`CAR_FW`/`CAR_FH` da `hubenv` → confronta con la **§6.3**.
4. Le righe usano la prima cella in backtick → riusa `bibleRow(bibleS, key)`.

**Vincolo:** perché il parser testuale funzioni, le entry di `STOP_LOCATIONS` **devono restare mono-riga** (già così oggi). Le §6.4/§7 (parametri di resa, dim-prop) restano **documentate ma non lockate** in questa v0.1 (vivono in chiamate inline dentro le funzioni di disegno, non in una tabella-dati): lockabili in seguito estraendole in costanti nominate.

> Quando il gancio diventa attivo, aggiungere `ART_BIBLE_SOSTE.md` alla **Regola n.1** di [CLAUDE.md](../CLAUDE.md) e a `npm run validate:art`.

---

## 10. Stato & problemi aperti (da risolvere a schermo)

> v0.1 **bozza**: i target visivi qui **non sono ancora stati giudicati a schermo** (SOSTE §13: "verificato con build verde, **non ancora a schermo**"). Vanno validati nella **Galleria Luoghi** ([DebugScene](../src/scenes/DebugScene.ts) → tasti 1-5).

Rischi noti già sospettati (da confermare/risolvere col pass visivo):
- **Banding della pozza** di luce additiva (gradienti a scalini sul terreno scuro).
- **Ombre lunghe a "lozenge"** (l'allungamento direzionale può leggersi come losanga, non come ombra).
- **Fuoco "diorama"** all'accampamento (le fiamme a triangoli possono sembrare cartone, non fuoco).
- **Deriva `warm`↔`warmth`** del depot (§3) — decisione di design pendente.
- **NPC "teste fluttuanti"** se le figure full-body non staccano dal fondo (SOSTE §13 v0.2).
- **Vuoto centrale** del cortile fra stazione e veicolo (le figure ambientali lo popolano: verificare che bastino).

**Prossimo passo raccomandato:** pass nella Galleria → screenshot dei 5 hub → diagnosi puntuale → questa bozza diventa v1.0 con i target tarati su ciò che si vede (e, in parallelo, attivazione del gancio §9).

---

> **Manutenzione.** Questo è un **living document**. Ogni modifica visiva agli hub aggiorna la scheda pertinente + le tabelle 🔒; ogni numero che cambia nel codice si rispecchia in §6 (e, quando attivo, `npm run validate:art` lo impone). La fonte di verità *estetica* delle soste è qui; il *piano/scope* resta in [SOSTE_DIEGETICHE.md](SOSTE_DIEGETICHE.md), le *regole* in [GAME_DESIGN.md](GAME_DESIGN.md), i *numeri d'economia* in [BALANCE.md](BALANCE.md).
