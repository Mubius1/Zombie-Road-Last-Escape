# 🚗 Art Bible — Oggetti & Equipaggiamento
### Zombie Road: Last Escape · Direzione Artistica (qualità AAA)

> **Stato:** v1.0 · vivo (living document)
> **Ambito:** tutti gli **oggetti** non-nemico e non-ambiente: il **veicolo** del giocatore (7 varianti) e i suoi **componenti**, le **armi** e i loro **proiettili** (proiettile, razzo, fiamma, muzzle-flash), i **pickup** (tanica di carburante), gli **oggetti-effetto** (scintilla, nube tossica) e i token dei **sopravvissuti**.
> **Riferimento di stile:** survival-horror top-down ad alta densità (es. *Dead Nation*) — **metallo sporco e tattile**, proiettili che "pesano", pickup leggibili a colpo d'occhio nel caos.
> **Vincolo fondante:** grafica **100% procedurale** (Phaser 3 Graphics API → `generateTexture`). **Nessun PNG.**

Questo documento è la **fonte di verità** per chiunque (umano o AI) tocchi un oggetto di gioco. Se modifichi un veicolo, un'arma o un pickup, aggiorna anche la sua scheda qui.

> **Documenti gemelli:**
> - [`ART_BIBLE_ZOMBIES.md`](./ART_BIBLE_ZOMBIES.md) — i nemici. Contiene la sezione **⭐ Standard di Produzione AAA**, che vale per **tutto il titolo**: è la **stella polare** condivisa. Qui **non la riscrivo** — la **applico agli oggetti**.
> - [`ART_BIBLE_AMBIENTE.md`](./ART_BIBLE_AMBIENTE.md) — la strada e lo sfondo.
>
> I tre documenti coprono i tre "personaggi" della scena: **nemici** · **mondo** · **oggetti del giocatore**. Stessa mano, stessa luce, stessa palette firma.

---

## ⭐ Come gli oggetti servono lo Standard AAA

I tre pilastri del titolo (coesione · game feel · rifinitura) tradotti sugli oggetti:

- **Coesione.** Veicoli, armi e pickup usano la **stessa regola di luce** dei nemici e della strada: **alto-sinistra schiarisce, basso-destra in ombra**, più un'**ombra a terra** coerente (ellisse scura). Lo stesso **kit metallo** (acciaio desaturato) lega visivamente la torretta del veicolo, la testata del razzo e il beccuccio della tanica. Gli unici colori vivi sono gli **accenti emissivi**, gli stessi 3 colori firma del titolo: **malato-verde · arancio-fuoco · rosso-sangue**.
- **Game feel.** *Ogni* oggetto che parte o colpisce ha la sua risposta multisensoriale: il proiettile ha **muzzle-flash** allo sparo, il razzo lascia **scorch** sull'asfalto ed **esplode con luce**, la tanica raccolta dà feedback. Niente oggetto "muto".
- **Rifinitura.** Niente rettangolo grigio per "l'auto" o pallino giallo per "il proiettile". Ogni oggetto ha **≥3 toni**, un **gancio di silhouette**, un'**etichetta o dettaglio narrativo** (la fiamma sul razzo, l'etichetta di pericolo sulla tanica). La differenza tra "prototipo" e "AAA" è qui.

> **Regola d'oro degli oggetti:** *Il ruolo prima della bellezza. In 1 frame, nel pieno del caos, il giocatore deve sapere cosa raccogliere, cosa lo sta colpendo e cos'è suo. Se "bello" e "leggibile come ruolo" sono in conflitto, vince **leggibile**.*

---

## 0. Mappa del codice (dove vive tutto)

| Cosa | Dove |
|---|---|
| **Texture veicolo** (7 varianti, 100×44) | `src/VehicleTextures.ts` → `buildVehicleTexture()` |
| Istanza veicolo + fisica + hitbox | `GameScene.buildVehicle()` |
| **Componenti danneggiabili** (motore/ruote/serbatoio/torretta/corazza) | `this.components`, `ComponentData`, `damageComponent()` |
| Punti di aggancio zombi sul veicolo | `ATTACH_SLOTS` |
| **Texture oggetti** (proiettile, tanica, scintilla, razzo, nube tossica) | `src/EntityTextures.ts` → `buildEntityTextures()` (sezione finale) |
| Dati armi (cooldown, danno, velocità, colore, range) | `src/GameData.ts` → `WEAPONS`, `WEAPON_KEYS`, `WeaponType` |
| Sparo / scelta proiettile per arma | `GameScene.fireWeapon()`, `spawnBullet()`, `spawnRocket()` |
| Muzzle-flash + bloom + luce esplosione | `src/Juice.ts` → `muzzleFlash()`, `bloomBurst()`, `lightFlash()` |
| Dati veicoli (prezzo, colore, bonus) | `src/GameData.ts` → `VEHICLES`, `VEHICLE_KEYS`, `VehicleData` |
| Dati sopravvissuti (nome proprio, abilità, colore) | `src/GameData.ts` → `SURVIVORS`, `SurvivorData` (`properName`) |
| Ritratti sopravvissuti (texture procedurali) | `src/EntityTextures.ts` → `buildSurvivorTextures()` |
| Spawn tanica (intervallo, esploratore) | `GameScene.spawnFuelCan()` + timer in `create()` |
| Effetti dei sopravvissuti (riparazioni, torretta auto) | `GameScene.updateSurvivorEffects()` |
| Galleria di test (veicoli a scala reale) | `src/scenes/DebugScene.ts` → `drawVehicles()` |
| Vetrina armi/veicoli nel negozio | `src/scenes/ShopScene.ts` |

**Chiavi texture:** `vehicle_<chiave>` (es. `vehicle_civilian_car`), `bullet`, `rocket`, `fuel_can`, `particle`, `toxic_cloud`, `hazard_wreck`, `hazard_oil`, `hazard_mine`, `survivor_<chiave>` (ritratti: `survivor_mechanic/medic/soldier/explorer`).
**Chiavi VFX condivise** (in `Juice.ts`): `fx_light` (alone additivo per muzzle/bloom/luce).

---

## 1. I tre livelli di lettura (per gli oggetti)

A risoluzione di gioco un proiettile è alto **5 px** e vola, un pickup è **22×26 px** in un campo pieno di nemici. La leggibilità vive in quest'ordine:

1. **RUOLO** — in 1 frame deve dire *cosa fa per me*: lo **raccolgo** (pickup), mi **colpisce** (proiettile nemico), è **mio** (proiettile/veicolo). Il **codice colore di fazione** (§3.1) è la prima linea di lettura, prima ancora della forma.
2. **SILHOUETTE IN MOVIMENTO** — proiettili e razzi si leggono *mentre volano*: forma allungata + scia/coda direzionale = "questo si muove e in quella direzione". Il veicolo si riconosce dalla **sagoma laterale** (berlina vs camion a 6 ruote) anche piccolo.
3. **MATERIA & STORIA** — usura, rivetti, etichette di pericolo, bagliori emissivi: aggiungono *premium* e racconto, ma sono l'ultimo 20%.

> **Regola d'oro:** *Colore di fazione corretto + silhouette di ruolo inequivocabile + 1 accento emissivo + 1 dettaglio di materia.*

**Mai** un oggetto rappresentato da una primitiva nuda (cerchio/rettangolo a tinta unita). Mai.

---

## 2. Vincoli tecnici (non negoziabili)

- **Solo primitive:** `fillRect`, `fillRoundedRect`, `fillEllipse`, `fillCircle`, `fillTriangle`, `fillPoints`, `lineBetween`. Le forme arrotondate / a poligono fanno anti-aliasing → niente "scaletta".
- **Texture-once.** Ogni oggetto è una texture bakeata **una sola volta** (`generateTexture`) e poi istanziata/poolata. **Mai** ridisegnare un oggetto ogni frame.
- **Proiettili = gruppi poolati.** `bullets` / `rockets` / `fuelCans` / `toxicClouds` sono `Phaser.Physics.Arcade.Group`. Riciclo, non creazione continua. Pulizia fuori schermo in `cleanOffScreen()`.
- **Tinta a runtime per le armi.** Un'unica texture `bullet` viene **tinteggiata** con `WEAPONS[type].color` allo spawn (giallo MG, verde fucile, arancio fiamma…). Non serve una texture per arma: stessa forma, colore diverso. **Eccezione:** il **razzo** ha la sua texture dedicata (`rocket`).
- **VFX = fire-and-forget.** Muzzle-flash, bloom e scintille si auto-distruggono via tween. **Mai** un emitter persistente per proiettile.
- **Cosmetico ≠ gameplay.** Le `setBodySize`/hitbox dei proiettili e del veicolo sono **fisse**; bagliori, scia, ombra ed effetti **non toccano** il bilanciamento. Un'arma "pesa" di più per i suoi numeri (`damage`/`cooldown`/`speed`), non perché la texture è più grande.
- **Contenere il disegno nella texture** (sforare bleeda). Il veicolo si disegna entro `100×44`; gli oggetti entro le dimensioni dichiarate.
- **Performance budget:** decine di proiettili + nemici a **60 fps**. Niente effetti per-pixel sugli sprite, niente blur sugli oggetti. Il post-processing filmico è a livello camera (una passata GLSL + bloom), vedi `src/PostFx.ts`.

---

## 3. Linguaggio visivo condiviso

### 3.1 Codice colore di fazione (la lettura #1)
Il colore dice *di chi è* prima ancora della forma. Tre famiglie, coerenti coi 3 colori firma:

| Fazione | Colori | Dove |
|---|---|---|
| **Fuoco del giocatore** | giallo `#ffee00` / `#ffdd44` · verde `#44ff88` · arancio `#ff4400` / `#ff6600` · ciano `#00ffff` (torretta del Soldato) | proiettili, razzi, fiamme, muzzle-flash |
| **Pickup / utile** | rosso-tanica `#cc3300` + **etichetta gialla** `#ffdd00` con simbolo `#ff3300` | tanica di carburante |
| **Minaccia** | verde-tossico `#00cc44`/`#44ff88` (nube), accenti nemici (vedi `ART_BIBLE_ZOMBIES`) | nube tossica, proiettili boss |

> Il **player** parla coi 3 colori firma "caldi/vivi"; la **minaccia** col verde malato e il rosso-sangue. La **tanica** è l'unico oggetto che usa il **rosso + giallo di pericolo** in chiave "industriale" — è voluto: deve gridare *"benzina, prendimi"*.

### 3.2 Kit metallo condiviso
Tutto ciò che è meccanico (torrette, canne, testate, beccucci, bull bar) usa la **stessa terna acciaio**, così l'occhio le legge come "stesso mondo":
`metallo #4a4a52` · luce `#70707a` · ombra `#26262c`. Più, per i dettagli scuri, `#222222` / `#444444`.

### 3.3 Luce, ombra e stacco
- Luce convenzionale da **alto-sinistra**: bande/strisce chiare in alto (`light`/`lighter`), `dark`/`darker` in basso e sui bordi.
- **Ombra a terra** coerente per gli oggetti "appoggiati": il veicolo ha un'ellisse `#000000` alpha `0.22` sotto di sé (cotta nella texture). È ciò che lo stacca dall'asfalto.
- **Accento emissivo** = il punto più luminoso/saturo dell'oggetto: il nucleo bianco del proiettile, la fiamma del razzo, il cannone a energia del veicolo sperimentale.

---

## 4. Schede degli oggetti

> Ogni scheda: **Concept** (a cosa serve / che storia porta) · **Materia/Palette** (hex reali dal codice) · **Silhouette** (il gancio) · **VFX** · **Note di gameplay** (numeri reali, *solo cosmetico ≠ bilanciamento*).
> Le dimensioni sono quelle della texture generata.

---

### 4.1 IL VEICOLO — *l'oggetto-protagonista* · texture `100×44`

**Concept:** non un'auto, ma una **fortezza su ruote** improvvisata. Ogni variante è uno stadio della disperazione: dalla berlina di città rubata al mezzo militare a doppio cannone, fino al prototipo sperimentale a energia. Sale di stazza, corazza e potenza di fuoco man mano che il giocatore sopravvive.

**Linguaggio condiviso a tutte le 7 varianti** (verità del codice in `buildVehicleTexture`):
- **Ombra a terra:** `fillEllipse(50, 25, 96, 40)` in `#000000` alpha `0.22`.
- **Base colorata per variante** (`VEHICLES[].color`) + 4 toni derivati via `mixColor`: `light` (+30% bianco), `lighter` (+52%), `dark` (−34% nero), `darker` (−58%). **Luce alto-sinistra** = banda chiara in alto, ombra in basso.
- **Ruote:** corpo `#141414` (rounded rect) + battistrada `#2c2c2c`; i mezzi pesanti aggiungono il **mozzo** `#555555`.
- **Vetri:** `#0e1d29` (vetro scuro) + riflesso `#2c5470` a bassa alpha (lettura "vetro azzurrino").
- **Fari anteriori:** caldo `#fff4bc` + nucleo `#ffffff` + alone `#fff4bc` alpha `0.3`. **Fanali posteriori:** `#cc1111` + `#ff4444`.
- **Metallo** (torrette/canne/bull bar): kit §3.2.

> **Combat reboot — la canna non è più "cotta" nella texture.** Dalla mira col mouse, in `buildVehicleTexture` resta disegnato **solo il MOZZO/base** della torretta: la **canna** è ora un **overlay rotante separato** (`aim_turret_<weapon>`, vedi §4.1 bis) che ruota verso il puntatore e cambia con l'arma. Le **dimensioni della texture veicolo restano `100×44` invariate** (il mozzo occupava già quello spazio) → validatori invariati. Conseguenza per il **Mezzo Pesante**: perde la **doppia canna cotta** nella sagoma (il suo gancio "DOPPIO CANNONE" nella tabella sopra resta il riferimento storico, ma in gioco la canna è l'overlay; oggi a canna singola).

**Le 7 silhouette (il gancio di ognuna):**

| Chiave (`vehicle_…`) | Nome | Prezzo | `color` | Gancio di silhouette |
|---|---|---|---|---|
| `civilian_car` | Auto Civile | 0 | `#4a6fa5` (blu) | **berlina** tonda, tettuccio arrotondato, MG montata sul tetto |
| `pickup` | Pickup | 300 | `#8B4513` (marrone) | **cabina + pianale aperto** con 5 listoni, MG sul cassone |
| `armored_van` | Furgone Blindato | 700 | `#556B2F` (oliva) | **scatola** corazzata: piastre, **rivetti**, feritoie, torretta in scatola protettiva |
| `military_suv` | SUV Militare | 1200 | `#4a5c2a` (verde mil.) | **alto e boxy**, ruote grandi, **bull bar** anteriore, **antenna radio** |
| `armored_truck` | Camion Corazzato | 2000 | `#3a3a3a` (grigio) | **enorme, 6 ruote** (doppio assale post.), torretta corazzata |
| `heavy_military` | Mezzo Pesante | 3000 | `#2a3a2a` (verde scuro) | 6 ruote enormi col mozzo, **DOPPIO CANNONE**, corazza massima |
| `experimental` | Veicolo Sper. | 5000 | `#220044` (viola) | **angolare a cunei** (`fillPoints`), trim viola `#8833ff`, **cannone a energia** con nucleo bianco, fari viola/rosa |

**Accenti emissivi speciali (sperimentale):** ruote a pod con luci viola `#8833ff`, trim viola, **cannone a energia** (`#330066`→`#8833ff`→nucleo `#ffffff`), fari anteriori `#bb44ff`, fanali rosa `#ff22aa`. È l'unico veicolo che usa un emissivo "alieno" (firma del livello finale, coerente con la Città Finale dell'ambiente).

**Note di gameplay (cosmetico ≠ bilanciamento):** la scala/stazza visiva **non** è la hitbox. Statistiche reali (salute, corazza, velocità, fuoco) vivono in `VEHICLES` e nei moltiplicatori in `create()`. Più il veicolo "sembra" pesante (camion/mezzo pesante), più ha `healthBonus`/`armorBonus` e `speedMult` basso — la lettura visiva **deve** combaciare coi numeri.

**Scatto / scrollata (SHIFT · `performDash`):** manovra difensiva con cooldown (`DASH_COOLDOWN`) che **stacca tutti gli zombi aggrappati** sbalzandoli via, con breve **grazia** (`DASH_GRACE`) in cui nessun nuovo zombi si attacca. Il feedback è **solo cosmetico** (tinta blu `#aaddff`, lampo, shake): **niente rotazione/scala del corpo fisico** → la hitbox del veicolo resta invariata (vedi §2). È la contromossa al sistema d'aggancio (§4.2).

---

### 4.1 bis · TORRETTA PER ARMA — *overlay rotante (mira col mouse)*

**Concept:** col **combat reboot** (mira col mouse) la canna del veicolo non è più "cotta" nella texture (§4.1): è un **overlay separato che RUOTA verso il puntatore** e **CAMBIA forma con l'arma equipaggiata**. È la parte più osservata durante il combattimento — è dove l'occhio del giocatore vive mentre mira. Codice in `buildTurretTextures` (`src/VehicleTextures.ts`); le canne sono disegnate, la mira/rotazione in `GameScene.buildAim`/`updateAim`.

**Le 5 texture `aim_turret_<weapon>` · `36×14` · sovracampionate `OS_G` 2×** (kit metallo §3.2 — `#26262c` / `#44454f` / `#6a6c78`, con il **mozzo** comune accennato in viola-torretta `#8899ff`, coerente col colore-indicatore della torretta in §4.2):

| Chiave | Arma | Gancio di silhouette |
|---|---|---|
| `aim_turret_mg` | Mitragliatrice | **canna singola** media, volata in punta |
| `aim_turret_double_mg` | Doppia MG | **due canne** parallele, doppia volata |
| `aim_turret_rifle` | Fucile Auto | **canna lunga e sottile** + **tacca di mira** sopra |
| `aim_turret_rockets` | Razzi | **lanciatore tozzo** + **ogiva rossa** che sporge (`#cc2200` / `#ff5533`) |
| `aim_turret_flamethrower` | Lanciafiamme | **ugello svasato** + **fiammella pilota** (`#ff6622` / `#ffcc44`) |

**Pivot / origine:** le texture hanno il **mozzo a sinistra** e si ancorano con **origine `(0.11, 0.5)`** ≈ sul perno; lo sprite torna a scala design con `setScale(1/OVERSAMPLE)`. Ruotano impostando l'angolo verso il mirino, **clampato all'arco frontale** (vedi mira sotto). Al **cambio arma** (`selectWeapon`/`turretTex`) la torretta fa `setTexture('aim_turret_'+arma)`.

**`TURRET_DX` (offset perno per veicolo, esportato da `VehicleTextures`):** dove è disegnato il mozzo cambia per silhouette, quindi il perno della torretta segue — `civilian_car +8`, `pickup −22`, `armored_van 0`, `military_suv −3`, `armored_truck −13`, `heavy_military −17`, `experimental −3` (offset x dal centro veicolo). Lo stesso valore allinea la canna statica nelle anteprime.

**Mirino — `aim_crosshair` · `24×24` · ciano:** reticolo ciano (`#00ffff`, coerente §3.1) disegnato sul **punto mirato** (depth alta, sopra il mondo). La torretta punta verso di esso entro l'**arco frontale `±82°`** (`MAX_AIM`, costante di feel **derivata/da tarare**, non validata).

**In gioco vs vetrine:** in partita la canna è l'**overlay rotante** (depth sopra il corpo del veicolo e sotto i proiettili). Nel **negozio** (`ShopScene`) e nella **galleria Debug** (`DebugScene`) la torretta è mostrata **statica**, sempre `aim_turret_mg` puntata in avanti sul mozzo (con `TURRET_DX` per l'aggancio) — anteprima leggibile, non rotante.

**Note di gameplay (cosmetico ≠ bilanciamento):** la torretta è grafica; cadenza/danno restano nei numeri (`WEAPONS`, salute componente `turret`, Overdrive). La rotazione e il recoil visivo della canna **non toccano** hitbox né bilanciamento. *Queste texture **non** sono nell'header dei validatori §4.4–§4.8/§9 (non sono dimensioni-soggette-a-validazione del set oggetti): restano in sincronia manuale.*

---

### 4.2 COMPONENTI & TORRETTA — *le parti che si rompono*

**Concept:** il veicolo non è un blocco di salute unico: ha **5 componenti** che gli zombi possono aggredire singolarmente (si "aggrappano" ai punti di aggancio). È il sistema che rende il danno **leggibile e localizzato** — vedi una parte cedere, non solo una barra scendere.

**I 5 componenti** (verità del codice — `this.components`, colori indicatore):

| Componente | Etichetta HUD | Colore indicatore | Effetto se danneggiato |
|---|---|---|---|
| `engine` | MOTORE | `#44cc44` | perdita di velocità verticale |
| `wheels` | RUOTE | `#44aa88` | manovrabilità ridotta |
| `tank` | SERBAT. | `#ff8800` | consumo/perdita di carburante |
| `turret` | TORR. | `#8899ff` | cadenza di fuoco degradata (fino a inutilizzabile a 0) |
| `armor` | CORAZZA | `#6688bb` | meno protezione dai colpi |

**Punti di aggancio** (`ATTACH_SLOTS`, offset dal centro veicolo): corazza a destra (`dx 42`), ruote sopra/sotto (`dx 5, dy ±16`), motore dietro (`dx -40`), torretta (`dx 20, dy ±13`). Gli zombi aggrappati si disegnano **a questi offset**: la posizione del danno è fisica e leggibile.

**Note di gameplay:** i colori indicatore sono **funzionali** (lettura dello stato nell'HUD), non estetici liberi — distinti tra loro per leggibilità immediata. L'upgrade **Torretta migliorata** dà `fireMult ×1.25`. **Contromossa all'aggancio:** lo **scatto** del veicolo (§4.1) stacca gli zombi aggrappati — risolve il caso del motore (slot posteriore) che i proiettili, sparando in avanti, non raggiungono.

---

### 4.3 ARMI — tabella di riferimento (verità del codice)
**Concept:** le 5 armi del giocatore. Condividono la texture `bullet` (tinta a runtime, §4.4) tranne i **Razzi** (texture dedicata, §4.5). Questa tabella rispecchia **esattamente** `WEAPONS` in `src/GameData.ts` ed è verificata da `npm run validate:art`.

> **Cambio arma a runtime:** le armi **possedute** si selezionano in partita coi tasti `1`–`5` (posizione in `WEAPON_KEYS`) o `Q` per ciclare; la scelta è persistita in `currentWeapon`. L'HUD mostra il selettore (cifre-hotkey, attiva in oro) — vedi `ART_BIBLE_INTERFACCE` §4.2.

| Chiave (`WeaponType`) | Nome | Prezzo | Cooldown (ms) | Danno | Velocità | Colore (tinta) | Range |
|---|---|---|---|---|---|---|---|
| `mg` | Mitragliatrice | 0 | 280 | 1 | 680 | `#ffee00` | 9999 |
| `double_mg` | Doppia MG | 200 | 280 | 1 | 680 | `#ffdd44` | 9999 |
| `rifle` | Fucile Auto | 350 | 140 | 2 | 720 | `#44ff88` | 9999 |
| `rockets` | Razzi | 550 | 900 | 5 | 340 | `#ff4400` | 9999 |
| `flamethrower` | Lanciafiamme | 400 | 70 | 2 | 480 | `#ff6600` | 440 |

> **Note:** `range 9999` = praticamente illimitato (il proiettile esce dallo schermo); il **Lanciafiamme** ha range corto reale `440`. Il `desc` di ogni arma vive nel codice/HUD, non qui.

---

### 4.4 PROIETTILE — `bullet` · **18×5** · *tinta a runtime · sovracampionato (OS_G)*
**Concept:** il piombo del giocatore. Una sola texture per **tutte** le armi a proiettile; cambia solo la **tinta** (colore dell'arma) allo spawn.

**Palette (texture base, poi tinteggiata):** disegnata come **tracer** a 5 livelli.
- **scia di velocità** (a sinistra, si assottiglia): `#ffdd00` alpha `0.16` → `#ffcc33` alpha `0.30` (triangoli appuntiti) · **alone caldo** del corpo `#ffdd00` alpha `0.38`.
- **culatta in ottone** (rear): ombra `#886600` · `#aa8800` · luce `#d4aa44`.
- **nucleo bianco caldo** `#ffffff` (qui si legge la tinta dell'arma) + fondo più caldo `#fff2c0` (luce dall'alto).
- **punta** `#ffee44` + **nucleo della punta `#ffffff`** (l'accento emissivo, la direzione).

**Silhouette:** sottile e **orizzontale**, **punta a triangolo a destra + scia che si assottiglia a sinistra** = "sta volando verso destra", direzione inequivocabile. Il nucleo bianco è l'accento emissivo.

**Nitidezza nativa:** texture **sovracampionata `OS_G` 2×** come veicolo/zombie/tanica; lo sprite torna a scala design con `setScale(1/OVERSAMPLE)` allo spawn (`spawnBullet`). **Hitbox invariata** (frame×scala = 18×5). I numeri di `generateTexture('bullet',18,5)` restano di design → validatore invariato. *Eccezione direzione:* il **proiettile-boss** (riuso del `bullet`, tinta viola) usa `setFlipX(true)` perché viaggia verso sinistra.

**VFX:** **muzzle-flash** allo sparo (`Juice.muzzleFlash`, `fx_light` additivo tinto col colore dell'arma) — **tranne il lanciafiamme**, che ne fa a meno (è già un getto continuo).

**Tinta per arma:** giallo `#ffee00` (MG) · giallo caldo `#ffdd44` (Doppia MG) · **verde `#44ff88`** (Fucile) · arancio `#ff6600` (Lanciafiamme) · **ciano `#00ffff`** (torretta automatica del Soldato).

---

### 4.5 RAZZO — `rocket` · **28×12** · *texture dedicata · sovracampionato (OS_G)*
**Concept:** l'arma pesante. Un vero missile riconoscibile, con testata e scia di scarico — deve "leggersi" come AoE in arrivo.

**Palette (acciaio top-lit + testata rossa):**
- **corpo** cilindro d'acciaio: ombra `#8e8e98` → mezzo `#cfcfd6` → **banda di luce** `#eeeef2` / picco `#f8f8fc` (luce dall'alto) · ombra inferiore `#70707a`.
- **materia/storia:** giunti `#70707a`, rivetti scuri `#55555c` + lumini `#f8f8fc`, **banda rossa** d'accento `#cc2200`.
- **testata** (gradiente): ombra `#aa1800` → `#cc2200` → `#ff4422` → luce `#ff7755` · ombra in basso `#8a1000` · giunto corpo/testata `#6a0c00`.
- **ogiva a punta** `#bb1100` + spigolo illuminato `#ff5533`.
- **ugello = kit metallo §3.2** `#26262c` / `#444444` / `#70707a` + **bagliore interno** caldo `#ffcc66`.
- **alette** (acciaio, su/giù al retro) `#55555c` / `#8e8e98` (alto) · `#44444a` / `#70707a` (basso, più in ombra).
- **fiamma di scarico** (coda a sinistra, **contenuta nella texture**): `#ff5500` → `#ff8800` → `#ffcc33` → nucleo `#ffffff` (triangoli appuntiti + 2 lingue laterali).

**Silhouette:** affusolata, **ogiva rossa in punta a destra + fiamma in coda a sinistra** = direzione e pericolo immediati. Il più "grosso e lento" dei proiettili (velocità `340` vs `680+`): la lettura visiva di massa combacia.

**Nitidezza nativa:** texture **sovracampionata `OS_G` 2×**; lo sprite torna a scala design con `setScale(1/OVERSAMPLE)` (`spawnRocket`) e il body è `setSize(22·OVERSAMPLE, 8·OVERSAMPLE)` per compensare → **hitbox 22×8 invariata**. Dimensioni `generateTexture` di design → validatore invariato.

**VFX:** all'impatto → **esplosione** con `Juice.bloomBurst`/`lightFlash` (luce arancione che illumina la scena) + **decal `scorch`** sull'asfalto (vedi `ART_BIBLE_AMBIENTE` §7) + hit-stop ~30 ms (vedi budget in `ART_BIBLE_ZOMBIES`).

**Note di gameplay:** esplosione AoE `r=90px`, `damage 5`, `cooldown 900` ms.

---

### 4.6 SCINTILLA / MOTE — `particle` · **12×12** · *VFX condiviso*
**Concept:** il "mote" caldo generico — schegge d'impatto, scintille d'esplosione, frammenti. Riusato ovunque serva un puntino incandescente.

**Palette:** falloff radiale morbido — alone `#ff6600` a`0.22` → `#ff8800` a`0.35` → `#ffaa00` a`0.55` → `#ffcc33` a`0.85` → `#ffee88` → **nucleo `#ffffff`** · **glint a croce** (`#fff4cc` a`0.30` + `#ffffff` a`0.55`, assottigliato verso le punte) per la lettura "scintilla". Base bianco-calda → **tinge pulito** su qualsiasi colore (debris metallici grigi, schegge verdi, scintille arancio).

**Silhouette:** punto luminoso con alone caldo **e glint a croce**. Sempre **fire-and-forget** (tween posizione + alpha → 0).

> Coerente col toolkit VFX dei nemici (`emitSparks`, `ART_BIBLE_ZOMBIES` §4): stessa famiglia di scintille calde.

---

### 4.7 NUBE TOSSICA — `toxic_cloud` · **50×50** · *minaccia residua*
**Concept:** ciò che lo **zombi Tossico** lascia morendo: una sacca di gas che resta sull'asfalto e danneggia chi la attraversa. È un **oggetto-minaccia**, non un VFX innocuo — la palette lo dichiara.

**Palette (blob stratificati, bassa alpha):** silhouette **irregolare** (cerchi sovrapposti e sfalsati, non un disco): `#003300` a`0.14` → `#004d11` → `#006600` → `#008822` → `#00aa33` → `#00cc44` (blob esterni) · **bolle di ebollizione** `#33dd55` a`0.5` (mote brillanti sparsi) · **nucleo malato** `#00ff55` a`0.22` → `#44ff88` a`0.30` → incandescente `#88ffaa` a`0.5`. Verde-tossico firma, la stessa famiglia `#6cff3a` di `emitZombieFx`.

**Silhouette:** sacca di gas dal contorno **irregolare**, con **bolle** e nucleo denso. Leggibile come "zona da evitare". (Resta volutamente **morbida/traslucida** → a risoluzione design, non sovracampionata: la nitidezza non serve a una nube di gas.)

**Note di gameplay:** è l'unico **oggetto di colore "fuoco del giocatore"-incompatibile** a terra: il verde malato segnala *minaccia*, non *pickup*. Coerenza di fazione (§3.1) rispettata.

---

### 4.8 TANICA DI CARBURANTE — `fuel_can` · **22×26** · *il pickup*
**Concept:** il carburante è il timer della corsa. La tanica è l'**unico pickup** e deve gridare "prendimi" nel caos: rosso industriale + etichetta di pericolo gialla.

**Palette (jerry-can, sovracampionata `OS_G` 2×):**
corpo rosso — base `#cc3300`, mezzo-tono `#e23d12`, **luce alto-sinistra `#ff5530`**, rim `#ff8a5c` (alpha `0.55`–`0.7`), ombra `#5e1000` / `#8a1c00` / `#6e1400` · costole pressate — luce `#ff7a52` / `#ff6a44`, ombra `#7a1600` / `#701400` · piede `#4a0c00` / `#8a1c00` · collare/tappo `#7a1800` / `#a8300a` / `#cc4a1e` · **beccuccio e maniglia = kit metallo §3.2 `#4a4a52` / `#70707a` / `#26262c`** + imbocco `#9a9aa4` + specular `#a6a6b0` · **etichetta di pericolo gialla `#ffdd00` / `#ffee66` (bordo `#b89000`) + fiamma `#cc1800` / `#ff3300` / nucleo `#ffcc00`** · **ombra a terra** `#000000` alpha `0.22`.

**Silhouette:** classica **tanica jerry-can** con beccuccio e maniglia in alto + costole laterali pressate = riconoscibile all'istante. L'**etichetta gialla** è il gancio di lettura a distanza; l'**ombra di contatto** la stacca dall'asfalto.

**VFX:** alla raccolta → feedback di carburante (HUD) + SFX. Scorre/spawna come oggetto del mondo.

**Note di gameplay:** spawn ogni **7.5 s** (ogni **5 s** col sopravvissuto **Esploratore**). Ripristina carburante alla raccolta. **Sovracampionata** come zombie/veicolo: la texture è generata a `OVERSAMPLE`× e lo sprite torna a scala design con `setScale(1/OVERSAMPLE)` → nitidezza nativa, **hitbox invariata** (frame × scala = 22×26). Hitbox indipendente dalla grafica.

---

### 4.8 bis · HAZARD DI CORSIA (A1) — *ostacoli su strada da schivare*
**Concept:** la strada non è più vuota. Tre ostacoli scorrono col mondo e rendono la **posizione verticale** una decisione continua, indipendente dall'autofire: o li schivi (su/giù, Scatto), o paghi. Le **taniche** tendono a uscire nella corsia di un hazard recente → "su o giù?" diventa rischio/ricompensa. Tutti **sovracampionati `OS_G` 2×** (sprite a `setScale(1/OVERSAMPLE)`, hitbox = frame×scala). Texture in `buildEntityTextures()`; dimensioni validate da `npm run validate:art`.

#### `hazard_wreck` · **44×38** — *relitto · ostacolo pesante*
Carcassa carbonizzata (corpo `#2a2622` / luce `#44403a` / ombra `#16140f`, cabina sfondata con vetri `#1a2a2e`, ruggine `#6a3a1e`, ruote `#111111`, brace residua `#ff5522`). **Contatto:** danno pesante (20) + corazza −15, shake + hit-stop.

#### `hazard_oil` · **50×18** — *chiazza d'olio · perdita di controllo*
Pozza piatta e lucida (`#0a0a10` / `#16161e` con sheen iridescente `#2a3a4a` / `#3a2a4a`). A terra (depth sotto i veicoli). **Contatto:** nessun danno, ma velocità verticale ×0.5 per ~1,5 s (sterzi male).

#### `hazard_mine` · **22×22** — *mina · danno a scoppio*
Cupola metallica (`#33333a` / `#55555c` / `#70707a`) con spuntoni `#3a3a42` e **luce rossa pulsante `#ff3018`**. **Contatto:** danno (15) + motore −10, esplosione (luce/scoppio) + shake + hit-stop.

> Valori di danno/cadenza **non validati a numero** (derivati/da tarare, vedi [BALANCE §5](BALANCE.md#5--nemici-)); le **dimensioni** delle texture sì. Niente danno durante la celebrazione di vittoria, come gli altri sistemi.

---

### 4.9 SOPRAVVISSUTI — *token, non sprite nel mondo*
**Concept:** i compagni a bordo. **Non** hanno uno sprite nel mondo di gioco: sono rappresentati come **token colorati** nel negozio / HUD e agiscono tramite **effetti** (alcuni dei quali *generano oggetti*).

**Palette token** (verità del codice — `SURVIVORS[].color`):

| Chiave | Nome | Colore token | Effetto (oggetti generati) |
|---|---|---|---|
| `mechanic` | Meccanico | `#44aaff` | ripara 8hp al componente peggiore ogni 5 s |
| `medic` | Medico | `#ff6666` | rigenera 0.3 salute/s |
| `soldier` | Soldato | `#ffcc44` | **torretta automatica**: spara un `bullet` **ciano `#00ffff`** ogni 3 s |
| `explorer` | Esploratore | `#44ff88` | **più taniche**: spawn ogni 5 s invece di 7.5 s |

> Il colore-token è un **accento** coerente con la palette firma; resta un'icona UI, non una creatura del mondo. Se in futuro avranno una rappresentazione a bordo del veicolo, dovrà seguire la regola di luce e il kit metallo come tutto il resto.

---

## 5. Pipeline: aggiungere un nuovo oggetto

### 5.1 Nuovo veicolo
1. **Concept prima del pixel:** una frase ("fortezza su ruote stadio N") + il **gancio di silhouette** + il `color` base.
2. Aggiungi la riga in **`VEHICLES`** (`src/GameData.ts`): prezzo, colore, bonus.
3. Aggiungi un ramo `else if (vehicleKey === '<chiave>')` in **`buildVehicleTexture`**, restando entro `100×44`, usando i toni derivati (`light`/`dark`…), il kit metallo e la regola di luce.
4. Verifica nella **DebugScene** (`drawVehicles`) a scala reale **e** ingrandita.
5. Assicurati che la **lettura visiva combaci coi numeri** (un mezzo "pesante" deve avere bonus salute alti e velocità bassa).
6. Aggiorna **questa scheda** (§4.1).

### 5.2 Nuova arma / proiettile
1. **Concept:** ruolo (rapida? AoE? continua?) + **colore di fazione** (§3.1).
2. Aggiungi la riga in **`WEAPONS`** con `color` (usato come tinta del `bullet`), `cooldown`, `damage`, `speed`, `range`.
3. Se serve una forma **dedicata** (come il razzo), disegna una nuova texture in `buildEntityTextures` + gruppo poolato; altrimenti **riusa `bullet` con tinta**.
4. Gestisci lo spawn in **`fireWeapon()`** (e `spawnBullet`/`spawnRocket`).
5. Aggancia il feedback: **muzzle-flash** (`Juice.muzzleFlash` col colore dell'arma) e, se esplosiva, `bloomBurst`/`lightFlash` + decal `scorch`.
6. Aggiorna la **tabella armi** (§4.3) e la scheda del proiettile (§4.4 o §4.5), poi esegui `npm run validate:art`.

### 5.3 Nuovo pickup / oggetto-effetto
1. **Concept** + **colore di fazione** (pickup = leggibile come "raccogli"; minaccia = colore malato).
2. Disegna la texture in `buildEntityTextures` (≥3 toni + 1 accento + 1 dettaglio narrativo).
3. Gruppo poolato + spawn + pulizia in `cleanOffScreen()`.
4. Verifica la **leggibilità del ruolo** nel caos (DebugScene / gioco a densità alta).
5. Aggiorna **questa scheda**.

---

## 6. Checklist di qualità (Definition of Done — oggetti)

- [ ] **Ruolo leggibile** in 1 frame: colore di fazione corretto (player / pickup / minaccia).
- [ ] **Silhouette** riconoscibile a scala reale (proiettile che vola, veicolo di profilo, tanica nel caos).
- [ ] Palette a **≥3 toni** + **1 accento emissivo** + **1 dettaglio di materia/storia**.
- [ ] **Luce alto-sinistra** + ombra coerente (e ombra a terra per gli oggetti appoggiati).
- [ ] **Kit metallo condiviso** su tutte le parti meccaniche.
- [ ] **VFX di feedback** agganciato (muzzle-flash allo sparo, esplosione+luce+scorch per gli AoE, feedback di raccolta per i pickup).
- [ ] **Pooling** rispettato (gruppi fisici, niente creazione/distruzione continua); VFX **fire-and-forget**.
- [ ] **Hitbox/bilanciamento invariati** dagli effetti visivi (cosmetico ≠ gameplay).
- [ ] La **lettura visiva combacia coi numeri** (massa percepita ↔ statistiche).
- [ ] 60 fps con molti proiettili + nemici a schermo.

---

## 7. Antipattern da evitare

- ❌ **Primitiva nuda** come oggetto (cerchio giallo = "proiettile", rettangolo grigio = "auto"). Sembra prototipo.
- ❌ **Colore di fazione sbagliato:** un pickup col verde-tossico, un proiettile del player col rosso-sangue → il giocatore legge male e muore.
- ❌ **Una texture per ogni arma** quando basta **tinteggiare** `bullet`. Spreco.
- ❌ **Veicolo "grosso" ma debole** (o viceversa): lettura visiva che mente sui numeri.
- ❌ **VFX persistenti per-proiettile** / oggetti non poolati → cali di frame e leak.
- ❌ **Oggetto che sfora** la propria texture → bleed/artefatti.
- ❌ **Effetti che alterano hitbox** (scia/bagliore che "ingrandisce" il colpo).
- ❌ **Metallo incoerente** (ogni torretta con un suo grigio) → rompe la coesione "stessa mano".
- ❌ **Pickup poco leggibile** nel caos → frustrazione (il carburante è il timer della corsa: deve gridare).

---

## 8. Stato implementazione & roadmap

> Onestà sul gap (come i documenti gemelli).

**✅ Implementato** (`GameScene` + `GameData` + `Juice`):
1. **7 veicoli** procedurali con silhouette distinte, kit metallo, luce alto-sinistra, ombra a terra (`buildVehicleTexture`).
2. **Sistema componenti** danneggiabili (5) con colori indicatore e punti di aggancio (`ATTACH_SLOTS`).
3. **5 armi** con `bullet` tinteggiato a runtime + **razzo** dedicato; muzzle-flash, esplosione (bloom/luce), decal `scorch`.
4. **Pickup tanica** con etichetta di pericolo + spawn temporizzato (gated dall'Esploratore).
5. **Oggetti-effetto** `particle` (scintilla calda) e `toxic_cloud` (minaccia verde) coerenti coi 3 colori firma.
6. **Sopravvissuti** con **ritratto procedurale** (busto testa+spalle 44×52, volto a 3 toni + occhi infossati, `buildSurvivorTextures`) e **nome proprio**: *Bruno* (Meccanico — berretto + fascia blu), *Sara* (Medico — fascia bianca + croce rossa), *Marcus* (Soldato — elmetto + accento giallo), *Nadia* (Esploratore — cappello a tesa + banda verde). Distinti per **copricapo** (gancio di silhouette) + colletto col **colore-firma** del ruolo; mostrati nel negozio. Effetti di gameplay invariati (riparazioni, torretta auto ciano, taniche extra).

**Aperto (rifinitura futura):**
- **Usura/danno visibile sul veicolo** al calare dei componenti (oggi il danno è solo nell'HUD): chiazze, fumo dal motore, ruota sgonfia.
- **Animazione di ricarica/idle** della torretta del veicolo (oggi statica).
- **Varietà di razzo/fiamma** per le armi future (oggi 1 razzo dedicato; il resto è `bullet` tinto).
- **Rappresentazione a bordo dei sopravvissuti** durante la guida (oggi il **ritratto** vive nel negozio; sul veicolo in corsa non sono ancora visibili).
- **Profiling 60 fps** a densità massima di proiettili.

---

## 9. Anti-deriva (validazione)

I numeri e gli hex di questo documento **non devono divergere** dal codice. `npm run validate:art` (vedi `scripts/validate-art-bible.mjs`) confronta automaticamente:

| Sezione | Codice | Campi verificati |
|---|---|---|
| **§4.1** Veicoli | `VEHICLES` (`src/GameData.ts`) | nome · prezzo · colore (hex) |
| **§4.1** Texture veicolo | `generateTexture(key, …)` (`GameScene.ts`) | dimensione `100×44` |
| **§4.3** Armi | `WEAPONS` (`src/GameData.ts`) | nome · prezzo · cooldown · danno · velocità · colore (hex) · range |
| **§4.4–§4.8 bis** Texture oggetti | `generateTexture('…', …)` (`EntityTextures.ts`) | dimensione `NN×NN` di `bullet`/`rocket`/`particle`/`toxic_cloud`/`fuel_can`/`hazard_wreck`/`hazard_oil`/`hazard_mine` |

Lo script è agganciato a `npm run build`: **se i valori divergono, la build fallisce.** Quando cambi un veicolo, un'arma o una dimensione texture, aggiorna **entrambi** (codice + scheda) e rilancia la validazione.

**Ancora in sincronia manuale** (non coperti dallo script — aggiorna a mano):
- Aggancio componenti (`ATTACH_SLOTS`) e colori indicatore dei componenti (`this.components`) → §4.2.
- **Palette** (hex) degli oggetti e dei veicoli (solo le *dimensioni* texture sono validate, non i colori interni) → §4.1, §4.4–§4.8.
- `SURVIVORS` (abilità/colore) e intervallo spawn tanica → §4.8/§4.9.

> **Roadmap di validazione:** estendere lo script ai **colori indicatore** dei componenti e, se utile, a un sottoinsieme di **hex di palette** dichiarati come "verità del codice", così da chiudere la sincronia manuale residua.

---

*Fine documento. Mantienilo allineato al codice: se cambi un veicolo, un'arma, un pickup o un colore di fazione, aggiorna la scheda corrispondente — e tieni d'occhio `npm run validate:art`.*
