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
2. **Campagna a checkpoint.** Una "corsa" è una catena di missioni che il gioco **salva a ogni missione** (su disco, anche tra sessioni del browser → "CONTINUA"). La morte **non azzera tutto**: rigiochi la missione corrente pagando un **pedaggio** (−25% monete), tenendo veicolo/armi/sopravvissuti/potenziamenti. Solo **Nuova Partita** ricomincia da capo. La posta resta (morire costa), ma il progresso del viaggio non si perde — **non è un roguelike**.
3. **Degrado significativo.** I componenti del veicolo si danneggiano e questo **cambia come si guida** (più lento, spara peggio, beve più carburante) — non è solo una barra che cala.
4. **Mira attiva.** Spari **dove punti**: il combat è un verbo che il giocatore esercita di continuo, non un automatismo di sfondo. Lo Scatto e l'Overdrive aggiungono verbi tattici sopra alla mira.
5. **Leggibilità arcade.** Lettura immediata della minaccia, feedback tattile su ogni colpo (vedi Standard di Produzione AAA nell'art bible zombi).

> 🔁 **Decisione — Combat reboot.** Nelle prime versioni il fuoco era **automatico in avanti**: il fun-gate ha mostrato che rendeva il giocatore **passivo** (bastava posizionarsi in verticale). Il combat è stato riprogettato sulla **mira col mouse**: la torretta ruota verso il puntatore (arco frontale ±82°) e si spara attivamente verso il mirino. La struttura della campagna (km → boss all'82% → 7 regioni → negozio, componenti, carburante, armi, sopravvissuti, Track A, scaling NG+) resta **invariata**.

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

1. **Missione** (`GameScene`): il veicolo è ancorato a sinistra (`VEHICLE_X = 150`) e si muove solo in verticale dentro la strada. Il mondo scorre, gli zombi arrivano da destra. **Miri col mouse** (la torretta segue il puntatore nell'arco frontale) e spari verso il mirino tenendo premuto. Avanzi accumulando **distanza**.
2. **Boss** all'**82%** della distanza di missione: mentre il boss è vivo l'avanzamento si congela e gli spawn ordinari si fermano — è un duello.
3. **Missione completata** (boss sconfitto → completamento): converti il punteggio in **monete**, salvi lo stato dei componenti, passi al **Negozio**.
4. **Negozio** (`ShopScene` — "GARAGE"): spendi le monete in riparazioni, potenziamenti, armi, veicoli; recluti **un** sopravvissuto (max 1 a sosta) tra 3 offerti, compri **razioni** e **curi** i feriti. Poi parte la missione successiva.
5. **Loop a cicli**: regioni e boss ciclano (§3). Completare il ciclo delle **7 regioni** dà una **vittoria di ciclo** (schermata dedicata), poi si prosegue in **endless+** con difficoltà crescente (§10). L'obiettivo di lungo termine resta il **record** di missione/punteggio (salvato, §11).

---

## §2 · Comandi

| Input | Azione |
|---|---|
| **↑ / ↓** (o W/S) | Muovi il veicolo su/giù nella strada |
| **MOUSE** | **Mira**: la torretta ruota verso il puntatore, vincolata all'arco frontale **±82°**; il mirino segna il punto mirato |
| **CLIC / SPAZIO** | **Sparo**: tieni premuto per fare fuoco verso il mirino, secondo l'arma equipaggiata (cliccare l'HUD non spara) |
| **Shift** | **Scatto** (dash): scrolla via gli zombi aggrappati · ricarica 5 s |
| **F** | **Sovraccarico** (overdrive): a barra piena, ~3 s di cadenza ×2 + veicolo-ariete + onda d'urto frontale. La barra si carica dalle uccisioni in combo (§7). |
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
| Spawn zombi | a intervallo decrescente | parte da `max(330, 1350 − (missione−1)·80)` ms, accelera (§5) |
| Sferzata d'orda | ogni `SURGE_INTERVAL = 11 500` ms | onda extra `min(7, 4 + ⌊(missione−1)/2⌋)` spawn; sospesa durante il boss |
| Gigante | ogni `22 000` ms | spawn speciale fuori dal pool ordinario |
| Hazard di corsia | ogni `4500` ms | relitto/olio/mina che scorrono col mondo, da schivare (A1) |
| Eventi in-run (B2) | a ~30% e ~62% (prob. 80%) | picco situazionale, mai prima del boss: **Orda Notturna** (velo scuro + raffica), **Blocco Stradale** (muro di relitti con varco), **Tempesta** (sterzo molle + visibilità ridotta), **Convoglio** (scorta un van alleato → bonus monete + carburante) |

**Densità "orda".** La mira attiva regge una pressione più alta: la strada è **affollata**. Tre leve danno il ritmo:
- **Intervallo più fitto** — lo spawn ordinario parte molto più stretto di prima (pavimento `290` ms vs `500`), così la massa cresce in fretta.
- **Sciami** — i *fodder* (Comune/Corridore) arrivano in gruppo da 1-3, il Tossico da 1-2, gli altri singoli: piccoli grappoli da falciare, non file isolate.
- **Sferzate** — ogni `SURGE_INTERVAL` un'**orda extra** (più chiamate di spawn, ognuna eventualmente uno sciame), che cresce con la missione. È un ritmo a **picchi** (calma → ondata → calma); le sferzate si **fermano durante il duello col boss**.

> ⚠️ Le costanti di densità (intervallo, sciami, `SURGE_INTERVAL`/base) sono **derivate / in taratura**, non valori 🔒 di bilanciamento.

**Sequenza:** guida e sopravvivi → all'82% **spawn boss** (gli zombi ordinari e le sferzate smettono) → sconfiggi il boss → schermata *BOSS SCONFITTO* → dopo 2,2 s **MISSIONE COMPLETATA** → bottino → Negozio.

---

## §5 · Nemici

### Roster zombi
8 tipi ordinari (`ZOMBIE_STATS` / `ZOMBIE_MOTION`). Identità di movimento e VFX nell'[art bible zombi](ART_BIBLE_ZOMBIES.md); numeri in [BALANCE.md §5](BALANCE.md#5--nemici).

| Tipo | Ruolo di design |
|---|---|
| **Comune** | massa di base, fragile |
| **Corridore** | sciame veloce, poco danno, ti raggiunge in fretta |
| **Corazzato** | spugna lenta (4 HP), danno alto da contatto |
| **Saltatore** | scatta addosso, danno medio |
| **Tossico** | lascia una nube velenosa quando muore |
| **Gigante** | mini-boss errante (12 HP), spawn temporizzato |
| **Caricatore** | bruto che si impenna (telegrafo) e poi **carica** sulla tua corsia: va schivato o attraversato con lo Scatto — primo nemico "a risposta" (A2) |
| **Sputatore** | artiglieria tossica a distanza: lancia bile sulla tua corsia, ti costringe a non restare fermo (A2) |

**Pool di spawn ordinario** (peso per frequenza): Comune ×4 · Corridore ×2 · Tossico ×2 · Corazzato ×1 · Saltatore ×1 · Caricatore ×1 · Sputatore ×1. Il Gigante è fuori pool (timer dedicato).

### Aggancio agli slot del veicolo
Gli zombi che raggiungono il veicolo si **aggrappano** a uno dei 6 slot-componente (`ATTACH_SLOTS`). Da agganciati:
- infliggono **14 danni** al componente collegato ogni **1,6 s**;
- ogni zombi aggrappato **rallenta** il veicolo (−12% velocità verticale, fino a un minimo del 30%).
- Lo **Scatto** (Shift) li sbalza via tutti — è la valvola di sfogo anti-soffocamento (cooldown 5 s, 350 ms di grazia in cui nessuno si riaggancia). Sbalzarli **non dà punteggio**.

### Knockback dei colpi
Ogni colpo che **non** uccide dà un **rinculo** al nemico: una spinta lungo l'angolo del proiettile, scalata sugli HP (i bersagli fragili schizzano via, i tank quasi non si muovono) e che **decade** nel tempo, restando dentro la corsia. È **solo game-feel** — dà peso ai colpi e fa "respirare" la mischia — e **non** altera le velocità di movimento né il bilanciamento (costante di feel derivata, non 🔒).

---

## §6 · Il veicolo e i suoi componenti

Il veicolo è definito da `VEHICLES[key]` (salute/armatura/velocità/cadenza base) — tabella nell'[art bible oggetti](ART_BIBLE_OGGETTI.md), effetti in [BALANCE.md §3](BALANCE.md#3--veicoli). Sopra di esso vivono **4 componenti** con salute 0–100, che degradano (per aggancio zombi e per **fonte localizzata**) e **modificano la guida**:

| Componente | Effetto del degrado |
|---|---|
| **MOTORE** | regola il **ritmo di avanzamento**: sano = missione breve, rovinato = arranchi (45% a 0). **A 0 NON è più game over** |
| **RUOTE** | velocità verticale crolla con la salute (da 100% a 15%) |
| **SERBATOIO** | consumo carburante fino a **3×** a serbatoio rovinato |
| **TORRETTA** | cadenza di fuoco peggiora; a **0 non spari più** |

> **Armatura passiva:** la **corazza** non è più un componente che degrada (componenti 5→4) — è una **riduzione danno passiva** (armatura del veicolo + upgrade *Corazza rinforzata*), mostrata come badge HUD. **Morte solo su Salute = 0 o Carburante = 0.** Il colpo danneggia il componente coerente con la **fonte** (tossico → serbatoio; contatti/relitti → scafo/Salute; cannone → torretta; aggancio → slot). Mappa e formule in [BALANCE.md §4](BALANCE.md#4--degrado-dei-componenti).
> I componenti si **portano dietro** tra una missione e l'altra (salvati nel registry): la riparazione al Negozio è una scelta economica reale.

---

## §7 · Risorse del giocatore

- **Salute** (`100 + bonus veicolo`): a 0 → *"Veicolo distrutto!"* (game over).
- **Carburante** (`100`, +30 con upgrade serbatoio): cala di continuo (`BASE_FUEL_DRAIN`), più in fretta se il serbatoio è danneggiato; a 0 → *"Carburante esaurito!"* (game over). Si ricarica con le **taniche** (+30) che appaiono ogni 7,5 s (ogni 5 s con l'Esploratore).
- **Punteggio / Combo**: ogni uccisione dà punti × moltiplicatore combo. La **combo** sale a ogni kill entro 2,5 s dal precedente e moltiplica fino a **×5** (cap a 13 kill di fila, vedi [BALANCE §2](BALANCE.md#2--economia--flusso-delle-monete)). Il punteggio è la valuta-sorgente: a fine missione diventa **monete** (= ⌊punteggio/8⌋). Il **boss** dà inoltre una **ricompensa in monete diretta** (accreditata subito) **più** +500 punteggio — due accrediti distinti a fine missione.
- **Sovraccarico (Overdrive)** (A3): una barra che si carica dalle uccisioni in combo. A barra piena, **F** scatena ~3 s di cadenza di fuoco ×2, veicolo-ariete (il contatto uccide senza danneggiare i componenti) e un'onda d'urto frontale. È la valvola **attiva** legata alla combo — premia l'aggressività e aggiunge un secondo verbo oltre allo Scatto. Numeri in [BALANCE §1](BALANCE.md#1--costanti-di-missione-).
- **Monete (★)**: spese solo al Negozio. **Non** sopravvivono al game over.

---

## §8 · Armi

5 armi (`WEAPONS`), tutte sparano **in direzione della mira** (verso il mirino), non più dritte in avanti — profili e numeri **invariati** (in [BALANCE.md §7](BALANCE.md#7--armi)). Ogni arma ha la sua **torretta** dedicata che ruota col puntatore (vedi art bible oggetti):

| Arma | Identità di design |
|---|---|
| **Mitragliatrice** | base affidabile, gratis; singolo proiettile mirato |
| **Doppia MG** | due linee con offset **perpendicolare** alla mira (±14) — copertura attorno al punto mirato |
| **Fucile Auto** | alta cadenza, danno doppio — DPS singolo-bersaglio, colpo mirato |
| **Razzi** | missile mirato con esplosione ad area (r≈90px), lenta — anti-orda/boss |
| **Lanciafiamme** | ventaglio breve attorno alla mira a corto raggio (range 440) |

Le armi si **comprano** una volta e si **equipaggiano** liberamente (tasti 1–5 o dal Negozio).

---

## §9 · Progressione e meta (Negozio)

Tra le missioni, nel **GARAGE** (`ShopScene`):

- **Potenziamenti** (una tantum): Corazza rinforzata (−20% danno), Motore potenziato (+15% velocità), Torretta migliorata (+25% cadenza), Serbatoio extra (+30 carburante max). Più **Ripara tutto** (ripetibile): componenti → 100%.
- **Armi**: acquisto + equipaggiamento.
- **Veicoli**: 7 mezzi da Auto Civile (gratis) a Veicolo Sperimentale (5000) — salute/armatura/velocità/cadenza crescenti.
- **Sopravvissuti — loop di sopravvivenza** (non più "collezione gratis"): a ogni visita **3 offerti** tra i non reclutati, **max 1 reclutamento per sosta** (M1). Ogni sopravvissuto a bordo **mangia** ogni missione (scorta di campagna; M2): a corto di cibo diventa **affamato** → abilità spenta finché non compri **razioni**. Un **colpo pesante** può **ferirlo** (abilità spenta finché non lo curi al negozio; M3); la **fame prolungata** (≥2 missioni) lo fa **andare via**, e la **morte** ne porta via **uno** (oltre al pedaggio monete). Le perdite si recuperano **salvandone uno sulla strada** (evento di scorta a rischio; M4). Le abilità sono attive **solo se sazio e illeso**:

| Sopravvissuto | Abilità |
|---|---|
| **Meccanico** | +8 salute al componente messo peggio, ogni 5 s |
| **Medico** | rigenera 0,3 salute/s (e dimezza il costo di cura dei feriti) |
| **Soldato** | colpo automatico verso lo zombi più vicino, ogni 1,6 s |
| **Esploratore** | taniche di carburante ogni 5 s (anziché 7,5 s) |
| **Saccheggiatore** | +12% monete a fine missione |
| **Cecchino** | colpo forte allo zombi più resistente davanti, ogni 2,2 s |
| **Artificiere** | tasto **C**: lancia una granata ad area a ricarica |

> Reclutamento, cibo, ferimento, cura, abbandono e salvataggio: numeri-sorgente in [BALANCE.md §8](BALANCE.md#8--negozio-ed-economia).

---

## §10 · Condizioni di vittoria e sconfitta

- **Sconfitta (game over):** salute **o** carburante a 0. La corsa **non** termina: si **rigioca la missione corrente** ripristinando il checkpoint d'inizio missione (veicolo/armi/sopravvissuti/potenziamenti intatti) e pagando un **pedaggio** di recupero (**−25% monete**, `DEATH_MONEY_PENALTY`, vedi [BALANCE §2](BALANCE.md#2--economia--flusso-delle-monete)). Il gioco salva a ogni missione, anche **tra sessioni** ("CONTINUA"). Solo **Nuova Partita** azzera davvero il progresso. *(Il pedaggio è un costo "morbido": chiudere/ricaricare prima di morire lo evita — scelta deliberata per una campagna forgiving, non un roguelike.)*
- **Vittoria (di ciclo):** completare il **ciclo delle 7 regioni** (missione 7, 14, 21, …) mostra una schermata **"🏆 VITTORIA · Ciclo N"** e un lampo dorato; poi il gioco **continua in endless+** con lo scaling NG+ (HP nemici/boss crescenti per ciclo, vedi [BALANCE §5](BALANCE.md#5--nemici)). Non è una fine secca: è un traguardo ripetibile che dà un picco e una ragione per spingersi oltre.
- **Record persistente:** missione più lontana e punteggio di missione massimo sono salvati in `localStorage` (`SaveData`) e mostrati nel menu — sopravvivono al game over e alla chiusura del browser.

---

## §11 · Stato persistente (registry)

Lo stato della corsa vive nel `registry` di Phaser durante il gioco: `missionNumber`, `money`, `vehicle`, `ownedVehicles`, `survivors`, `upgrades`, `components`, `currentWeapon`, `ownedWeapons`, `lastScore`, `routeModifier` (Track B1: nodo di percorso scelto per la prossima missione).

A ogni missione (e dopo ogni ricompensa/acquisto) quello stato viene **salvato su disco** come **checkpoint** (`SaveData.run` → localStorage): è ciò che **"CONTINUA"** ripristina, anche **tra sessioni** del browser. Il game over non lo cancella — lo ripristina col pedaggio (§10); solo **Nuova Partita** lo azzera. Sopravvivono inoltre i **record** (`bestMission`/`bestScore`, mostrati nel menu). (Le preferenze — volume, effetti, risoluzione, daltonismo — vivono separate in `Settings`.)

---

## §12 · Domande aperte / ganci di roadmap

> 🗺️ Il piano per affrontare rigiocabilità e game-feel (profondità del core loop, scelte di run, distintività di boss/regioni, meta-progressione) vive in [`ROADMAP_RIGIOCABILITA.md`](ROADMAP_RIGIOCABILITA.md). Le voci qui sotto sono indicizzate lì (§12.2/§12.4 → Track D, §12.5 → Track C).

1. ✅ **Condizione di vittoria** — *implementata*: vittoria al completamento del ciclo di 7 regioni, poi endless+ (vedi §10).
2. ✅ **Persistenza** — *implementata*: oltre al **record**, l'intera **corsa** si salva a ogni missione (`SaveData.run` → localStorage) → "CONTINUA" cross-sessione (§11). Lo sblocco permanente di veicoli (meta) resta un *extra* possibile (Track D).
3. ✅ **Curva di difficoltà oltre il ciclo** — *implementata*: scaling NG+ degli HP di nemici e boss per ciclo (`diffMult`, [BALANCE §5](BALANCE.md#5--nemici)). Danno/velocità ancora costanti (leva HP-only).
4. ✅ **Costo della morte** — *risolta*: il gioco è una **campagna a checkpoint** (non roguelike). La morte rigioca la missione con un pedaggio (−25% monete) invece di azzerare; il progresso si salva a ogni missione, anche cross-sessione (§10/§11). Una valuta meta resta possibile come *extra* (Track D), non più necessaria per la retention.
5. 🟡 **Differenziazione dei boss** — *parziale*: aggiunta una **2ª fase** sotto il 40% HP (attacchi più fitti + telegrafo). Pattern d'attacco completamente distinti per tipo restano un'estensione possibile.

---

> **Manutenzione.** Se modifichi una regola qui descritta (core loop, condizioni di game over, ruoli di nemici/armi/sopravvissuti), aggiorna questa scheda. Per i **numeri** la fonte di verità è il codice + [`BALANCE.md`](BALANCE.md); questo documento descrive **intenti e regole**, non i valori puntuali.
