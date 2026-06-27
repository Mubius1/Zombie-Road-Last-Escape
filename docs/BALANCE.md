# ⚖️ Bilanciamento & Economia — Zombie Road: Last Escape

> **Stato:** v1.0 · vivo (living document)
> **Ambito:** i **numeri** del gioco e l'**intento** dietro di essi — economia, curve di difficoltà, formule, costi.
> **Relazione con le altre fonti:**
> - I valori grezzi vivono nel **codice** (`src/GameData.ts`, costanti in `src/scenes/GameScene.ts`): quella è la fonte di verità eseguibile.
> - L'identità *visiva* di veicoli/armi (nome · prezzo · colore · dimensioni) è già verificata dalle [art bible](ART_BIBLE_OGGETTI.md) tramite `npm run validate:art`.
> - Questo file documenta **intento, formule e valori derivati** (DPS, curve, soglie) che il codice non spiega da solo. Le regole di gioco stanno in [`GAME_DESIGN.md`](GAME_DESIGN.md).

⚠️ **Anti-deriva (automatica).** Le tabelle dei **valori-sorgente** qui sotto (contrassegnate 🔒) sono verificate dallo script `npm run validate:balance`, agganciato a `npm run build` **e** attivo durante `npm run dev` (ri-validazione a ogni salvataggio). Se cambi un numero nel codice e non aggiorni la riga 🔒 corrispondente, la build fallisce e il dev te lo segnala. Dettagli in §10. I valori **derivati** (curve, soglie, percentuali) non sono validati a numero: ricalcolali dalla formula citata.

---

## §1 · Costanti di missione 🔒

Fonte: costanti in testa a `GameScene.ts`. La colonna **Valore** è validata (un valore per riga, senza unità).

| `costante` | Valore | Effetto |
|---|---|---|
| `SCROLL_SPEED` | 240 | velocità di scorrimento del mondo (u/s) = ritmo base |
| `MISSION_DIST` | 6000 | lunghezza missione in u (~180 km mostrati · `KM_PER_UNIT`, ~25 s di guida base) — **pivot "This War of Mine su ruote"**: la tratta è un transito BREVE e teso, non il cuore (era 18000 u) |
| `BOSS_TRIGGER` | 0.82 | frazione di missione a cui appare il boss (82% → 14 760 u) |
| `BASE_FUEL_DRAIN` | 1.5 | consumo carburante base /s (serbatoio integro) — × il `fuelEff` per-veicolo (§3 bis). Logistica: il carburante PERSISTE tra le missioni (un pieno ≈ 3 tratte) → un *Rifornimento* al garage ogni ~3 soste, non una morte al secondo |
| `MAX_FUEL` | 100 | carburante massimo (+30 con upgrade) |
| `GIANT_SPAWN_INTERVAL` | 22000 | spawn del Gigante errante (ms) |
| `COMBO_WINDOW` | 2500 | finestra per mantenere la catena (ms) |
| `DASH_COOLDOWN` | 5000 | ricarica dello scatto (ms) |
| `DASH_GRACE` | 350 | grazia post-scatto senza riaggancio (ms) |
| `ATTACH_DAMAGE_AMOUNT` | 14 | danno al componente per zombi aggrappato |
| `ATTACH_DAMAGE_INTERVAL` | 1600 | cadenza del danno da aggancio (ms) |
| `OVERDRIVE_MAX` | 100 | soglia della barra piena del Sovraccarico (A3) |
| `OVERDRIVE_DURATION` | 3000 | durata del Sovraccarico una volta attivato (ms) |
| `OVERDRIVE_FIRE_MULT` | 2 | ×cadenza di fuoco durante il Sovraccarico |
| `OVERDRIVE_SHOCK_DMG` | 6 | danno dell'onda d'urto frontale all'attivazione |
| `OVERDRIVE_CHARGE_BASE` | 2 | carica della barra per ogni uccisione (base) |
| `OVERDRIVE_CHARGE_COMBO` | 2 | carica aggiuntiva per uccisione = questo × moltiplicatore combo |
| `ENGINE_SCROLL_MIN` | 0.45 | M1 motore onesto: ritmo di avanzamento a motore distrutto (45%); a 100% = pieno |
| `ARMOR_MULT_FLOOR` | 0.40 | M2 corazza passiva: moltiplicatore danno minimo (riduzione max 60%) |

> *Non validati (valori inline):* convoglio salvato = **+18** carburante; *(taniche su strada **rimosse** — unica ricarica al garage, §3 bis/§8)*; `KM_PER_UNIT = 0.03` (`World.ts`) = fattore distanza→km mostrati (**solo display**: il gameplay resta in unità). Il **pieno vero** si fa al garage (negozio → *Rifornimento*, §8). Carburante **persistente** tra le missioni: `RunData.fuel` (caricato a inizio missione, persistito a fine, ripristinato alla morte — modello B).

> **Sovraccarico (Overdrive, A3).** La barra (`OVERDRIVE_MAX`) si carica a ogni uccisione di `OVERDRIVE_CHARGE_BASE + OVERDRIVE_CHARGE_COMBO · moltiplicatore_combo` (→ ~15-20 kill per riempirla a combo media). A barra piena, **F** attiva il Sovraccarico per `OVERDRIVE_DURATION` ms: cadenza di fuoco ×`OVERDRIVE_FIRE_MULT`, veicolo-ariete (il contatto uccide senza danni ai componenti) e onda d'urto frontale da `OVERDRIVE_SHOCK_DMG` all'attivazione. *Da tarare a playtest.*

### §1 bis · Combat reboot — mira & densità (derivate, NON validate)

> ⚠️ **In taratura.** Le costanti qui sotto nascono dal *combat reboot* (mira col mouse, branch `aim-combat`): **non** sono marcate 🔒 e **non** sono lette dal validatore — sono valori di *feel/densità* da rifinire a playtest. Vivono in testa a `GameScene.ts` (e `TURRET_DX` in `VehicleTextures.ts`). La struttura di campagna (km → boss all'82% → 7 regioni → negozio, componenti, carburante, 5 armi, sopravvissuti, Track A, scaling NG+) è invariata: cambia *come si spara*, non *cosa* si affronta.

**Mira & knockback**

| Costante | Valore | Effetto |
|---|---|---|
| `MAX_AIM` | 82° | semi-arco frontale di mira: la torretta ruota verso il puntatore, clampata a ±82° da destra |
| `KNOCK` | 220 | impulso di rinculo (px/s) impresso al nemico colpito, lungo l'angolo del colpo |
| `KNOCK_DECAY` | 0.84 | decadimento del rinculo per frame (~16,67 ms; applicato time-based con `pow(decay, Δ/16.67)`) |

- **Mira:** il puntatore viene portato in spazio di design (`cameras.main.getWorldPoint`), l'angolo è `atan2` clampato a `±MAX_AIM`; un mirino (`aim_crosshair`) marca il punto mirato. Si spara tenendo premuto **CLIC** (o **SPAZIO**) verso il mirino; col mouse il colpo è ignorato se il puntatore è sopra un elemento UI cliccabile (`input.hitTestPointer`). Tutte e 5 le armi sparano in direzione della mira (non più dritto). La cadenza resta gateata da salute Torretta (a 0 non spari) e Overdrive (§1).
- **Knockback:** spinta scalata sugli HP, `kf = clamp(2/hp, 0.18, 1)` → i tank quasi non rinculano. È un offset di posizione decadente clampato nella corsia `[ROAD_TOP+12 .. ROAD_BOTTOM-12]`: **solo game-feel**, non altera le velocità del motion (§4/§5).

**`TURRET_DX` — perno torretta per veicolo** (offset x del mozzo, esportato da `VehicleTextures.ts`):

| Veicolo | `TURRET_DX` |
|---|---|
| Auto Civile (civilian_car) | +8 |
| Pickup (pickup) | −22 |
| Furgone Blindato (armored_van) | 0 |
| SUV Militare (military_suv) | −3 |
| Camion Corazzato (armored_truck) | −13 |
| Mezzo Pesante (heavy_military) | −17 |
| Veicolo Sperimentale (experimental) | −3 |

> La canna non è più "cotta" nelle 7 texture veicolo (resta solo il mozzo); è un overlay rotante che cambia texture al cambio arma (5 torrette: `aim_turret_mg/double_mg/rifle/rockets/flamethrower`). Dimensioni texture veicolo invariate (100×44) → validatori arte OK.

**Throttle — acceleratore / freno (pivot horror, con inerzia)**

> ⚠️ Derivate/in taratura, **non 🔒**. Vivono in testa a `GameScene.ts`; lette da `updateThrottle`/`throttleInput`, `getEffectiveScroll·throttle` (distanza), `getEffectiveFuelDrain` (carburante) e `applyWorldScroll`/`updateStripes`/`environment.update` (scroll visivo).

| Costante | Valore | Effetto |
|---|---|---|
| `THROTTLE_MAX` | 1.6 | ×scroll a tutto gas (1 = `SCROLL_SPEED` di riferimento) |
| `THROTTLE_ACCEL` | 1.4 | salita di `throttle` col gas (unità/s) |
| `THROTTLE_DRAG` | 0.5 | attrito/**inerzia**: discesa quando NON acceleri (unità/s) |
| `THROTTLE_BRAKE` | 2.2 | decelerazione extra del freno, sopra l'attrito (unità/s) |

- **Modello a inerzia** (`updateThrottle`): `throttle` ∈ [0, `THROTTLE_MAX`]. Freno → `throttle -= (DRAG + BRAKE·freno)·dt` (vince sul gas, fino allo **STOP**); gas → `throttle += ACCEL·gas·dt`; nessun input → `throttle -= DRAG·dt` (coast). **Niente auto-crociera**: per restare in moto devi accelerare.
- **Sorgente unica** (`throttleInput`): tastiera (→/D, ←/A = 0/1) **o** pad (grilletti RT/LT = 0..1 analogici) confluiscono qui → throttle agnostico alla sorgente.
- **Avanzamento:** `distance += getEffectiveScroll()·throttle·dt` (motore M1 **e** throttle regolano i km/boss/carburante-nel-tempo).
- **Scroll visivo:** ambiente (`dt·throttle`), strisce, pickup/hazard/nubi (`-SCROLL_SPEED·throttle`) e velocità di scorrimento degli zombi seguono il throttle; la **locomozione propria** dei nemici resta (a mondo fermo continuano a camminare verso di te). Bullet/proiettili boss e oggetti-evento (convoglio/salvataggio) **non** seguono il throttle (transienti) — limite noto, accettato.

**Ritmo del terrore — director a fasi dread → burst (pivot horror)**

> Sostituisce le vecchie *sferzate* (`SURGE_*`, rimosse): non più pressione costante con picchi periodici, ma **alternanza di QUIETE tese e ONDATE**. Derivate/in taratura, **non 🔒**. In `GameScene.updateZombieSpawning`/`advanceSpawnPhase`.

> 🎚️ **Scala dal basso (tuning playtest):** alla **missione 1** (nuova partita: veicolo base, solo MG, zero potenziamenti) la densità è volutamente **gentile** e sale fino alla densità piena verso **metà gioco** (M~12), quando il giocatore ha mezzi/armi/upgrade. Risolve il feedback "troppi nemici appena inizio".

| Costante | Valore (M1) | Effetto |
|---|---|---|
| `CALM_INTERVAL` | 3300 | ms tra spawn nella **quiete** (cala ~110/missione, pavimento 1500) → sagome isolate |
| `BURST_INTERVAL` | 760 | ms tra spawn nell'**ondata** (cala ~40/missione, pavimento 300 → densità piena ~M12) → sciami serrati |
| `CALM_MS_MIN`/`CALM_MS_MAX` | 3500 / 5500 | durata della quiete (ms, random nel range) — accorciata per la tratta breve (~25 s) |
| `BURST_MS_BASE` | 4000 | durata base dell'ondata a M1 (+170 ms/missione) |
| `BURST_MS_CAP` | 7000 | **tetto** durata ondata: su 31 tratte da ~25 s l'ondata non può durare più della tratta (coerente col tetto di difficoltà per atto) |

- **Fasi** (`advanceSpawnPhase`): si parte in **quiete** (a **M1 piena** = intro gentile; dalle missioni successive dimezzata, l'azione entra prima). Allo scadere, **quiete → ondata**: parte lo **stinger** (`playWaveStinger`), il **drone d'angoscia va al massimo** per tutta l'ondata (`burstDreadUntil`), e si genera un **batch d'apertura** di `min(4, 1 + ⌊(missione−1)/3⌋)` spawn (M1 = 1, alleggerito per la tratta-transito). Allo scadere dell'ondata, **ondata → quiete** (respiro). Sospeso durante il boss.
- **Intento:** il **silenzio è minaccia**, non riposo — sai che l'ondata arriverà. La difficoltà cresce **con la missione** (proxy della potenza accumulata): a M1 ondate rade/corte, da metà gioco serrate. Gli intervalli (e ogni `spawnZombie`, che per i *fodder* è uno **sciame** 1-3) scalano anche col nodo di percorso (`routeSpawnMult`, B1).

---

## §2 · Economia — flusso delle monete

```
   uccisioni ──▶ PUNTEGGIO ──┐
       │          ×combo      ├─(fine tratta)─▶ MONETE ──▶ SOSTA / NEGOZIO ──▶ tratta+1
       └──────────────────────┘  ⌊score/5⌋ + (uccisioni×4)   ripara · rifornisci · potenzia · recluta
                                       │
                                  GAME OVER ──▶  checkpoint: rigiochi la tratta (−25% monete), build intatto
```

### Sorgenti di guadagno
| Sorgente | Monete | Note |
|---|---|---|
| Conversione punteggio | `⌊punteggio / 5⌋` | la combo gonfia il punteggio (≈ efficienza), poi si converte a fine tratta |
| Quota per uccisione | `uccisioni × 4` | **fissa, svincolata dalla combo**: ogni kill vale qualcosa anche a combo 1 |
| ~~Boss sconfitto~~ | **OFF** | `BOSSES_ENABLED=false`: la ricompensa 400-650★ (§6) NON è accreditata — le due gambe sopra la rimpiazzano (divisore più generoso + quota per-kill) |

> **Pavimento Atto 1-2 (`EARLY_TRATTA_FLOOR=90★`):** nei primi due atti (`actIndex ≤ 1`) l'incasso per tratta ha un **pavimento garantito** — l'inizio campagna era near-break-even (~10★/tratta netti), troppo povero proprio quando vuoi le compere economiche (Pickup 300, Fucile 350). Dagli atti centrali in poi **nessun pavimento** → la tensione logistica di metà/fine gioco resta intatta. Derivato/in taratura.

### Pozzi di spesa (tutti al Negozio)
Riparazioni, potenziamenti, armi, veicoli (§7–§8). I **sopravvissuti sono gratis**.

> **Morte = checkpoint, non reset.** Il gioco è una **campagna a checkpoint**: a ogni missione (e dopo ricompense/acquisti) lo stato si salva su disco (`SaveData.run`). Al game over **non** si azzera — si ripristina il checkpoint d'inizio missione (build intatto) e si paga un **pedaggio** `DEATH_MONEY_PENALTY = 0.25` (−25% monete, clampato a ≥0, auto-limitante). Solo **Nuova Partita** azzera (`money=0`, `missionNumber=1`, stato iniziale). Il pedaggio è un valore di *feel* **non validato** (in taratura). *Save-scum:* chiudere prima di morire evita il pedaggio → accettato di proposito (campagna forgiving, non roguelike).

### Combo → moltiplicatore di punteggio
`mult = clamp(1 + ⌊(combo − 1)/3⌋, 1, 5)` — accorciato da `/5` a `/3` (G3): prima il ×5 chiedeva 21 kill di fila (di fatto irraggiungibile), ora 13.

| Catena (kill entro 2,5 s l'una dall'altra) | Moltiplicatore |
|---|---|
| 1–3 | ×1 |
| 4–6 | ×2 |
| 7–9 | ×3 |
| 10–12 | ×4 |
| 13+ | ×5 (cap) |

> L'HUD mostra il moltiplicatore (`×M`) **solo quando M>1**: a combo basse mostra `COMBO N` senza il `×1` (che sembrava un bug).

---

## §3 · Veicoli 🔒

Fonte: `VEHICLES` (`GameData.ts`). Prezzo e colore sono già validati dall'art bible; qui sono validati i **bonus di potere** (`healthBonus`, `armorBonus`, `speedMult`, `fireMult`).

| `chiave` | Veicolo | +Salute | +Armatura | ×Velocità | ×Cadenza |
|---|---|---|---|---|---|
| `civilian_car` | Auto Civile | 0 | 0 | 1.0 | 1.0 |
| `pickup` | Pickup | 20 | 10 | 1.0 | 1.0 |
| `armored_van` | Furgone Blindato | 40 | 20 | 0.9 | 1.1 |
| `military_suv` | SUV Militare | 60 | 25 | 1.1 | 1.2 |
| `armored_truck` | Camion Corazzato | 80 | 35 | 0.85 | 1.0 |
| `heavy_military` | Mezzo Pesante | 100 | 45 | 0.8 | 1.3 |
| `experimental` | Veicolo Sperimentale | 60 | 20 | 1.2 | 1.5 |

- **Salute totale** del mezzo = `100 + (+Salute)` → da 100 (Auto Civile) a 220 (Sperimentale). **+Armatura** entra nella mitigazione danni (§4 corazza).
- **×Cadenza** (`fireMult`) si moltiplica con l'upgrade Torretta (×1.25); **×Velocità** (`speedMult`) con l'upgrade Motore (×1.15).
- *Tensione di design:* i mezzi più corazzati (Camion, Pesante) sono **più lenti** → trade-off tra incassare e schivare.
- *Sperimentale = "glass cannon" (B3):* resta il re di **velocità (1.2)** e **cadenza (1.5)** ma con salute/armatura **ridimensionate** (60/20, sotto SUV/Camion/Pesante) → non è più dominante su tutti gli assi: è una scelta aggressiva ad alto rischio, non un upgrade assoluto. Più punitivo con lo scaling NG+ (§5).
- **Capienza sopravvissuti** (`survivorSlots`, NON validata — gameplay): posti oltre al guidatore — Auto Civile **4**, Pickup **2**, Furgone **5**, SUV **4**, Camion **4**, Pesante **3**, Sperimentale **2**. I mezzi da combattimento sacrificano posti → trade-off potenza/persone; cambiando mezzo gli eccedenti restano indietro.
- **Specifiche dal mezzo reale** (`horsepower`/`weight`/`topSpeed`): mostrate nella scheda del negozio per "sentire" il mezzo. **`weight` e `horsepower` ora CONTANO**: alimentano il **consumo carburante** realistico (§3 bis, `vehicleFuelEff`) → ogni veicolo ha la sua autonomia. `topSpeed` resta flavor (la velocità reale è `speedMult`). Descrizioni in `vehicle.<key>.desc`.

### §3 bis · Consumo & autonomia carburante (derivato, NON validato)

Il consumo **non è più uguale per tutti**: ogni veicolo brucia in proporzione ai suoi **dati reali** (massa + potenza), via `vehicleFuelEff()` (`GameData.ts`). Così `weight`/`horsepower` — prima solo flavor — **contano**: un bestione da 12 t è assetato, una city-car è parca.

```
fuelEff = 0.62 + weight/15000 + horsepower/4200      // × sul consumo base BASE_FUEL_DRAIN
```

**Modello "viaggio" (carburante persistente).** Il pieno **NON** si ricarica a ogni missione: `RunData.fuel` si porta avanti (un singolo tratto-missione mostra **~180 km** credibili, ma un pieno copre **~3 missioni**). Così l'autonomia mostrata è da auto vera (centinaia di km) **senza** uccidere la scarsità: il carburante è un **bene di campagna** da gestire sul lungo viaggio. Si rabbocca **solo al garage** (negozio → *Rifornimento*, fa il pieno; §8) — le taniche su strada sono **rimosse**. Autonomia stimata mostrata nella **scheda veicolo** del negozio (`vehicleRangeKm`).

Autonomia di display ≈ `serbatoio · KM_PER_FUEL / fuelEff` con `KM_PER_FUEL = 4.8` (= `SCROLL_SPEED·KM_PER_UNIT/BASE_FUEL_DRAIN`):

| Veicolo | kg / CV | `fuelEff` (×) | Autonomia¹ pieno (100) | Missioni/pieno² |
|---|---|---|---|---|
| Auto Civile | 1200 / 90 | 0.72 | ~665 km | ~3.7 |
| Pickup | 1900 / 150 | 0.78 | ~613 km | ~3.4 |
| Furgone Blindato | 2800 / 140 | 0.84 | ~571 km | ~3.2 |
| SUV Militare | 2600 / 250 | 0.85 | ~563 km | ~3.1 |
| Camion Corazzato | 7000 / 300 | 1.16 | ~414 km | ~2.3 |
| Mezzo Pesante | 12000 / 520 | 1.54 | ~311 km | ~1.7 |
| Sperimentale | 1600 / 600 | 0.87 | ~552 km | ~3.1 |

> ¹ A velocità di crociera (throttle 1), serbatoio e motore integri, tanica base 100 (senza upgrade *Serbatoio* +30).
> ² Missioni (~180 km) coperte da un pieno. Il **Mezzo Pesante** è l'estremo "logistica": scambia autonomia per corazza/potenza. **In taratura:** burn (`BASE_FUEL_DRAIN`) e costo *Rifornimento* al garage (§8) sono i dial di scarsità — le taniche su strada sono state **rimosse** (il garage è l'unica ricarica) — da rifinire a playtest.
>
> **Anti-softlock (RIMORCHIO).** Il Mezzo Pesante (`fuelEff 1.54`) sulla tratta più assetata (deserto, `fuelDrainMult 1.5 × lengthMult 1.5`) consuma **~130** a crociera > serbatoio max **100** (non monta *Serbatoio extra*): un pieno **non basta**. Per questo finire la benzina **non è game over** ma un **RIMORCHIO** alla sosta successiva che **AVANZA il leg** (`GameScene.strandLeg`), così nessun leg resta invincibile per nessun mezzo/stato-serbatoio (il fattore serbatoio danneggiato arriva a ×3). Pedaggio `STRAND_MONEY_PENALTY 0.20` (< morte 0.25) + crollo morale, **niente sopravvissuto perso**; arrivi con `STRAND_TOW_FUEL 25`. Sul leg terminale si resta sul leg con pieno + serbatoio riparato (corto, sempre completabile). Derivati, **non 🔒**.

---

## §4 · Degrado dei componenti

I **4 componenti** (salute 0–100) si danneggiano per aggancio zombi (14/1,6 s) e per **fonte localizzata** (vedi "Mappa danno"), e **modificano la guida**. Formule esatte (`GameScene.ts`):

| Componente | Formula effettiva | A 100% | A 0% |
|---|---|---|---|
| **Motore** → ritmo avanz. | `SCROLL_SPEED · (ENGINE_SCROLL_MIN + (1−ENGINE_SCROLL_MIN)·mot/100)` | pieno (240 u/s) | 45% (108 u/s) — **NON game over** |
| **Ruote** → velocità vert. | `230 · speedMult · (0.15 + 0.85·ruote/100) · max(0.3, 1 − agganciati·0.12)` | piena | 15% (× malus aggancio) |
| **Serbatoio** → consumo | `1.5 · (1 + (1 − serb/100)·2) · (0.5 + 0.5·throttle) · fuelEff` | 1.5/s¹ ² | 4.5/s (3×)¹ ² |
| **Torretta** → cooldown | `(base/fireMult) · (1 + (1 − torr/100)·1.4)` | base | +140% · **a 0 = non spara** |

> ¹ **Throttle (pivot horror):** il consumo è ora moltiplicato dal fattore `0.5 + 0.5·throttle` → **crociera (throttle=1) = invariato** (le colonne "A 100%/0%" valgono a crociera), **gas (1.6) ≈ ×1.3**, **freno/fermo (0) = ×0.5** (drena comunque: fermarsi non è gratis). Vedi §1bis.
>
> ² **fuelEff (§3 bis):** moltiplicatore di consumo per-veicolo (da massa/potenza), ×0.72 (Auto Civile) … ×1.54 (Mezzo Pesante). Le colonne "A 100%/0%" valgono a `fuelEff=1` (≈ pickup); gli altri mezzi scalano in proporzione.

> **Motore onesto (M1):** il motore non uccide più a 0 — regola il **ritmo di avanzamento** (accumulo di `distance` → km, soglia boss, carburante-nel-tempo). Sano = missione breve; rovinato = arranchi (più lunga, più esposizione, più carburante). `ENGINE_SCROLL_MIN = 0.45`.

### Armatura passiva (M2) — niente più barra "Corazza"
La corazza **non è più un componente che degrada**: è una **riduzione danno passiva** dall'armatura del veicolo (§3) + upgrade *Corazza rinforzata*. Mostrata come badge HUD, non come barra calante. Componenti scesi da **5 a 4**.
```
mult = max(ARMOR_MULT_FLOOR, 1 − bonusArmaturaVeicolo/100)
danno_finale = round(danno_nominale · mult)
```
- `bonusArmaturaVeicolo` = armatura del veicolo (§3, 0–45) + 20 se possiedi l'upgrade *Corazza rinforzata* (max 65).
- Floor a **×0.40** (`ARMOR_MULT_FLOOR`): riduzione danno massima 60%.
- *Lettura di design:* niente più spirale ×2.5 da corazza distrutta → il gioco è più clemente sul lato danno (tarabile alzando il danno base da contatto o il floor).

### Mappa danno (M3 — danno localizzato)
Il colpo danneggia il componente coerente con la **fonte**, così si capisce *perché* una barra cala.

| Fonte di danno | Componente |
|---|---|
| Zombi **aggrappato** | componente dello **slot** afferrato (`ATTACH_SLOTS`) |
| **Tossico** (sputo · zombi tossico · spitter) | **Serbatoio** |
| Urti/relitti/contatti generici · stangata boss | **Salute** (scafo, via `dealDamage` + passiva) |
| Colpi al cannone | **Torretta** |

---

## §5 · Nemici 🔒

Fonte: `ZOMBIE_STATS` (velocità/HP/danno/punteggio) e `SPAWN_POOL` (peso pool). Movimento/VFX → art bible zombi §5–§6, già validati lì.

| `chiave` | Tipo | Velocità | HP | Danno | Punteggio | Peso pool |
|---|---|---|---|---|---|---|
| `common` | Comune | 70 | 1 | 8 | 10 | 4 |
| `runner` | Corridore | 210 | 1 | 5 | 15 | 2 |
| `armored` | Corazzato | 45 | 4 | 20 | 35 | 1 |
| `jumper` | Saltatore | 160 | 2 | 12 | 20 | 1 |
| `toxic` | Tossico | 55 | 2 | 10 | 25 | 2 |
| `giant` | Gigante | 30 | 12 | 35 | 80 | — |
| `charger` | Caricatore | 60 | 3 | 30 | 40 | 1 |
| `spitter` | Sputatore | 40 | 2 | 12 | 30 | 1 |

- **Peso pool** = occorrenze in `SPAWN_POOL` (12 voci totali): Comune ~33% · Corridore ~17% · Tossico ~17% · Corazzato ~8% · Saltatore ~8% · Caricatore ~8% · Sputatore ~8%. Il **Gigante** è fuori pool (timer 22 s) → peso `—` (non validato).
- **Caricatore (A2):** la colonna *Velocità* (60) è la velocità di **avvicinamento**. A `CHARGER_TRIGGER_X` (360 u) dal veicolo si **impenna** per `CHARGER_TELEGRAPH` (700 ms, telegrafo), poi **carica** orizzontalmente a `CHARGER_CHARGE_SPEED` (420, oltre lo scroll) puntando la corsia del veicolo: va schivato o attraversato con lo Scatto. Le tre costanti di carica sono *derivate/da tarare*, non validate a numero.
- **Sputatore (A2):** nemico a **distanza**. Avanza lento (40) e ogni `SPITTER_FIRE_INTERVAL` (2000 ms) lancia un proiettile di bile verso la posizione corrente del veicolo a `SPITTER_PROJECTILE_SPEED` (260, schivabile): la colonna *Danno* (12) è il danno del proiettile (e del contatto). Costringe a non restare fermi in corsia. Le due costanti sono *derivate/da tarare*, non validate.
- **Hazard di corsia (A1):** ostacoli che scorrono col mondo, da schivare (non sono nemici, non sono nel pool). Spawn ogni `HAZARD_SPAWN_INTERVAL` (4500 ms); tipo pesato: relitto 40% · olio 35% · mina 25%. **Relitto** → danno 20 + corazza −15. **Mina** → danno 15 + motore −10 + scoppio. **Olio** → nessun danno ma velocità verticale ×`OIL_SLOW_MULT` (0.5) per `OIL_SLOW_DURATION` (1500 ms). Valori *derivati/da tarare*, non validati a numero (le dimensioni texture sì, lato arte: [ART_BIBLE_OGGETTI §4.8 bis](ART_BIBLE_OGGETTI.md)).
- Il **Tossico** rilascia una nube velenosa alla morte; il danno tabellato è quello da contatto.
- *Rapporto rischio/ricompensa:* punteggio ∝ pericolosità (HP×danno), così la combo premia l'aggressività verso i bersagli grossi.
- Il **danno** in tabella è il valore nominale: passa sempre dalla mitigazione corazza (§4).

### Curva di difficoltà (frequenza di spawn)

> ⚠️ *Derivata, non validata.* La frequenza **non** è più una rampa lineare per-missione: è governata dal **director dread→burst** (§1 bis) — quiete rade (`calmInterval`) alternate a ondate serrate (`burstInterval`), con durate di fase (`CALM_MS`, `BURST_MS_BASE`+`BURST_MS_CAP`) tarate per la **tratta breve** (~25 s). Gli intervalli di spawn calano col progredire (pavimenti **1500**/**300** ms) e scalano con tappa (C2) × nodo (B1). La vecchia formula lineare `max(330, 1350 − …)` è stata **rimossa** con l'arrivo del director a fasi.

- **Sciami:** ogni `spawnZombie()` non genera più un singolo nemico per i *fodder* — Comune e Corridore arrivano in gruppo di **1-3**, Tossico **1-2**; tutti gli altri tipi restano **singoli**. Combinato col director dread→burst (§1 bis) il risultato è un ritmo a **picchi** (ondate affollate ↔ quiete rade), non una pressione costante.

### Scaling di difficoltà — campagna "IL CONVOGLIO" (F1, derivato/non validato)

> 🔁 **Cambiato in F1.** La vecchia rampa **NG+ illimitata** legata al ciclo mod-7 (`1 + 0.2·⌊(missione−1)/7⌋`, missioni 1–7 ×1.0, 8–14 ×1.2, …) è sostituita da una curva **finita con TETTO** sull'**atto** corrente, coerente con l'arco finibile (vedi [`CAMPAGNA_CONVOGLIO.md`](CAMPAGNA_CONVOGLIO.md) §2). Niente più endless+.

`diffMult = 1 + 0.15 · min(actIndex, 5)`  (`actIndex` 0-based: Atto 1 = 0 … Atto 6 = 5)

| Atto | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| `diffMult` | ×1.00 | ×1.15 | ×1.30 | ×1.45 | ×1.60 | ×1.75 (tetto) |

- **HP** = `Math.ceil(base · diffMult)` su tutti gli zombi (incl. gigante e spawn boss); **boss** = `round(hp · diffMult)`. Il `ceil` è deliberato: con `round`, `round(1×1.15)=1` lascerebbe invariati i nemici da 1 HP (comune/corridore, ~60% del pool); col `ceil` salgono comunque dagli atti centrali.
- **Danno da contatto** dei nemici = `round(danno · diffMult)`.
- I valori-base 🔒 in §5/§6 restano invariati: lo scaling è un fattore a runtime (la formula vive in `GameScene.difficultyMult`, ora su `actIndex`). `BossController` mantiene la sua copia ma i boss sono **disattivati** (`BOSSES_ENABLED = false`) → ininfluente finché restano spenti.
- *Da tarare a playtest:* passo 0.15 e tetto a 1.75 sono un punto di partenza, non un valore validato.

---

## §6 · Boss 🔒

Fonte: `BOSS_CONFIG`. Appaiono all'82%; mentre vivi congelano l'avanzamento.

| `chiave` | Boss | HP | Velocità | Ricompensa ★ |
|---|---|---|---|---|
| `mega_mutant` | Mega Mutante | 80 | 55 | 400 |
| `giant_worm` | Verme Gigante | 110 | 40 | 500 |
| `armored_colossus` | Colosso Corazzato | 150 | 28 | 650 |
| `radioactive_beast` | Bestia Radioattiva | 95 | 50 | 450 |

- La sconfitta dà **due** accrediti: la **ricompensa in monete** del boss (`reward`, accreditata subito) **più** `+500 punteggio` (× combo) che a fine missione si converte in altre monete (⌊score/5⌋). Doppio accredito voluto (G10). *Inerte finché `BOSSES_ENABLED=false`.*
- **HP scalati col ciclo** (NG+, vedi §5): `hp_effettivo = hp · diffMult`. Gli HP base in tabella restano la baseline (ciclo 1).
- **2ª fase sotto il 40% HP** (G4): il boss accelera gli attacchi (~1.8×) con un telegrafo visivo/sonoro ("⚠ FURIA").
- *Coerenza:* ricompensa ∝ HP (tankiness) → il Colosso paga di più perché impegna più a lungo.
- **Hitbox** (`bodyW`/`bodyH` in `BOSS_CONFIG`) non è una leva di bilanciamento pura: è tarata in funzione di `scaleX`/`scaleY` per tenere invariata la hitbox effettiva nel mondo → è documentata e validata lato **arte** ([art bible zombi §6.7](ART_BIBLE_ZOMBIES.md)), non qui.

---

## §7 · Armi 🔒

Fonte: `WEAPONS`. Sono validati **Prezzo · Cooldown · Danno** (valori-sorgente) e il **DPS** per linea (valore *derivato*, ricalcolato da `danno / (cooldown/1000)` e confrontato a 1 decimale). Velocità/colore/range restano validati dall'art bible.

| `chiave` | Arma | Prezzo ★ | Cooldown | Danno | DPS | Range | Profilo |
|---|---|---|---|---|---|---|---|
| `mg` | Mitragliatrice | 0 | 280 | 1 | 3.6 | ∞ | base |
| `double_mg` | Doppia MG | 200 | 280 | 1 | 3.6 | ∞ | due linee parallele larghe (±14 px) |
| `rifle` | Fucile Auto | 350 | 140 | 2 | 14.3 | ∞ | massimo DPS singolo, raggio infinito |
| `rockets` | Razzi | 550 | 900 | 5 | 5.6 | ∞ | esplosione r≈90, anti-orda/boss |
| `flamethrower` | Lanciafiamme | 400 | 70 | 2 | 28.6 | 440 | DPS altissimo, raggio corto |

- **DPS** è il danno per *singola linea di fuoco*. La **Doppia MG** spara 2 proiettili → danno-su-bersaglio effettivo fino a ~2× il DPS tabellato; i **Razzi** aggiungono danno ad area non incluso nel DPS.
- La **cadenza effettiva** scala con `fireMult` del veicolo, l'upgrade Torretta (×1.25) e il degrado torretta (§4).
- **Doppia MG (rivisto):** cooldown allineato alla MG base (280) → DPS/linea **3.6** identico, ma con **due linee** distanziate di **±14 px** (vedi `fireWeapon`) per coprire più corsia. A parità di per-linea non è mai peggio della MG gratuita, e su bersagli sparsi/orde rende ~2×: il valore dei 200 ★ è la **larghezza di copertura**.
- **Lanciafiamme (rivisto):** danno per colpo **2** (era 1) → DPS/linea **28.6**, il più alto del gioco, **giustificato dal raggio corto** (440) che costringe a lasciar avvicinare i nemici. Identità chiara vs Fucile (14.3 DPS / raggio ∞ / 350 ★): trade-off DPS↔raggio, non più scelta dominata. Il danno è derivato da `WEAPONS.flamethrower.damage` in `fireWeapon` (niente più valore cablato).

### §7 bis · Munizioni finite (pivot horror) — derivate, NON validate

> ⚠️ Capacità per arma in `GameData.WEAPON_AMMO` (derivate/in taratura, **non 🔒**). La **MG base è il FALLBACK illimitato** (`0` = ∞): non lascia mai a secco. Stato corrente in `RunData.ammo`; consumo in `fireWeapon` (1 munizione/colpo); a secco → click (`playDryFire`) + ripiego automatico sulla MG.

| Arma | Riserva max | ≈ durata a fuoco continuo |
|---|---|---|
| `mg` | ∞ | — (fallback disperato) |
| `double_mg` | 120 | ~34 s |
| `rifle` | 90 | ~13 s |
| `rockets` | 18 | ~16 s |
| `flamethrower` | 200 | ~14 s |

- **Rifornimento:** casse di munizioni sulla strada (`ammo_crate`, ogni ~13 s; ricaricano `AMMO_PICKUP = 0.5` della capacità all'arma equipaggiata — o, con la MG, alla finita più scarica) **o** il `restock` al garage (§8, ricarica tutto al massimo). Le casse compaiono solo se possiedi un'arma finita.
- **Persistenza:** la riserva si carica a inizio missione, si consuma sparando, si **porta avanti** a missione completata (checkpoint); alla morte si **ripristina** quella d'inizio missione (coerente col modello forgiving B). Acquistare un'arma la fa arrivare **carica**.
- *Intento:* ogni colpo delle armi forti **pesa** (scarsità survival horror); la MG gratis evita la frustrazione del soft-lock (sei rallentato, non bloccato).

---

## §8 · Negozio ed economia degli acquisti

Fonte: `SHOP_ITEMS` (`ShopScene.ts`).

### Potenziamenti 🔒
| `chiave` | Voce | Costo ★ | Tipo | Effetto |
|---|---|---|---|---|
| `repair` | Ripara tutto | 80 | ripetibile | tutti i componenti → 100% |
| `refuel` | Rifornimento | 50 | ripetibile | fa il **pieno** del veicolo corrente (carburante "viaggio", persistente §1); universale, compare solo se il serbatoio non è già pieno |
| `restock` | Rifornimento munizioni | 120 | ripetibile | ricarica al **massimo** le armi finite possedute (pivot horror); compare solo se possiedi un'arma finita |
| `armor` | Corazza rinforzata | 150 | una tantum | +20 armatura (≈ −20% danno, §4) |
| `engine` | Motore potenziato | 120 | una tantum | velocità verticale ×1.15 |
| `turret` | Torretta migliorata | 100 | una tantum | cadenza ×1.25 |
| `fuelTank` | Serbatoio extra | 80 | una tantum | carburante massimo +30 |
| `plating` | Blindatura pesante | 180 | una tantum | salute massima +30 |
| `ram` | Ariete frontale | 130 | una tantum | speronare infligge 6 danni a chi tenta l'aggancio |
| `nitro` | Nitro | 110 | una tantum | ricarica scatto ×0.7 (−30%) |
| `ammo` | Munizioni pesanti | 160 | una tantum | +1 danno proiettile |
| `filters` | Filtri NBC | 90 | una tantum | danno nube tossica ×0.5 (−50%) |
| `overcharge` | Sovraccarico esteso | 140 | una tantum | durata overdrive ×1.3 (+30%) |

> **Potenziamenti portabili (globali del convoglio):** un potenziamento si compra **una volta** e resta tuo
> (`RunData.upgrades: Upgrades`) — **non si ri-paga** al cambio mezzo (uccide la "tassa di ri-acquisto" da 400-680★/cambio).
> Ma ogni veicolo **applica** solo gli upgrade nel suo catalogo (`VEHICLES[key].upgrades` in `GameData.ts`) → identità
> del mezzo preservata. Il negozio mostra il catalogo del mezzo selezionato e segna come già posseduti quelli globali;
> `repair` è universale per tutti i veicoli, e `restock` (munizioni) è universale ma compare solo se possiedi un'arma finita.
> I salvataggi vecchi (forma per-veicolo) sono fusi al volo da `migrateUpgrades` (OR su tutti i mezzi).
>
> | Veicolo | Catalogo |
> |---|---|
> | Auto civile | armor · engine · fuelTank · nitro |
> | Pickup | engine · fuelTank · ram · nitro |
> | Furgone blindato | armor · plating · turret · fuelTank · filters |
> | SUV militare | engine · turret · nitro · ammo |
> | Camion blindato | armor · plating · ram · fuelTank · turret |
> | Mezzo militare pesante | armor · plating · turret · ammo · filters |
> | Sperimentale | turret · ammo · nitro · overcharge |

### Sopravvissuti (gratis — 3 offerti, 1 scelto a visita)
| Sopravvissuto | Effetto | Cadenza |
|---|---|---|
| Meccanico | +8 salute al componente peggiore | ogni 5 s |
| Medico | +0.3 salute | al secondo (continuo) |
| Soldato | colpo auto verso lo zombi più vicino | ogni 1.6 s (G9: era 3 s, contributo troppo marginale) |
| Esploratore | consumo carburante −20% (`EXPLORER_FUEL_MULT` 0.8) | passivo |
| Saccheggiatore | +12% monete a fine missione (compone col nodo di percorso) | a fine missione |
| Cecchino | colpo forte (danno 5) allo zombi più resistente davanti | ogni 2,2 s |
| Artificiere | tasto C: granata ad area (raggio 110, danno 8) | ricarica 5,5 s |

### Loop di sopravvivenza dei sopravvissuti (M1–M4 🔒)
Reclutare non è più "prendili tutti": è un loop di gestione (recluta · sfama · proteggi · perdi · salva). Numeri-sorgente in `GameData.FOOD` e nelle costanti di `GameScene.ts`/`ShopScene.ts`.

| Leva | Valore | Dove |
|---|---|---|
| Reclutamenti per sosta | **1** | `recruitLockMission` (M1) |
| Cibo: scorta max · iniziale | **120 · 60** | `FOOD.max` · `FOOD.start` (M2) |
| Fabbisogno per sopravvissuto / missione | **6** | `FOOD.perSurvivor` — un convoglio pieno (4) consuma 24/tratta: la fame è una spesa periodica, non una tassa a ogni sosta |
| Razione (negozio) | **+40 cibo / 100★** | `FOOD.rationFood` · `FOOD.rationCost` |
| Ferimento: prob. · soglia colpo · soglia salute | **25% · ≥8 danno · <35%** | `INJURY_CHANCE` · `INJURY_HEAVY_DMG` · `INJURY_HP_THRESHOLD` (M3) |
| Cura ferito (negozio; ½ col Medico) | **60★** | `HEAL_COST` |
| Fame → abbandono | **2 missioni consecutive** | `STARVE_MISSIONS_TO_LEAVE` |
| Perdita alla morte | **1 sopravvissuto** (oltre al pedaggio monete) | `endGame` |
| Salvataggio strada: raggio · scorta · finestra · ripiego | **72 · 4 s · 16 s · +60★** | `RESCUE_RADIUS` · `ESCORT_MS` · `RESCUE_DEADLINE_MS` · `RESCUE_FALLBACK_COINS` (M4) |

- **Affamato/ferito** = abilità SPENTA per la missione (gancio `hasActiveSurvivor`, vale per tutti e 7). La fame si **proietta dal vivo** nel negozio (🍖✗) mentre compri razioni.
- **Persistenza checkpoint:** cibo/fame consumati UNA volta a missione (`foodMission` evita il doppio addebito al retry dopo la morte); ferimento e reclutamento-su-strada entrano nel checkpoint solo a **fine missione** → si perdono alla morte (coerente col modello B).
- Il salvataggio su strada (evento `rescue`) recupera le perdite: scortalo (stagli vicino per 4 s) per recuperarlo se hai **slot + cibo**, altrimenti monete di ripiego. La sosta espone a un cluster.

### Letture economiche di riferimento
- **"Ripara tutto" (80)** è il pozzo ricorrente: a corazza/serbatoio rovinati è quasi sempre il miglior acquisto (rompe la spirale di §4).
- Costo primo veicolo utile (Pickup 300) ≈ punteggio **1500** (`300·5`) **più** la quota per-kill (~4★/uccisione). Utile come metro per tarare la generosità degli spawn.
- I sopravvissuti gratis sono il motore di **potenza composta** della corsa: più a lungo sopravvivi, più ne accumuli.

---

## §9 · Debug & leve di tuning

- **Tasti debug** (in `GameScene`): `G` god-mode, `H` cura salute+carburante, `N` completa missione. Galleria modelli in `DebugScene`.
- **Dove mettere mano per ribilanciare:**
  - generosità economica → `COIN_DIVISOR` (⌊score/N⌋) + `COIN_PER_KILL` (quota fissa per-kill) in `triggerMissionComplete`;
  - ritmo → `SCROLL_SPEED`, `MISSION_DIST`, formula `spawnInterval`;
  - letalità → `ZOMBIE_STATS[*].damage`, soglie corazza in `dealDamage`;
  - pressione carburante → `BASE_FUEL_DRAIN`, costo *Rifornimento* al garage (niente taniche su strada);
  - tankiness boss → `BOSS_CONFIG[*].hp` e `reward`.

---

## §10 · Validatore `validate:balance` (implementato)

Sul modello di `scripts/validate-art-bible.mjs`, lo script **`scripts/validate-balance.mjs`** rilegge le tabelle 🔒 di questo file e le confronta con il codice, fallendo con codice 1 (build interrotta) su qualsiasi divergenza.

**Cosa controlla**

| Sezione 🔒 | Fonte nel codice | Campi verificati |
|---|---|---|
| §1 Costanti | costanti top-level di `GameScene.ts` | valore di ogni costante elencata |
| §3 Veicoli | `VEHICLES` (`GameData.ts`) | `healthBonus` · `armorBonus` · `speedMult` · `fireMult` |
| §5 Nemici | `ZOMBIE_STATS` + `SPAWN_POOL` | velocità · hp · danno · punteggio · peso pool |
| §6 Boss | `BOSS_CONFIG` | hp · velocità · reward (hitbox → lato arte) |
| §7 Armi | `WEAPONS` | prezzo · cooldown · danno · **DPS** (derivato, ricalcolato) |
| §8 Negozio | `SHOP_ITEMS` (`ShopScene.ts`) | costo di ogni voce |

I valori **derivati non a numero singolo** (mitigazione corazza, curva di spawn, percentuali del pool) **non** sono validati: vanno ricalcolati a mano dalle formule citate.

Oltre ai valori, lo script fa un **cross-check di copertura**: se aggiungi (o rimuovi) un veicolo/arma/boss/nemico/voce-negozio nel codice senza aggiornare la tabella 🔒 corrispondente, la validazione fallisce indicando la chiave mancante. Così il documento non può restare indietro rispetto al codice.

**Come si usa**

```bash
npm run validate:balance   # solo bilanciamento
npm run validate:art       # solo arte
npm run validate           # entrambi
npm run build              # art + balance (gate duro) → tsc → vite build
```

In **`npm run dev`** un plugin Vite (`scripts/vite-plugin-validate.mjs`) esegue entrambi i validatori all'avvio e a ogni salvataggio dei file rilevanti: in caso di deriva mostra un **banner in console** e l'**overlay d'errore** nel browser, senza fermare il server. Vedi [CLAUDE.md Regola n.2/n.3](../CLAUDE.md).

---

## §11 · Campagna "IL CONVOGLIO" — descrittori di tappa & curve (derivati, NON 🔒)

> ⚠️ **Documentati, NON lockati riga-per-riga** (decisione [`CAMPAGNA_CONVOGLIO.md`](CAMPAGNA_CONVOGLIO.md) §9.6-B): il `STAGE_MANIFEST` (`src/World.ts`) è *contenuto di campagna in taratura continua* — lockarlo riga-per-riga ingesserebbe il level-design procedurale. Solo le **costanti-cardine** restano 🔒 (`MISSION_DIST`, §1). Qui si documentano gli **assi** del descrittore e le **curve**; i valori per-tratta vivono nel manifest.

### Assi del descrittore di tappa (`StageDescriptor`)

Ogni tratta della campagna è una riga di `STAGE_MANIFEST`; questi assi sono **moltiplicatori** letti nei punti di gioco già parametrici — **nessun nemico/scena/asset nuovo** (F2).

| Asse | Range | Dove agisce (GameScene) | Default neutro |
|---|---|---|---|
| `lengthMult` | 0.6 … 1.5 | distanza-obiettivo `missionDist = MISSION_DIST·lengthMult` (durata + soglie eventi + HUD km); **NON** tocca `MISSION_DIST` 🔒 | 1.0 |
| `spawnMult` | 0.6 (assedio) … 1.5 (quiete) | `calmInterval`/`burstInterval` × `spawnMultCombined()` | 1.0 |
| `burstMult` | 0.8 … 1.6 | durata ondata in `advanceSpawnPhase` (`BURST_MS_BASE`·…) | 1.0 |
| `fuelDrainMult` | 1.0 … 1.6 | `getEffectiveFuelDrain` (leva *This War of Mine*) | 1.0 |
| `ammoCrateMult` | 0.5 (scarso) … 1.5 | intervallo casse munizioni (`13000 / ammoCrateMult`) | 1.0 |
| `hazardMult` | 0.4 … 2.0 | intervallo hazard (`HAZARD_SPAWN_INTERVAL / (route.hazardMult·hazardMult)`) | 1.0 |
| `poolBias` | `Partial<Record<ZombieType,number>>` | pesi-moltiplicatore sul `SPAWN_POOL` in `pickZombieType` (i pesi-base 🔒 §5 restano) | `{}` |
| `setPiece` | `none`/`night`/`roadblock`/`storm`/`convoy`/`rescue` | evento forzato della tratta-climax (F4) | `none` |
| `stopKind` | `garage`/`depot`/`camp`/`checkpoint`/`market` | sosta a valle (F1, `locationForLeg`) | garage |

### Composizione `routeModifier`(B1) × descrittore(C2) — decisione §9.4-B

Sulla **densità di spawn** i due sistemi si compongono in `spawnMultCombined()`: il descrittore di tappa (C2) è la **base** di difficoltà attesa; il nodo di percorso (B1, `routeSpawnMult`) la **perturba clampato ±30%** (`clamp(routeSpawnMult, 0.7, 1.3)`) per evitare estremi incontrollabili. Sugli **hazard** si moltiplicano direttamente (`route.hazardMult · hazardMult`).

### Curva di difficoltà finita (vedi §5)

`diffMult = 1 + 0.15 · min(actIndex, 5)` → ×1.00 (Atto 1) … ×1.75 (Atto 6, tetto). Rampa NG+ illimitata rimossa.

### Lunghezza odometro (display)

Km diegetici per tratta = `180 · lengthMult` (`MISSION_DIST·KM_PER_UNIT·lengthMult`). La **META** è ~**6000 km**: i `lengthMult` delle ~31 tratte sono tarati perché la loro **somma ≈ 33.3** → `Σ(180·lengthMult) ≈ 6000`. Il nastro-odometro HUD (F3) mostra questo avanzamento.

### Morale del convoglio (F5 — implementato, derivato/NON 🔒)

`MORALE` (`GameData.ts`, struct condivisa sul modello `FOOD`). Sotto `break` il gate unico `hasActiveSurvivor` si spegne **globalmente** (tutte le abilità OFF). Persistito col checkpoint come fuel/ammo: le variazioni in-missione si consolidano a fine tratta, alla morte si ripristina il checkpoint.

| Leva | Valore | Dove |
|---|---|---|
| Iniziale · max | **60 · 100** | `MORALE.start` · `MORALE.max` |
| Soglia crollo (abilità OFF sotto) | **25** | `MORALE.break` (gate `hasActiveSurvivor`) — abbassata da 40: con start 60 le abilità restano ON nei cali normali; OFF solo in crisi vera (perdite/fame ripetute) |
| Soglia rotto (diserzione, gancio) | **15** | `MORALE.rout` |
| Perdita di un sopravvissuto (morte/abbandono) | **−25** | `MORALE.dLoss` |
| Salvataggio su strada riuscito | **+12** | `MORALE.dRescue` |
| Sosta sicura (accampamento) | **+8** | `MORALE.dCamp` |
| Reclutamento riuscito | **+6** | `MORALE.dRecruit` |
| Almeno un affamato a fine consumo | **−10** | `MORALE.dHungry` |
| Tratta completata | **+2** | `MORALE.dTrattaClean` |

> **Epilogo (F5).** All'arrivo al rifugio `showEpilogue` sceglie **1 di 4 finali** da `sopravvissuti × morale finale × integrità veicolo`: *Il convoglio regge* (≥4 vivi ∧ morale ≥50) · *Pochi ma vivi* (1-3 vivi ∧ morale ≥25) · *Arrivi solo* (0 vivi ∨ morale <25) · *Il rifugio è caduto* (morale <15 ∨ integrità <25). I caduti (`RunData.fallen`) sono **nominati**.

### Nemesi-con-memoria (F6 — implementato, opzionale, derivato/NON 🔒)

Riusa lo scheletro del **Gigante** (timer `GIANT_SPAWN_INTERVAL`): negli atti centrali/finali (`actIndex ≥ 1`) il Gigante temporizzato **È** la Nemesi — firma viola, stinger, HP `× (1 + nemesisHeat/150)`. `nemesisState` (0=presagio Atto 1 → 3=resa dei conti Atto 6) derivato dall'atto; `nemesisHeat` (0..100) cresce **+8** per tratta braccata, cala **−12** alle soste `camp`, persistito. *"Si semina, non si batte"*: nessuna entità nuova, nessun duello-a-barra.

### Incontri Tier C — rifondazione equipaggio (implementati, derivati/NON 🔒)

Decisioni morali alle soste (`StopScene`, una per tipo di luogo), con conseguenza persistente in `RunData.choices`. L'epilogo le legge: ≥2 fra `sold`/`looted`/`forced` declassano *Il convoglio regge* → *Pochi ma vivi*. Mostrati **una volta per sosta** (guard `encounterDoneLeg` nel registry, azzerato a Nuova Partita). Stringhe in i18n ×6 (`enc.*`).

### Diramazioni giocabili d'arco (scaffold `World.detourStage` + `resolveDetour` — implementate, derivate/NON 🔒)

Una scelta d'arco con campo `detour` marca `RunData.pendingDetour=<kind>` → la **tratta successiva** è una DEVIAZIONE (override del descrittore, tema/tensione del kind, intro dedicata). A fine deviazione `resolveDetour()` tira un **esito pesato e amaro** (speranza fragile *by design*); il flag-esito `<kind>_<esito>` va in `choices` e l'**epilogo** del personaggio mostra la carta dell'esito (priorità sui finali base). Stringhe i18n ×6 (`detour.<kind>.*`, `campaign.detour.<kind>.*`, `campaign.ending.<chi>.<kind>_*`).

- **«Cerca Lena»** (Sara, `kind=lena`): bioma `city`, `lengthMult 0.7`. Esito: *trovata* (morale **+25**) · *troppo tardi* (**−20**) · *esca/trappola* (**−12**, **−60★**, **−15 cibo**). La probabilità di **trovata SCALA col morale** (`0.20 + (morale−40)/100·0.5`, clamp 0.15–0.55) e ×0.7 se la medica è affamata/ferita/sfinita; `trap` fisso 0.30; il resto è `late`. **Effetto duraturo:** con `lena_found` in `choices`, Lena è "a bordo" → **+2 morale a ogni tratta** (`MORALE.dLena`).
- **«Il valico»** (Nadia, `kind=valico`): bioma `forest`, `lengthMult 0.8`, più hazard, scarso di munizioni. Esito: *passate pulite* **35%** (morale **+18**) · *la frana* **35%** (morale **−12**, **−30 carburante**) · *le tracce* **30%** (morale **−16**).

### Stanchezza per-persona (bisogni "vivi" — implementata, derivata/NON 🔒)

`FATIGUE` (`GameData.ts`): ogni sopravvissuto a bordo ha una fatica 0..**100**. A inizio tratta (guardia `foodMission`, retry-safe): accumula **+14** (`perLeg`) **+8 se affamato** (`hungryPenalty` — fame e fatica si rinforzano), e recupera in base alla sosta da cui arriva: **−9** sosta normale (`stopRest`), **−40** se è un **campo** (`campRest`, "dormi"). Netto base ≈ **+5/tratta** (ben nutriti) → la stanchezza è un **lento accumulo** che i campi azzerano; senza campi (atti 4-5) diventa la pressione "a secco" del finale. Oltre **50** (`tired`) è **SFINITO** → abilità spenta (via `hasActiveSurvivor`, come fame/ferita) finché non riposa. Stato **SOFT e recuperabile** (≠ fame, che fa andar via). Visibile ovunque: pannello-stato alla sosta (*Sfiniti: …*), pastiglia **azzurra** sopra la testa, anello azzurro nel pannello-crew dell'HUD, figura spenta.

| Luogo | Opzione | Effetto |
|---|---|---|
| **camp** | Dividi le razioni | −20 cibo · +10 morale |
| **camp** | Razionamento duro | −8 morale |
| **depot** | Saccheggia a fondo | +80★ · −6 morale |
| **depot** | Prendi e fuggi | +20★ |
| **market** | Compra provviste | −120★ · +50 cibo (se puoi pagare) |
| **market** | Baratta una «bocca» | −1 sopravvissuto · +150★ · −18 morale |
| **market** | Rifiuta | — |
| **checkpoint** | Paga il pedaggio | −60★ |
| **checkpoint** | Forza il blocco | −5 morale |

---

## §12 · Fase R — Rigiocabilità (difficoltà & sblocchi · derivati, NON 🔒)

> ⚠️ **Documentati, NON lockati** (come `diffMult` §5): valori di *feel/progressione* in taratura, non letti dal validatore. Vivono in `src/GameData.ts` (`DIFFICULTIES`) e `src/MetaProfile.ts` (`UNLOCKS`). Regole in [`CAMPAGNA_CONVOGLIO.md` §10](CAMPAGNA_CONVOGLIO.md) + [`GAME_DESIGN.md` §11](GAME_DESIGN.md).

### Livelli di difficoltà (R2 — `DIFFICULTIES`)

Strato **globale** che modula i moltiplicatori esistenti — niente sistema nuovo. `enemyMult` × `difficultyMult` (HP+danno da contatto, §5); `spawnMult` × `spawnMultCombined` (densità: <1 = intervalli più corti = più fitto, §1bis); `fuelMult` × `getEffectiveFuelDrain` (scarsità, §4). Indice in `RunData.difficulty`; pick a Nuova Partita (`NewRunScene`); Incubo gated dietro `MetaProfile.bestDifficulty ≥ 1`.

| Difficoltà | `enemyMult` | `spawnMult` | `fuelMult` |
|---|---|---|---|
| Normale (0) | ×1.00 | ×1.00 | ×1.00 |
| Difficile (1) | ×1.18 | ×0.88 | ×1.12 |
| Incubo (2) | ×1.38 | ×0.78 | ×1.25 |

> Si **compone** con la curva per-atto (§5): es. nemici all'Atto 6 in Incubo = `1.75 × 1.38 ≈ ×2.42` HP/danno. Da tarare a playtest.

### Sblocchi cross-corsa (R3 — `MetaProfile.UNLOCKS`)

**VARIETÀ, non potenza.** Kit di partenza completo e vincibile; gli sblocchi aggiungono stili. Due gate: meta-sblocco (predicato sul profilo) **+** monete in-run (modello FTL/Hades). Soglie derivate dai fatti grezzi del meta-profilo (corse, atto raggiunto, archi, difficoltà, salvataggi, monete cumulative).

| | Kit di partenza | Sblocco ← soglia |
|---|---|---|
| **Veicoli** | Auto Civile · Pickup | SUV ← `furthestAct≥2` · Furgone ← `lifetimeRescues≥3` · Camion ← `furthestAct≥4` · Pesante ← `runsCompleted≥1` · Sperimentale ← `bestDifficulty≥1` |
| **Armi** | MG · Doppia MG · Fucile | Razzi ← `furthestAct≥3` · Lanciafiamme ← `arcsCompleted≥1` |
| **Sopravvissuti** | Bruno · Sara · Marcus | Nadia ← `furthestAct≥2` · Vince ← `lifetimeMoney≥3000` · Eva ← `runsCompleted≥1` · Karim ← `bestDifficulty≥1` |

> Pacing atteso: ~3-5 corse per aprire il grosso del catalogo. Soglie in taratura.

---

> **Manutenzione.** Aggiorna le tabelle 🔒 dei **valori-sorgente** ogni volta che cambi `GameData.ts`, `ShopScene.ts` o una costante di bilanciamento — altrimenti `validate:balance` fallisce. I valori **derivati** (formule, curve, soglie) ricalcolali dalla formula citata.
