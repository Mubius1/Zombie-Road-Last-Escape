# 🗺️ Roadmap Rigiocabilità & Game-Feel — Zombie Road: Last Escape

> **Stato:** v0.1 · piano (planning document) · *nessuna riga di codice ancora scritta*
> **Ambito:** come rendere il gioco **più divertente** (profondità del core loop) e **più rigiocabile** (contenuto + retention), in tracce implementabili e spedibili una alla volta.
> **Natura del documento:** questo è un **piano**, non una fonte di verità. Le fonti di verità restano [`GAME_DESIGN.md`](GAME_DESIGN.md) (regole), [`BALANCE.md`](BALANCE.md) (numeri) e le [art bible](ART_BIBLE_ZOMBIES.md) (estetica). Man mano che una voce qui viene implementata, i suoi numeri/regole/visual **migrano** nei documenti canonici e questa roadmap ne traccia lo stato (§9).

---

> 🔁 **AGGIORNAMENTO — il fun-gate (tappa 1) ha FALSIFICATO l'ipotesi di §0, ed era l'esito desiderabile.** Track A (Overdrive/Caricatore/Sputatore/Hazard) è stato implementato per intero, ma al playtest il combat **restava passivo**: il vero collo di bottiglia non erano i *sistemi mancanti*, era il **verbo** — il **fuoco automatico in avanti** lasciava il giocatore a *guardare* l'autofire. La risposta è stata un **COMBAT REBOOT a mira col mouse** (branch `aim-combat`), che il fun-gate ha **VALIDATO**: ora la torretta punta il puntatore (clamp ±82°) e si spara attivamente verso il mirino. Il problema "il giocatore non fa niente" è stato risolto **cambiando il verbo, non aggiungendo altri sistemi**. Il mouse-aim è la **nuova fondazione del combat**; i sistemi di Track A restano e **convivono** con esso (gli zombi a risposta e gli hazard ora chiedono mira *e* posizione). Dettaglio del reboot in [ARCHITETTURA §8.1](ARCHITETTURA.md#81-combat-a-mira-col-mouse-perché-overlay-perché-getworldpoint); la §0 qui sotto è la diagnosi **originale** (autofire), conservata per contesto storico.

> 🗺️ **AGGIORNAMENTO 2 — il gioco NON è un roguelike: è una CAMPAGNA A CHECKPOINT.** Decisione del designer (giugno 2026): la morte non azzera più la corsa. Il gioco **salva a ogni missione** (su disco, anche cross-sessione → "CONTINUA") e al game over **rigioca la missione corrente** pagando un pedaggio (−25% monete), invece di ripartire da zero. Solo "Nuova Partita" azzera. **Conseguenza su questa roadmap: Track D (meta-progressione) si ridimensiona** — il progresso del viaggio già persiste, quindi una valuta meta non è più la spina dorsale della retention (resta un *extra* opzionale per sblocchi-sidegrade). Il vincolo "unlock = sidegrade, non potere" si **allenta** (non c'è più un pilastro "la morte azzera tutto" da proteggere): resta buona norma anti-power-creep, non un dogma. La rigiocabilità si appoggia ora alla **varietà** (Track B/C). Vedi [GAME_DESIGN §10/§11](GAME_DESIGN.md#10--condizioni-di-vittoria-e-sconfitta).

## §0 · Diagnosi: due problemi distinti, un ordine obbligato

Sono emersi due problemi, di natura diversa — e l'ordine in cui si affrontano conta più della lista stessa.

| Problema | Natura | Sintomi osservati | Stato |
|---|---|---|---|
| **"Non è molto divertente"** | profondità del **core loop** | il combat si gioca quasi da solo | ✅ **risolto dal combat reboot** (mira col mouse): il verbo è ora attivo |
| **"Finisce in 2-4 ore"** | **contenuto & retention** | 7 regioni che riusano la stessa strada (cambia il colore), 4 boss in ciclo, una sola modalità, nessuno sblocco persistente, nessun daily/leaderboard | aperto → Track B/C/D |

**Tesi fondante della roadmap:** il secondo problema è *a valle* del primo. Aggiungere meta-progressione e sblocchi sopra un loop che non diverte è un secchio bucato più grande — dà più motivi per *tornare* a fare una cosa che non piace *fare*. Quindi: **prima si approfondisce il loop (Track A), poi se ne aumenta la varietà strutturale (Track B/C), e solo alla fine si costruisce la retention (Track D).**

> **Lezione del fun-gate (a posteriori):** la tesi "loop prima di meta" ha tenuto, ma con una correzione importante — il loop non si approfondisce solo *aggiungendo sistemi* (Track A), bensì anche (e prima) scegliendo il **verbo giusto**. Track A era necessario ma non sufficiente finché il fuoco restava automatico; con la mira col mouse i suoi sistemi finalmente "mordono".

### Perché (ipotesi) il loop non diverte

> 🔁 Questa era l'ipotesi pre-reboot. Il punto debole comune ai quattro sintomi sotto era il **fuoco automatico**; il combat reboot (mira col mouse) attacca proprio quello — vedi il banner in testa a §0. La lascio integrale come diagnosi storica.

Il gioco ha sistemi ricchi *attorno* al combat (degrado componenti, carburante, sopravvissuti, negozio) ma il **combat in sé è poco profondo**, ed è lì che si passa il 90% del tempo:

- **Movimento su 1 solo asse** (su/giù) + **fuoco automatico in avanti**. Le uniche leve attive sono posizione verticale, Scatto (cooldown 5 s) e cambio arma. Per la maggior parte del tempo il giocatore *guarda* l'autofire, non *gioca*.
- **Lo sparo non è skill.** Essendo automatico, la varietà del roster nemici non si traduce in decisioni: 6 tipi di zombi, ma per il giocatore fanno quasi tutti la stessa cosa (cambia solo *quanto a lungo tieni premuto*, che è automatico).
- **La posizione verticale conta poco.** Ci si muove su/giù per allineare colpi (auto) ed evitare il contatto; non c'è un motivo *interessante* per stare in alto piuttosto che in basso in un dato istante.
- **La combo è solo un numero.** Sale da sola con l'autofire e moltiplica il punteggio, ma non alimenta nulla che il giocatore *controlli*.

> ⚠️ **Questa è un'ipotesi da playtest**, non una certezza. La domanda da verificare appena Track A tappa 1 è giocabile: *adesso il combat diverte per 5 minuti senza pensare a sblocchi?* Se la risposta è no, Track B/C/D vanno ripensati prima di spenderci sopra.
>
> 🔁 **Esito (a posteriori):** la risposta del fun-gate con il solo Track A è stata **no** → da qui il combat reboot a mira col mouse, dopo il quale la stessa domanda ha avuto risposta **sì**. Track B/C/D restano validi e non sono stati ripensati nella sostanza: cambia la *fondazione* sotto di loro, non il loro contenuto.

---

## §1 · Principi guida

1. **Loop prima di meta.** Si valida il divertimento minuto-per-minuto prima di costruire la retention.
2. **Più verbi, più decisioni/secondo.** L'obiettivo di Track A è trasformare "guarda l'autofire" in "gestisci risorse e posizione sotto pressione".
3. **Gli sblocchi sono sidegrade, non potere piatto.** La meta-progressione (Track D) — *se* costruita — dovrebbe sbloccare *opzioni* (veicoli/armi disponibili, perk di partenza), non stat gratuite. *(Nota post-checkpoint: il gioco non è più un roguelike "la morte azzera tutto" → questo vincolo si **allenta**, ma resta buona norma per non banalizzare la sfida.)*
4. **Anti-deriva sempre verde.** Ogni numero nuovo nasce in una tabella 🔒 di [`BALANCE.md`](BALANCE.md) (o costante validata), ogni texture/colore nuovo in una art bible → `npm run validate` deve restare verde a ogni passo (vedi [CLAUDE.md Regola n.2/n.3](../CLAUDE.md)).
5. **Ogni tappa è spedibile e testabile da sola.** Niente big-bang: ogni voce della roadmap è un incremento che si può giocare e committare indipendentemente.

> I numeri proposti in questo documento sono **punti di partenza da tarare a playtest**, non valori validati. Diventano valori-sorgente (e finiscono nei validatori) solo quando la voce viene implementata.

---

## §2 · Track A — Approfondire il core combat 🔴 *priorità assoluta*

> Obiettivo: alzare lo skill ceiling e le decisioni/secondo **senza tradire la fantasia** "guido e falcio orde". È il lavoro che attacca direttamente il "non diverte".

### A3 · Overdrive — risorsa attiva caricata dalla combo
*(il singolo intervento con più impatto sul game-feel; lo metto per primo perché è il più economico in rapporto al ritorno)*

Oggi la combo è solo un moltiplicatore di punteggio (gestita in `addKillScore` / decadimento `updateCombo` in [`GameScene.ts`](../src/scenes/GameScene.ts)). La trasformo in una **risorsa che il giocatore spende**.

**Meccanica.** Una barra `overdrive` 0→100, caricata da ogni kill in proporzione alla combo. A barra piena, il tasto **`F`** (confermato) attiva il **SOVRACCARICO** per ~3 s:
- cadenza di fuoco ×2;
- il veicolo diventa **ariete**: il contatto uccide gli zombi senza danneggiare i componenti;
- all'attivazione, **onda d'urto frontale** che sbalza gli aggrappati + i vicini e infligge danno (riusa la logica di sbalzo di `performDash`).

Così la combo diventa *tua* e lo Scatto smette di essere l'unico verbo attivo.

**Numeri proposti** (futura riga in [BALANCE §1](BALANCE.md#1--costanti-di-missione-) come costanti 🔒):

| Costante | Valore | Effetto |
|---|---|---|
| `OVERDRIVE_MAX` | 100 | soglia barra piena |
| `OVERDRIVE_PER_KILL` | `2 + comboMult·2` | carica per kill, scalata dal moltiplicatore combo |
| `OVERDRIVE_DURATION` | 3000 | durata sovraccarico (ms) |
| `OVERDRIVE_FIRE_MULT` | 2.0 | moltiplicatore cadenza durante il sovraccarico |
| `OVERDRIVE_SHOCK_DMG` | 6 | danno dell'onda d'urto di attivazione |

> Taratura obiettivo: una buona catena riempie la barra in ~15-20 kill. Il moltiplicatore combo è quello già definito in [BALANCE §2](BALANCE.md#2--economia--flusso-delle-monete).

**File da toccare:**
- [`src/scenes/GameScene.ts`](../src/scenes/GameScene.ts) — stato `overdrive`; carica in `addKillScore`; input tasto `F` + nuovo `updateOverdrive`; effetto attivazione (cadenza temporanea su `getEffectiveCooldown`, modalità ariete in `onVehicleHitZombie`, onda d'urto sugli `attachedZombies`).
- [`src/HudController.ts`](../src/HudController.ts) — nuova barra Overdrive accanto a salute/carburante, con palette daltonico-safe già usata nell'HUD.
- [`src/SoundManager.ts`](../src/SoundManager.ts) — nuovo `playOverdrive()` (vedi [ART_BIBLE_AUDIO](ART_BIBLE_AUDIO.md)).
- [`src/Juice.ts`](../src/Juice.ts) — `flash` + `bloomBurst` all'attivazione.

**Aggiornamenti documentali (a implementazione):** BALANCE §1 (costanti 🔒) · [GAME_DESIGN §2](GAME_DESIGN.md#2--comandi) (nuovo tasto `F`), [§7](GAME_DESIGN.md#7--risorse-del-giocatore) (nuova risorsa), [§1](GAME_DESIGN.md#1--core-loop) (nota nel loop) · [ART_BIBLE_INTERFACCE](ART_BIBLE_INTERFACCE.md) (barra Overdrive) · [ART_BIBLE_AUDIO](ART_BIBLE_AUDIO.md) (suono attivazione) · `validate:balance` + `validate:audio`.

---

### A2 · Nemici "a risposta"

Non più spugne: nemici che **mappano a un verbo specifico**. Il sistema lo supporta già — basta estendere l'union `ZombieType` ([`World.ts`](../src/World.ts)), le tabelle `ZOMBIE_STATS` / `ZOMBIE_MOTION` / `SPAWN_POOL` e lo switch `onVehicleHitZombie` ([`GameScene.ts`](../src/scenes/GameScene.ts)). Il movimento è già **procedurale** in `updateZombieMotion()`: per un nuovo tipo basta configurarne la firma in `ZOMBIE_MOTION`.

| Tipo nuovo | Comportamento | Verbo richiesto | Numeri proposti (vel · hp · danno · punti · peso pool) |
|---|---|---|---|
| **Caricatore** | si impenna (telegrafo ~700 ms) poi scatta orizzontale verso la tua corsia | **cambia corsia / Scatto-attraverso** | 400 (in carica) · 3 · 30 · 40 · 1 |
| **Sputatore** | resta sulla destra, lancia proiettili tossici sulla tua Y | **non restare fermo in corsia** | 40 · 2 · 12 (proiettile) · 30 · 1 |

Il **Caricatore** rende il movimento verticale una *reazione* (non riempitivo); lo **Sputatore** punisce il camping in una corsia. Entrambi sfruttano il sistema di telegrafo (shake + tint, sul modello di `enterPhase2`) e lo stinger `playBossWarn` già esistente.

> Nota: oggi esiste già il **Tossico** (corpo-a-corpo + nube alla morte). Lo Sputatore è una variante **a distanza** distinta — non lo sostituisce.

**File da toccare:**
- [`src/World.ts`](../src/World.ts) — estendere l'union `ZombieType`.
- [`src/scenes/GameScene.ts`](../src/scenes/GameScene.ts) — righe in `ZOMBIE_STATS`, `ZOMBIE_MOTION`, `SPAWN_POOL`; nuovi `case` in `onVehicleHitZombie`; logica telegrafo+carica e proiettili Sputatore dentro `updateZombieMotion`/`update`.
- [`src/EntityTextures.ts`](../src/EntityTextures.ts) — texture + animazioni walk + frame di telegrafo.

**Aggiornamenti documentali (a implementazione):** [BALANCE §5](BALANCE.md#5--nemici-) (nuove righe 🔒 — `validate:balance` **richiede** velocità/hp/danno/punteggio/peso-pool e un cross-check di copertura) · [ART_BIBLE_ZOMBIES](ART_BIBLE_ZOMBIES.md) (schede nemico §5/§6 — `validate:art`) · [GAME_DESIGN §5](GAME_DESIGN.md#5--nemici) (roster).

---

### A1 · Hazard di corsia

Oggi la strada è **vuota** di ostacoli: gli unici collider sono zombi, proiettili e taniche; l'ambiente genera solo decal cosmetici (sangue/skid/detriti). Aggiungo ostacoli che scorrono col mondo (a `-SCROLL_SPEED`) e rendono la posizione verticale una decisione continua, indipendente dall'autofire.

| Hazard | Effetto al contatto | Numeri proposti |
|---|---|---|
| **Relitto / Barriera** | danno pesante a un componente + knockback; va schivato | 30 a corazza, hit-stop |
| **Chiazza d'olio** | −50% controllo verticale per ~1,5 s (nessun danno) | tween handling |
| **Mina** | danno a scoppio + piccola onda | 20 + flash |

**Tensione di design (chiave):** alla generazione di una tanica, ~40% di probabilità che esca nella corsia di un hazard imminente o di un cluster denso → "su o giù?" diventa rischio/ricompensa reale, non riempitivo.

**File da toccare:**
- [`src/scenes/GameScene.ts`](../src/scenes/GameScene.ts) — nuovo gruppo fisico `hazards` in `buildGroups`; overlap vehicle↔hazards in `buildColliders`; nuovo `updateHazardSpawning()` nel loop `update`; `spawnHazard()`; estendere `cleanOffScreen`. Bias di corsia nella generazione tanica (`spawnFuelCan`).
- [`src/EntityTextures.ts`](../src/EntityTextures.ts) — texture procedurali `hazard_wreck` / `hazard_oil` / `hazard_mine`.
- [`src/SoundManager.ts`](../src/SoundManager.ts) — riusa `playImpact` / `playExplosion`.

**Aggiornamenti documentali (a implementazione):** [ART_BIBLE_OGGETTI](ART_BIBLE_OGGETTI.md) (nuova categoria *hazard*: colori/dimensioni → `validate:art`) · BALANCE nuova sotto-sezione (intervallo spawn + danni 🔒) · [GAME_DESIGN §4](GAME_DESIGN.md#4--anatomia-di-una-missione) (anatomia missione).

---

## §3 · Track B — Scelte dentro la run

> Obiettivo: convertire la **catena lineare** (missione → boss → negozio → identica, ×N) in una **sequenza di decisioni**. È la leva con più ritorno *contemporaneamente* su divertimento e rigiocabilità: attacca il "7 regioni che riusano la stessa strada" non disegnando 7 strade nuove, ma dando 7 *decisioni* diverse.

### B1 · Nodo di scelta percorso

Oggi la catena è rigida: `triggerMissionComplete` → `ShopScene` → `continueGame` → `GameScene`, con regione fissata da `envIndex = (missione − 1) mod 7`. Inserisco una scelta tra negozio e missione — come pannello inline in [`ShopScene.ts`](../src/scenes/ShopScene.ts) prima di `continueGame`, oppure come nuova scena `RouteScene`. 2-3 nodi, ciascuno con un tag rischio/ricompensa:

| Nodo | Boon | Bane |
|---|---|---|
| **Orda fitta** | +50% monete | +30% spawn |
| **Carovana** | +1 sopravvissuto offerto | meno bottino |
| **Strada minata** | bottino raro | più hazard (Track A1) |
| **Riposo** | meno nemici | meno monete |

Richiede di **disaccoppiare la regione** da `(missione − 1) mod 7`: un override opzionale nel registry (`nextRegion` / `routeModifier`).

**File da toccare:**
- Nuova `src/scenes/RouteScene.ts` *oppure* pannello in [`src/scenes/ShopScene.ts`](../src/scenes/ShopScene.ts) (prima di `continueGame`).
- [`src/RunState.ts`](../src/RunState.ts) — campi `routeModifier?` / `nextRegion?` nell'interfaccia `RunData` + reset in `resetRunState`.
- [`src/scenes/GameScene.ts`](../src/scenes/GameScene.ts) — legge e applica il modificatore in `create` (override di `envIndex`, moltiplicatori spawn/bottino).
- `src/game.ts` — registra la scena se nuova.
- [`src/i18n.ts`](../src/i18n.ts) + `src/locales/*` — nuove chiavi (italiano canonico, poi 5 traduzioni; vedi [I18N.md](I18N.md)).

**Aggiornamenti documentali (a implementazione):** [GAME_DESIGN](GAME_DESIGN.md) nuova sezione "struttura della run" (è una **regola** → va documentata) · BALANCE (moltiplicatori dei modificatori) · [ART_BIBLE_INTERFACCE](ART_BIBLE_INTERFACCE.md) (schermata percorso) · `validate:i18n`.

### B2 · Eventi in-run

Eventi a soglie di distanza dentro la missione, per rompere la ripetizione strutturale:

- **Orda notturna** — le luci calano, raffica di spawn;
- **Blocco stradale** — muro di relitti da slalom (riusa Track A1);
- **Convoglio** — scorta un van di sopravvissuti per un bonus;
- **Tempesta** — handling alterato temporaneamente.

Uno scheduler in `update` legato alla percentuale di distanza attiva/disattiva uno stato temporaneo.

**File da toccare:** [`src/scenes/GameScene.ts`](../src/scenes/GameScene.ts) (scheduler + implementazioni eventi); [`src/EntityTextures.ts`](../src/EntityTextures.ts) / [`src/SoundManager.ts`](../src/SoundManager.ts) (VFX/stinger).
**Aggiornamenti documentali:** [GAME_DESIGN §4](GAME_DESIGN.md#4--anatomia-di-una-missione) · BALANCE (parametri evento).

---

## §4 · Track C — Boss e regioni davvero distinti

### C1 · Pattern d'attacco boss

Stato attuale (verificato): in [`BossController.ts`](../src/BossController.ts) ogni boss ha **un solo attacco ripetuto** a timer fisso, e la 2ª fase sotto il 40% HP (`enterPhase2`) si limita ad **accelerare il timer ×1,8**. Niente telegrafi, niente varietà tattica. Già segnalato come aperto in [GAME_DESIGN §12.5](GAME_DESIGN.md#12--domande-aperte--ganci-di-roadmap).

Do a ogni boss **2 attacchi + una firma telegrafata**, trasformando lo `switch` per tipo in `update` in un dispatch verso metodi per-boss:

| Boss | Identità | Attacchi proposti |
|---|---|---|
| **Mega Mutante** | mobile, introduttivo | evoca-add (attuale) + affondo telegrafato sulla tua corsia |
| **Verme Gigante** | largo, basso | mura tossiche tra le corsie (varco da centrare) + ri-emersione |
| **Colosso Corazzato** | tanky, lento | raffica mirata (attuale) + finestre di **scudo frontale** (forza razzi/timing) + slam con onda |
| **Bestia Radioattiva** | veloce, aggressivo | spray tossico (attuale) + burst radiale telegrafato + scatti erratici |

Il telegrafo riusa lo stile di `enterPhase2` (shake + tint) e lo stinger `playBossWarn` già esistente, con un breve wind-up VFX prima della firma.

**File da toccare:**
- [`src/World.ts`](../src/World.ts) — `BOSS_CONFIG`: nuovo campo `pattern` / set di attacchi (**mantenere single-line per voce** — `validate:balance` rilegge la tabella riga per riga).
- [`src/BossController.ts`](../src/BossController.ts) — refactor di `update` in metodi per-boss + executor degli attacchi + telegrafo + timer multipli (oltre a `timer1`).
- [`src/EntityTextures.ts`](../src/EntityTextures.ts) — VFX di telegrafo (opzionale).

**Aggiornamenti documentali (a implementazione):** [GAME_DESIGN §3](GAME_DESIGN.md#3--struttura-del-mondo) (tabella boss) + chiudere [§12.5](GAME_DESIGN.md#12--domande-aperte--ganci-di-roadmap) · [BALANCE §6](BALANCE.md#6--boss-) (cadenze d'attacco 🔒) · [ART_BIBLE_ZOMBIES](ART_BIBLE_ZOMBIES.md) (telegrafi) · [ART_BIBLE_AUDIO](ART_BIBLE_AUDIO.md) (stinger d'attacco).

### C2 · Meccanica per regione

Oggi la regione cambia **solo i colori** (`ENVIRONMENTS`, applicata in `buildWorld` di [`GameScene.ts`](../src/scenes/GameScene.ts)): nessun effetto di gameplay. Aggiungo un modificatore per regione, applicato a inizio missione (nuovo `applyEnvironmentModifier`, dopo `buildWorld`).

| Regione | Meccanica proposta |
|---|---|
| Città Distrutta | strada più stretta / più relitti |
| Autostrada Abbandonata | `SCROLL_SPEED` +15%, più corridori |
| Deserto | drain carburante ×1,25, meno taniche |
| Foresta Infestata | visibilità ridotta (foschia), minacce a distanza più letali |
| Zona Industriale | olio + fuoco, più hazard |
| Base Militare | più corazzati/caricatori, più monete |
| Città Finale | spawn misti d'élite |

Implementato come tabella `REGION_MODIFIERS` per `envIndex` con moltiplicatori (`spawnMult`, `fuelDrainMult`, `scrollMult`, `hazardMult`, `poolBias`, `visibility`), letti nei punti di spawn/fuel/scroll.

**File da toccare:**
- [`src/World.ts`](../src/World.ts) — tabella `REGION_MODIFIERS` (o campi aggiuntivi su `EnvConfig`).
- [`src/scenes/GameScene.ts`](../src/scenes/GameScene.ts) — `applyEnvironmentModifier` + uso dei moltiplicatori in spawn/fuel/scroll.
- [`src/Environment.ts`](../src/Environment.ts) — foschia/visibilità ridotta per la Foresta.

**Aggiornamenti documentali (a implementazione):** [GAME_DESIGN §3](GAME_DESIGN.md#3--struttura-del-mondo) (colonna "meccanica" alla tabella regioni — è una **regola**) · BALANCE (moltiplicatori regione) · [ART_BIBLE_AMBIENTE](ART_BIBLE_AMBIENTE.md) (foschia/visual).

---

## §5 · Track D — Meta-progressione & retention

> Da costruire **per ultimo**: a loop divertente moltiplica, a loop piatto spreca. Qui stanno gli sblocchi persistenti, la daily e la leaderboard.

### D0 · Prerequisito: RNG seedabile

Stato attuale (verificato): **tutta** la randomness di gameplay usa `Math.random` / `Phaser.Math.Between` / `Phaser.Utils.Array.Shuffle` → **non seedabile** (questi usano `Math.random` internamente). La daily challenge lo richiede.

Creo `src/Rng.ts` (PRNG tipo Mulberry32), con un'istanza globale selezionabile: run normale = seed casuale, daily = seed derivato dalla data. Sostituisco la randomness **che influenza il gameplay** — scelta tipo da `SPAWN_POOL` e posizioni in `spawnZombie`/`spawnFuelCan`, shuffle dei 3 sopravvissuti in `ShopScene`, randomness degli attacchi boss in `BossController`. La randomness puramente **cosmetica** (VFX) può restare su `Math.random`.

> ⚠️ **Caveat onesto sul determinismo.** Seedare l'RNG dà a tutti lo **stesso contenuto** (spawn/boss/negozio identici) — la fairness standard di una "daily". *Non* è determinismo frame-perfect: la fisica Arcade con delta variabile non è perfettamente riproducibile. Per una classifica a punteggio va benissimo; un replay input-per-input sarebbe molto più lavoro e non è in programma.

**File da toccare:** nuovo `src/Rng.ts`; patch ai punti di random in [`ShopScene.ts`](../src/scenes/ShopScene.ts), [`GameScene.ts`](../src/scenes/GameScene.ts), [`BossController.ts`](../src/BossController.ts).
**Stima:** ~mezza giornata. È un prerequisito tecnico di D2.

### D1 · Valuta meta persistente + unlock

> ⚠️ **Ridimensionata dal passaggio a campagna a checkpoint:** il progresso di corsa **già persiste** (le monete non si azzerano più al game over), quindi la meta-valuta **non è più necessaria** per la retention — resta un *extra* opzionale per sblocchi-sidegrade.

Se costruita: estendo [`SaveData.ts`](../src/SaveData.ts) — che oggi contiene `bestMission`/`bestScore` **e** lo snapshot `run` (checkpoint) — con `metaCurrency` e `unlocks: Record<string, boolean>`. La meta-valuta si guadagna da **traguardi** (boss ucciso, prima volta in una regione) e si spende in un meta-negozio (nuova `MetaShopScene` dal menu).

> **Vincolo di design (consigliato):** gli unlock dovrebbero restare **opzioni/sidegrade** (veicoli/armi che poi compri in-run, perk di partenza), non stat gratuite — buona norma anti-power-creep. *(Col modello a checkpoint non c'è più un pilastro roguelike "la morte azzera tutto" da proteggere, quindi non è più un vincolo critico — vedi banner in testa.)*

**File da toccare:**
- [`src/SaveData.ts`](../src/SaveData.ts) — estendere `SaveDataShape`; API `addMeta` / `spendMeta` / `unlock` / `isUnlocked` (sul modello di `SaveData.record`).
- [`src/scenes/MenuScene.ts`](../src/scenes/MenuScene.ts) — accesso al meta-negozio.
- Nuova `src/scenes/MetaShopScene.ts`.
- [`src/scenes/ShopScene.ts`](../src/scenes/ShopScene.ts) / [`src/RunState.ts`](../src/RunState.ts) — rispettano gli unlock (quali veicoli/armi disponibili, bonus di partenza in `resetRunState`).

**Aggiornamenti documentali:** [GAME_DESIGN §9/§11](GAME_DESIGN.md#9--progressione-e-meta-negozio) + chiudere [§12.4](GAME_DESIGN.md#12--domande-aperte--ganci-di-roadmap) (regola) · BALANCE (tassi di guadagno + costi unlock 🔒) · [ART_BIBLE_INTERFACCE](ART_BIBLE_INTERFACCE.md) · `validate:i18n`.

### D2 · Daily challenge + leaderboard (locale)

Pulsante "Sfida del Giorno" nel menu (seed = `YYYYMMDD`): stesso contenuto per tutti, un tentativo al giorno. **Leaderboard locale** (best giornaliero salvato in `SaveData`) è banale. **Online richiede un backend** — fuori scope per un gioco offline 100% procedurale: lo segnalo come decisione esplicita. Alternativa senza server: un **codice-punteggio condivisibile** (seed + score + checksum) per la dimensione social a costo zero.

**Dipende da D0.**

**File da toccare:** [`src/scenes/MenuScene.ts`](../src/scenes/MenuScene.ts) (pulsante + `startDaily`, accanto a `newGame` / `continueGame`); [`src/scenes/GameScene.ts`](../src/scenes/GameScene.ts) (legge il flag daily, inizializza `Rng`, disabilita i tasti debug, riporta l'esito); [`src/SaveData.ts`](../src/SaveData.ts) (record giornalieri).

### D3 · Ascension (modificatori di difficoltà)

Livelli "Apocalisse 1…N" sbloccati completando cicli, ognuno aggiunge una **regola** (più danno, meno carburante, solo élite), non solo più HP. Riusa lo scaling NG+ (`diffMult`) già presente in [BALANCE §5](BALANCE.md#5--nemici-). Long-tail per chi "ha visto tutto". Traccia `maxAscension` in `SaveData`.

### D4 · Achievement / sfide

Lista di obiettivi ("vinci senza riparare", "ciclo intero con l'Auto Civile"), tracciati in `SaveData`, che possono concedere meta-valuta. Ganci di engagement a basso costo.

---

## §6 · Sequenza di implementazione

Ogni tappa è spedibile e testabile da sola.

| # | Tappa | Contenuto | Criterio di uscita |
|---|---|---|---|
| 1 | **Fun-gate** | **A3 Overdrive** + **A2 Caricatore** → *(esito: FALLITO con l'autofire)* → **Combat reboot mira-mouse** | *playtest:* il combat è attivo e divertente per 5 min senza pensare a sblocchi? → **sì, dopo il reboot** |
| 2 | Profondità posizione | **A1 Hazard** + **A2 Sputatore** | "su o giù?" è una decisione reale a ogni momento |
| 3 | Decisioni di run | **B1 Scelta percorso** + **B2 un evento** | due run si *giocano* diverse, non solo *durano* diverse |
| 4 | Distintività contenuti | **C1 Pattern boss** + **C2 Meccanica regione** | boss e regioni hanno identità di gameplay, non solo colore |
| 5 | Retention | **D0 SeededRNG → D1 meta/unlock → D2 daily → D3 ascension → D4 achievement** | motivi strutturali per tornare |

> **Il senso dell'ordine:** la tappa 1 è il **test sul divertimento**. Se lì non si accende, le tappe 3-5 vanno ripensate prima di investirci. Per questo l'ordine conta più della lista.

---

## §7 · Impatto su validatori & bible (riepilogo)

Questa roadmap, da sola, **non tocca codice** → tutti i validatori restano verdi dopo il suo commit. Gli aggiornamenti sotto scattano **quando una voce viene implementata**:

| Voce | `validate:art` | `validate:balance` | `validate:audio` | `validate:i18n` |
|---|---|---|---|---|
| A3 Overdrive | barra HUD (INTERFACCE) | costanti 🔒 | suono attivazione | — |
| A2 Nemici | schede nemico (ZOMBIES) | righe `ZOMBIE_STATS`/pool 🔒 | — | nomi/desc nemici |
| A1 Hazard | categoria hazard (OGGETTI) | spawn/danni 🔒 | — | — |
| B1 Percorso | schermata (INTERFACCE) | moltiplicatori | — | nuove chiavi |
| B2 Eventi | VFX evento | parametri | stinger | nomi eventi |
| C1 Boss | telegrafi (ZOMBIES) | `BOSS_CONFIG` 🔒 | stinger | — |
| C2 Regioni | foschia (AMBIENTE) | moltiplicatori | — | — |
| D1 Meta | meta-negozio (INTERFACCE) | costi/guadagni 🔒 | — | nuove chiavi |
| D2 Daily | UI daily (INTERFACCE) | — | — | nuove chiavi |
| D3 Ascension | — | scaling/regole NG+ | — | nomi ascension |
| D4 Achievement | — | (eventuale ricompensa meta) | — | titoli/descrizioni |

> D0 (RNG seedabile) è puramente tecnico → nessun impatto su art/balance/audio/i18n.

> Promemoria operativo: l'italiano ([`src/locales/it.ts`](../src/locales/it.ts)) è la locale **canonica** — ogni nuova stringa nasce lì, poi si traduce nelle altre 5 (`en · es · fr · de · pt`).

---

## §8 · Caveat & rischi

- **L'intera roadmap è molto lavoro per un progetto solo-dev.** L'ordine (§6) è progettato perché ogni tappa renda valore da sola: si può fermarsi dopo qualsiasi tappa con un gioco migliore di prima.
- **Il "fun-gate" (tappa 1) può falsificare l'ipotesi di §0.** È un esito *desiderabile*: meglio scoprirlo dopo un giorno di lavoro che dopo aver costruito tutta la retention.
- **Determinismo daily:** contenuto identico, non replay frame-perfect (vedi D0).
- **Leaderboard online = backend** → fuori scope offline; ripiego sul codice-punteggio condivisibile.
- **Unlock = sidegrade, non potere** → buona norma anti-power-creep (D1). *(Non più "non negoziabile": col passaggio a campagna a checkpoint non c'è un roguelike da proteggere — vedi banner in testa a questo documento.)*
- **Pressione sui validatori:** ogni tappa aggiunge righe alle tabelle 🔒 e schede alle art bible; non saltare l'aggiornamento o `npm run build` fallisce (è il comportamento voluto, [CLAUDE.md Regola n.2](../CLAUDE.md)).

---

## §9 · Stato (checklist di tracking)

| ID | Voce | Track | Stato |
|---|---|---|---|
| A3 | Overdrive (tasto `F`) | A | ✅ fatto |
| A2a | Nemico Caricatore | A | ✅ fatto |
| A2b | Nemico Sputatore | A | ✅ fatto |
| A1 | Hazard di corsia | A | ✅ fatto |
| — | **Combat reboot (mira col mouse)** | **fondazione** | ✅ fatto (branch `aim-combat`) — esito del fun-gate; convive con Track A |
| B1 | Nodo scelta percorso | B | ✅ fatto (3 nodi: Orda Fitta / Strada Minata / Tratta Tranquilla · `RouteScene` tra negozio e missione) |
| B2 | Eventi in-run | B | ⬜ da fare |
| C1 | Pattern d'attacco boss | C | ⬜ da fare |
| C2 | Meccanica per regione | C | ⬜ da fare |
| D0 | RNG seedabile | D | ⬜ da fare |
| D1 | Valuta meta + unlock | D | ⬜ da fare |
| D2 | Daily challenge + leaderboard locale | D | ⬜ da fare |
| D3 | Ascension | D | ⬜ da fare |
| D4 | Achievement / sfide | D | ⬜ da fare |

> **Manutenzione.** Quando una voce viene implementata: (1) aggiorna il suo stato qui, (2) migra numeri/regole/visual nei documenti canonici (GAME_DESIGN / BALANCE / art bible), (3) verifica `npm run validate`. Questa roadmap descrive *intenti e piano*; la verità eseguibile resta nel codice e nei documenti di §7.
