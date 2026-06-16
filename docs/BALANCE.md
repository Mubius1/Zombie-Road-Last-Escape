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

> *Non validati (valori inline):* tanica = **+30** carburante per pickup; intervallo tanica **7500 ms** (**5000 ms** con Esploratore).

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

> **Reset alla morte.** Il game over riporta `money=0`, `missionNumber=1`, veicolo/armi/sopravvissuti/potenziamenti allo stato iniziale. Non c'è valuta meta persistente (vedi [GAME_DESIGN §12](GAME_DESIGN.md#12--domande-aperte--ganci-di-roadmap)).

### Combo → moltiplicatore di punteggio
`mult = clamp(1 + ⌊(combo − 1)/5⌋, 1, 5)`

| Catena (kill entro 2,5 s l'una dall'altra) | Moltiplicatore |
|---|---|
| 1–5 | ×1 |
| 6–10 | ×2 |
| 11–15 | ×3 |
| 16–20 | ×4 |
| 21+ | ×5 (cap) |

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
| `experimental` | Veicolo Sperimentale | 120 | 50 | 1.2 | 1.5 |

- **Salute totale** del mezzo = `100 + (+Salute)` → da 100 (Auto Civile) a 220 (Sperimentale). **+Armatura** entra nella mitigazione danni (§4 corazza).
- **×Cadenza** (`fireMult`) si moltiplica con l'upgrade Torretta (×1.25); **×Velocità** (`speedMult`) con l'upgrade Motore (×1.15).
- *Tensione di design:* i mezzi più corazzati (Camion, Pesante) sono **più lenti** → trade-off tra incassare e schivare.

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

- **Peso pool** = occorrenze in `SPAWN_POOL` (10 voci totali): Comune 40% · Corridore 20% · Tossico 20% · Corazzato 10% · Saltatore 10%. Il **Gigante** è fuori pool (timer 22 s) → peso `—` (non validato).
- Il **Tossico** rilascia una nube velenosa alla morte; il danno tabellato è quello da contatto.
- *Rapporto rischio/ricompensa:* punteggio ∝ pericolosità (HP×danno), così la combo premia l'aggressività verso i bersagli grossi.
- Il **danno** in tabella è il valore nominale: passa sempre dalla mitigazione corazza (§4).

### Curva di difficoltà (frequenza di spawn)
- Intervallo iniziale per missione: `max(700, 2100 − (missione−1)·80)` ms.
- A ogni spawn l'intervallo cala di **3 ms**, con pavimento a **500 ms** entro la missione.

| Missione | Intervallo iniziale |
|---|---|
| 1 | 2100 ms |
| 5 | 1780 ms |
| 10 | 1380 ms |
| 15 | 980 ms |
| 18+ | 700 ms (pavimento) |

> ⚠️ **Buco noto:** oltre la missione ~18 l'intervallo iniziale è fisso a 700 ms e HP/danno nemici **non scalano** — la difficoltà si appiattisce nel ciclo ripetuto. Candidato a scaling "new game+" (vedi GAME_DESIGN §12).

---

## §6 · Boss 🔒

Fonte: `BOSS_CONFIG`. Appaiono all'82%; mentre vivi congelano l'avanzamento.

| `chiave` | Boss | HP | Velocità | Ricompensa ★ |
|---|---|---|---|---|
| `mega_mutant` | Mega Mutante | 80 | 55 | 400 |
| `giant_worm` | Verme Gigante | 110 | 40 | 500 |
| `armored_colossus` | Colosso Corazzato | 150 | 28 | 650 |
| `radioactive_beast` | Bestia Radioattiva | 95 | 50 | 450 |

- La sconfitta dà anche **+500 punteggio** (× combo) oltre alla ricompensa in monete.
- *Coerenza:* ricompensa ∝ HP (tankiness) → il Colosso paga di più perché impegna più a lungo.
- **Hitbox** (`bodyW`/`bodyH` in `BOSS_CONFIG`) non è una leva di bilanciamento pura: è tarata in funzione di `scaleX`/`scaleY` per tenere invariata la hitbox effettiva nel mondo → è documentata e validata lato **arte** ([art bible zombi §6.7](ART_BIBLE_ZOMBIES.md)), non qui.

---

## §7 · Armi 🔒

Fonte: `WEAPONS`. Sono validati **Prezzo · Cooldown · Danno** (valori-sorgente) e il **DPS** per linea (valore *derivato*, ricalcolato da `danno / (cooldown/1000)` e confrontato a 1 decimale). Velocità/colore/range restano validati dall'art bible.

| `chiave` | Arma | Prezzo ★ | Cooldown | Danno | DPS | Range | Profilo |
|---|---|---|---|---|---|---|---|
| `mg` | Mitragliatrice | 0 | 280 | 1 | 3.6 | ∞ | base |
| `double_mg` | Doppia MG | 200 | 310 | 1 | 3.2 | ∞ | due linee parallele |
| `rifle` | Fucile Auto | 350 | 140 | 2 | 14.3 | ∞ | massimo DPS singolo |
| `rockets` | Razzi | 550 | 900 | 5 | 5.6 | ∞ | esplosione r≈90, anti-orda/boss |
| `flamethrower` | Lanciafiamme | 400 | 70 | 1 | 14.3 | 440 | flusso continuo corto |

- **DPS** è il danno per *singola linea di fuoco*. La **Doppia MG** spara 2 proiettili → danno-su-bersaglio effettivo ~2× il DPS tabellato; i **Razzi** aggiungono danno ad area non incluso nel DPS.
- La **cadenza effettiva** scala con `fireMult` del veicolo, l'upgrade Torretta (×1.25) e il degrado torretta (§4).
- *Da rivedere:* la Doppia MG ha DPS/linea inferiore alla MG base ma costa 200 — il valore è la **doppia linea**; verificare che si percepisca.

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

### Sopravvissuti (gratis — 3 offerti, 1 scelto a visita)
| Sopravvissuto | Effetto | Cadenza |
|---|---|---|
| Meccanico | +8 salute al componente peggiore | ogni 5 s |
| Medico | +0.3 salute | al secondo (continuo) |
| Soldato | colpo auto verso lo zombi più vicino | ogni 3 s |
| Esploratore | taniche più frequenti (5 s vs 7,5 s) | passivo |

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
