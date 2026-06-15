# 🛣️ Art Bible — Ambiente & Strada
### Zombie Road: Last Escape · Direzione Artistica (qualità AAA)

> **Stato:** v1.1 · vivo (living document) · **roadmap §13 implementata** in [`src/Environment.ts`](../src/Environment.ts)
> **Ambito:** la **strada**, le sue corsie, spallette e ciglio, lo **sfondo a strati** (cielo, skyline, decoratori) e l'**illuminazione** del mondo di gioco. Tutto ciò su cui corre il veicolo e sotto cui muoiono gli zombi.
> **Riferimento di stile:** survival-horror top-down ad alta densità (es. *Dead Nation*) — **strada notturna sporca e tattile**, mai un fondale piatto e muto.
> **Vincolo fondante:** grafica **100% procedurale** (Phaser 3 Graphics API → `generateTexture` / `TileSprite`). **Nessun PNG.**

Questo documento è la **fonte di verità** per chiunque (umano o AI) tocchi la strada o l'ambiente. Se modifichi una palette, una banda o un parametro di scorrimento, aggiorna anche la scheda qui.

> **Documento gemello:** [`ART_BIBLE_ZOMBIES.md`](./ART_BIBLE_ZOMBIES.md) copre i nemici. La sezione **⭐ Standard di Produzione AAA** di quel file vale per **tutto il titolo**: è la **stella polare** condivisa. Qui non la riscrivo — la **applico alla strada**.

---

## ⭐ Come la strada serve lo Standard AAA

I tre pilastri del titolo (coesione · game feel · rifinitura) tradotti sull'ambiente:

- **Coesione.** La strada usa la **stessa regola di luce** dei nemici e del veicolo: **alto-sinistra schiarisce, basso-destra in ombra**. La palette è desaturata e malata; gli unici colori vivi sono gli **accenti emissivi** (linee di corsia, bagliori d'ambiente), gli stessi 3 colori firma del titolo: **malato-verde · arancio-fuoco · rosso-sangue**.
- **Game feel.** La strada **reagisce**: ogni razzo lascia una **bruciatura**, ogni zombi ucciso sull'asfalto lascia una **pozza**, le esplosioni **illuminano** la carreggiata per 1–2 frame. La strada non è un wallpaper: è una superficie che **accumula la violenza** della corsa.
- **Rifinitura.** Niente bande piatte. L'asfalto ha **grana, crepe, rappezzi**; il ciglio ha **transizione** (rumble strip → ghiaia → terra), non un taglio netto. La differenza tra "prototipo" e "AAA" è qui.

> **Regola d'oro dell'ambiente:** *La strada è il secondo personaggio. Deve avere profondità (strati), superficie (materia), e memoria (decal). Se uno screenshot fermo sembra un fondale statico, è fuori firma.*

---

## 0. Mappa del codice (dove vive tutto)

| Cosa | Dove |
|---|---|
| **Sistema strada a strati** (asfalto, parallasse, ciglio, luce, fari, decal) | **`src/Environment.ts`** → classe `Environment` |
| Texture asfalto tileato + ciglio rumble | `Environment.buildAsphaltTexture` / `bakeRumble` |
| Parallasse decoratori `far`/`near` per i 7 ambienti | `Environment.drawFar` / `drawNear` |
| Gradiente cielo + foschia, luce carreggiata, cono fari | `Environment.buildObjects` |
| Texture decal (scorch/blood/skid/debris) | `Environment.buildDecalTextures` |
| Decal dinamici (pool, fire-and-forget) | `Environment.addDecal` + hook negli handler di `GameScene` |
| Avanzamento per-frame (scroll strati + decal + fari) | `Environment.update(dt, vx, vy)` ← da `GameScene.update()` |
| Mondo base (fasce, spallette, strisce) + aggancio `Environment` | `src/scenes/GameScene.ts` → `buildWorld()` |
| Decoratori statici **legacy** (superati dal parallasse, non più chiamati) | `drawDecorators(g, idx)` |
| Scorrimento strisce di corsia | `updateStripes(dt)` |
| Palette per ambiente | `ENVIRONMENTS` (interfaccia `EnvConfig`) |
| Geometria del mondo | costanti `ROAD_TOP=155`, `ROAD_BOTTOM=445`, `ROAD_CENTER=300`, `W=800`, `H=600` |
| Velocità di scorrimento del mondo | `SCROLL_SPEED = 240` (px/s) |
| Geometria strisce | `STRIPE_W=48`, `STRIPE_GAP=82` |
| Overlay filmico (vignetta + grana + scanline + aberrazione), flash, bloom, fari-burst, transizioni | `src/Juice.ts` |
| Helper colore (schiarisci/scurisci/mescola) | `static mixColor()` · `Environment.mix()` |
| Galleria di test | `src/scenes/DebugScene.ts` |

**Geometria di riferimento (non spostare senza motivo — il gameplay ci dipende):**
```
y=0    ┌─────────────────────────────┐  ← cielo (0 → ROAD_TOP)
       │   skyline / decoratori       │
y=155  ├═════════════════════════════┤  ← ROAD_TOP   (linea + spalletta sup.)
       │                              │
y=300  │   ░░░  CARREGGIATA  ░░░      │  ← ROAD_CENTER (corsie + strisce)
       │                              │
y=445  ├═════════════════════════════┤  ← ROAD_BOTTOM (linea + spalletta inf.)
       │   terreno / decoratori       │
y=600  └─────────────────────────────┘  ← ground (ROAD_BOTTOM → H)
```
> Carreggiata = **290 px** di altezza (155→445). Zona di gioco verticale degli zombi e del veicolo. Tutto il resto è cornice e profondità.

---

## 1. I tre strati di lettura

Come per i nemici (silhouette → movimento → texture), la strada ha un suo ordine di priorità. **Se devi tagliare, taglia dal fondo.**

1. **PROFONDITÀ** — lo sguardo deve leggere *dove sono i bordi giocabili* in 1 frame: cielo lontano, carreggiata scura al centro, terreno vicino. La **gerarchia di valori** (cielo medio → asfalto scuro → ciglio) crea il "palcoscenico" su cui gli zombi staccano.
2. **MATERIA** — l'asfalto deve sembrare *asfalto*: mai un colore uniforme. Grana, crepe, rappezzi e macchie raccontano una strada *vissuta e abbandonata*.
3. **MEMORIA** — la strada *ricorda* lo scontro: bruciature, sangue, detriti, segni di frenata. È l'ultimo 20%, ma è ciò che vende il "game feel".

> **Mai** una carreggiata a tinta unita, statica, senza reazione. Mai.

---

## 2. Vincoli tecnici (non negoziabili)

- **Solo primitive + TileSprite:** `fillRect`, `fillRoundedRect`, `fillEllipse`, `fillCircle`, `fillTriangle`, `lineBetween`, `fillGradientStyle`, `Phaser.GameObjects.TileSprite`. Niente shader, niente blur per-pixel.
- **Texture-once, scroll-cheap.** L'asfalto è una **texture bakeata una sola volta** (`generateTexture`) e mostrata come **`TileSprite`** che scorre muovendo `tilePositionX`. **Mai** ridisegnare la strada ogni frame. La texture deve **tilare in orizzontale senza giunta** (continuità ai bordi).
- **Profondità = strati che scorrono a velocità diverse** (parallasse). Ogni strato è 1 oggetto (TileSprite o graphics duplicato in loop), non N oggetti per frame.
- **Decal = fire-and-forget, in pool, con cap.** I segni sull'asfalto si auto-distruggono via tween e **scorrono con la strada** (stessa `SCROLL_SPEED`). **Mai** un decal persistente non riciclato. Budget rigido (vedi §7).
- **Cosmetico ≠ gameplay.** Profondità, parallasse, decal e luci **non toccano** hitbox, fisica o bilanciamento. Il mondo "vivo" è **solo visivo**. Le costanti `ROAD_TOP/BOTTOM/CENTER` restano la verità per la fisica.
- **Depth ordering esplicito** (`setDepth`): cielo/decoratori `< 0..1`, carreggiata `1`, strisce `1`, decal `2`, veicolo/zombi `9..10`, HUD/overlay `18+`, flash `40`. La luce della carreggiata sta **sotto** le entità; l'overlay filmico **sopra** tutto.
- **Performance budget:** decine di nemici + strada animata a **60 fps**. La strada è "sempre accesa" → deve essere quasi gratis. Niente emitter persistenti; niente gradient ridisegnati per frame (bakeali in texture).

---

## 3. La strada come **sistema a strati** (lo stack)

Dal più lontano/lento al più vicino/veloce. Questo è il cuore della profondità AAA.

| # | Strato | Contenuto | Scroll | Depth | Stato |
|---|---|---|---|---|---|
| L0 | **Cielo** | gradiente verticale `skyColor` → orizzonte + foschia | 0 (fermo) | 0.1 | ✅ gradiente |
| L1 | **Skyline lontana** (`far`) | edifici/alberi/dune/ciminiere per ambiente | **0.22×** | 0.2 | ✅ scorre |
| L2 | **Decoratori medi** | *fusi nel layer `far`* (non un layer separato) | 0.22× | 0.2 | ◐ fusi in L1 |
| L3 | **Ciglio** | linea viva + rumble strip + ghiaia | 1.0× (cotto nell'asfalto) | 0.5 | ✅ bakeato |
| **L4** | **Carreggiata (asfalto)** | texture tileata: grana + crepe + rappezzi + macchie | **1.0×** | 0.5 | ✅ tileata |
| L4b | **Corsie / mezzeria** | strisce in `lineColor`, consumate, dash mancanti | 1.0× | 1 | ✅ ambientate |
| L5 | **Terreno vicino** (`near`) | macerie/tubi/sacchi/sottobosco per ambiente | **0.55×** | 0.3 | ✅ scorre |
| L5b | **Spallette esterne** | 2 barre `shoulderColor` (3ª fascia del ciglio) | 0 (ferme) | 0 | ◐ statiche |
| L6 | **Decal dinamici** | bruciature, sangue, frenate, detriti | 1.0× | 1.8 | ✅ in pool |
| L7 | **Luce carreggiata + fari** | gradiente di luce + cono fari additivo | fisso / segue il veicolo | 2 / 2.6 | ✅ attivo |
| L8 | **Overlay filmico** | vignetta + grana + scanline + aberrazione | fisso | 18+ | ✅ in `Juice.ts` |

> **Principio:** più uno strato è **vicino** (in basso, verso il giocatore) più scorre **veloce**; più è **lontano** (in alto, verso l'orizzonte) più scorre **lento**. È così che 2D piatto comunica profondità 3D senza prospettiva vera.
>
> **3 velocità distinte** oggi: `far` **0.22×** · `near` **0.55×** · carreggiata/corsie **1.0×** (soddisfa il "≥3 strati a velocità diverse" della DoD).

---

## 4. Anatomia della carreggiata (la superficie)

La carreggiata è una **texture orizzontale tileabile** (es. `road_asphalt`, ~`256 × 290`) bakeata in `buildWorld()` e resa come `TileSprite` largo `W`. Composta, dal basso verso l'alto della pila di disegno:

1. **Base** — riempimento pieno `env.roadColor`.
2. **Grana tonale (mottling)** — *l'antidoto al colore piatto.* 60–120 micro-macchie a **bassa alpha** (`fillEllipse`/`fillRect` 2–6 px), metà schiarite `mixColor(roadColor, 0xffffff, 0.06)` metà scurite `mixColor(roadColor, 0x000000, 0.18)`. È ciò che rende l'asfalto "ruvido" a colpo d'occhio.
3. **Crepe** — 4–8 **polilinee** (`lineBetween`) sottili in `crackColor` (≈ `mixColor(roadColor, 0x000000, 0.4)`), con 1–2 **ramificazioni** per crepa. Spezzate, mai rette.
4. **Rappezzi** (toppe di catrame) — 2–3 `fillRoundedRect` di tono leggermente diverso (`patchColor`), bordo più scuro: la strada è stata "riparata male".
5. **Macchie d'olio / umido** — 2–3 `fillEllipse` molto scuri a bassa alpha: pozze scure che catturano l'(unica) luce.
6. **Detriti cotti** — pochissimi puntini chiari (ghiaia) sparsi.

> **Seamless obbligatorio:** qualunque elemento sfori il bordo destro della texture **deve** ricomparire a sinistra (oppure stare a ≥4 px dai bordi). Una giunta visibile che scorre è l'artefatto #1 da evitare.

### 4.1 Corsie e mezzeria (L4b) — ✅ fatto
- **Implementato** (in `buildWorld()`): strisce in **`env.lineColor`**, alpha variabile `0.20–0.36` per segmento, ~1 dash su 6 quasi assente (alpha `0.06`) → strada abbandonata. Scroll via `updateStripes()`.
- **Ancora aperto:** doppia linea continua di corsia (oggi c'è solo la **linea di bordo** viva, cotta nell'asfalto).

### 4.2 Ciglio e spallette (L3 / L5) — ✅ fatto (parziale)
- **Implementato** (`bakeRumble`, cotto nei bordi della texture asfalto → **scorre con la strada**): **transizione a 3 fasce**:
  1. **Linea di bordo viva** (`lineColor`, consumata).
  2. **Rumble strip** — trattini chiaro/scuro alternati (periodo 16 px → tile).
  3. **Ghiaia** — fascia di mottling fine.
- **3ª fascia esterna:** le 2 barre `shoulderColor` fanno da stacco verso il terreno, ma oggi sono **statiche** (non scorrono). Aperto: farle scorrere o cuocerle nel layer `near`.

---

## 5. Profondità & parallasse (L0–L5)

> **✅ Risolto** in `src/Environment.ts`: i decoratori sono ora **2 layer `TileSprite`** (`far` skyline + `near` terreno) che scorrono a frazioni di `SCROLL_SPEED` muovendo `tilePositionX`. Il vecchio `drawDecorators()` (statico) **non è più chiamato**. Le silhouette sono ridisegnate **tileabili** (pattern a periodo che divide la larghezza-base `PW=480`) in `drawFar`/`drawNear` per tutti i 7 ambienti.

**Tecnica usata — A (TileSprite):** bake della banda in texture (`env_far_<idx>`, `env_near_<idx>`), poi `tilePositionX += SCROLL_SPEED * fattore * dt` in `Environment.update()`.

**Fattori di parallasse implementati** (× `SCROLL_SPEED`):

| Strato | Fattore (impl.) | Sensazione |
|---|---|---|
| Cielo (L0) | 0.00 | fermo, infinito |
| Skyline `far` (L1, ingloba L2) | **0.22** | orizzonte che deriva |
| **Carreggiata + corsie (L4/L4b)** | **1.00** | la verità del movimento |
| Terreno `near` (L5) | **0.55** | il più vicino, "sfreccia" |

> **Regola:** mai due strati alla **stessa** velocità se sono a profondità diverse — il parallasse vive *nella differenza*. E mai uno strato lontano più veloce di uno vicino (rompe l'illusione).
>
> **Aperto:** un 3° layer intermedio (L2 "medi") separato e un `near` ancora più vicino (>1.0×) darebbero ancora più profondità. Oggi 2 layer + carreggiata = 3 velocità, sufficiente per la DoD.

---

## 6. Illuminazione del mondo (L7 + overlay)

La regola di luce **alto-sinistra** vale anche qui. Obiettivo: **nessuna zona piatta non illuminata** (Definition of Done del titolo).

1. **Gradiente cielo** (L0) — ✅ `fillGradientStyle` verticale in `buildObjects`: alto più scuro (`mix(skyColor, 0x000000, 0.3)`) → orizzonte virato verso `hazeColor` + banda di foschia. Bakeato, fermo.
2. **Luce di carreggiata** (L7) — ✅ overlay graphics (depth 2, **sotto** le entità): bordi alto/basso della carreggiata scuriti via gradiente, centro lasciato leggibile. Bakeato una volta, non per-frame.
3. **Cono dei fari** (L7) — ✅ texture `env_headlight` (alone additivo accumulato a ellissi, non un singolo `fillTriangle`), tinta calda `0xffeebb` alpha `0.5`, `BlendMode.ADD`, origine al veicolo, **segue** `vehicle.x/y` ogni frame. *Aperto:* oggi è sempre acceso (anche in Deserto); si potrebbe gateare per luminosità d'ambiente.
4. **Accento emissivo d'ambiente** — ✅ campo **`emissive`** valorizzato per i 7 ambienti (default = `lineColor`). Usato per i bagliori/pozze (es. neon viola in Città Finale). Uno solo per ambiente.
5. **Reazione di luce agli eventi** — ✅ `Juice.lightFlash()`/`flash()`/`bloomBurst()` su razzi ed esplosioni; la strada **riceve** il lampo (gli overlay non la coprono).
6. **Overlay filmico** (L8) — ✅ `Juice.addOverlay()`: vignetta + grana animata (`jitterGrain`) + **scanline CRT** (`fx_scanline`, alpha `0.06`) + **aberrazione cromatica** ai bordi. Grana ≤ `0.05` alpha.

---

## 7. Sistema di **decal** dinamici (L6) — la memoria della strada · ✅ fatto

I segni che lo scontro lascia sull'asfalto. **Scorrono con la strada** (`x -= SCROLL_SPEED * dt` in `Environment.update`) e si auto-distruggono a sinistra (`x < -70`) o a fine tween. API: `Environment.addDecal(type, x, y)` — ignora se `y` è fuori carreggiata.

| Decal (`type`) | Evento (hook in `GameScene`) | Texture (`buildDecalTextures`) | Vita |
|---|---|---|---|
| `scorch` **Bruciatura** | esplosione razzo (`onRocketHitZombie`/`Boss`) | `env_scorch`: cerchi neri accumulati + anello bruno | ~4.2 s |
| `blood` **Pozza di sangue** | zombi ucciso (`onBulletHitZombie`, `onVehicleHitZombie`) | `env_blood`: ellisse `#4a0e0a` + 7 schizzi | ~3.2 s |
| `skid` **Frenata** | impatto runner/corazzato/gigante | `env_skid`: 2 strisce scure parallele | ~2.6 s |
| `debris` **Detriti** | impatto corazzato/gigante | `env_debris`: 9 micro-`fillRect` grigi | ~2.2 s |

**Regole di budget (rispettate):**
- **Pool condiviso**, cap a **`DECAL_CAP = 24`** vivi. Oltre il cap → distrugge il più vecchio (`shift`).
- **Fire-and-forget:** ogni decal è un singolo `Image` con un solo tween (`alpha → 0`). Nessun emitter persistente.
- **Throttle:** pozze di sangue ≥ **`BLOOD_THROTTLE = 110` ms** l'una dall'altra, anche con uccisioni multiple.
- **Depth = 1.8**: sopra l'asfalto e le strisce, **sotto** veicolo e zombi (depth 9–10). Mai una minaccia nascosta da un decal.

> Coerenza con i nemici: i 3 colori firma valgono anche qui. Il sangue è **rosso-sangue**, il fuoco **arancio-fuoco**, le pozze tossiche del Tossico (alla sua morte) sono **malato-verde** — lo stesso `#6cff3a` di `emitZombieFx`.

---

## 8. Palette per ambiente (`ENVIRONMENTS`)

I 7 ambienti hanno ciascuno i 6 colori base + `grade`/`gradeAlpha` (viraggio del mood, MULTIPLY) + i nuovi `emissive`/`hazeColor`. Le tabelle sotto riportano i **valori reali nel codice** (`EnvConfig`).

### 8.1 Valori attuali (verità del codice — tenere in sync)

| Idx | Ambiente | bg | sky | ground | road | line | shoulder |
|---|---|---|---|---|---|---|---|
| 0 | Città Distrutta | `0x12121e` | `0x16161e` | `0x1a1610` | `0x2a2a2a` | `0xddcc00` | `0x1e1e22` |
| 1 | Autostrada Abbandonata | `0x14120e` | `0x1c180e` | `0x141208` | `0x323028` | `0xaaaa44` | `0x201e16` |
| 2 | Deserto | `0x1e1006` | `0x2e1a08` | `0x1e1408` | `0x4a3a1a` | `0xddaa00` | `0x2a2010` |
| 3 | Foresta Infestata | `0x040c04` | `0x040c04` | `0x020802` | `0x141c10` | `0x66cc22` | `0x0a100a` |
| 4 | Zona Industriale | `0x0e0a08` | `0x120e0a` | `0x0c0806` | `0x1c1a18` | `0xff6600` | `0x181410` |
| 5 | Base Militare | `0x080e06` | `0x0c1008` | `0x080e06` | `0x202818` | `0x88bb44` | `0x101608` |
| 6 | Città Finale | `0x0c0612` | `0x100618` | `0x0c0612` | `0x180c22` | `0xcc44ff` | `0x140a1a` |

### 8.1b Mood & materia (verità del codice — tenere in sync)

| Idx | Ambiente | grade | gradeAlpha | emissive | hazeColor |
|---|---|---|---|---|---|
| 0 | Città Distrutta | `0x8fa6c8` | `0.42` | `0xffcc33` | `0x2a2a3a` |
| 1 | Autostrada Abbandonata | `0xc8bc86` | `0.40` | `0xccbb55` | `0x33301f` |
| 2 | Deserto | `0xffba60` | `0.48` | `0xffb24a` | `0x4a2c12` |
| 3 | Foresta Infestata | `0x74c084` | `0.46` | `0x6cff3a` | `0x0c2410` |
| 4 | Zona Industriale | `0xc89a5a` | `0.44` | `0xff7722` | `0x2a1810` |
| 5 | Base Militare | `0x9ab074` | `0.42` | `0x99cc55` | `0x162012` |
| 6 | Città Finale | `0xb074d8` | `0.48` | `0xcc44ff` | `0x240a36` |

### 8.2 `EnvConfig` (implementata)

```ts
interface EnvConfig {
  name: string;
  bgColor: number; skyColor: number; groundColor: number;
  roadColor: number; lineColor: number; shoulderColor: number;
  grade: number; gradeAlpha: number;  // viraggio cromatico (MULTIPLY) per il mood
  // ── materia + luce della strada (opzionali; default derivati via mix in Environment) ──
  crackColor?: number;  // crepe asfalto  (default: mix(roadColor, 0x000000, 0.40))
  patchColor?: number;  // toppe/rappezzi (default: mix(roadColor, groundColor, 0.5))
  emissive?:  number;   // 1 accento saturo a terra (pozze/bagliori). Default = lineColor
  hazeColor?: number;   // foschia all'orizzonte (gradiente cielo). Default = mix(sky, ground)
}
```
> `crackColor`/`patchColor` non sono ancora valorizzati per ambiente (usano i default `mix`); `emissive`/`hazeColor` sì (§8.1b). I campi opzionali si attivano **senza rompere** i 7 ambienti.

---

## 9. Schede dei 7 ambienti

> Ogni scheda: **Mood** · **Asfalto** (la firma della superficie) · **Profondità** (cosa scorre, da `Environment.drawFar`/`drawNear`) · **Luce/Emissivo** (l'unico accento).

### 9.0 CITTÀ DISTRUTTA — *"Il primo silenzio"*
**Mood:** cemento freddo blu-grigio, città appena caduta. `road #2a2a2a` (il più neutro).
**Asfalto:** crepe nette e diffuse (terremoto/abbandono), qualche rappezzo, vetri sparsi cotti. Linee gialle `#ddcc00` molto consumate.
**Profondità:** palazzi con finestre spente (`0x0e0e22`), macerie a terra. Skyline che deriva lenta.
**Luce/Emissivo:** giallo sporco delle linee; rare finestre fioche. Notte urbana, fari del veicolo protagonisti.

### 9.1 AUTOSTRADA ABBANDONATA — *"La fuga di tutti"*
**Mood:** asfalto caldo-bruno `#323028`, polvere. La strada per eccellenza.
**Asfalto:** la più "stradale" — doppia linea consumata `#aaaa44`, lunghe crepe longitudinali, segni di frenata cotti (qualcuno *non ce l'ha fatta*).
**Profondità:** **guardrail** (già presente) come ciglio scorrevole, alberi morti, orizzonte basso.
**Luce/Emissivo:** giallo-oliva tenue. Il guardrail metallico prende la luce alto-sinistra.

### 9.2 DESERTO — *"Il forno"*
**Mood:** ocra `#4a3a1a`, sabbia che invade l'asfalto. L'unico ambiente "chiaro".
**Asfalto:** **sabbia che mangia i bordi** (mottling ocra che invade la carreggiata dal ciglio), crepe da calore, linee `#ddaa00` quasi cancellate.
**Profondità:** dune sinusoidali (già procedurali), cactus. Foschia di calore sull'orizzonte (`hazeColor`).
**Luce/Emissivo:** ambra. Contrasto alto, ombre lunghe.

### 9.3 FORESTA INFESTATA — *"Il verde che mangia"*
**Mood:** verde quasi-nero `#141c10`, umido, claustrofobico. L'ambiente più scuro.
**Asfalto:** **muschio e radici** che spaccano l'asfalto (chiazze `#66cc22` desaturate), pozze scure, foglie cotte. Linee verdi `#66cc22` come unica guida.
**Profondità:** alberi a triangolo fitti (già procedurali), sottobosco. Parallasse forte = senso di "tunnel" vegetale.
**Luce/Emissivo:** **spore/funghi bioluminescenti verdi** — accento malato-verde (colore firma). Pochissima luce ambiente: i fari contano molto.

### 9.4 ZONA INDUSTRIALE — *"La ruggine viva"*
**Mood:** grigio-ferro quasi nero `#1c1a18`, oleoso. Metallo ovunque.
**Asfalto:** **macchie d'olio** grandi e lucide, chiazze di ruggine, tombini, linee **arancio acceso `#ff6600`** (sicurezza industriale) — accento arancio-fuoco.
**Profondità:** ciminiere con fumo, fabbrica, tubi a terra (già procedurali). Bagliori arancio di forni lontani.
**Luce/Emissivo:** **arancio-fuoco** da pozze e tubi incandescenti. L'ambiente più "caldo e tossico".

### 9.5 BASE MILITARE — *"L'ultimo avamposto"*
**Mood:** verde-oliva spento `#202818`, ordine in rovina. Cemento militare.
**Asfalto:** **stencil militari sbiaditi** (frecce, numeri, zone tratteggiate), segni di cingoli, linee `#88bb44`. Più "disegnata" delle altre.
**Profondità:** torrette di guardia, recinzione (rumble-ready), sacchi di sabbia (già procedurali).
**Luce/Emissivo:** verde-oliva con rari **fari di sicurezza** (puntini caldi). Tensione, non orrore puro.

### 9.6 CITTÀ FINALE — *"L'apoteosi viola"*
**Mood:** viola profondo `#180c22`, neon sopravvissuti, finale drammatico. Il climax.
**Asfalto:** **riflessi neon viola/rosa** sull'asfalto bagnato (pozze emissive `#cc44ff`), linee viola `#cc44ff` — accento firma del livello finale.
**Profondità:** grattacieli con finestre illuminate viola/rosa (già random, `0x4a1a6a`), pavimento drammatico. Parallasse ricco.
**Luce/Emissivo:** **viola al neon** come unica luce viva — il più "cinematografico". Qui l'illuminazione AAA deve brillare (è la mission finale).

---

## 10. Pipeline: implementare / aggiungere un ambiente

1. **Mood prima del pixel:** una frase + il colore-firma `road`/`emissive`.
2. Aggiungi la riga in **`ENVIRONMENTS`** (6 base + `grade`/`gradeAlpha` + opzionali `emissive`/`hazeColor`).
3. **Decoratori:** aggiungi un `case <idx>` in **`Environment.drawFar`** (skyline lontana) e **`drawNear`** (terreno vicino), con pattern **tileabili** (periodo che divide `PW=480`, niente `Math.random` sui bordi).
4. Asfalto, ciglio, gradiente cielo, luce di carreggiata, fari e decal sono **già generici**: si adattano da soli alla palette (nessun codice nuovo).
5. Verifica in **DebugScene**/gioco: a velocità reale (parallasse + giunta?) e fermo (asfalto non piatto?).
6. Aggiorna **questa scheda** (§8.1 / §8.1b / §9) e mantieni gli hex in sync col codice.

---

## 11. Checklist di qualità (Definition of Done — ambiente)

- [x] **Profondità:** 3 velocità di parallasse diverse (`far` 0.22 · `near` 0.55 · carreggiata 1.0).
- [x] **Asfalto non piatto:** grana + crepe ramificate + rappezzi + macchie d'olio (elementi entro i margini → giunta minimizzata).
- [x] **Ciglio rifinito:** linea viva + rumble + ghiaia cotti nell'asfalto (3ª fascia = spallette, statiche).
- [x] **Corsie ambientate:** strisce in `lineColor`, consumate, ~1 dash su 6 mancante.
- [x] **Luce coerente:** gradiente cielo + luce di carreggiata + cono fari attivo.
- [x] **1 accento emissivo** per ambiente (`emissive`), coerente coi 3 colori firma.
- [x] **Memoria:** decal `scorch`/`blood`/`skid`/`debris` in pool (cap 24), sotto le entità.
- [x] **Leggibilità:** decal (1.8) e luce (2) **sotto** veicolo/zombi (9–10) → minacce sempre leggibili.
- [ ] **60 fps** con massima densità: **da profilare** (texture bakeate una volta, ma verifica a schermo pieno).
- [x] **Cosmetico ≠ fisica:** `ROAD_TOP/BOTTOM/CENTER` e le hitbox invariati (`tsc` + `validate:art` verdi).

---

## 12. Antipattern da evitare

- ❌ **Carreggiata a tinta unita** (`fillRect` singolo) → l'errore #1, sembra prototipo.
- ❌ **Mondo incollato:** decoratori statici mentre la strada scorre → "tapis roulant" senza profondità.
- ❌ **Strati alla stessa velocità** a profondità diverse → parallasse morto.
- ❌ **Giunta visibile** che scorre nella texture tileata → artefatto ipnotico.
- ❌ **Gradient o crepe ridisegnati ogni frame** → cali di fps. Bakeali in texture.
- ❌ **Decal persistenti / non riciclati** → memory leak visivo e cali di frame.
- ❌ **Strisce bianche `0xffffff` fisse** ignorando `lineColor` → incoerenza d'ambiente.
- ❌ **Luce/decal che coprono le minacce** → muore la leggibilità (vince sempre "leggibile").
- ❌ **Tagli netti** asfalto→ciglio→sfondo → la firma "indie", non "AAA".

---

## 13. Stato implementazione & roadmap

> Onestà sul gap (come la roadmap del documento gemello).

**✅ Implementato** (`src/Environment.ts` + hook in `GameScene` / `Juice`):
1. **Parallasse decoratori** `far`/`near` — 2 layer tileabili, 7 ambienti (§5).
2. **Texture asfalto tileata** — grana + crepe + rappezzi + macchie (§4).
3. **Decal dinamici** — `scorch`/`blood`/`skid`/`debris` in pool (§7).
4. **Ciglio rumble + corsie ambientate** (§4.1/4.2).
5. **Luce carreggiata + cono fari** (§6).
6. **Gradiente cielo + foschia** (§6).
7. **Estensione `EnvConfig`** — `emissive`/`hazeColor` valorizzati; `crack`/`patch` a default (§8).
8. **Scanline + aberrazione cromatica** nell'overlay filmico `Juice` (§6).
> Verificato: `npx tsc --noEmit` pulito · `npm run validate:art` verde · base preesistente (`grade`, `Juice.flash/bloomBurst/lightFlash`, transizioni di scena) integrata, non sostituita.

**Aperto (rifinitura futura):**
- 3° layer parallasse intermedio (L2) separato + un `near` ancora più vicino (>1.0×) per più profondità.
- Spallette esterne (L5b) ancora **statiche**: cuocerle nel layer `near` o farle scorrere.
- Cono fari **sempre acceso** anche in ambienti chiari: gateare per luminosità d'ambiente.
- `crackColor`/`patchColor` **per-ambiente** (oggi default `mix`).
- **Profiling 60 fps** a densità massima.
- **Tuning artistico** delle silhouette tileabili (alcune più ripetitive delle versioni statiche legacy).
- Rimuovere il metodo `drawDecorators()` ormai morto in `GameScene` (oggi solo un *Hint* del compilatore).

---

## 14. Anti-deriva (validazione)

I colori e i numeri di questo documento **non devono divergere** dal codice. Oggi `npm run validate:art` (vedi `scripts/validate-art-bible.mjs`) copre i **nemici**.

> **Roadmap di validazione:** estendere lo script per confrontare **§8.1 + §8.1b** con `ENVIRONMENTS` in `GameScene.ts` (name + tutti gli hex/alpha per ambiente) e i fattori di parallasse §5 con `Environment.update`. Finché non c'è, **la sincronia è manuale**: se cambi un colore in `ENVIRONMENTS`, aggiorna §8.1/§8.1b; se cambi un fattore di parallasse o `SCROLL_SPEED`/`STRIPE_*`, aggiorna §0/§3/§5.

---

*Fine documento. Mantienilo allineato al codice: se cambi una palette d'ambiente, un fattore di parallasse o un parametro di scorrimento, aggiorna la scheda corrispondente — e tieni d'occhio `npm run validate:art`.*
