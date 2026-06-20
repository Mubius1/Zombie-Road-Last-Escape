# 🎮 Game Design Document — Zombie Road: Last Escape

> **Stato:** v1.0 · vivo (living document)
> **Ambito:** game design *meccanico* — core loop, regole, progressione, condizioni di vittoria/sconfitta.
> **Cosa NON copre:** estetica e game-feel → vedi le [art bible](ART_BIBLE_ZOMBIES.md). Numeri di bilanciamento ed economia → vedi [`BALANCE.md`](BALANCE.md).
> **Vincolo fondante:** grafica e audio **100% procedurali**, **nessun asset esterno**.

Questo documento è la **fonte di verità** del *design del gioco*: cosa fa il giocatore, come si vince e si perde, come si progredisce. Le art bible dicono *com'è fatto*; questo dice *come si gioca*. Se cambi una regola di gioco nel codice, aggiorna anche la scheda qui.

---

## §0 · Visione e pilastri

**Pitch.** Arcade survival top-down: guidi un veicolo lungo una strada infinita che scorre verso sinistra, falci orde di zombi, sopravvivi al boss di regione e usi il bottino tra una missione e l'altra per potenziarti — finché carburante o scocca non cedono.

**Pilastri di design**

1. **Tensione a doppia risorsa.** Non muori solo perché ti colpiscono: muori anche se finisci il **carburante**. Ogni secondo conta; fermarsi non è un'opzione.
2. **Corsa roguelike.** Una "corsa" è una catena di missioni. La morte **azzera tutto** (soldi, veicolo, armi, sopravvissuti, potenziamenti): la posta è alta, ogni acquisto pesa.
3. **Degrado significativo.** I componenti del veicolo si danneggiano e questo **cambia come si guida** (più lento, spara peggio, beve più carburante) — non è solo una barra che cala.
4. **Leggibilità arcade.** Lettura immediata della minaccia, feedback tattile su ogni colpo (vedi Standard di Produzione AAA nell'art bible zombi).

---

## §1 · Core loop

```
                 ┌─────────────────────────────────────────────┐
                 │                                             │
   ┌────────┐    │   ┌──────────┐   boss   ┌──────────┐        │
   │  MENU  │────┼──▶│ MISSIONE │─────────▶│   BOSS   │        │
   └────────┘    │   │ (guida + │  all'82% │ di regione│       │
        ▲        │   │  spara)  │          └────┬─────┘        │
        │        │   └────┬─────┘               │ sconfitto    │
        │ game   │        │ carburante/          ▼              │
        │ over   │        │ salute = 0     ┌──────────┐         │
        │ (reset)│        └───────────────▶│ NEGOZIO  │─────────┘
        │        │       │                 │ (GARAGE) │  missione+1
        └────────┴───────┘                 └──────────┘
```

1. **Missione** (`GameScene`): il veicolo è ancorato a sinistra (`VEHICLE_X = 150`) e si muove solo in verticale dentro la strada. Il mondo scorre, gli zombi arrivano da destra. Spari in automatico in avanti. Avanzi accumulando **distanza**.
2. **Boss** all'**82%** della distanza di missione: mentre il boss è vivo l'avanzamento si congela e gli spawn ordinari si fermano — è un duello.
3. **Missione completata** (boss sconfitto → completamento): converti il punteggio in **monete**, salvi lo stato dei componenti, passi al **Negozio**.
4. **Negozio** (`ShopScene` — "GARAGE"): spendi le monete in riparazioni, potenziamenti, armi, veicoli; recluti **gratis** un sopravvissuto tra 3 offerti. Poi parte la missione successiva.
5. **Loop a cicli**: regioni e boss ciclano (§3). Completare il ciclo delle **7 regioni** dà una **vittoria di ciclo** (schermata dedicata), poi si prosegue in **endless+** con difficoltà crescente (§10). L'obiettivo di lungo termine resta il **record** di missione/punteggio (salvato, §11).

---

## §2 · Comandi

| Input | Azione |
|---|---|
| **↑ / ↓** (o W/S) | Muovi il veicolo su/giù nella strada |
| **Sparo** | Automatico, in avanti, secondo l'arma equipaggiata |
| **Shift** | **Scatto** (dash): scrolla via gli zombi aggrappati · ricarica 5 s |
| **1–5** | Cambia arma posseduta al volo |
| **ESC** | Pausa / Impostazioni (mette in pausa la scena) |
| **SPAZIO** | Avanza nelle schermate di esito (negozio / restart) |
| **M** | Torna al menu dalle schermate di esito |

**Tasti debug** (non per il giocatore finale): `G` god-mode, `H` cura tutto, `N` completa missione, più la galleria modelli in `DebugScene`. Vedi [BALANCE.md §9](BALANCE.md#9--debug--leve-di-tuning).

---

## §3 · Struttura del mondo

Tutto vive in uno **spazio di design alto 600** (vedi [CLAUDE.md → Risoluzione & scaling](../CLAUDE.md) e `Config.ts`). La strada è la fascia `ROAD_TOP=155 … ROAD_BOTTOM=445`; il veicolo è ancorato a `x=150`.

### Regioni (ambienti)
7 ambienti in `ENVIRONMENTS`, percorsi **in ciclo**: `envIndex = (missione − 1) mod 7`.

| # | Regione | Accento luce |
|---|---|---|
| 1 | Città Distrutta | giallo caldo |
| 2 | Autostrada Abbandonata | ocra |
| 3 | Deserto | arancio |
| 4 | Foresta Infestata | verde malato |
| 5 | Zona Industriale | arancio-fuoco |
| 6 | Base Militare | verde oliva |
| 7 | Città Finale | viola/magenta |

> Palette e materia di ogni regione sono specificate nell'[art bible ambiente](ART_BIBLE_AMBIENTE.md). Qui conta solo che **scandiscono la varietà visiva** della corsa, non cambiano le regole.

### Boss di regione
4 boss in `BOSS_CONFIG`, anch'essi **in ciclo**: `boss = BOSS_ORDER[(missione − 1) mod 4]`.

| Boss | HP | Note di design |
|---|---|---|
| Mega Mutante | 80 | introduttivo, mobile |
| Verme Gigante | 110 | largo e basso, schiva difficile |
| Colosso Corazzato | 150 | il più tanky, lento |
| Bestia Radioattiva | 95 | veloce, aggressivo |

> Numeri completi (velocità, ricompensa, hitbox) in [BALANCE.md §6](BALANCE.md#6--boss).

---

## §4 · Anatomia di una missione

| Parametro | Valore | Significato |
|---|---|---|
| Distanza missione | `MISSION_DIST = 18000` u | ~**180 km** mostrati; ~75 s di guida pura a `SCROLL_SPEED=240 u/s` |
| Trigger boss | `82%` (`BOSS_TRIGGER`) | il boss appare a 14 760 u; l'avanzamento si congela finché vive |
| Spawn zombi | a intervallo decrescente | parte da `max(700, 2100 − (missione−1)·80)` ms, accelera (§5) |
| Gigante | ogni `22 000` ms | spawn speciale fuori dal pool ordinario |

**Sequenza:** guida e sopravvivi → all'82% **spawn boss** (gli zombi ordinari smettono) → sconfiggi il boss → schermata *BOSS SCONFITTO* → dopo 2,2 s **MISSIONE COMPLETATA** → bottino → Negozio.

---

## §5 · Nemici

### Roster zombi
6 tipi ordinari (`ZOMBIE_STATS` / `ZOMBIE_MOTION`). Identità di movimento e VFX nell'[art bible zombi](ART_BIBLE_ZOMBIES.md); numeri in [BALANCE.md §5](BALANCE.md#5--nemici).

| Tipo | Ruolo di design |
|---|---|
| **Comune** | massa di base, fragile |
| **Corridore** | sciame veloce, poco danno, ti raggiunge in fretta |
| **Corazzato** | spugna lenta (4 HP), danno alto da contatto |
| **Saltatore** | scatta addosso, danno medio |
| **Tossico** | lascia una nube velenosa quando muore |
| **Gigante** | mini-boss errante (12 HP), spawn temporizzato |

**Pool di spawn ordinario** (peso per frequenza): Comune ×4 · Corridore ×2 · Tossico ×2 · Corazzato ×1 · Saltatore ×1. Il Gigante è fuori pool (timer dedicato).

### Aggancio agli slot del veicolo
Gli zombi che raggiungono il veicolo si **aggrappano** a uno dei 6 slot-componente (`ATTACH_SLOTS`). Da agganciati:
- infliggono **14 danni** al componente collegato ogni **1,6 s**;
- ogni zombi aggrappato **rallenta** il veicolo (−12% velocità verticale, fino a un minimo del 30%).
- Lo **Scatto** (Shift) li sbalza via tutti — è la valvola di sfogo anti-soffocamento (cooldown 5 s, 350 ms di grazia in cui nessuno si riaggancia). Sbalzarli **non dà punteggio**.

---

## §6 · Il veicolo e i suoi componenti

Il veicolo è definito da `VEHICLES[key]` (salute/armatura/velocità/cadenza base) — tabella nell'[art bible oggetti](ART_BIBLE_OGGETTI.md), effetti in [BALANCE.md §3](BALANCE.md#3--veicoli). Sopra di esso vivono **5 componenti** con salute 0–100, che degradano sotto l'aggancio degli zombi e **modificano la guida**:

| Componente | Effetto del degrado |
|---|---|
| **MOTORE** | (slot d'aggancio; contribuisce all'identità del mezzo) |
| **RUOTE** | velocità verticale crolla con la salute (da 100% a 15%) |
| **SERBATOIO** | consumo carburante fino a **3×** a serbatoio rovinato |
| **TORRETTA** | cadenza di fuoco peggiora; a **0 non spari più** |
| **CORAZZA** | il danno ricevuto si moltiplica (fino a ×2,5 a corazza distrutta) |

> Tutte le formule esatte in [BALANCE.md §4](BALANCE.md#4--degrado-dei-componenti). I componenti si **portano dietro** tra una missione e l'altra (salvati nel registry): la riparazione al Negozio è una scelta economica reale.

---

## §7 · Risorse del giocatore

- **Salute** (`100 + bonus veicolo`): a 0 → *"Veicolo distrutto!"* (game over).
- **Carburante** (`100`, +30 con upgrade serbatoio): cala di continuo (`BASE_FUEL_DRAIN`), più in fretta se il serbatoio è danneggiato; a 0 → *"Carburante esaurito!"* (game over). Si ricarica con le **taniche** (+30) che appaiono ogni 7,5 s (ogni 5 s con l'Esploratore).
- **Punteggio / Combo**: ogni uccisione dà punti × moltiplicatore combo. La **combo** sale a ogni kill entro 2,5 s dal precedente e moltiplica fino a **×5** (cap a 13 kill di fila, vedi [BALANCE §2](BALANCE.md#2--economia--flusso-delle-monete)). Il punteggio è la valuta-sorgente: a fine missione diventa **monete** (= ⌊punteggio/8⌋). Il **boss** dà inoltre una **ricompensa in monete diretta** (accreditata subito) **più** +500 punteggio — due accrediti distinti a fine missione.
- **Monete (★)**: spese solo al Negozio. **Non** sopravvivono al game over.

---

## §8 · Armi

5 armi (`WEAPONS`), tutte a fuoco automatico in avanti. Profilo d'uso (numeri in [BALANCE.md §7](BALANCE.md#7--armi)):

| Arma | Identità di design |
|---|---|
| **Mitragliatrice** | base affidabile, gratis |
| **Doppia MG** | due proiettili paralleli, copertura verticale |
| **Fucile Auto** | alta cadenza, danno doppio — DPS singolo-bersaglio |
| **Razzi** | esplosione ad area (r≈90px), lenta — anti-orda/boss |
| **Lanciafiamme** | flusso continuo a corto raggio (range 440) |

Le armi si **comprano** una volta e si **equipaggiano** liberamente (tasti 1–5 o dal Negozio).

---

## §9 · Progressione e meta (Negozio)

Tra le missioni, nel **GARAGE** (`ShopScene`):

- **Potenziamenti** (una tantum): Corazza rinforzata (−20% danno), Motore potenziato (+15% velocità), Torretta migliorata (+25% cadenza), Serbatoio extra (+30 carburante max). Più **Ripara tutto** (ripetibile): componenti → 100%.
- **Armi**: acquisto + equipaggiamento.
- **Veicoli**: 7 mezzi da Auto Civile (gratis) a Veicolo Sperimentale (5000) — salute/armatura/velocità/cadenza crescenti.
- **Sopravvissuti**: a ogni visita ne vengono offerti **3 a caso** tra i non reclutati; se ne prende **1 gratis**. Effetti passivi continui:

| Sopravvissuto | Abilità |
|---|---|
| **Meccanico** | +8 salute al componente messo peggio, ogni 5 s |
| **Medico** | rigenera 0,3 salute/s |
| **Soldato** | colpo automatico verso lo zombi più vicino, ogni 1,6 s |
| **Esploratore** | taniche di carburante ogni 5 s (anziché 7,5 s) |

> Prezzi, costi e curva di potere in [BALANCE.md §8](BALANCE.md#8--negozio-ed-economia).

---

## §10 · Condizioni di vittoria e sconfitta

- **Sconfitta (game over):** salute **o** carburante a 0. La corsa termina e **tutto si azzera** — missione torna a 1, monete a 0, niente sopravvissuti/potenziamenti, di nuovo Auto Civile con sola Mitragliatrice. È una **morte permanente della corsa** (impronta roguelike).
- **Vittoria (di ciclo):** completare il **ciclo delle 7 regioni** (missione 7, 14, 21, …) mostra una schermata **"🏆 VITTORIA · Ciclo N"** e un lampo dorato; poi il gioco **continua in endless+** con lo scaling NG+ (HP nemici/boss crescenti per ciclo, vedi [BALANCE §5](BALANCE.md#5--nemici)). Non è una fine secca: è un traguardo ripetibile che dà un picco e una ragione per spingersi oltre.
- **Record persistente:** missione più lontana e punteggio di missione massimo sono salvati in `localStorage` (`SaveData`) e mostrati nel menu — sopravvivono al game over e alla chiusura del browser.

---

## §11 · Stato persistente (registry)

Lo stato della corsa vive nel `registry` di Phaser (in memoria, non su disco): `missionNumber`, `money`, `vehicle`, `ownedVehicles`, `survivors`, `upgrades`, `components`, `currentWeapon`, `ownedWeapons`, `lastScore`. Il game over li resetta.

L'**unico stato che sopravvive tra le sessioni** è il **record** (`SaveData` → localStorage): `bestMission` e `bestScore`, aggiornati a fine missione e al game over, mostrati nel menu. (Le preferenze — volume, effetti, risoluzione, daltonismo — vivono separate in `Settings`.)

---

## §12 · Domande aperte / ganci di roadmap

> 🗺️ Il piano per affrontare rigiocabilità e game-feel (profondità del core loop, scelte di run, distintività di boss/regioni, meta-progressione) vive in [`ROADMAP_RIGIOCABILITA.md`](ROADMAP_RIGIOCABILITA.md). Le voci qui sotto sono indicizzate lì (§12.2/§12.4 → Track D, §12.5 → Track C).

1. ✅ **Condizione di vittoria** — *implementata*: vittoria al completamento del ciclo di 7 regioni, poi endless+ (vedi §10).
2. 🟡 **Persistenza** — *parziale*: il **record** (missione/punteggio max) è salvato in `localStorage` (`SaveData`). Lo sblocco permanente di veicoli resta da valutare.
3. ✅ **Curva di difficoltà oltre il ciclo** — *implementata*: scaling NG+ degli HP di nemici e boss per ciclo (`diffMult`, [BALANCE §5](BALANCE.md#5--nemici)). Danno/velocità ancora costanti (leva HP-only).
4. ⬜ **Costo della morte** — *aperta*: valutare una valuta meta che sopravvive (sblocchi permanenti) oltre al record.
5. 🟡 **Differenziazione dei boss** — *parziale*: aggiunta una **2ª fase** sotto il 40% HP (attacchi più fitti + telegrafo). Pattern d'attacco completamente distinti per tipo restano un'estensione possibile.

---

> **Manutenzione.** Se modifichi una regola qui descritta (core loop, condizioni di game over, ruoli di nemici/armi/sopravvissuti), aggiorna questa scheda. Per i **numeri** la fonte di verità è il codice + [`BALANCE.md`](BALANCE.md); questo documento descrive **intenti e regole**, non i valori puntuali.
