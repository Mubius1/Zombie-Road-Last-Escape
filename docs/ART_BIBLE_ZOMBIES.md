# 🧟 Art Bible — Comparto Zombi
### Zombie Road: Last Escape · Direzione Artistica (qualità AAA)

> **Stato:** v1.0 · vivo (living document)
> **Ambito:** estetica, leggibilità e personalità di movimento di tutti i nemici "zombi".
> **Riferimento di stile:** survival-horror top-down ad alta densità (es. *Dead Nation*) — orrore **leggibile**, mai confusionario.
> **Vincolo fondante:** grafica **100% procedurale** (Phaser 3 Graphics API → `generateTexture`). **Nessun PNG.**

Questo documento è la **fonte di verità** per chiunque (umano o AI) tocchi i nemici. Se modifichi un nemico, aggiorna anche la sua scheda qui.

---

## ⭐ Standard di Produzione AAA — *Game Feel & Coesione*

> Questa sezione vale per **tutto il titolo**, non solo i nemici. Le sezioni numerate (§0–§11) sono la specifica dettagliata del roster zombi; questa è la **stella polare** che rende il prodotto "premium".

### Tesi
Un titolo sembra AAA **non** per quantità di dettaglio, ma per tre cose che possiamo ottenere anche in grafica 100% procedurale:
**(1) coesione** — sembra disegnato da una sola mano · **(2) game feel** — ogni azione ha un peso tattile · **(3) rifinitura** — nessun bordo grezzo, nessun "prototipo".

### I pilastri di produzione

1. **Coesione visiva.** Una sola direzione artistica: la stessa **regola di luce** (alto-sinistra + bordo d'ombra) e la stessa logica di palette su veicolo, nemici, ambienti e UI. Nessun elemento "fuori stile". Gli accenti **emissivi** (occhi, bagliori, proiettili) sono l'unica fonte di colore saturo: tutto il resto è desaturato e malato.

2. **Game feel / "juice".** *Ogni* evento di gameplay ha una risposta multisensoriale **sincronizzata**: VFX + suono + feedback schermo nello stesso frame. Niente azione "muta".
   - **Hit-stop:** micro-pausa (time-scale → ~0.0 per 30–70 ms) sugli impatti forti (uccisione boss, colpo del gigante). Vende il peso più di qualsiasi texture.
   - **Knockback & squash** su impatto; **flash di tinta** bianco (~80 ms) sul colpito.
   - **Screen feedback** calibrato (vedi budget sotto), mai gratuito.

3. **Illuminazione & atmosfera.** Strato sopra il gioco: **vignettatura** ai bordi, **gradiente cielo** per ambiente (già in `ENVIRONMENTS`), **luci dinamiche** che sparano (muzzle flash, esplosioni che illuminano la scena per 1–2 frame), grana/scanline tenue per coesione "filmica".

4. **Color grading & mood.** Ogni ambiente ha la sua palette (già presente). Aggiungere un **overlay di grading** coerente (contrasto + viraggio) e limitare gli accenti emissivi: il malato-verde, l'arancio-fuoco e il rosso-sangue sono i nostri tre colori "firma".

5. **Post-processing leggero (procedurale-friendly).** **Bloom finto** sugli emissivi (cerchio a bassa alpha dietro la sorgente), leggera aberrazione/grana CRT opzionale. Mai pesante: deve restare a 60 fps.

6. **Leggibilità prima di tutto.** Gerarchia chiara: le **minacce** sono sempre leggibili sopra il rumore di fondo; l'**HUD** è pulito e non copre l'azione; il VFX non deve mai nascondere ciò che uccide il giocatore. Se "bello" e "leggibile" sono in conflitto, vince **leggibile**.

7. **Rifinitura ("no rough edges").** Forme arrotondate (anti-alias), ombre a terra coerenti su tutto, **transizioni di scena** (fade/slide, mai cut secchi), schermate (titolo, game over, negozio) curate quanto il gioco. La differenza tra "indie prototipo" e "AAA" è qui.

8. **Performance come feature.** 60 fps stabili sono parte dell'estetica. Budget rigidi su particelle e shake; VFX `fire-and-forget`; nessun emitter persistente per entità.

### Budget di feedback schermo (camera & tempo)

Calibrazione di `cameras.main.shake(durata, intensità)` per evento — la coerenza di questi numeri è ciò che fa sentire "il peso giusto":

| Evento | Durata (ms) | Intensità | Hit-stop |
|---|---|---|---|
| Zombi aggrappato | 60 | 0.004 | — |
| Impatto leggero (comune/corridore) | 80 | 0.005 | — |
| Impatto pesante (corazzato) | 200 | 0.014 | — |
| Esplosione razzo | 130 | 0.009 | ~30 ms |
| Colpo del Gigante | 400 | 0.025 | ~50 ms |
| Spawn boss | 300 | 0.016 | — |
| Uccisione boss | 500 | 0.022 | ~70 ms |
| Game over | 500 | 0.018 | — |

> **Regola:** lo shake è una **spezia**. Se è sempre acceso non si sente più nulla; riservalo agli eventi che meritano peso.

### Segnatura visiva di *questo* titolo
Strada notturna desaturata · carne necrotica e metallo ossidato · **bagliori biologici malati** come unica luce viva · grana filmica leggera · impatti "succosi". Se uno screenshot non comunica *"horror su strada, sporco e tattile"*, è fuori firma.

### Definition of Done — livello titolo
- [ ] Ogni azione del giocatore ha **VFX + suono + feedback schermo** sincronizzati.
- [ ] Palette coerente: accenti emissivi limitati ai 3 colori firma.
- [ ] Vignettatura + grading attivi; nessuna zona "piatta" non illuminata.
- [ ] Transizioni tra le scene (niente cut secchi).
- [ ] HUD leggibile, non copre mai le minacce.
- [ ] 60 fps con la massima densità di nemici prevista.
- [ ] Nessun bordo a scaletta / ombra incoerente / schermata trascurata.

> **Stato implementazione:** ✅ implementati in `src/Juice.ts` (sistema condiviso) — **hit-stop** (impatti forti: razzo 30 ms, gigante 50 ms, boss 70 ms), **vignettatura + grana** filmica, **luce dinamica** (`lightFlash` con alone morbido `fx_light` su esplosioni/razzi/morte boss + **muzzle-flash** illuminante allo sparo), **bloom finto**, **flash a schermo** sulla morte del boss e **transizioni di scena** in dissolvenza (Game ↔ Shop ↔ Debug + restart morte). **Color grading per-ambiente** (viraggio MULTIPLY) in `ENVIRONMENTS[].grade/gradeAlpha`, applicato a depth 16 (sopra il gameplay, sotto vignetta/HUD). Camera-shake e SFX procedurali erano già presenti.
> **Ordine di profondità del compositing:** gameplay ≤15 · grading 16 · luci/FX additivi 17 · vignetta + frangia cromatica 18 · scanline CRT + grana 19 · HUD 20+ · flash globale 40.
> **Ottiche CRT:** ✅ **scanline** (texture `fx_scanline`, righe scure ogni 3 px, alpha 0.06) e **aberrazione cromatica finta** (frangia rossa/ciano additiva ai bordi laterali, alpha 0.07) — sottili, per non intaccare la leggibilità.
> **Roadmap residua:** nessuna pendente sul comparto visivo. Eventuali extra (curvatura CRT, sweep di luce) solo se richiesti.

---

## 0. Mappa del codice (dove vive tutto)

| Cosa | Dove |
|---|---|
| Disegno texture + spritesheet a 3 frame | `src/EntityTextures.ts` → `buildEntityTextures()` |
| Creazione animazioni di camminata | stesso metodo, helper `walk(type, rate)` |
| Statistiche di gioco (velocità, hp, scala, danno, punti) | `ZOMBIE_STATS` |
| Personalità di movimento (rollio, tonfo, virata, VFX) | `ZOMBIE_MOTION` + `updateZombieMotion()` |
| Emettitori VFX | `emitZombieFx()`, `emitSparks()` |
| Helper frame spritesheet | `AF(key, fw, fh, n)` |
| Helper colore (schiarisci/scurisci) | `static mixColor(color, target, t)` |
| Juice / game-feel (hit-stop, vignetta, bloom, transizioni) | `src/Juice.ts` |
| Galleria di test | `src/scenes/DebugScene.ts` |

**Chiavi texture:** `zombie_common`, `zombie_runner`, `zombie_armored`, `zombie_jumper`, `zombie_toxic`, `zombie_giant`.
**Animazioni:** `walk_<tipo>` (loop, sequenza fotogrammi `[0,1,2,1]`).

---

## 1. I tre pilastri

A risoluzione di gioco un nemico è alto **25–50 px**: il dettaglio interno quasi sparisce. L'orrore e la riconoscibilità vivono in quest'ordine:

1. **SILHOUETTE** — la sagoma deve dire *cosa* è in 1 frame. Asimmetria obbligatoria: un corpo storto racconta già una morte.
2. **MOVIMENTO** — il *come* si muove comunica peso/agilità prima ancora della texture.
3. **TEXTURE** — chiazze, bagliori e gore aggiungono *storia*, ma sono l'ultimo 20%.

> **Regola d'oro:** *Sagoma asimmetrica + 1 gancio visivo unico + 1 colore emissivo che cattura l'occhio + 1 personalità di movimento tattile.*

**Mai** zombi in piedi, simmetrici e statici. Mai.

---

## 2. Vincoli tecnici (non negoziabili)

- **Solo primitive:** `fillRect`, `fillRoundedRect`, `fillEllipse`, `fillCircle`, `fillTriangle`, `lineBetween`. Le forme arrotondate fanno anti-aliasing → niente "scaletta" anni '80.
- **Spritesheet orizzontale a 3 frame** per ciclo di camminata. Posa parametrica su `ph = f - 1 ∈ {-1, 0, +1}` (passo sx · neutro · passo dx).
- **Contenere il disegno nel frame** (`X(x) = ox + x`, con `x ∈ ~[0, fw]`): sforare bleeda nel frame adiacente dello stesso foglio. Limiti tollerati: ≤ ~4 px sugli arti estremi.
- **Hitbox fisse** (`setBodySize`), indipendenti da rotazione, scala-respiro e animazione. Il movimento "vivo" è **solo visivo**: non tocca il bilanciamento.
- **VFX = fire-and-forget:** immagini/particelle che si auto-distruggono via tween. **Mai** un emitter persistente per ogni zombi; emissione *throttellata* dal pool condiviso.
- **Performance budget:** decine di nemici a schermo a 60 fps. Niente effetti per-pixel, niente shader, niente blur.

---

## 3. Linguaggio visivo condiviso

### 3.1 Palette del decadimento
Mai un colore-pelle uniforme. Ogni corpo ha **almeno 3 zone materiche**:
- `carne necrotica` (base desaturata, tono malato)
- `livor mortis` (chiazza grigio-viola — **sempre nella metà bassa**, dove il sangue si deposita)
- `tessuto strappato` (rosso-bruno scuro con **bordo d'osso frastagliato a triangoli**)

### 3.2 Luce e stacco
- Luce convenzionale da **alto-sinistra** (coerente col veicolo): lato superiore schiarito.
- **Bordo d'ombra scurissimo** sul lato basso/destro: è ciò che stacca lo zombi dal fondo scuro della strada a 30 px.

### 3.3 Colore emissivo
Gli **occhi** (o il bagliore biologico) sono il **punto più luminoso e saturo** della creatura: è lì che va l'occhio del giocatore. Un solo accento emissivo per tipo.

---

## 4. Toolkit VFX procedurale

Costruzioni riutilizzabili (solo primitive). Il *sottile* va **cotto nei 3 frame**; il *dinamico* emesso a runtime e throttellato.

| Effetto | Costruzione | Animazione |
|---|---|---|
| Goccia / colatura | `fillCircle` + `fillTriangle` (punta su) = lacrima | cade con gravità → si allunga → splat (ellisse piatta) |
| Schizzo / spruzzo | 3–5 micro-ellissi in arco | dissolvenza + scala → 0 |
| Vapore / fumo | 3 cerchi impilati, raggio↑ / alpha↓ | salgono + crescono + svaniscono |
| Bava / filo | `lineBetween` o rounded-rect sottile | si allunga, poi "snap" e ricade |
| Scossa / arco | polilinea 5–6 punti con jitter, bianco-ciano + scintille a triangolo | accendi/spegni ogni 60–90 ms |
| Bagliore | grande `fillCircle` a bassa alpha dietro al corpo | pulsa con `sin` su scala/alpha |
| Scintille metallo | particelle che schizzano radialmente | tween posizione + alpha → 0 |

**Implementazioni attuali** (`emitZombieFx` / `emitSparks`):
- Tossico → vapore verde `#4cff3a` che sale + goccia melma `#2cbb2a`.
- Corridore → afterimage tint `#ff7744`, alpha 0.26.
- Gigante → polvere ai piedi `#6a5a44`.
- Corazzato → scintille `#fff2a0` ad ogni colpo incassato.

---

## 5. Sistema di Motion Personality

`rotation = lean + sign(sin(t·spd + fase)) · |sin(...)|^pow · amp`

- **`pow > 1`** → onda che **indugia agli estremi** = peso, massa, lentezza tattile.
- **`pow < 1`** → onda che **frusta per il centro** = scatto, nervosismo, agilità.
- **`stomp`** → tonfo verticale del passo (offset reversibile, niente accumulo).
- **`wob`** → respiro/gonfiore (squash-stretch del volume).
- **`home` + `turn`** → inseguimento verticale del veicolo con **virata graduale** (`turn` alto = scatta su di te; basso = deriva).
- **`fx` / `fxEvery`** → emissione VFX throttellata (ms).

### Tabella parametri canonica (`ZOMBIE_MOTION`)

| Tipo | amp | spd | lean | pow | stomp | wob | home | turn | fx | ogni |
|---|---|---|---|---|---|---|---|---|---|---|
| common | 0.09 | 4.0 | 0.00 | 1.0 | 0 | 0 | 14 | 0.05 | — | — |
| runner | 0.13 | 11.0 | **-0.22** | **0.55** | 0 | 0 | 60 | **0.18** | scia | 100 |
| armored | 0.05 | 2.6 | 0.00 | **1.6** | **1.2** | 0 | 0 | 0 | — | — |
| jumper | 0.10 | 9.0 | 0.00 | **0.5** | 0 | 0 | 0 | 0 | — | — |
| giant | 0.04 | 2.0 | 0.00 | **1.6** | **1.8** | 0.03 | 0 | 0 | polvere | 360 |
| toxic | 0.13 | 2.2 | 0.00 | 1.0 | 0 | **0.05** | 16 | 0.05 | vapore | 220 |

---

## 6. Schede dei nemici

> Ogni scheda: **Concept** (storytelling) · **Materia/Palette** (hex reali) · **Silhouette** (il gancio) · **VFX** · **Motion**.
> Dimensioni = frame singolo. Lo spritesheet è `fw × 3`.

---

### 6.1 COMUNE — *"Il Collo Rotto"* · 30×44 · `scale 1.0`
**Concept:** è morto cadendo. La testa pende lateralmente, un braccio è lussato e penzola più in basso dell'altro.

**Palette:**
`carne #6f7d54` · luce `#8a9668` · ombra `#444c33` · **livor mortis #5a4e63** · muscolo `#6e2a26` / `#9a3a2e` · osso `#d9cba6` · maglietta `#3b4156`/`#4d5570`/`#282c3c` · pantaloni `#34322b` · occhi `#ff2a10`.

**Silhouette:** testa **inclinata** a destra + **braccio destro penzolante** lungo il fianco, sinistro proteso. Asimmetria immediata.

**VFX (cotti):** brandelli di maglietta con **bordo strappato a triangoli**, squarcio con **muscolo + costole d'osso**, chiazze livide su gambe e viso, bava dalla bocca.

**Motion:** strascico lento, rollio ±5°, deriva verticale debole verso il giocatore.

---

### 6.2 CORRIDORE — *"Lo Scorticato"* · 26×42 · `scale 0.82`
**Concept:** corre così forte che la pelle si lacera sull'asfalto. Pura urgenza.

**Palette:**
`pelle sbiancata #b3a48f` · luce `#cabba6` · ombra `#7d705e` · **abrasione #7a2e22 / #a8412e** · stracci `#55303a` · osso `#d9cba6` · **occhi arancio #ff6410** (faro).

**Silhouette:** **orizzontale, bassa, a freccia** (lean -0.22 + posa di slancio). Gamba anteriore protesa, braccio anteriore ad artiglio, testa oltre i piedi.

**VFX:** **scia/afterimage** arancione; abrasioni rosse su spalla e coscia; micro-spruzzi.

**Motion:** scatto frenetico (`pow 0.55`, `spd 11`), **virata netta** (`turn 0.18`): ti individua e corregge la rotta di colpo. Il più "terrificante" nell'inseguire.

---

### 6.3 CORAZZATO — *"Il Tutore"* · 38×48 · `scale 1.25`
**Concept:** agente antisommossa rianimato, fuso dentro la sua armatura ossidata.

**Palette:**
`acciaio #5f6b78` · luce `#8a97a5` · ombra `#39424c` · cavità `#20262c` · **ruggine #8a4a26 → #3a1d0e** (colature verticali) · **verderame #3f6b54** · **sangue ossidato #2a1410** · carne marcia nelle giunture `#5a4e63` · occhi `#ffcc22`.

**Silhouette:** **blocco largo e top-heavy** + gancio unico: **scudo antisommossa** (trapezio alto) sul braccio sinistro. Spallaccio a cupola.

**VFX (cotti):** colature di ruggine sotto i rivetti, verderame sui bordi, sangue ossidato sulla corazza. **(dinamico)** scintille quando colpito.

**Motion:** massa pura. `pow 1.6`, **tonfo verticale** ad ogni passo, gambe quasi immobili. Nessun inseguimento: avanza implacabile e dritto, non barcolla se colpito.

---

### 6.4 SALTATORE — *"Il Ragno"* · 32×46 · `scale 0.9`
**Concept:** tendini e articolazioni cedute al contrario; si muove a scatti come un insetto.

**Palette:**
`pelle giallo-verde #9aa83e` · luce `#c2d05a` · ombra `#5f6a22` · **articolazioni nere #20240e** (lettura insetto) · **tendini #d8e08a** · **occhi giallo elettrico #fff000** · artigli `#e8e0c0`.

**Silhouette:** **compatto e spinoso** — palla accovacciata con **artigli che spuntano oltre la testa**. Arti ad angolo acuto.

**VFX (cotti):** ginocchia/gomiti scuri, tendini chiari tesi sugli arti, zanne.

**Motion:** estremamente agile a scatti (`pow 0.5`), **rimbalzo** (`bY` nei frame). Ingresso con **balzo** (tween sulla Y dall'alto/basso, non avanza dritto).

---

### 6.5 TOSSICO — *"Il Gonfio"* · 30×48 · `scale 1.1`
**Concept:** sacca di gas e marciume sotto pressione, sul punto di scoppiare.

**Palette:**
`pelle verde malata #3f7a33` · luce `#5fa84a` · ombra `#265020` · **vene emissive #7dff4a** · melma `#6cff3a` / `#2cbb2a` · **sacca traslucida #8fd86a** · occhi `#9dff5a`.

**Silhouette:** **asimmetrico e bulboso** — gancio unico: **enorme sacca tossica su una spalla** che sbilancia tutta la sagoma. Testa inclinata verso la sacca.

**VFX:** il più ricco — **vene emissive**, **pustole con nucleo luminoso**, alone verde. **(dinamico)** vapore che sale + gocce di melma. Alla morte lascia nube tossica.

**Motion:** molle e instabile — dondolio ampio + **respiro** (`wob 0.05`, squash che lo fa sembrare pieno di liquido). Deriva lenta verso il giocatore.

---

### 6.6 GIGANTE — *"L'Innesto"* · 48×66 · `scale 2.2` · **base dei boss**
**Concept:** non è uno zombi, sono **più cadaveri cuciti insieme** — un esperimento.

**Palette:**
`carne bruno-violacea #5a3a2e` · luce `#7d5240` · ombra `#38241c` · **chiazze livide #4a3a52** · **braccio innestato #5a5a3a / #7d7d50 / #2a2a18** (colore diverso) · **suture #1e140e + punti #8a7a60** · osso `#d9c8a0` · sangue `#6e2a26` · occhi `#ff2a10`.

**Silhouette:** **torreggiante, top-heavy** — **gobba** (spalla destra rialzata sopra la testa piccola) + **braccio destro innestato sovradimensionato** di colore diverso. Triangolo largo-in-alto = bruto istantaneo.

**VFX (cotti):** suture/punti sul torso e alla spalla innestata, pancia squarciata con gabbia toracica, chiazze livide. **(dinamico)** polvere ai piedi.

**Motion:** peso massimo (`pow 1.6`, `spd 2`), **tonfo marcato** + **respiro** (`wob 0.03`). Va dritto, inarrestabile.

**Boss:** non riusano più questa texture. Ognuno ha **modello, silhouette e palette dedicati** — vedi **§6.7**. Il Gigante resta il loro *antenato di linguaggio* (massa, suture, innesti, occhi rossi), ma i quattro boss sono creature distinte, non recolor.

---

## 6.7 BOSS — modelli dedicati (fine regione)

> I quattro boss **non** sono più recolor del Gigante: ognuno ha texture `boss_<tipo>` (3 frame, `OS_G`) e animazione `walk_boss_<tipo>`, con la propria **silhouette** — è il primo pilastro (§1) applicato ai momenti più importanti del gioco.
>
> **Codice:** texture in `buildEntityTextures()`, animazioni via helper `bwalk(...)`, parametri in `BOSS_CONFIG` (`spawnBoss`/`updateBoss`).
> **Bilanciamento invariato:** `scaleX/scaleY` adattano la cornice dedicata, ma `bodyW/bodyH` sono ricalcolati così che la **hitbox effettiva** (`bodyW·scaleX/OVERSAMPLE × bodyH·scaleY/OVERSAMPLE`) coincida col vecchio riuso del Gigante.
> **Tinta → accento:** il campo `tint` non colora più lo sprite (palette **cotta** nella texture); è il **colore-firma emissivo** usato nei VFX (alone della morte).
> **Nota validatore:** `validate:art` controlla i nemici §6 (frame/scala/motion), **non** i boss — questa scheda è la fonte di verità manuale; tienila allineata a `BOSS_CONFIG`.

---

### 6.7.1 MEGA MUTANTE — *"La Madre"* · frame 56×70 · `scaleX 2.4 / scaleY 2.6` · `boss_mega_mutant`
**Concept:** un alveare di carne che **partorisce** i comuni: una sacca-utero sotto pressione, piena di feti malformati che spinge fuori dalla bocca-ventre.

**Palette:** membrana `#3f6b3a` · luce `#5fa84a` · ombra `#21401e` · livor `#4a3a52` · sacca traslucida verde `#8fd86a` · **accento emissivo BLOOD-RED `#ff5a3a`** (occhi + pod-embrioni) · vene `#ff3020` · nucleo `#ffe6d0` · embrione `#6e4a3a`/`#9a6a4a` · osso `#d9cba6`. *Corpo verde malato, uova che brillano di rosso-sangue: firma cromatica distinta dalla Bestia (verde) e legata agli occhi rossi dei comuni che genera.*

**Silhouette:** **a goccia asimmetrica** — enorme ventre bulboso in basso (lobo extra sul lato sx), torso piccolo, **tumore-spalla** sproporzionato a destra, **braccio sx grande proteso / dx ridotto a moncone** (mai umanoide simmetrico) e una **testa-embrione che rompe il profilo inferiore** fra le gambe (il "parto" è nella sagoma, non solo nell'interno).

**VFX (cotti):** pod-embrioni luminosi nella membrana, vene emissive, pustola sul tumore, suture sul torso. **(dinamico)** genera zombi `common` ai lati (comportamento `updateBoss`).

**Motion:** mole molle che respira (`walk_boss_mega_mutant` ~2.6 fps); il ventre pulsa col passo. Deriva verticale ampia (seno) verso il giocatore.

---

### 6.7.2 VERME GIGANTE — *"Il Divoratore"* · frame 96×44 · `scaleX 2.0 / scaleY 2.0` · `boss_giant_worm`
**Concept:** non è un umanoide: un **anellide carnivoro** che affiora dall'asfalto, fauci radiali di zanne e gola incandescente.

**Palette:** carne `#9a5a2e` · luce `#c87a3a` · ombra `#5a2e14` · solco anelli `#3a1d0e` · ventre livido `#5a4e63` · gola `#1a0a06` · **bagliore emissivo `#ff7722`** / caldo `#ffd06a` · denti osso `#d9c8a0` · occhi `#ffcc22` · mucosa `#c89a5a`.

**Silhouette:** **orizzontale e segmentata** — catena di 6 anelli che rastremano in coda a destra, **maw radiale** a sinistra (verso il veicolo). Nessuna gamba: lettura "verme" immediata.

**VFX (cotti):** solchi tra i segmenti, anello di zanne, gola luminosa, bava. **(dinamico)** sputa nubi tossiche (`spawnToxicCloud`).

**Motion:** **ondulazione viaggiante** cotta nei 3 frame (offset seno per segmento) → `walk_boss_giant_worm` ~4.5 fps dà il serpeggiare. Ampie spazzate verticali in `updateBoss`.

---

### 6.7.3 COLOSSO CORAZZATO — *"Il Bastione"* · frame 60×74 · `scaleX 2.5 / scaleY 2.8` · `boss_armored_colossus`
**Concept:** un'unità antisommossa fusa in **piastre d'assedio** — un bunker che cammina, con **scudo** e **mortaio** sulla spalla.

**Palette:** acciaio `#5f6b78` · luce `#8a97a5` · ombra `#39424c` · cavità `#20262c` · ruggine `#8a4a26`→`#3a1d0e` · verderame `#3f6b54` · sangue ossidato `#2a1410` · carne nelle giunture `#5a4e63` · **visiera/innesco emissivi `#ffcc22`** / caldo `#ffe9a0`.

**Silhouette:** **blocco top-heavy** con due ganci: **scudo antisommossa** alto (trapezio) sul braccio sx + **canna del cannone** che punta in alto a destra. Elmo a cupola con fessura-visiera.

**VFX (cotti):** rivetti, colature di ruggine, bordi di verderame, sangue secco sullo scudo, bagliore visiera/bocca canna. **(dinamico)** spara proiettili (`fireBossProjectile`).

**Motion:** massa implacabile, **tonfo verticale** alternato delle gambe corazzate (`walk_boss_armored_colossus` ~2.2 fps). Resta centrato e martella.

---

### 6.7.4 BESTIA RADIOATTIVA — *"Il Reattore"* · frame 72×56 · `scaleX 2.2 / scaleY 2.3` · `boss_radioactive_beast`
**Concept:** un orrore **quadrupede** irradiato: la schiena spaccata espone un nucleo-reattore di organi fusi che cola radiazione.

**Palette:** pelle `#3f7a33` · luce `#5fa84a` · ombra `#1e3a18` · pelle vescicata `#9aa83e` · livor `#3a4a2a` · **nucleo emissivo `#7dff4a`** / medio `#b6ff6a` / cuore `#eaffd6` · osso `#d9c8a0` · melma `#6cff3a` · occhi `#b6ff6a`.

**Silhouette:** **bassa e ricurva** — quadrupede con zampe anteriori lunghe e artigliate, dorso arcuato che culmina nella **cresta-spina luminosa**, testa piccola protesa in basso a sinistra.

**VFX (cotti):** vertebre ossee che emergono dal nucleo, vene luminose sui fianchi, fauci e bava radioattiva, alone del core. **(dinamico)** sputa nubi tossiche, anche multiple (il più aggressivo).

**Motion:** **andatura predatoria** — zampe in controfase, nucleo che pulsa (`walk_boss_radioactive_beast` ~5 fps). Insegue con seno verticale nervoso.

---

### 6.7.5 — Tabella di sincronia (controllata da `validate:art`)

I numeri-sorgente dei boss **devono** coincidere con `BOSS_CONFIG` e con le chiamate `generateTexture`/`AF` nel codice. Lo script `npm run validate:art` confronta questa tabella col codice e **fallisce se divergono** (come per i nemici §5/§6). Cambia *qui e nel codice insieme*.

| chiave | frame | scaleX | scaleY | bodyW | bodyH |
|---|---|---|---|---|---|
| `boss_mega_mutant` | 56×70 | 2.4 | 2.6 | 56 | 71 |
| `boss_giant_worm` | 96×44 | 2.0 | 2.0 | 152 | 34 |
| `boss_armored_colossus` | 60×74 | 2.5 | 2.8 | 62 | 80 |
| `boss_radioactive_beast` | 72×56 | 2.2 | 2.3 | 59 | 66 |

> **Hitbox effettiva** = `bodyW · scaleX / OVERSAMPLE × bodyH · scaleY / OVERSAMPLE` (con `OVERSAMPLE = 2`). Se ribilanci la **scala**, aggiorna `bodyW/bodyH` di conserva per **non** alterare la hitbox (e quindi il gameplay): es. Mega Mutante `56·2.4/2 × 71·2.6/2 ≈ 67×92`.

### 6.7.6 — VFX di morte dedicati

Ogni boss "muore a modo suo" (`bossDeathFx()` in `GameScene.ts`, chiamato da `killBoss`) — Standard AAA: **VFX + suono + feedback schermo** sincronizzati, tutto *fire-and-forget* (immagini tinte che si auto-distruggono, **nessun** emitter persistente, **nessun** impatto sul gameplay). Base condivisa: lampo bianco + alone/`bloomBurst` nel **colore-firma** (`BOSS_CONFIG.tint`) + scoppi a catena con SFX.

- **Mega Mutante:** la sacca si rompe e **sputa la covata** — sagome di `zombie_common` schizzano via e svaniscono + spruzzi rosso-sangue.
- **Verme Gigante:** il corpo si **sfalda nei segmenti**, schegge arancio/brune scagliate di lato (bias orizzontale) che ruotano e ricadono.
- **Colosso Corazzato:** la **corazza esplode in schegge metalliche** (grigio acciaio) + raffiche di **scintille** ambra; shake extra (impatto pesante).
- **Bestia Radioattiva:** **fusione del nucleo** — vampata verde (`lightFlash`) + detriti verdi + **nubi radioattive** puramente visive che si gonfiano e svaniscono.

---

## 7. Pipeline: aggiungere un nuovo nemico

1. **Concept prima della pixel:** una frase di storytelling + il *gancio di silhouette*.
2. Definisci la **palette a 3 zone** (necrosi / livido / strappo) + 1 colore emissivo.
3. Disegna i **3 frame** parametrici su `ph` dentro `buildEntityTextures`, restando nei limiti del frame.
4. `generateTexture(key, fw*3, fh)` + `AF(key, fw, fh, 3)`.
5. Registra l'animazione: `walk(type, rate)`.
6. Aggiungi la riga in `ZOMBIE_STATS` (bilanciamento) e in `ZOMBIE_MOTION` (personalità).
7. Se serve un VFX, estendi `emitZombieFx` (fire-and-forget, throttellato).
8. Verifica nella **DebugScene** (galleria animata) a scala reale **e** ingrandita.
9. Aggiorna **questa scheda**.

---

## 8. Checklist di qualità (definition of done)

- [ ] Riconoscibile dalla **sola sagoma** a 30 px.
- [ ] Asimmetria presente (posa o anatomia).
- [ ] Palette a **≥3 zone** + 1 accento emissivo.
- [ ] Almeno **1 elemento di storytelling** (ferita, innesto, ruggine, abrasione...).
- [ ] **Movimento** distintivo (peso *oppure* agilità leggibile).
- [ ] Nessun **bleed** evidente tra i frame.
- [ ] Hitbox invariata / bilanciamento non alterato dagli effetti visivi.
- [ ] 60 fps con molti nemici a schermo.

---

## 9. Antipattern da evitare

- ❌ Zombi simmetrici, in piedi, statici.
- ❌ Colore-pelle uniforme senza chiazze.
- ❌ Dettaglio interno fitto invisibile a 30 px (spreco) al posto di una silhouette forte.
- ❌ Movimento uguale per tutti (stessa sinusoide) → sembrano tutti "molli".
- ❌ VFX persistenti per-zombi → cali di frame.
- ❌ Sforare i bordi del frame nello spritesheet → artefatti in animazione.

---

## 10. Scheda-template (nuovi nemici · boss · eventi)

Copia il blocco qui sotto per ogni nuovo nemico. I commenti spiegano **cosa fa ogni campo in fase di compilazione**: vanno letti, poi sostituiti con i valori reali (non lasciarli nel documento finale della scheda).

### 10.1 — Scheda Markdown (da incollare in §6)

```markdown
### 6.N NOME_IT — *"Soprannome"* · FWxFH · `scale S`
<!-- 6.N      → numero progressivo di sezione (es. 6.7) -->
<!-- NOME_IT  → nome leggibile in MAIUSCOLO; serve anche al validatore per ritrovare la scheda
                (aggiungilo alla mappa IT2KEY nello script di validazione). -->
<!-- Soprannome → il "nome da incubo" che porta lo storytelling (es. "Il Collo Rotto"). -->
<!-- FWxFH    → dimensioni del SINGOLO frame in px (lo spritesheet sarà FW*3 × FH).
                Deve coincidere ESATTAMENTE con AF('zombie_<chiave>', FW, FH, 3) nel codice. -->
<!-- scale S  → fattore di scala a schermo = ZOMBIE_STATS[<chiave>].scale. -->

**Concept:** ...
<!-- Una sola frase di storytelling ambientale: COME è morto / cosa lo rende inquietante.
     È il seme di tutto il resto (palette, ferite, posa). -->

**Palette:**
<!-- Elenca gli hex REALI usati nel codice, raggruppati per zona:
     carne necrotica (base/luce/ombra) · livor mortis · tessuto strappato/osso ·
     materiali (vestiti/metallo) · 1 colore EMISSIVO (occhi/bagliore = punto più luminoso). -->

**Silhouette:**
<!-- Il GANCIO unico: cosa rende la sagoma riconoscibile a 30 px (asimmetria, protesi,
     gobba, scudo, sacca...). Una frase. -->

**VFX:**
<!-- Cosa è COTTO nei frame (chiazze, vene, suture, ruggine) e cosa è DINAMICO
     (vapore/gocce/scintille/scia) emesso da emitZombieFx. -->

**Motion:**
<!-- La personalità tattile in parole: pesante o agile? tonfo? respiro? insegue?
     Deve riflettere i numeri di ZOMBIE_MOTION qui sotto. -->
```

### 10.2 — Costante di gioco (`ZOMBIE_STATS`)

```ts
// chiave: usata OVUNQUE → texture 'zombie_<chiave>', animazione 'walk_<chiave>'
<chiave>: {
  speed:  0,    // px/s orizzontali AGGIUNTIVI allo scroll della strada (più alto = più aggressivo)
  hp:     0,    // colpi base per ucciderlo (il danno proiettile varia per arma)
  scale:  1.0,  // scala a schermo della texture · DEVE coincidere con "scale S" nella scheda §6
  damage: 0,    // danno al veicolo all'impatto
  score:  0,    // punti dati alla morte
},
```

### 10.3 — Costante di movimento (`ZOMBIE_MOTION`)

```ts
// Ogni campo qui DEVE coincidere con la riga corrispondente nella tabella §5 della Art Bible.
<chiave>: {
  amp:     0.00,  // ampiezza del rollio in radianti (~0.09 = 5°). 0 = rigido.
  spd:     0.0,   // velocità dell'oscillazione (rad/s). Alto = passi/scatti rapidi.
  lean:    0.00,  // inclinazione COSTANTE in radianti. Negativo = piegato in avanti (corsa).
  pow:     1.0,   // forma d'onda: >1 = pesante (indugia agli estremi) · <1 = agile (frusta al centro).
  stomp:   0,     // ampiezza del tonfo verticale del passo (px). >0 solo per i pesanti.
  wob:     0,     // respiro/gonfiore: squash-stretch del volume (0..~0.06). >0 = "vivo/molle".
  home:    0,     // inseguimento verticale: velocità (px/s) con cui punta la Y del veicolo. 0 = va dritto.
  turn:    0,     // virata: 0..1 lerp per frame verso la rotta. Alto = scatta su di te · basso = deriva.
  fx:      false, // se true emette VFX procedurali (gestiti in emitZombieFx).
  fxEvery: 0,     // intervallo emissione VFX in ms · DEVE coincidere con la colonna "ogni" in §5.
                  //   (se fx:false → fxEvery:0 e "ogni" = "—" nella tabella)
},
```

### 10.4 — Riga tabella §5 (parametri di movimento)

```
| <chiave> | amp | spd | lean | pow | stomp | wob | home | turn | <fx-desc o —> | <fxEvery o —> |
```
<!-- I numeri devono essere IDENTICI a ZOMBIE_MOTION. Lo script di validazione confronta
     proprio questa riga col codice. "fx-desc" è descrittivo (es. "vapore"); il validatore
     controlla solo "ogni" (= fxEvery). -->

### 10.5 — Dopo aver compilato il template

1. Disegna i 3 frame in `buildEntityTextures` + `generateTexture` + `AF(...)`.
2. Registra l'animazione con `walk('<chiave>', frameRate)`.
3. Inserisci le righe in `ZOMBIE_STATS` e `ZOMBIE_MOTION`.
4. Per un VFX nuovo, estendi `emitZombieFx`.
5. Se la chiave è un nome italiano nuovo, aggiungi la coppia in `IT2KEY` dentro `scripts/validate-art-bible.mjs`.
6. **Esegui `npm run validate:art`** → deve passare senza disallineamenti.
7. Verifica visivamente nella `DebugScene`.

---

## 11. Anti-deriva (validazione automatica)

I numeri di questo documento **non devono mai divergere** dal codice. Uno script li confronta:

```bash
npm run validate:art
```

Controlla, per ogni nemico, che **dimensioni frame**, **scala** e **tutti i parametri di `ZOMBIE_MOTION`** scritti qui coincidano con `src/scenes/GameScene.ts`. È agganciato anche a `npm run build`: **se i valori divergono, la build fallisce.** Quando cambi un parametro, aggiorna *entrambi* (codice + scheda) e rilancia la validazione.

---

*Fine documento. Mantienilo allineato al codice: se cambi un hex, una posa o un parametro di movimento, aggiorna la scheda corrispondente — e fai girare `npm run validate:art`.*
