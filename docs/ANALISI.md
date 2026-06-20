# Analisi del gioco — Zombie Road: Last Escape

> Analisi multi-agente del **2026-06-17** (branch `art_bible`). 9 dimensioni analizzate in parallelo, ogni finding verificato in modo adversariale contro il codice reale. **73 finding confermati** su 74 (1 scartato in verifica).
>
> Documento di sola lettura/diagnosi: i numeri di riga sono indicativi al momento dell'analisi e vanno riverificati prima di intervenire. Quando si agisce su un finding, seguire le regole di `CLAUDE.md` (art bible / `BALANCE.md` / `npm run validate`).

---

## Stato di avanzamento

> **Aggiornato il 2026-06-17** (branch `art_bible`). Dopo l'audit sono stati applicati **due round di interventi** — i Quick win 2–9 e i 6 bug di correttezza rimanenti — con `npm run build` (validatori + tsc + vite) **verde**. **21 dei 73 finding risolti**; la dimensione *Bug & correttezza* è chiusa al 100% (9/9). Gli unici valori di bilanciamento toccati (armi) sono stati aggiornati nei doc 🔒, quindi i validatori restano allineati.

**Round 1 — Quick win 2–9**

| Finding risolti | Intervento | File principali |
|---|---|---|
| **AU1** | Limiter brick-wall (`DynamicsCompressorNode`) tra master e destination | `SoundManager.ts`, `ART_BIBLE_AUDIO.md` §0/§4/§11 |
| **V2** | Reazione del veicolo al danno: tinta rossa + flash schermo scalato sul colpo | `GameScene.ts` (`flashVehicleDamage`) |
| **X1, X2** | Listener RESUME con handler nominato, guardia `alive/missionDone`, `off()` allo SHUTDOWN | `GameScene.ts` `create()` |
| **P2** | HUD: `setText` solo al cambio valore (cache) + nome arma/selettore/debug su eventi discreti | `GameScene.ts` (`updateHUD`/`refreshWeaponHUD`) |
| **A2** | Reset run centralizzato | nuovo `src/RunState.ts` + GameScene/MenuScene/DebugScene |
| **B1, B2, X7** | Lanciafiamme 28.6 DPS (danno 2, non più cablato); Doppia MG cooldown 280 + linee ±14 | `GameData.ts`, `GameScene.ts`, BALANCE §7 + ART_BIBLE_OGGETTI §4.3 |
| **V1** | Gore colorato per tipo alla morte (`killBurst`: rosso carne / verde tossico / metallo) | `GameScene.ts` |
| **T1, T2, T3, T4, T7** | Rimossi 28 `.js`/`.js.map`, config Vite unificata in `.ts`, scratch eliminati, metadati `zombie-road-last-escape@0.1.0`, `lang="it"` | repo |

**Round 2 — Bug di correttezza**

| Finding risolti | Intervento | File |
|---|---|---|
| **X3** | `clearAttachedZombies()` a fine missione e al game over (niente sprite/timer orfani) | `GameScene.ts` |
| **X4** | Flag `bossDefeated`: mondo congelato + invulnerabilità (danni/carburante) nei ~2,2s di celebrazione; `killBoss` ripulisce proiettili e nubi residui | `GameScene.ts` |
| **X5** | Speronare il gigante dà punteggio/combo/gore (come ucciderlo a colpi) | `GameScene.ts` `onVehicleHitZombie` |
| **X6** | Niente spawn gigante durante la celebrazione (stessa guardia `bossDefeated`) | `GameScene.ts` `updateGiantSpawning` |
| **X8** | Il respiro (wob) compensa la dimensione del body → hitbox invariata | `GameScene.ts` `updateZombieMotion` |
| **X9** | `endGame` ferma anche `bossProjectiles`/`bossGroup` | `GameScene.ts` |

**Round 3 — Decomposizione `GameScene.ts` (A1 ✅)**

`GameScene.ts` **da 2965 a 1333 righe (−1632, ~55%)**, estratto in 4 moduli coesi; tutto importato da GameScene/Shop/Debug/MenuScene, validatori e WATCHED del plugin Vite ripuntati. `npm run build` verde.

| Modulo | Contenuto | Righe |
|---|---|---|
| `src/EntityTextures.ts` | `buildEntityTextures` — texture nemici/boss/oggetti (funzioni pure) | ~853 |
| `src/VehicleTextures.ts` | `buildVehicleTexture` + `mixColor` — texture veicolo | ~354 |
| `src/HudController.ts` | HUD di gioco (vista: barre, punteggio, combo, scatto, selettore armi, componenti, debug) | ~218 |
| `src/BossController.ts` | sottosistema boss: spawn, movimento/attacchi per tipo, barra HP, danni, morte VFX; possiede stato e gruppi fisici; accede a GameScene via interfaccia `BossHost` | ~404 |

`GameScene` resta l'orchestratore del game-loop + sistemi core (veicolo, mondo, spawn, collisioni, combo, scatto, carburante, sopravvissuti, missione/game over). I dati (`ZOMBIE_STATS`/`BOSS_CONFIG`/…) restano in GameScene (letti dai validatori lì).

> ⚠️ La decomposizione è un refactor sensibile al comportamento: il build verifica solo la compilazione, **non** il runtime. Consigliato un playtest (in particolare uno scontro col boss e un game over/restart) prima del commit.

**Round 4 — UI/UX (11 finding)**

| Finding | Intervento | File |
|---|---|---|
| **U1** | HUD: blocco di destra (missione/arma/selettore) ancorato a `designW` → in 16:9 si distribuisce invece di addensarsi | `HudController.ts` |
| **U3** | Selettore armi HUD cliccabile (callback → `selectWeapon`) | `HudController.ts`, `GameScene.ts` |
| **U4** | Floor tipografici alzati: HUD `/ N km` 10px; negozio nomi 8→10px, prezzi/stato 9→11px | `HudController.ts`, `ShopScene.ts` |
| **U5** | % salute sovrapposta alla barra (ridondanza) + toggle **DALTONISMO** in Impostazioni → palette barre blu/giallo (`Settings.colorblind`) | `HudController.ts`, `SettingsScene.ts`, `Settings.ts` |
| **U6** | Card potenziamento non acquistabili: marker `🔒 + manca N★` + feedback al click (suono + lampo rosso sul contatore) | `ShopScene.ts` |
| **U7** | Feedback acquisti: suono + "pop" del contatore monete prima del refresh | `ShopScene.ts` (`SoundManager` statico riusato → no leak master) |
| **U8** | Game over comunica "Progressione azzerata — si riparte dalla Missione 1" | `GameScene.ts` |
| **U9** | Pausa: etichetta `PAUSA` leggibile (blu) + "ESC per riprendere" sul pulsante RIPRENDI | `SettingsScene.ts` |
| **U10** | `ART_BIBLE_INTERFACCE` allineata al codice (pannello 540×480, righe risoluzione/schermo intero/daltonismo, titoli esito 32/50px + stroke) | `docs/ART_BIBLE_INTERFACCE.md` |
| **U11** | Hint comandi HUD da `#333` (illeggibile) a `UI.faint` | `HudController.ts` |
| **U12** | Menu: voce **CONTINUA** se c'è una corsa in corso (verde, primaria) + avviso "azzera il progresso" su NUOVA PARTITA; INVIO continua se c'è progresso | `MenuScene.ts` |

Resta aperto in UI/UX solo **U2** (controlli touch/pointer — big bet). `npm run build` verde (47 token UI ancora validati: la palette daltonico-safe vive in `HudController`, non nei token `UI`).

**Round 5 — Game design (9 finding, G2–G10; resta solo G1)**

| Finding | Intervento | File |
|---|---|---|
| **G2** | Scaling NG+: HP di nemici e boss × `1 + 0.15·⌊(missione−1)/7⌋` (cresce a ogni ciclo di 7 regioni). I valori-base 🔒 restano invariati (fattore a runtime) | `GameScene.ts`, `BossController.ts`, BALANCE §5/§6 |
| **G3** | Combo: `×5` ogni **3** kill (era 5) → raggiungibile; HUD nasconde `×1` | `GameScene.ts`, `HudController.ts`, BALANCE §2 |
| **G4** | Boss: **2ª fase** sotto il 40% HP — attacchi ~1.8× più frequenti + telegrafo "⚠ FURIA" | `BossController.ts` |
| **G5** | **Record persistente** (`SaveData` → localStorage): missione/punteggio max, mostrati nel menu | nuovo `src/SaveData.ts`, `GameScene.ts`, `MenuScene.ts` |
| **G6** | **Vittoria di ciclo**: completare le 7 regioni → schermata "🏆 VITTORIA · Ciclo N" + lampo, poi endless+ | `GameScene.ts`, GAME_DESIGN §10 |
| **G7** | Niente consumo carburante durante il duello col boss (mondo congelato) | `GameScene.ts` |
| **G8** | Movimento anche con **W/S** (come da GAME_DESIGN §2) | `GameScene.ts` |
| **G9** | Soldato: cadenza torretta 3 s → **1,6 s** | `GameScene.ts`, `GameData.ts`, doc |
| **G10** | Documentata la doppia ricompensa boss (monete diretta + 500 punti) | GAME_DESIGN §7, BALANCE §6 |

Resta aperto in game-design solo **G1** (sparo automatico — decisione di design). `npm run build` verde (valori-base di bilanciamento invariati: scaling e cadenze sono fattori/prose, non token 🔒).

**Ancora aperti (principali):** **G1** sparo automatico (decisione); big bet *object pooling (P1)*, *touch/pointer (U2)*; finding di performance (P3–P6), audio (AU2–AU7), arte/VFX (V3–V7), architettura (A3–A8), bilanciamento (B3–B7), tooling (T5–T6).

> ⚠️ **Le posizioni `file:riga` nelle sezioni sottostanti sono quelle dell'audit originale**: dopo gli interventi i numeri di riga sono cambiati. Per lo stato per-finding fare riferimento a questa sezione (gli ID — `A2`, `X4`, …— restano stabili).

---

## Re-audit (2026-06-17) — stato attuale & cosa manca

Secondo passaggio multi-agente (84 agenti) sul **codice attuale**, dopo i 5 round, per cercare **regressioni** dei refactor + ri-verificare gli aperti + nuovi problemi. **74 finding confermati: 1 regressione + 4 incoerenze da refactor · 15 nuovi · 50 aperti storici · 6 verificati già risolti.** Verdetto: gioco in **buono stato** (lifecycle solido, 9 bug storici chiusi, meccaniche R5 corrette, validatori+tsc verdi); ciò che manca è **maturità**, non stabilità.

**Round 6 — Regressioni dai refactor (8 fix, tutti applicati, build verde)**

| ID | Problema | Fix |
|---|---|---|
| **REG1** (alto) | La celebrazione "BOSS SCONFITTO" veniva **tagliata**: a fine duello distance≥MISSION_DIST e `updateDistance` chiamava subito `triggerMissionComplete`, sovrascrivendo i 2,2s. | `update()` ora **congela il mondo** quando `boss.defeated` (return anticipato, solo visuale) → `updateDistance` non gira più in celebrazione. |
| **REG2** (medio) | Mondo non davvero congelato: zombi residui si muovevano/agganciavano sopra l'overlay. | Stesso freeze di REG1. |
| **REG3** (basso) | `jitterGrain` girava durante l'hit-stop (grana che vibra a mondo fermo). | Spostato **dopo** `if (this.frozen) return`. |
| **REG4** (basso) | Hint comandi HUD non citava W/S (aggiunti in R5). | `'↑↓/WS Muovi · …'`. |
| **REG5** (basso) | Pulsante pannello Impostazioni **sbordava** dopo la 5ª riga (daltonismo). | Box 540×**500** + pulsanti rientrati. |
| **REG6** (basso) | Barra HP boss e barra percorso ignoravano il toggle daltonismo. | Entrambe ora CB-aware. |
| **REG7** (basso) | Deny-feedback acquisto solo sui Potenziamenti, non su Armi/Veicoli. | `denyPurchase()` esteso a tutte le card. |
| **REG8** (basso) | Razzi che uccidono uno zombi **aggrappato** non davano punteggio/combo. | `addKillScore(5)` come `checkBulletsVsAttached`. |

Inoltre allineati `CLAUDE.md` e `ARCHITETTURA.md` ai refactor (citavano `spawnBoss`/`updateBoss` rimossi; mancava `validate:balance`/`validate:audio` e i nuovi file).

**🟠 Difetto di efficacia (NON una regressione, ma alto) — ancora da decidere:** lo scaling NG+ (G2) è **quasi inerte**: `Math.round(1×1.15)=1` → i nemici da 1 HP (~60% del pool) non scalano fino al ciclo 6, e danno/velocità non scalano affatto. **B4 è risolto solo formalmente.** Va deciso assieme al trade-off del **Veicolo Sperimentale** (B3, dominante su tutti gli assi) come pacchetto di ribilanciamento late-game.

**Cosa manca (big bet, prioritizzati dal re-audit):**
1. **Object pooling** (P1) — proiettili/particelle/detriti senza pool: churn GC nei momenti caldi.
2. **Ribilanciamento late-game** — NG+ più ripido (ceil/0.25 + leva danno) + trade-off Sperimentale.
3. **CI + test + ESLint** (T5) — nessuna rete contro regressioni di logica (proprio come REG1).
4. **Tipizzare registry + dati zombi/boss** (A3/A4) e **rompere l'import circolare** GameScene↔BossController (spostando `BOSS_CONFIG`/`ROAD_*`/`ENVIRONMENTS` in un modulo dati neutro).
5. **`SoundManager.dispose()`** (no master orfani a ogni restart, AU7) + eventi audio mancanti (AU2–AU6).
6. **Modello di input** — G1 (auto-fire vs SPACE) + U2 (touch/pointer).

**Aperti storici confermati (non regressioni):** A3–A8, P3/P5/P6, AU2–AU7, V4–V7, B3/B5/B6/B7, T5, G1, U2. **Verificati già risolti/conformi:** V3 (scia baked, ok per art bible), T6 (WATCHED completa), + tutte le meccaniche R5.

**Round 7 — Big bet "alta priorità" (5 pacchetti, build verde dopo ciascuno)**

| ID | Pacchetto | Cosa è stato fatto |
|---|---|---|
| **B3+B4** | Ribilanciamento late-game | NG+ ora **morde**: `difficultyMult` step **0.2** (era 0.15), HP con `Math.ceil` (i nemici da 1 HP scalano: prima `round(1×1.2)=1` li lasciava fermi), **danno da contatto scalato** (`scaledDamage`, prima non scalava); boss in sync. **Sperimentale** da dominante-su-tutto a **glass cannon** (salute/armatura 120/50→**60/20**, resta re di velocità 1.2 / cadenza 1.5). BALANCE §3/§5 aggiornati (con nota "da tarare a playtest"). |
| **AU** | Teardown + eventi audio | `SoundManager.dispose()` (scollega master+limiter → no nodi orfani a ogni restart, AU7), cablato in `GameScene`/`SettingsScene` SHUTDOWN; **buffer di rumore condiviso** (AU4, niente alloc per sparo); `ctx.resume()` in `startEngine` (AU6); disconnessione catena motore su `onended` (AU2, parte leak); **2 cue nuovi** (AU5): stinger apparizione boss `playBossWarn`, allarme carburante `playLowFuel` (<25%, isteresi). Schede in ART_BIBLE_AUDIO §5.11/5.12. |
| **T5** | Rete anti-regressione | Nuovo validatore **`validate:i18n`** (parità chiavi + coerenza segnaposto `{…}` + no duplicati nei 6 dizionari) agganciato a `validate`/`build`/plugin dev; **CI GitHub Actions** (`.github/workflows/ci.yml`) che gira `npm run build` a ogni push/PR. *ESLint + unit-test delle formule pure: rimandati (richiedono nuove devDependencies, non installabili nell'ambiente attuale).* |
| **A3+A4** | Architettura | **Import circolare rotto**: `BOSS_CONFIG`/`BOSS_ORDER`/`ROAD_*` + tipi dominio spostati nel modulo neutro **`src/World.ts`**; `BossController` non importa più `GameScene` (verificato). Validatori art/balance ri-puntati a `World.ts`. **Registry tipizzato** (A3): `RunData` + `getRun`/`setRun` in `RunState.ts`, migrati **tutti i 60 call site** → le chiavi/valori del canale cross-scena sono ora type-checked. |
| **P1** | Object pooling | **Proiettili** poolati (pattern Phaser `bullets.get()` + `enableBody` / `killBullet`→`disableBody`): l'oggetto più frequente non fa più create/destroy a ogni colpo. Boss via `BossHost.killBullet`. ⚠️ *Da verificare a playtest* (correttezza pool non coperta dalla build). **Razzi e particelle/detriti** (`add.image`+tween) **non** ancora poolati → follow-up (richiedono pool con gestione tween). |

**Resta da fare dopo R7:** P1-fase2 (rockets + particelle/detriti), ESLint+unit-test (T5), medie A5–A8 · P3/P5 · B5/B7, basse AU3/AU4 · V4–V7 · P6 · B6, decisioni G1/U2. La tabella prioritizzata vive nella chat.

---

## Verdetto complessivo

"Zombie Road: Last Escape" è un progetto solido e sorprendentemente maturo per un titolo 100% procedurale: arte, audio e toolkit di juice sono di livello alto e coerenti con le proprie art bible. Le fondamenta tecniche sono buone — servizi condivisi ben separati, TypeScript strict, tre validatori anti-deriva agganciati a build e dev, documentazione architetturale eccellente.

I problemi non sono di crash né di qualità estetica, ma di tre tipi ricorrenti:

1. **Debito strutturale** concentrato in `GameScene.ts` (monolite da 2838 righe).
2. **Game-feel/feedback debole sugli eventi più frequenti** (morte zombi comune, danno al giocatore) in contrasto con i climax spettacolari (morte boss).
3. **Discrepanze tra documenti di design e codice reale** (sparo non automatico, W/S assenti, difficoltà che si appiattisce).

A questo si aggiunge **igiene del repository da finalizzare** (artefatti `.js` committati, doppia config Vite) e alcuni **bug reali di gestione stato tra scene** (listener RESUME accumulato, race condition pausa/morte). Nel complesso il gioco è giocabile e bello, ma il late-game perde tensione e il core loop non comunica abbastanza ciò che il giocatore fa più spesso.

### Stato di salute per area

| Area | Salute (audit) | # finding | Risolti |
|---|---|---|---|
| Architettura & qualità del codice | discreto | 8 | A2 · **A1 ✅** (texture+HUD+boss estratti) |
| Performance & rendering | discreto | 6 | 1 (P2) |
| Game design & progressione | discreto | 10 | 9 (G2–G10) · resta G1 (decisione) |
| Bilanciamento & economia | discreto | 7 | 2 (B1, B2) |
| Audio procedurale | buono | 7 | 1 (AU1) |
| Arte procedurale & VFX / game-feel | buono | 7 | 2 (V1, V2) |
| UI/UX, HUD & menu | buono | 12 | 11 (U1, U3–U12) · resta U2 (touch) |
| Bug & correttezza | discreto | 9 | **9 ✅ (tutti)** |
| Build, tooling, docs e igiene repo | discreto | 7 | 5 (T1–T4, T7) |

### Temi trasversali

- **Debito strutturale concentrato in GameScene.ts**: il monolite da 2838 righe è la radice di molti finding architetturali, di performance e di bug (responsabilità eterogenee, stato per-sprite stringly-typed, sistemi non isolabili).
- **Deriva tra documentazione e codice**: ripetuti scostamenti tra ciò che `GAME_DESIGN.md`/`BALANCE.md`/art bible dichiarano e ciò che il codice fa (sparo non automatico, W/S assenti, difficoltà che non scala, geometrie UI, danno lanciafiamme cablato), molti non coperti dai validatori automatici.
- **Feedback più povero sugli eventi più frequenti**: morte dello zombi comune e danno al giocatore sono i momenti meno succosi, in stridente contrasto con le morti boss spettacolari; mancano gore colorato, scie proiettili e reazione del veicolo al danno.
- **Stringly-typed e magic number duplicati**: registry e `getData/setData` senza tipi, valori di bilanciamento replicati (`BULLET_SPEED` vs `WEAPONS.mg.speed`, +30 tanica, danno flamethrower) creano fonti di verità multiple e rischio di deriva silenziosa.
- **Pattern duplicati e allocazioni non riusate**: factory Graphics ripetuta con cast `as any`, override OVERSAMPLE duplicato, reset run in tre punti, e soprattutto `add.image`+tween per ogni effetto invece di pool/emitter persistenti.
- **Late-game senza tensione**: difficoltà appiattita, dominanze di loadout (Sperimentale, Razzi), assenza di climax e di meta-progressione convergono nel rendere il gioco banale e poco rigiocabile una volta che il giocatore è forte.
- **Robustezza del ciclo di vita tra scene**: listener accumulati, race condition pausa/morte, entità e proiettili non ripuliti a fine partita — bug non fatali ma che degradano visibilmente l'esperienza nelle transizioni.
- **Igiene del repository e tooling da finalizzare**: artefatti `.js` committati, doppia config Vite, file di scratch, metadati boilerplate e assenza di CI/test, nonostante un toolchain di validazione di base molto valido.

---

## Roadmap prioritizzata

### Quick wins (alto impatto / basso sforzo)

| # | Stato | Intervento | Perché |
|---|---|---|---|
| 1 | ⬜ aperto | Rendere lo sparo automatico (o allineare il doc) | Decisione di design: il doc dichiara "sparo automatico" ma il codice spara solo tenendo SPAZIO. |
| 2 | ✅ fatto | Limiter sul master audio (AU1) | Elimina il clipping nel momento più climatico (morte boss). |
| 3 | ✅ fatto | Feedback visivo del danno sul veicolo (V2) | Il danno ora si "sente" anche sul corpo del veicolo + ai bordi schermo. |
| 4 | ✅ fatto | Guardia RESUME + cleanup listener (X1, X2) | Niente motore duplicato né riavvio "da morto". |
| 5 | ✅ fatto | HUD aggiornato solo al cambio valore (P2) | Niente re-render canvas/upload GPU inutili 60 volte/s. |
| 6 | ✅ fatto | Reset run centralizzato (A2) | `resetRunState()` elimina la tripla duplicazione. |
| 7 | ✅ fatto | Igiene repo (T1–T4, T7) | `.js` rimossi, config Vite unica, scratch via, metadati corretti. |
| 8 | ✅ fatto | Differenziare Lanciafiamme e Doppia MG (B1, B2, X7) | Non più scelte dominate; danno lanciafiamme non più cablato. |
| 9 | ✅ fatto | Gore colorato per-tipo alla morte (V1) | L'uccisione comunica COSA hai ucciso (rosso/verde/metallo). |

> **Bug & correttezza:** oltre ai quick win, i 6 bug residui (**X3, X4, X5, X6, X8, X9**) sono stati corretti — vedi §Stato di avanzamento. La dimensione è chiusa al 100%.

### Big bets (interventi strutturali)

| # | Intervento | Posizione | Perché |
|---|---|---|---|
| 1 | Scomporre GameScene.ts in moduli/controller | `GameScene.ts:1-2838` | ~1100 righe di authoring texture pure e già statiche (basso rischio), + BossController + HudController → sotto ~800 righe. |
| 2 | Riprogettare curva difficoltà late-game + climax | `GameScene.ts:237`, `GAME_DESIGN.md:200-214` | Scala solo la frequenza spawn (satura ~missione 18); serve scaling NG+ e/o condizione di vittoria. |
| 3 | Object pooling per proiettili/particelle/detriti | `GameScene.ts:1543-1551, 2117-2128, 2825-2837` | Decine di GameObject+Tween al secondo → micro-stutter da GC. |
| 4 | Controlli touch/pointer | `GameScene.ts:1642-1662` | Solo tastiera: ingiocabile su tablet/telefono. |
| 5 | Fasi e pattern d'attacco reali per i boss | `GameScene.ts:2555-2590` | Differiscono solo per oscillazione e proiettile: il duello è "tieni premuto SPAZIO". |
| 6 | Meta-progressione persistente + CI | `GameScene.ts:2450-2463`, `package.json:6-14` | Reset totale senza record/sblocchi; validatori solo in locale. |

---

## Finding per dimensione

Legenda severità: **critico / alto / medio / basso**. Sforzo: **piccolo / medio / grande**. Tutti i finding sotto sono a confidenza di verifica **alta**.

> ℹ️ Questa è la fotografia dell'**audit originale**. Per sapere quali finding sono **già risolti** (e con quale intervento) vedi la §Stato di avanzamento in cima al documento; i `file:riga` qui sotto sono dell'audit e possono non corrispondere più al codice attuale.

### 1. Architettura & qualità del codice — *discreto*

Basi solide (servizi condivisi ben separati, doc architetturale eccellente, TS strict). Problema dominante: `GameScene.ts` monolite; stato run "stringly-typed" non tipizzato con reset duplicato in tre punti.

**A1 — GameScene.ts è un monolite da 2838 righe** *(alto / grande)* — `GameScene.ts:1-2838`
Una sola classe accentra authoring texture (~1100 righe), HUD, tutti i sistemi di gameplay, sottosistema boss, wiring audio e reset stato (~50 metodi, >30 campi). Ogni modifica è rischiosa e nulla è testabile in isolamento.
*→ Estrarre authoring texture in moduli statici (`EntityTextures.ts`/`VehicleTextures.ts`, basso rischio), il boss in un `BossController`, l'HUD in un `HudController`. Obiettivo: GameScene sotto ~800 righe di orchestrazione.*

**A2 — Logica di reset della run duplicata identica in tre punti** *(alto / piccolo)* — `GameScene.ts:2455-2463`, `MenuScene.ts:155-163`, `DebugScene.ts:200-208`
Nove `registry.set` copiati carattere per carattere in `endGame`, `newGame`, `startFresh`. Aggiungere una chiave richiede di toccare tre file.
*→ Centralizzare in `resetRunState(registry)`; è anche il posto naturale per tipizzare le chiavi del registry.*

**A3 — Stato della run sul registry non tipizzato** *(medio / medio)* — `GameScene.ts:218-246`, `ShopScene.ts:53-60`, `DebugScene.ts:184-208`
Chiavi-stringa libere (`'money'`, `'missionNumber'`...) senza tipi; ogni lettura ripete `?? 0` e cast manuali. Una chiave sbagliata non è intercettata dal compilatore.
*→ Wrapper tipizzato `RunState` con get/set tipizzati e default centralizzati.*

**A4 — Dati delle entità via getData/setData stringly-typed** *(medio / medio)* — `GameScene.ts:2053-2068, 2147-2176, 2257-2262`
Stato per-sprite (`'hp'`, `'type'`, `'rockPhase'`...) con 53 occorrenze di `setData/getData` a chiavi-stringa + cast ripetuti. La "forma" di uno zombi è implicita e sparsa.
*→ Interfaccia `ZombieData` + helper tipizzati o factory di spawn.*

**A5 — tsconfig.json privo di flag anti-deriva** *(medio / piccolo)* — `tsconfig.json:2-15`
`strict` attivo ma mancano `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `noImplicitOverride`. Con tanti accessi indicizzati (`SPAWN_POOL[...]`, `RESOLUTIONS[idx]`) il terzo avrebbe valore reale.
*→ Aggiungere subito i primi tre flag (basso rischio); valutare `noUncheckedIndexedAccess` in seguito.*

**A6 — Factory di Graphics per texture duplicata in 4 punti con `as any`** *(basso / piccolo)* — `GameScene.ts:336, 341-347, 1151-1156`, `Juice.ts:18-38`, `Environment.ts:82`
Il pattern `make.graphics({add:false} as any)` ricorre 9 volte; l'override OVERSAMPLE è duplicato in `OS_G` e in `buildVehicleTexture`.
*→ Helper condivisi `makeTexGraphics`/`makeOversampledGraphics`.*

**A7 — BULLET_SPEED duplica WEAPONS.mg.speed** *(basso / piccolo)* — `GameScene.ts:18, 2131`, `GameData.ts:44`
`BULLET_SPEED = 680` replica `WEAPONS.mg.speed = 680`; anche colore e danno della torretta soldato sono hardcoded. Due fonti di verità.
*→ Derivare `fireAutoShot` da `WEAPONS.mg` o documentare la divergenza voluta.*

**A8 — Tasti di debug e God mode cablati in produzione** *(basso / piccolo)* — `GameScene.ts:1655-1661, 192-193`
Hotkey di sviluppo (0/G/B/N/H) e `debugGod` intrecciati nel codice shippato, attivi anche in build di produzione.
*→ Gate dietro `import.meta.env.DEV` e/o `buildDebugInput()` chiamato solo in dev.*

### 2. Performance & rendering — *discreto*

Fondamenta solide (texture generate una volta, Graphics distrutti, ambiente bake-once, cleanup off-screen). Problema sistemico: nessun object pooling + micro-sprechi nel loop `update()`.

**P1 — Nessun object pooling: proiettili/particelle/detriti/decal create-destroy a ogni colpo** *(alto / grande)* — `GameScene.ts:1543-1551, 2117-2128, 2825-2837, 2014-2042`
Gruppi senza `maxSize`/pooling; ogni proiettile/particella è `create()`+`destroy()`. MG continua + spawn fitti + morte boss = decine di GameObject e Tween al secondo → garbage e micro-stutter da GC.
*→ Pooling Phaser (`classType`+`maxSize`, `get()`/`killAndHide()`) e `ParticleEmitter` persistenti con `emitParticleAt()`.*

**P2 — updateHUD ridisegna tutto il testo ogni frame** *(medio / medio)* — `GameScene.ts:1892-1940` (da `update():324`)
`setText` incondizionato su punteggio/km/carburante/arma/combo/debug ogni frame: ogni `setText` con stringa diversa forza re-render canvas + upload GPU. Valori che cambiano raramente → lavoro sprecato 60 volte/s.
*→ Memorizzare l'ultimo valore mostrato e aggiornare solo al cambio; spostare l'arma in `selectWeapon` e il debug al toggle.*

**P3 — Sequenza morte boss alloca 30+ Image+Tween in pochi frame** *(medio / medio)* — `GameScene.ts:2705-2769, 2771-2795`
`bossDeathFx` lancia 6 `spawnHitParticles` ritardati + 2-4 `spawnDebris` + (mega_mutant) 5 zombi-immagine, tutti `add.image`+`tweens.add`. Picco di allocazioni proprio durante hit-stop e shake.
*→ `ParticleEmitter` persistente con burst (`emitParticleAt` con `quantity`).*

**P4 — Jitter della grana (e Math.random) eseguito ogni frame anche durante il freeze** *(basso / piccolo)* — `GameScene.ts:298-304`, `Juice.ts:80-84`
`Juice.jitterGrain` gira anche durante hit-stop (`frozen=true`) con due `Math.random()`, scrivendo `tilePositionX/Y`.
*→ Spostarlo dopo il guard `if(this.frozen) return;`.*

**P5 — checkBulletsVsAttached è O(proiettili × aggrappati) ridondante** *(basso / medio)* — `GameScene.ts:1824-1846` (da `update():318`)
Doppio loop con `Distance.Between` (sqrt) ogni frame, anche quando nessun proiettile è vicino agli aggrappati (che stanno all'estrema sinistra).
*→ Early-out su `x > vehicle.x+60` e confronto sul quadrato della distanza.*

**P6 — Tinta/clearTint via delayedCall su ogni colpo** *(basso / piccolo)* — `GameScene.ts:2168-2169, 2267-2269, 1839-1840, 1818`
Ogni colpo non letale crea `setTint`+`delayedCall(80,...)` con closure che cattura lo sprite: molti TimerEvent/closure al secondo.
*→ Pool di TimerEvent riusati o timestamp `clearTintAt` ripristinato in `updateZombieMotion`.*

### 3. Game design & progressione — *discreto*

Core loop solido (doppia risorsa, degrado componenti, run roguelike, boss a ciclo, negozio meta). Discrepanze concrete doc↔codice, difficoltà che si appiattisce, boss poco caratterizzati, combo lenta.

**G1 — Lo sparo NON è automatico: il doc dichiara il contrario** *(alto / piccolo)* — `GameScene.ts:1690-1695`
`GAME_DESIGN.md` §1/§2 dicono "spari in automatico"; il codice spara solo con `spaceKey.isDown`. Anche l'hint HUD dice "SPAZIO Spara".
*→ Decidere la fonte di verità (consigliato fuoco automatico) e allineare doc/HUD.*

**G2 — La difficoltà si appiattisce dopo ~7 missioni** *(alto / medio)* — `GameScene.ts:237, 1792`, `ZOMBIE_STATS:84-91`
L'unica leva è l'intervallo di spawn `max(700, 2100-(mission-1)*80)`: dalla missione ~18 è fisso a 700ms. HP/danno/velocità di zombi e boss costanti per sempre, mentre il giocatore accumula potenza composta.
*→ Scaling NG+ legato al ciclo (es. HP/danno ×`1+0.15*floor((mission-1)/7)`) o peso crescente dei tipi corazzati; in alternativa dare una fine al loop.*

**G3 — Il moltiplicatore combo x5 richiede 21+ kill consecutivi** *(medio / piccolo)* — `GameScene.ts:1756-1758`
`comboMultiplier = clamp(1+floor((combo-1)/5),1,5)`: servono 6/11/16/21 kill (finestra 2.5s ciascuno) per x2/x3/x4/x5. Il x5 è quasi mai visto; l'HUD mostra "×M" da combo≥2 ma il moltiplicatore resta x1 fino a 6 (sembra un bug).
*→ Accorciare la scala (ogni 3 kill) o mostrare il moltiplicatore solo quando >1; documentare in BALANCE/GAME_DESIGN.*

**G4 — I 4 boss differiscono solo per statistiche e timer** *(medio / grande)* — `GameScene.ts:2555-2590`
`updateBoss` distingue solo ampiezza/periodo dell'oscillazione e tipo di proiettile. Niente fasi, telegraphing, cambi sotto soglia HP: il duello è "tieni premuto SPAZIO mirando in verticale".
*→ Almeno una seconda fase sotto il 40% HP + telegraphing; variare i pattern di movimento (es. Colosso che carica).*

**G5 — Reset totale al game over senza meta-progressione** *(medio / medio)* — `GameScene.ts:2450-2463`
`endGame` azzera tutto; niente localStorage né valuta meta. Le morti tardive (10+ minuti) non lasciano nulla → rigiocabilità bassa.
*→ Persistere almeno il record (high score/distanza) e valutare una valuta meta minima.*

**G6 — Nessuna condizione di vittoria: il loop endless non ha climax** *(medio / medio)* — `GAME_DESIGN.md:200,212-214`, `GameScene.ts:2398-2436`
`triggerMissionComplete` incrementa solo `missionNumber` all'infinito. Combinato con la difficoltà appiattita, il gioco perde tensione quando il giocatore è forte.
*→ Traguardo: completare il ciclo regioni sblocca un boss conclusivo + schermata di vittoria, poi endless+ con scaling NG+.*

**G7 — Boss tanky + arma lenta: rischio pressione carburante nel duello** *(basso / piccolo)* — `GameScene.ts:311, 1772-1776, 2393`
Durante il boss l'avanzamento si congela ma `updateFuel` continua a drenare. Colosso 150 HP con MG base (~42s) vs serbatoio ~45s (3x se danneggiato); spawn ordinari fermi = niente kill.
*→ Sospendere/dimezzare il drain durante `bossActive` o garantire una tanica all'inizio del boss.*

**G8 — Tasti W/S documentati ma non implementati** *(basso / piccolo)* — `GameScene.ts:1643, 1679-1680`
`GAME_DESIGN.md` §2 indica "↑/↓ (o W/S)" ma `createCursorKeys()` non mappa W/S.
*→ Aggiungere il binding W/S o rimuovere "(o W/S)" dal doc.*

**G9 — Il Soldato è nettamente più debole degli altri sopravvissuti** *(basso / piccolo)* — `GameData.ts:22-27`, `GameScene.ts:1874-1881`
Medico/Meccanico/Esploratore hanno impatto strategico forte; il Soldato spara 1 colpo ogni 3s, marginale → quasi sempre scartato.
*→ Rafforzarlo (raffica/cadenza/sinergia con gli zombi aggrappati); allineare BALANCE §8.*

**G10 — Doppia ricompensa monete a fine missione non documentata** *(basso / piccolo)* — `GameScene.ts:2685-2687, 2402-2403`
`killBoss` accredita `reward` (400-650) + 500 punti; poi `triggerMissionComplete` accredita `floor(score/8)`. Doppio accredito non descritto nel doc.
*→ Chiarire in GAME_DESIGN §1/§7 e BALANCE §6 o consolidare in un unico flusso.*

### 4. Bilanciamento & economia — *discreto*

Tabelle codice↔`BALANCE.md` allineate e protette da `validate:balance`. Dominanze nette nel parco armi/veicoli e punto di rottura economico late-game.

**B1 — Lanciafiamme dominato dal Fucile** *(alto / piccolo)* — `GameData.ts:46, 48`, `GameScene.ts:2107, 1954, 2150`
Fucile: cooldown 140/danno 2 → 14.3 DPS, prezzo 350, range infinito. Lanciafiamme: 70/1 → stesso 14.3 DPS, costa 400, range 440. Strettamente inferiore.
*→ Dargli identità (pierce/AoE o DPS nettamente superiore) e riprezzare; aggiornare BALANCE §7 + validate.*

**B2 — Doppia MG: DPS/linea inferiore alla MG base** *(alto / medio)* — `GameScene.ts:2102-2104`
Costa 200, cooldown 310 (3.2 DPS/linea) vs MG gratuita 280 (3.6); i due proiettili a `vy±8` distano solo 16px e spesso colpiscono uno solo. Già segnalata "da rivedere" in BALANCE §7.
*→ Aumentare separazione verticale (±14/16) o cooldown ≤280, o riposizionarla come anti-orda a ventaglio.*

**B3 — Veicolo Sperimentale: nessun trade-off** *(medio / medio)* — `GameData.ts:13`, `BALANCE.md:88`
Ha contemporaneamente velocità più alta, cadenza più alta, salute e armatura più alte: scelta dominante assoluta che viola la regola "più corazza = più lento".
*→ Ridurre una stat (speed o salute/armatura) per renderlo situazionale; aggiornare la tabella 🔒 BALANCE §3.*

**B4 — Difficoltà appiattita oltre la missione ~18** *(medio / grande)* — `GameScene.ts:237`
(Stesso fenomeno di G2 visto dal lato bilanciamento) spawn floor a 700ms + nemici che non scalano mai vs economia che accumula. Già annotato come "buco noto" in BALANCE §5.
*→ Scaling soft HP/danno legato a `max(0,mission-15)*coeff` e/o cap del loop con vittoria; documentare in BALANCE §5.*

**B5 — Punteggio boss fisso, pesa poco nel late-game** *(basso / piccolo)* — `GameScene.ts:2402, 2685-2687`
Guadagno = `floor(score/8)` + reward boss (400-650); per l'esperto la reward boss è una frazione piccola. La sequenza reward (400,500,650,450) non è monotona.
*→ Reward boss crescente con la regione e curva monotona; aggiornare BALANCE §6.*

**B6 — Tanica carburante: +30 inline non validato, doppione col serbatoio** *(basso / piccolo)* — `GameScene.ts:2295`
Il rifornimento `+30` è un magic number inline non in `validate:balance`, e coincide col bonus `fuelTank` (+30 a maxFuel): due significati, stesso numero. La pressione carburante è inoltre modesta.
*→ Estrarre `FUEL_CAN_AMOUNT` nella tabella 🔒 §1; valutare di aumentare il drain o ridurre il valore tanica.*

**B7 — Razzi: AoE r=90 potente, possibile dominanza anti-boss** *(basso / piccolo)* — `GameScene.ts:2250-2271`
5 danni a TUTTI gli zombi entro 90px (inclusi gli aggrappati); contro orde dense e boss fermi l'efficacia reale supera il DPS tabellato (non contabilizzato in BALANCE §7).
*→ Verificare in playtest il TTK boss; eventualmente ridurre raggio/danno o introdurre un costo; documentare l'AoE.*

### 5. Audio procedurale — *buono*

Catena di segnale pulita (sorgente→filtro→gain→master unico), inviluppi espliciti, gerarchia validata da `validate-audio.mjs`. Il refactor del motore su questo branch è un netto miglioramento. Restano problemi concreti su clipping, pausa, click e churn di nodi.

**AU1 — Nessun limiter/compressore sul master** *(alto / piccolo)* — `SoundManager.ts:14-19`
Master = semplice GainNode → `ctx.destination`, nessuna protezione. Nella morte boss si sovrappongono `playBossDeath` + 3 `playExplosion` (0.8 cad.) + motore: somme >1.0 vengono troncate (hard clip).
*→ `DynamicsCompressorNode` brick-wall (threshold ~-3dB, ratio 20, knee 0, attack ~0.003, release ~0.1) tra master e destination; aggiornare ART_BIBLE_AUDIO §4/§11.*

**AU2 — Possibile raddoppio/battimento del motore al rientro dalla pausa** *(medio / medio)* — `SoundManager.ts:334-348, 257-258`, `GameScene.ts:287-290`
`stopEngine` azzera subito i riferimenti ma ferma gli oscillatori a +1.2s; al RESUME `startEngine` (guardia su `engineOsc` già undefined) crea nuovi oscillatori che battono coi vecchi in coda di stop.
*→ Far convergere stop+restart, oppure `pauseEngine/resumeEngine` che porta solo `engineGain` a ~0 senza ricreare i nodi (più efficiente).*

**AU3 — Attacco a gradino su voci a oscillatore (click)** *(medio / piccolo)* — `SoundManager.ts:48, 60, 89, 102, 209, 220`
`playZombieKill` (sine) e `playZombieAttach` (sawtooth) partono dal picco senza rampa d'attacco → click udibile (viola la regola d'oro della bible). `playZombieKill` è anche l'anteprima Impostazioni.
*→ Micro-rampa d'attacco lineare (`setValueAtTime(0.001,t)`→`linearRampToValueAtTime(picco,t+0.008)`), come già fatto per fuel/mission.*

**AU4 — Sparo a raffica: un buffer di rumore nuovo per ogni proiettile** *(medio / medio)* — `SoundManager.ts:29-40, 352-361`, `GameScene.ts:2114, 2132`
`playShot`→`noise(0.07)` alloca un AudioBuffer riempito con loop `Math.random()` a ogni colpo; con cooldown bassi, decine di buffer/s + impilamento d'ampiezza.
*→ Pre-generare un buffer di rumore riutilizzabile nel costruttore; creare solo `BufferSourceNode`; considerare voice-cap/throttle.*

**AU5 — Eventi di gameplay rilevanti senza suono dedicato** *(basso / medio)* — `SoundManager.ts` (set `play*`) vs eventi `GameScene.ts`
Mancano cue per pickup sopravvissuto/upgrade, acquisto in negozio, allarme carburante basso, stinger di apparizione boss.
*→ 2-3 cue mirati (ding positivo, bip allarme carburante, stinger grave boss); documentare in §4/§5.*

**AU6 — Nessuna gestione esplicita di AudioContext sospeso** *(basso / piccolo)* — `SoundManager.ts:14-19`, `GameScene.ts:278-283`
Mai controllato `ctx.state`; se il browser auto-sospende (tab in background, risparmio energetico mobile) le code possono accumularsi/ritardare.
*→ Guardia leggera `if (ctx.state === 'suspended') ctx.resume();` in `startEngine`/`play*`.*

**AU7 — L'anteprima Impostazioni crea un secondo master mai disconnesso** *(basso / piccolo)* — `SettingsScene.ts:113-119`
`playPreview` istanzia un secondo `SoundManager` → secondo master GainNode permanentemente connesso, in violazione del principio "un solo master".
*→ Usare il SoundManager esistente o disconnettere `preview` allo shutdown.*

### 6. Arte procedurale & VFX / game-feel — *buono*

Produzione artistica di livello molto alto e coerente con le art bible. I problemi non sono di qualità ma di game-feel sugli eventi più frequenti.

**V1 — La morte dello zombi comune non ha gore rosso-sangue** *(alto / medio)* — `GameScene.ts:2825-2837` (da `onBulletHitZombie:2156`)
L'evento più frequente produce 3-5 particelle "particle" (scintilla di fuoco arancione), uguale per tutti i tipi: contraddice il rosso-sangue colore-firma e appiattisce la lettura.
*→ Spray di gore per-tipo (rosso carne, verde tossico, scintille metallo) con impulso direzionale, centralizzato in `killBurst(type,x,y)`.*

**V2 — Nessun feedback sul veicolo quando il giocatore subisce danno** *(alto / piccolo)* — `GameScene.ts:2362-2378`, `onVehicleHitZombie:2173-2248`
Unico segnale = lampo bianco sulla barra HP, fuori dallo sguardo. Il veicolo si tinge di verde per pickup/dash ma non di rosso per il danno.
*→ `vehicle.setTint(0xff4422)` ~120ms + `Juice.flash` rosso scalato sul danno.*

**V3 — Proiettili e razzi senza scia** *(medio / medio)* — `GameScene.ts:2117-2128`
Sprite secco senza trail/bagliore: il fuoco rapid-fire è poco "caldo" e leggibile.
*→ Micro-particelle additive dietro i razzi; tracciante economico (scale X / afterimage) per i proiettili.*

**V4 — spawnHitParticles disperde radialmente: poco kick direzionale** *(medio / piccolo)* — `GameScene.ts:2825-2836`
Angolo casuale `Math.random()*2π`, raggio breve, durata/scala fisse per ogni evento → "scoppietto" neutro.
*→ Direzione preferenziale + cono di dispersione, o passare a `spawnDebris` (più ricco) anche per gli impatti.*

**V5 — Notti statiche: finestre/luci dell'ambiente senza vita** *(basso / medio)* — `Environment.ts:166-248, 316-341`
Skyline e neon completamente baked, accensione deterministica via `lit(i,j)`, cono fari ad alpha fisso.
*→ Pochi overlay additivi "vivi" (flicker neon, bagliore ciminiere, pulse del cono fari) sopra il bake statico.*

**V6 — Pickup carburante senza pulsazione** *(basso / piccolo)* — `GameScene.ts:2087-2092`
La jerry-can ("deve gridare prendimi nel caos") a runtime è uno sprite statico senza alone/pulse.
*→ Alone additivo (`fx_light`) + pulse di scala/alpha o bob verticale.*

**V7 — Muzzle-flash mono-posizione per la doppia mitragliatrice** *(basso / piccolo)* — `GameScene.ts:2102-2113`
`double_mg` spara a `vy±8` ma il muzzle-flash è uno solo al centro.
*→ Due muzzle-flash a `vy-8`/`vy+8`.*

### 7. UI/UX, HUD & menu — *buono*

Impianto UI maturo (palette centralizzata, helper riusabili, transizioni filmiche). Problemi su robustezza layout 16:9, accessibilità e feedback.

**U1 — HUD con coordinate X hardcodate: in 16:9 lo spazio resta vuoto e a sinistra si addensa** *(alto / medio)* — `GameScene.ts:1594-1624`
X fisse per `designW=800` (punteggio x290, combo x470, missione x620...); in 16:9 (~1067px) tutto resta ammassato a sinistra, e in 4:3 selettore armi e "[N aggrappati]" rischiano di toccarsi.
*→ Derivare le X di destra da `designW` o ancorarle a destra con `setOrigin(1,0)`.*

**U2 — Nessun controllo touch/mouse per movimento e sparo: ingiocabile senza tastiera** *(alto / grande)* — `GameScene.ts:1642-1662`
`buildInput` registra solo tastiera; su tablet/telefono il gioco è completamente ingiocabile (movimento/sparo/pausa senza fallback pointer).
*→ Set minimo di controlli pointer (drag verticale, tap/hold per sparare, bottone pausa) o avviso "serve tastiera"; decisione di design.*

**U3 — Il selettore armi mostra hotkey 1-5 ma non sono cliccabili** *(medio / piccolo)* — `GameScene.ts:1601-1608`
Cifre puramente testuali senza `setInteractive`: su mouse/touch non si può cambiare arma dall'HUD.
*→ Rendere le cifre interattive (`pointerdown`→`selectWeapon`) con hover.*

**U4 — Testo a 8-9px su monospace: leggibilità critica** *(medio / medio)* — `ShopScene.ts:175,186,187,261,276`, `GameScene.ts:1638`
Nomi/prezzi negozio a 8-11px e hint HUD a 9px su "Courier New" sono al limite; la stessa art bible §8 lo segnala.
*→ Alzare i floor tipografici (stato/prezzo ≥11px, nomi ≥10px) o opzione "testo grande/contrasto alto" in Settings.*

**U5 — Accessibilità daltonismo: lo stato dipende quasi solo dal colore** *(medio / medio)* — `GameScene.ts:1895,1938`, `ShopScene.ts:144-150`
Barre verde→ambra→rosso e prezzi oro vs rosso senza ridondanza testuale/iconografica.
*→ % numerica sulle barre, icone di stato, marker "🔒/BLOCCATO" sempre presenti; palette daltonico-safe opzionale.*

**U6 — Le card potenziamento bloccate non spiegano perché** *(medio / piccolo)* — `ShopScene.ts:130-152`
Diventano solo non-interattive con testo rosso: nessun marker, nessun feedback "monete insufficienti" al click.
*→ Marker esplicito + micro-feedback (shake + suono negativo) al click su item non acquistabile.*

**U7 — Acquisti senza feedback né conferma (scene.restart cancella le transizioni)** *(medio / medio)* — `ShopScene.ts:80-82, 298-348`
Ogni acquisto fa `scene.restart`: nessun suono/flash/animazione, e nessuna conferma per acquisti costosi (veicoli) → click accidentale irreversibile.
*→ Suono d'acquisto + flash card/contatore prima del restart; conferma per acquisti ad alto costo.*

**U8 — Game over con reset totale immediato, senza conferma né spiegazione** *(medio / piccolo)* — `GameScene.ts:2450-2487`
`endGame` azzera tutto il progresso prima ancora che appaia l'overlay, che non comunica la perdita.
*→ Comunicare "Progressione azzerata — riparti dalla Missione 1"; valutare se il reset debba essere così aggressivo.*

**U9 — Pausa: nessun hint "ESC riprende", bloccata durante eventi importanti senza comunicarlo** *(basso / piccolo)* — `GameScene.ts:1664-1671`, `SettingsScene.ts:48-49,233`
ESC ignorato se `!alive||missionDone` (non comunicato); etichetta "❚❚ PAUSA" a 15px in colore molto spento, nessun hint da tastiera.
*→ Aggiungere "ESC per riprendere" e rendere l'etichetta più leggibile (blu freddo §3.5).*

**U10 — Divergenze art bible Interfacce ↔ codice (non validate)** *(basso / piccolo)* — `ART_BIBLE_INTERFACCE.md:339,253,292,306`, `SettingsScene.ts:44`, `GameScene.ts:2421,2475-2477`
Pannello Impostazioni doc 540×380 vs codice 540×480; titoli esito e stroke (#006600/#880000) non allineati. Non coperti dal validatore (che verifica solo i token §3.6).
*→ Allineare le schede §4.4/§4.6 ai valori reali o correggere il codice; valutare di estendere `validate-art-bible.mjs`.*

**U11 — Hint comandi dell'HUD a contrasto bassissimo** *(basso / piccolo)* — `GameScene.ts:1637-1638`
"↑↓ Muovi · SPAZIO Spara..." in `#333333` su pannello quasi nero → di fatto illeggibile, unico posto dove i comandi sono spiegati.
*→ Portarlo a un grigio leggibile (es. `#556677`), eventualmente dissolverlo dopo qualche secondo.*

**U12 — MenuScene: manca "Continua" e nessun avviso che NUOVA PARTITA azzera** *(basso / medio)* — `MenuScene.ts:139-166`
Solo "NUOVA PARTITA" (resetta tutto) + "IMPOSTAZIONI"; INVIO mappa su `newGame()` senza conferma → perdita silenziosa del progresso.
*→ Voce "Continua" quando esiste uno stato salvato, o conferma/etichetta chiara su "riparti da zero".*

### 8. Bug & correttezza — *discreto*

Core loop e reset solidi, ma bug reali nella gestione listener/transizioni tra scene.

**X1 — Listener RESUME accumulato a ogni restart → motori audio duplicati** *(alto / piccolo)* — `GameScene.ts:287-290, 300`
`events.on(RESUME,...)` con `.on` (non `.once`), mai rimosso; ogni `scene.restart()` aggiunge un nuovo listener. Dopo N partite il RESUME invoca `startEngine()` N volte su istanze `SoundManager` stale (volumi desincronizzati).
*→ Usare `.once` o rimuovere esplicitamente in SHUTDOWN (`events.off(RESUME, fn)`).*

**X2 — Race condition pausa/morte: il motore può restare acceso o ripartire da morto** *(alto / medio)* — `GameScene.ts:284-290, 1664-1671, 2450-2466`
`endGame` chiama `stopEngine` ma il callback RESUME (a differenza di `openPauseSettings`) non controlla `alive/missionDone`: un RESUME residuo riavvia `startEngine` con `alive=false`.
*→ Nel callback RESUME: `if (!this.alive || this.missionDone) return;` prima di `startEngine()`.*

**X3 — Zombi aggrappati non puliti né al game over né a fine missione** *(medio / piccolo)* — `GameScene.ts:2398-2417, 2450-2471, 1806-1822`
`attachedZombies` non svuotato né distrutto; i `delayedCall` pendenti (setTint) continuano e gli sprite restano visibili ai bordi dell'overlay.
*→ In `endGame`/`triggerMissionComplete`: distruggere gli sprite aggrappati e azzerare l'array.*

**X4 — Il boss continua a infliggere danni durante i 2.2s di dissolvenza** *(medio / piccolo)* — `GameScene.ts:2615-2621, 2646-2655, 2672-2697`
`killBoss` distrugge il boss e pianifica `triggerMissionComplete` a +2200ms, ma proiettili e nubi già emessi restano attivi (overlap vivo): si può fare game over *dopo* aver vinto.
*→ Ripulire `bossProjectiles` in `killBoss` e/o disattivare gli overlap di danno durante la celebrazione.*

**X5 — Uccidere il Gigante speronandolo non assegna punteggio né combo** *(medio / piccolo)* — `GameScene.ts:2200-2213`
Il caso `giant` in `onVehicleHitZombie` non chiama `addKillScore` (a differenza di `onBulletHitZombie`): niente 80 punti, niente combo, niente `playZombieKill`.
*→ Decidere la regola e, se speronare premia, aggiungere `addKillScore(ZOMBIE_STATS.giant.score)`; allineare i doc.*

**X6 — Spawn del giant subito dopo la morte del boss** *(basso / piccolo)* — `GameScene.ts:1778-1804`
`giantTimer` non viene resettato all'attivazione del boss: se era prossimo a 0, dopo la morte del boss può spawnare un gigante in piena schermata di vittoria.
*→ Resettare `giantTimer = GIANT_SPAWN_INTERVAL` in `spawnBoss`/`killBoss`.*

**X7 — Danno del lanciafiamme cablato a 1, ignora WEAPONS** *(basso / piccolo)* — `GameScene.ts:2386-2390, 2106-2108`
Il lanciafiamme usa `damage=1` hardcoded ignorando `w.damage`: ribilanciarlo da `BALANCE.md` non avrebbe effetto (viola la Regola n.2).
*→ Usare `w.damage` anche per il lanciafiamme o documentare la divergenza voluta.*

**X8 — Il "respiro" (wob) di toxic/giant riscala la hitbox ogni frame** *(basso / medio)* — `GameScene.ts:1990-1994, 2069, 2078`
`z.setScale(base*(1±w))` scala anche il body fisico (±5%/±3% per frame), contraddicendo l'invariante "effetti vivi = solo visivi".
*→ Disaccoppiare scale visivo e body (figlio/container) o ripristinare `body.setSize` dopo lo scale.*

**X9 — Proiettili del boss non fermati a fine partita** *(basso / piccolo)* — `GameScene.ts:2469-2471, 1942-1955`
`endGame` azzera la velocità di zombies/bullets/fuelCans ma non di `bossProjectiles`/`bossGroup`: restano congelati a mezz'aria sopra l'overlay di game over (`cleanOffScreen` non gira con `alive=false`).
*→ `bossProjectiles.setVelocityX(0)` e `bossGroup.setVelocityX(0)` (o `clear`) in `endGame`.*

### 9. Build, tooling, docs e igiene repo — *discreto*

Toolchain di base solido (tre validatori robusti, tsc clean, plugin Vite di ri-validazione). Problema principale: igiene del repository.

**T1 — 28 artefatti .js/.js.map committati in src/** *(alto / piccolo)* — `src/*.js`, `src/*.js.map`, `src/scenes/*.js`
In HEAD nonostante `tsconfig.json` abbia `noEmit:true` e Vite transpili i `.ts`. Rischio drift, diff gonfio, ambiguità sulla fonte di verità. `.gitignore` li esclude ma non smette di tracciare file già aggiunti. Il branch corrente li ha già in stato D.
*→ `git rm --cached` su tutti i `.js`/`.js.map` sotto `src/` e committare; verificare con `git ls-files | grep -E '\.js(\.map)?$'`.*

**T2 — Due config Vite duplicate e contraddittorie** *(alto / piccolo)* — `vite.config.ts`, `vite.config.mjs`
`.mjs` carica il plugin di validazione ma non `server.open/port`; `.ts` imposta `open/port` ma non il plugin. Vite ne risolve una sola (il `.mjs` vince): metà delle impostazioni non si applica e una è codice morto.
*→ Unificare in un solo file (canonicamente `.ts`) con plugin + server config; eliminare l'altro.*

**T3 — File di scratch/debug committati** *(medio / piccolo)* — `test-path-setup.mjs`, `scripts/test-plugin-path.mjs`, `scripts/test-watch-match.mjs`
Script usa-e-getta finiti in repo accanto ai validatori veri; non referenziati da package.json.
*→ `git rm` (o spostare in `scratch/` ignorata); ripulire i permessi relativi in `.claude/settings.json`.*

**T4 — Metadati di progetto generici** *(medio / piccolo)* — `package.json:2,4`, `package-lock.json`
Nome ancora `"phaser-game-starter"`, versione `0.0.1` (doc parla di v0.1), manca `description`.
*→ Rinominare (es. `zombie-road-last-escape`), allineare versione, aggiungere description; rigenerare il lock.*

**T5 — Nessun test automatico, lint o CI** *(medio / grande)* — `package.json:6-14`, assenza di `.github/workflows`/eslint
I validatori e tsc girano solo in locale: nulla impedisce di pushare un branch che fallisce `npm run build`. `docs/TESTING.md` descrive una piramide di test marcata "da fare", nessuno script `test`.
*→ CI minima (GitHub Actions: `npm ci && npm run build` su push/PR); poi test unitari delle formule pure (es. `node:test`, zero dipendenze pesanti).*

**T6 — Plugin Vite: WATCHED non copre tutti i file letti dai validatori** *(basso / piccolo)* — `scripts/vite-plugin-validate.mjs:21-26`
La lista WATCHED duplica a mano le dipendenze degli script: un nuovo input non in lista non scatenerebbe la ri-validazione in dev pur potendo far fallire la build.
*→ Far esportare a ogni validatore la propria lista di input e comporre WATCHED da quelle.*

**T7 — index.html dichiara lang="en" su un gioco in italiano** *(basso / piccolo)* — `index.html:2`
Residuo del boilerplate.
*→ `<html lang="it">`.*

---

*Generato da analisi multi-agente (84 agenti, verifica adversariale per finding). Per intervenire su un finding, riverificare la posizione nel codice e seguire le regole di `CLAUDE.md`.*
