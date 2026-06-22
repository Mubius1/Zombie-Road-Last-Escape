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
| `MISSION_DIST` | 18000 | lunghezza missione in u (~180 km mostrati, ~75 s di guida) |
| `BOSS_TRIGGER` | 0.82 | frazione di missione a cui appare il boss (82% → 14 760 u) |
| `BASE_FUEL_DRAIN` | 2.2 | consumo carburante base /s (serbatoio integro) |
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

> *Non validati (valori inline):* tanica = **+30** carburante per pickup; intervallo tanica **7500 ms** (**5000 ms** con Esploratore).

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

**Sferzate (surge) — orde a picchi**

| Costante | Valore | Effetto |
|---|---|---|
| `SURGE_INTERVAL` | 11500 | ms tra una sferzata e l'altra (sospese durante il duello col boss) |
| `SURGE_BASE` | 4 | chiamate di spawn extra alla base di ogni sferzata |

- Numero di chiamate per sferzata: `min(7, SURGE_BASE + ⌊(missione − 1)/2⌋)` → 4 alla missione 1, sale di 1 ogni 2 missioni, cap **7**. Ogni chiamata è un normale `spawnZombie()` e può quindi essere uno sciame (vedi sotto).

---

## §2 · Economia — flusso delle monete

```
   uccisioni ──▶ PUNTEGGIO ──(fine missione)──▶ MONETE  +  ricompensa BOSS
                  ×combo          ⌊score/8⌋                 (400–650)
                                       │
                                       ▼
                                   NEGOZIO  ──▶  ripara · potenzia · arma · veicolo
                                       │
                                  GAME OVER ──▶  reset a 0 (niente sopravvive)
```

### Sorgenti di guadagno
| Sorgente | Monete | Note |
|---|---|---|
| Completamento missione | `⌊punteggio / 8⌋` | unica conversione del punteggio in valuta |
| Boss sconfitto | `reward` del boss (§6) | accreditato subito, **in aggiunta** |

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
- **Specifiche descrittive** (`horsepower`/`weight`/`topSpeed`, solo flavor/UI, NON gameplay): cavalli, peso (kg) e velocità max (km/h) mostrati nella scheda al passaggio del mouse nel negozio. NON influenzano il gioco (la velocità reale è `speedMult`); servono a "sentire" il mezzo. Descrizioni in `vehicle.<key>.desc`.

---

## §4 · Degrado dei componenti

I 5 componenti (salute 0–100) si danneggiano per aggancio zombi (14/1,6 s) e modificano la guida. Formule esatte (`GameScene.ts`):

| Componente | Formula effettiva | A 100% | A 0% |
|---|---|---|---|
| **Ruote** → velocità vert. | `230 · speedMult · (0.15 + 0.85·ruote/100) · max(0.3, 1 − agganciati·0.12)` | piena | 15% (× malus aggancio) |
| **Serbatoio** → consumo | `2.2 · (1 + (1 − serb/100)·2)` | 2.2/s | 6.6/s (3×) |
| **Torretta** → cooldown | `(base/fireMult) · (1 + (1 − torr/100)·1.4)` | base | +140% · **a 0 = non spara** |
| **Corazza** → danno subìto | vedi sotto | ×1.0 | ×2.5 |

### Danno ricevuto (mitigazione corazza)
```
armorPct = corazza.health / 100
base = 2.5  se armorPct ≤ 0      (corazza distrutta)
       1.8  se < 0.30
       1.3  se < 0.60
       1.0  altrimenti
mult = max(0.5, base − bonusArmaturaVeicolo/100)
danno_finale = round(danno_nominale · mult)
```
- `bonusArmaturaVeicolo` = armatura del veicolo (§3) + 20 se possiedi l'upgrade Corazza.
- Floor a **×0.5**: anche con corazza piena + armatura alta non si scende sotto metà danno.
- *Lettura di design:* la corazza distrutta **2,5×** il danno è la spirale di morte; ripararla al Negozio è spesso prioritario.

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
- **Hazard di corsia (A1):** ostacoli che scorrono col mondo, da schivare (non sono nemici, non sono nel pool). Spawn ogni `HAZARD_SPAWN_INTERVAL` (4500 ms); tipo pesato: relitto 40% · olio 35% · mina 25%. **Relitto** → danno 20 + corazza −15. **Mina** → danno 15 + motore −10 + scoppio. **Olio** → nessun danno ma velocità verticale ×`OIL_SLOW_MULT` (0.5) per `OIL_SLOW_DURATION` (1500 ms). ~40% delle taniche escono nella corsia dell'ultimo hazard (rischio/ricompensa). Valori *derivati/da tarare*, non validati a numero (le dimensioni texture sì, lato arte: [ART_BIBLE_OGGETTI §4.8 bis](ART_BIBLE_OGGETTI.md)).
- Il **Tossico** rilascia una nube velenosa alla morte; il danno tabellato è quello da contatto.
- *Rapporto rischio/ricompensa:* punteggio ∝ pericolosità (HP×danno), così la combo premia l'aggressività verso i bersagli grossi.
- Il **danno** in tabella è il valore nominale: passa sempre dalla mitigazione corazza (§4).

### Curva di difficoltà (frequenza di spawn)

> ⚠️ *Derivata, non validata* — rivista col **combat reboot** per la densità "orda" (mira col mouse → più nemici sullo schermo). Valori in taratura.

- Intervallo iniziale per missione: `max(330, 1350 − (missione−1)·80)` ms *(prima: `max(700, 2100 − …)`)*.
- A ogni spawn l'intervallo cala di **3 ms**, con pavimento a **290 ms** entro la missione *(prima: 500 ms)*.

| Missione | Intervallo iniziale |
|---|---|
| 1 | 1350 ms |
| 5 | 1030 ms |
| 10 | 630 ms |
| 13+ | 330 ms (pavimento iniziale) |

- **Sciami:** ogni `spawnZombie()` non genera più un singolo nemico per i *fodder* — Comune e Corridore arrivano in gruppo di **1-3**, Tossico **1-2**; tutti gli altri tipi restano **singoli**. Combinato con le sferzate (§1 bis) il risultato è un ritmo a picchi molto più affollato di prima (quando solo il Comune, al 25%, usciva a 2-3).

### Scaling "new game+" (G2 · rafforzato in B4)
Oltre la frequenza di spawn, da fine ciclo crescono **HP e danno** di nemici e boss col numero di ciclo di regioni (1 ciclo = 7 regioni):

`diffMult = 1 + 0.2 · ⌊(missione − 1)/7⌋`  → missioni 1–7 ×1.0 · 8–14 ×1.2 · 15–21 ×1.4 · …

- **HP** = `Math.ceil(base · diffMult)` su tutti gli zombi (incl. gigante e spawn boss); **boss** = `round(hp · diffMult)`. Il `ceil` è deliberato: con `round`, `round(1×1.2)=1` lasciava invariati i nemici da 1 HP (comune/corridore, ~60% del pool) → lo scaling era di fatto inerte (B4). Ora anche loro salgono (1→2 al 2° ciclo).
- **Danno da contatto** dei nemici = `round(danno · diffMult)` (prima il danno non scalava affatto).
- I valori-base 🔒 in §5/§6 restano invariati: lo scaling è un fattore a runtime (la formula vive in `GameScene.difficultyMult` e, in sync, in `BossController`).
- *Da tarare a playtest:* passo 0.2 e curva sono un punto di partenza, non un valore validato.

---

## §6 · Boss 🔒

Fonte: `BOSS_CONFIG`. Appaiono all'82%; mentre vivi congelano l'avanzamento.

| `chiave` | Boss | HP | Velocità | Ricompensa ★ |
|---|---|---|---|---|
| `mega_mutant` | Mega Mutante | 80 | 55 | 400 |
| `giant_worm` | Verme Gigante | 110 | 40 | 500 |
| `armored_colossus` | Colosso Corazzato | 150 | 28 | 650 |
| `radioactive_beast` | Bestia Radioattiva | 95 | 50 | 450 |

- La sconfitta dà **due** accrediti: la **ricompensa in monete** del boss (`reward`, accreditata subito) **più** `+500 punteggio` (× combo) che a fine missione si converte in altre monete (⌊score/8⌋). Doppio accredito voluto (G10).
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

---

## §8 · Negozio ed economia degli acquisti

Fonte: `SHOP_ITEMS` (`ShopScene.ts`).

### Potenziamenti 🔒
| `chiave` | Voce | Costo ★ | Tipo | Effetto |
|---|---|---|---|---|
| `repair` | Ripara tutto | 80 | ripetibile | tutti i componenti → 100% |
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

> **Potenziamenti per-veicolo:** ogni potenziamento si applica al SOLO veicolo su cui è comprato
> (`RunData.upgrades` = `Record<vehicleKey, Upgrades>`). Il negozio mostra solo il catalogo del mezzo
> selezionato (`VEHICLES[key].upgrades` in `GameData.ts`); `repair` è universale per tutti i veicoli.
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
| Esploratore | taniche più frequenti (5 s vs 7,5 s) | passivo |
| Saccheggiatore | +12% monete a fine missione (compone col nodo di percorso) | a fine missione |
| Cecchino | colpo forte (danno 5) allo zombi più resistente davanti | ogni 2,2 s |
| Artificiere | tasto C: granata ad area (raggio 110, danno 8) | ricarica 5,5 s |

### Letture economiche di riferimento
- **"Ripara tutto" (80)** è il pozzo ricorrente: a corazza/serbatoio rovinati è quasi sempre il miglior acquisto (rompe la spirale di §4).
- Costo primo veicolo utile (Pickup 300) ≈ punteggio **2400** in una missione (`300·8`). Utile come metro per tarare la generosità degli spawn.
- I sopravvissuti gratis sono il motore di **potenza composta** della corsa: più a lungo sopravvivi, più ne accumuli.

---

## §9 · Debug & leve di tuning

- **Tasti debug** (in `GameScene`): `G` god-mode, `H` cura salute+carburante, `N` completa missione. Galleria modelli in `DebugScene`.
- **Dove mettere mano per ribilanciare:**
  - generosità economica → divisore `⌊score/8⌋` in `triggerMissionComplete`;
  - ritmo → `SCROLL_SPEED`, `MISSION_DIST`, formula `spawnInterval`;
  - letalità → `ZOMBIE_STATS[*].damage`, soglie corazza in `dealDamage`;
  - pressione carburante → `BASE_FUEL_DRAIN`, intervallo/valore taniche;
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

> **Manutenzione.** Aggiorna le tabelle 🔒 dei **valori-sorgente** ogni volta che cambi `GameData.ts`, `ShopScene.ts` o una costante di bilanciamento — altrimenti `validate:balance` fallisce. I valori **derivati** (formule, curve, soglie) ricalcolali dalla formula citata.
