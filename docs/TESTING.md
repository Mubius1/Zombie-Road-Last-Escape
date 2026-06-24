# 🧪 Testing & QA — Zombie Road: Last Escape

> **Stato:** v0.2 · **in revisione** · giugno 2026 (riallineato al pivot horror + hardening del tooling).
> **Scopo:** definire **cosa** verifichiamo del *comportamento* del gioco e **come**. È la controparte mancante della validazione esistente.
> **Cosa è implementato OGGI:** solo **§1** (validatori statici + ESLint type-checked + type-check stretto) e **§4** (checklist di playtest manuale). **§2 (test unitari delle formule), §3 (integrazione) e §5 (runner Vitest) restano PROPOSTE non implementate:** non esiste `src/Formulas.ts`, non esiste alcun test runner né script `test` nel `package.json`.
> **Relazione con le altre fonti:**
> - I quattro validatori (`validate:art`, `validate:balance`, `validate:audio`, `validate:i18n`) controllano che i **numeri/dati** nel codice **combacino** con i documenti. Non eseguono il gioco e non sanno se una formula *fa la cosa giusta*.
> - Questo documento copre il livello che manca: **il comportamento è corretto?** (le formule, le transizioni di stato, il flusso giocabile).
> - Per *quali* numeri vedi [`BALANCE.md`](BALANCE.md); per *come è cucito il codice* vedi [`ARCHITETTURA.md`](ARCHITETTURA.md); per *le regole* vedi [`GAME_DESIGN.md`](GAME_DESIGN.md).

⚠️ **Il buco che questo documento chiude.** Lo dice [`BALANCE.md §10`](BALANCE.md) a chiare lettere: i **valori derivati** (mitigazione corazza, curva di spawn, moltiplicatore combo, consumo carburante) **non** sono validati a numero — «vanno ricalcolati a mano dalle formule citate». Finché restano «da ricalcolare a mano» nessuno li ricalcola, e una formula può sbagliare senza che nessuna build fallisca. **I test unitari di §2 sono il ricalcolo automatico di quei valori.** È l'estensione naturale della filosofia del progetto: dalla validazione *dei dati* alla validazione *del comportamento*.

---

## §0 · La piramide, adattata a questo progetto

```
            ╱ manuale ╲          §4  Checklist di playtest (zero dipendenze, usabile OGGI)
          ╱─────────────╲
        ╱  integrazione   ╲      §3  Transizioni di stato: registry, acquisti, reset, degrado
      ╱─────────────────────╲
    ╱     unità (formule)     ╲  §2  Formule pure — l'oracolo dei "valori derivati" di BALANCE
  ╱─────────────────────────────╲
 ╱  validatori statici (esistono) ╲ §1  4 validatori + lint + type-check stretto — già la nostra base
╲─────────────────────────────────╱
```

| Livello | Cosa garantisce | Costo | Stato |
|---|---|---|---|
| **§1 Validatori + lint + tsc** | i numeri/dati del codice = i docs · lint type-checked · type-check stretto | nullo (già fatto) | ✅ implementato |
| **§2 Unità (formule)** | le formule **calcolano** il valore giusto | basso | ⬜ da fare (serve §2.1) |
| **§3 Integrazione** | lo **stato** evolve correttamente (acquisti, reset…) | medio | ⬜ da fare |
| **§4 Playtest manuale** | il gioco **si gioca** end-to-end | manuale, ricorrente | ⬜ checklist pronta |

> **Regola di priorità.** Parti da **§4** (checklist: utile da subito, niente codice) e **§2** (massimo ritorno per riga di test). **§3** dopo, quando serve. Non inseguire la copertura totale: questo è un arcade procedurale, non una banca.

---

## §1 · La base che già abbiamo — analisi statica

Tre presìdi statici sono **già attivi** e agganciati alla build/CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml) esegue `npm run build` + `npm run lint` a ogni push/PR):

1. **Quattro validatori anti-deriva.** `npm run validate` esegue [`validate-art-bible.mjs`](../scripts/validate-art-bible.mjs), [`validate-balance.mjs`](../scripts/validate-balance.mjs), [`validate-audio.mjs`](../scripts/validate-audio.mjs) e [`validate-i18n.mjs`](../scripts/validate-i18n.mjs): rileggono le tabelle 🔒 dei documenti (art bible, BALANCE, ART_BIBLE_AUDIO) e i dizionari `src/locales/`, e li confrontano col codice, fallendo la build su qualsiasi divergenza (dettagli in [`BALANCE.md §10`](BALANCE.md) e [`CLAUDE.md` Regola n.2](../CLAUDE.md)). Un plugin Vite ([`vite-plugin-validate.mjs`](../scripts/vite-plugin-validate.mjs)) li ri-esegue a ogni salvataggio anche in `npm run dev`.
2. **ESLint type-checked** ([`eslint.config.js`](../eslint.config.js), `npm run lint` / `lint:fix`): regole typescript-eslint con type-information (floating/misused-promises, variabili inutilizzate, ecc.). È uno step a sé in CI.
3. **Type-check stretto** ([`tsconfig.json`](../tsconfig.json) via `tsc`): oltre a `strict`, sono attivi `noUnusedLocals`/`noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess` e `moduleResolution: "Bundler"`.

**Cosa garantiscono:** che `ZOMBIE_STATS.runner.speed` nel codice sia davvero `210` come scritto nei docs; che i dizionari di lingua siano completi vs `it.ts`; che non resti codice morto, promise non gestite o accessi indicizzati non guardati.
**Cosa NON possono garantire:** che `210` produca il movimento giusto, che la mitigazione corazza con corazza distrutta raddoppi davvero il danno, che comprare un upgrade scali i soldi. Sono analisi statiche: **non eseguono il gioco**. Tutto ciò che segue parte da qui.

---

## §2 · Test unitari delle formule pure (priorità alta) · **PROPOSTA — non implementata**

> ⚠️ Niente di questa sezione esiste ancora: **non c'è** `src/Formulas.ts` né un runner. È il piano da seguire quando si deciderà di automatizzare i «valori derivati».

Le formule di gioco vivono come **metodi privati di [`GameScene`](../src/scenes/GameScene.ts)** (cerca il nome del metodo nel file — niente numeri di riga, che invecchiano a ogni edit):

| Formula | Dove (oggi) | Documentata in |
|---|---|---|
| `comboMultiplier()` | metodo privato di `GameScene.ts` | [BALANCE §2](BALANCE.md) |
| `dealDamage()` → mitigazione corazza | metodo privato di `GameScene.ts` | [BALANCE §4](BALANCE.md) |
| `getEffectiveVerticalSpeed()` | metodo privato di `GameScene.ts` | [BALANCE §4](BALANCE.md) |
| `getEffectiveCooldown()` | metodo privato di `GameScene.ts` | [BALANCE §4/§7](BALANCE.md) |
| `getEffectiveFuelDrain()` | metodo privato di `GameScene.ts` | [BALANCE §1/§4](BALANCE.md) |
| ricompensa missione `⌊score/8⌋` | calcolo a fine missione in `GameScene.ts` | [BALANCE §2](BALANCE.md) |
| intervallo di spawn | costanti + scaling dello spawn in `GameScene.ts` | [BALANCE §5](BALANCE.md) |

### §2.1 · Prerequisito abilitante — estrarre un modulo puro

Sono metodi `private` accoppiati a `this.components`, `this.combo`, ecc.: **non testabili in isolamento** così come sono. Il passo abilitante è estrarne il **calcolo puro** in un modulo senza Phaser — es. `src/Formulas.ts` — che prende input espliciti e restituisce un numero, e che `GameScene` poi richiama:

```ts
// src/Formulas.ts — nessun import di Phaser, funzioni pure → banalmente testabili
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const comboMultiplier = (combo: number) => clamp(1 + Math.floor((combo - 1) / 5), 1, 5);

export const damageMitigation = (armorHealth: number, vehicleArmorBonus: number) => {
  const p = armorHealth / 100;
  const base = p <= 0 ? 2.5 : p < 0.3 ? 1.8 : p < 0.6 ? 1.3 : 1.0;
  return Math.max(0.5, base - vehicleArmorBonus / 100);
};
export const damageTaken = (nominal: number, armorHealth: number, bonus: number) =>
  Math.round(nominal * damageMitigation(armorHealth, bonus));

export const fuelDrain   = (tankHealth: number) => 2.2 * (1 + (1 - tankHealth / 100) * 2);
export const missionCoins = (score: number) => Math.floor(score / 8);
export const initialSpawnInterval = (mission: number) => Math.max(700, 2100 - (mission - 1) * 80);
```

> Nota: `comboMultiplier` oggi usa `Phaser.Math.Clamp`. Nel modulo puro si usa un `clamp` locale così `Formulas.ts` resta **senza dipendenze** e testabile a freddo. `GameScene` importa e delega — niente logica duplicata.

### §2.2 · Casi-oracolo (input → atteso, dai numeri di BALANCE)

Questi casi **sono** la tabella di BALANCE resa eseguibile. Se un domani qualcuno cambia la formula e dimentica di aggiornare il documento (o viceversa), il test diventa rosso.

**`comboMultiplier(combo)`** — atteso da [BALANCE §2](BALANCE.md):

| combo | 1 | 5 | 6 | 11 | 16 | 21 | 100 |
|---|---|---|---|---|---|---|---|
| atteso | 1 | 1 | 2 | 3 | 4 | 5 | 5 (cap) |

**`damageTaken(nominal, armorHealth, bonus)`** — atteso da [BALANCE §4](BALANCE.md) (nominale = 20):

| corazza | bonus veicolo | mult | danno (20) | nota |
|---|---|---|---|---|
| 0 | 0 | 2.5 | **50** | corazza distrutta = spirale di morte |
| 20 | 0 | 1.8 | **36** | <30% |
| 50 | 0 | 1.3 | **26** | <60% |
| 100 | 0 | 1.0 | **20** | piena |
| 100 | 70 | 0.5 (floor) | **10** | mai sotto ×0.5 |

**`fuelDrain(tankHealth)`** — [BALANCE §1/§4](BALANCE.md): `100 → 2.2` · `50 → 4.4` · `0 → 6.6` (3×).

**`missionCoins(score)`** — [BALANCE §2](BALANCE.md): `0 → 0` · `7 → 0` · `8 → 1` · `2400 → 300` (= prezzo Pickup).

**`initialSpawnInterval(mission)`** — [BALANCE §5](BALANCE.md): `1 → 2100` · `5 → 1780` · `10 → 1380` · `15 → 980` · `18 → 700` · `30 → 700` (pavimento).

> Bonus: questi test sono anche un **regression net** sul «buco noto» di [BALANCE §5](BALANCE.md) (difficoltà piatta oltre la missione ~18). Quando si aggiungerà lo scaling new-game+, i casi `18`/`30` andranno aggiornati di proposito — il test rosso ti **ricorda** che stai cambiando una regola di bilanciamento.

---

## §3 · Test di integrazione — transizioni di stato (priorità media)

Qui non si rende nulla: si verifica che lo **stato della run** evolva bene. Lo stato vive nel `registry` di Phaser ([ARCHITETTURA §6.1](ARCHITETTURA.md)); la logica di acquisto sta in `ShopScene`, il reset in `GameScene`/`DebugScene`. Come per §2, conviene **estrarre la logica pura** (es. «applica acquisto a uno stato» → nuovo stato) da un `registry` mockato `{ get, set }`.

Comportamenti che valgono un test (riferimento [BALANCE §8](BALANCE.md)):

- **Acquisto upgrade una-tantum** (`armor`/`engine`/`turret`/`fuelTank`): scala il costo dai soldi **e** segna l'upgrade come posseduto; un secondo acquisto è impedito.
- **"Ripara tutto" (ripetibile)**: porta i 5 componenti a 100 e scala 80; acquistabile di nuovo.
- **Fondi insufficienti**: acquisto rifiutato, soldi invariati.
- **Sopravvissuti**: 3 offerti, **1** scelto a visita, è gratis.
- **Reset al game over** ([ARCHITETTURA §6.1](ARCHITETTURA.md), [BALANCE §2](BALANCE.md)): `money → 0`, `missionNumber → 1`, `vehicle → 'civilian_car'`, `weapon → 'mg'`, upgrade/sopravvissuti/componenti ai default. **Niente** sopravvive alla morte.
- **Continuità tra missioni**: la salute dei componenti riportata nel `registry` a fine missione è quella riletta da `GameScene` alla missione successiva.

> Questi casi sono più costosi (serve estrarre o mockare) e cambiano più spesso del calcolo puro: scrivili quando un'area diventa fonte di bug ricorrenti, non in anticipo.

---

## §4 · Checklist di playtest manuale (usabile da subito, zero dipendenze)

Da percorrere prima di ogni release o dopo modifiche a gameplay/scene. Niente di tutto questo è automatizzabile a buon mercato (rendering procedurale, feel, audio): l'occhio umano è lo strumento giusto. Flussi da [GAME_DESIGN](GAME_DESIGN.md) e [ARCHITETTURA §5](ARCHITETTURA.md).

**Avvio & menu**
- [ ] `MenuScene` appare con dissolvenza; musica/SFX presenti; `INVIO` avvia la partita.

**Guida & mondo**
- [ ] Il veicolo si muove su/giù; il mondo scorre verso sinistra; il veicolo resta a sinistra.
- [ ] L'arma spara; il carburante cala; raccogliere una **tanica** lo ripristina (+30).
- [ ] Lo **scatto** (dash) ha cooldown e grazia post-scatto.

**Throttle — acceleratore/freno (pivot horror)**
- [ ] **Acceleratore** (→/`D`, o RT/grilletto destro col pad): il mondo scorre più veloce e il mezzo scivola in avanti; **freno** (←/`A`, o LB col pad): decelera fino allo **STOP totale** (scroll 0).
- [ ] **Senza input** il mezzo **coasta** giù da solo per inerzia (niente auto-crociera): per restare in moto devi accelerare; a riposo si assesta sulla crociera.
- [ ] **Avanzamento** (distanza/progressione) e **consumo carburante** seguono il throttle: fermo → non avanzi; a tutto gas il carburante cala più in fretta. Il **suono del motore** "tira" col gas e cala col freno.

**Combattimento**
- [ ] Ogni tipo di zombi compare e si comporta come da roster ([BALANCE §5](BALANCE.md)); il **Tossico** rilascia la nube; il **Gigante** appare a timer.
- [ ] Il contatore **combo** sale e il moltiplicatore segue la soglia ([BALANCE §2](BALANCE.md)); l'HUD si aggiorna.

**Munizioni finite (pivot horror)**
- [ ] La **MG** è a munizioni **infinite** (∞ nell'HUD, mai a secco); le altre armi possedute partono con una **riserva** ([BALANCE §5](BALANCE.md)) che cala di 1 a ogni colpo.
- [ ] Le **casse di munizioni** spawnano sulla strada **solo se possiedi almeno un'arma finita** (con la sola MG non compaiono); raccoglierne una **ricarica** l'arma equipaggiata (o la più scarica se hai la MG equipaggiata).
- [ ] Arma finita **a secco** → "click" a vuoto e **fallback automatico sulla MG** (disperazione): non resti senza fuoco.
- [ ] La riserva munizioni **persiste tra le missioni** (riletta dal `registry` alla missione successiva), come componenti/veicolo/arma.

**Danno & morte**
- [ ] La barra salute lampeggia al colpo; con corazza distrutta il danno è nettamente più alto (feel della spirale); a salute 0 → game over.

**Boss**
- [ ] Appare a ~82% della missione; mentre è vivo l'avanzamento si congela; la sconfitta dà monete **+** punteggio e un flash a schermo.

**Fine missione & negozio**
- [ ] `SPAZIO`/conferma → `ShopScene`; monete accreditate = `⌊punteggio/8⌋`.
- [ ] Acquisti: "Ripara" ripetibile; upgrade una-tantum spariscono/disabilitano dopo l'acquisto; soldi scalati; acquisto impossibile se fondi insufficienti.
- [ ] Scelta di **1** sopravvissuto fra 3; "AVANTI" → missione successiva con componenti/veicolo/arma mantenuti.

**Gamepad — gioco** ([ARCHITETTURA §5](ARCHITETTURA.md))
- [ ] **Stick sinistro** muove di corsia (su/giù), **stick destro** dà la direzione di mira (mirino a distanza fissa lungo l'angolo).
- [ ] **RT** (grilletto destro) = **fuoco** (tieni premuto); **LT** (grilletto sinistro, analogico) = **acceleratore**; **LB** = **freno**; **RB** = **cambio arma** (ciclo). D-pad = selezione diretta armi; `A` = scatto, `B` = Sovraccarico, `X`/`Y` = granata, `START` = pausa.
- [ ] **"Last input wins":** muovere mouse/tastiera spegne il cursore/mira-pad e viceversa; nessun conflitto fra le due sorgenti.

**Gamepad — menu e schermate** (navigazione `MenuPad`)
- [ ] Nei menu (titolo, **negozio**, **impostazioni**, pausa) **croce/stick sinistro** spostano il **focus** fra gli elementi (anche in griglia); `A`/`START` **attivano** l'elemento a fuoco; `B` torna indietro.
- [ ] Slider/selettori (volume, frecce risoluzione/lingua) si regolano con ←/→ del pad invece di spostare il focus.
- [ ] Il focus **persiste** tra i restart di scena (es. dopo un acquisto nel negozio non salta in cima); "last input wins" vale anche qui (mouse↔pad).
- [ ] **Schermate di esito** (game over / fine missione): il prompt mostra i tasti **PAD** quando si usa il pad; `A`/`START` confermano (→ negozio o avanti), `B` torna al menu.

**Pausa & impostazioni**
- [ ] `ESC` in partita → overlay impostazioni, audio si ferma; "RIPRENDI" ripristina (volume riallineato, motore audio riavviato); "Esci al menu" torna al menu.
- [ ] Volume, toggle **`screenFx`**, cambio risoluzione e schermo intero funzionano.

**Penombra & resa horror** ([ART_BIBLE_AMBIENTE.md](ART_BIBLE_AMBIENTE.md), [ART_BIBLE_INTERFACCE.md](ART_BIBLE_INTERFACCE.md))
- [ ] La scena di gioco è **scura** (mood horror): i **fari del veicolo** leggono come **luce primaria** sull'asfalto, le zone fuori dal cono restano in penombra leggibile.
- [ ] Il toggle **`screenFx`** influenza la resa filmica/penombra (overlay on/off): con `screenFx` spento la scena resta giocabile e leggibile (nessuna zona troppo buia per vedere i nemici).

**Game over & reset**
- [ ] Da game over → menu; **nuova partita parte pulita** (soldi 0, missione 1, Auto Civile, MG) — verifica diretta del reset di §3.

**Risoluzione & nitidezza** ([ARCHITETTURA §3/§4](ARCHITETTURA.md))
- [ ] In **16:9** si vede più strada a destra; gameplay invariato rispetto a 4:3.
- [ ] Zombi e veicolo restano **nitidi** anche a risoluzione alta (sovracampionamento `OVERSAMPLE`).

**Debug** ([BALANCE §9](BALANCE.md))
- [ ] Tasto `0` → `DebugScene` (galleria modelli); `G` god-mode, `H` cura, `N` completa missione.

---

## §5 · Strumento consigliato e wiring · **PROPOSTA — non implementata**

> ⚠️ Oggi **non esiste** alcun runner né script `test` nel `package.json`: quanto segue è il setup da adottare se/quando si automatizza §2.

**Vitest** è la scelta naturale: gira sullo stesso transform di **Vite** (già nel progetto), capisce TypeScript senza configurazione, è veloce e ha API minimale. Esegue solo codice puro (§2) — **non** carica Phaser né il canvas.

> ⚠️ **Decisione di dipendenza** ([CLAUDE.md](../CLAUDE.md): «niente dipendenze nuove senza motivo»). Qui il motivo è esplicito: non esiste alcun test runner. Vitest è una **devDependency** (non finisce nel bundle del gioco). Da approvare prima di aggiungerla.

Setup minimo proposto (lo script `build` reale oggi è `validate:art && validate:balance && validate:audio && validate:i18n && tsc && vite build`; il gate dei test andrebbe inserito **prima** di `tsc`):

```jsonc
// package.json → scripts
"test":        "vitest run",
"test:watch":  "vitest",
// e, se vogliamo il gate duro come per i validatori (i 4 validatori già ci sono):
"build": "npm run validate:art && npm run validate:balance && npm run validate:audio && npm run validate:i18n && npm run test && tsc && vite build"
```

- File: `*.test.ts` accanto al sorgente (es. `src/Formulas.test.ts`), oppure cartella `test/`.
- I test di §2 dipendono solo da `src/Formulas.ts` → girano in millisecondi, ideali anche in watch durante `npm run dev`.
- **Gate in build:** opzionale ma coerente con la filosofia anti-deriva — se i casi-oracolo di §2.2 divergono dalle formule, la build si ferma esattamente come per `validate:balance`.

---

## §6 · Cosa **non** testiamo (disciplina)

Per non sprecare sforzo dove non rende:

- **L'aspetto delle texture procedurali** (pixel, colori, pose): è dominio delle **art bible**, verificato da revisione umana + `validate:art` sui parametri. Non si fa screenshot-diff.
- **Gli interni di Phaser** (fisica arcade, scene manager, tween): è codice di terze parti, già testato a monte.
- **Tempi esatti di tween/VFX e feel**: soggettivi → checklist di playtest (§4), non assert numerici.
- **L'audio procedurale**: ascolto umano (§4) + direzione in [`ART_BIBLE_AUDIO.md`](ART_BIBLE_AUDIO.md).

Regola: si testa **logica deterministica e numerica** (§2) e **transizioni di stato** (§3). Tutto ciò che è *percezione* resta nella checklist manuale.

---

> **Manutenzione.** Quando cambi una **formula** in [`BALANCE.md`](BALANCE.md) (combo, mitigazione, consumo, ricompensa, curva di spawn) aggiorna i casi-oracolo di §2.2 **insieme** al codice: sono il modo in cui il valore *derivato* — che `validate:balance` non controlla — resta onesto. Quando aggiungi una **regola** (acquisti, reset, progressione) valuta un caso in §3 e una voce nella checklist §4.
