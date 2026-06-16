# 🧪 Testing & QA — Zombie Road: Last Escape

> **Stato:** v0.1 · vivo (living document) · giugno 2026.
> **Scopo:** definire **cosa** verifichiamo del *comportamento* del gioco e **come**. È la controparte mancante della validazione esistente.
> **Relazione con le altre fonti:**
> - I validatori (`validate:art`, `validate:balance`) controllano che i **numeri** nel codice **combacino** con i documenti. Non eseguono il gioco e non sanno se una formula *fa la cosa giusta*.
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
 ╱  validatori statici (esistono) ╲ §1  validate:art / validate:balance — già la nostra base
╲─────────────────────────────────╱
```

| Livello | Cosa garantisce | Costo | Stato |
|---|---|---|---|
| **§1 Validatori** | i numeri del codice = i numeri dei docs | nullo (già fatto) | ✅ implementato |
| **§2 Unità (formule)** | le formule **calcolano** il valore giusto | basso | ⬜ da fare (serve §2.1) |
| **§3 Integrazione** | lo **stato** evolve correttamente (acquisti, reset…) | medio | ⬜ da fare |
| **§4 Playtest manuale** | il gioco **si gioca** end-to-end | manuale, ricorrente | ⬜ checklist pronta |

> **Regola di priorità.** Parti da **§4** (checklist: utile da subito, niente codice) e **§2** (massimo ritorno per riga di test). **§3** dopo, quando serve. Non inseguire la copertura totale: questo è un arcade procedurale, non una banca.

---

## §1 · La base che già abbiamo — validatori statici

`npm run validate` esegue [`validate-art-bible.mjs`](../scripts/validate-art-bible.mjs) e [`validate-balance.mjs`](../scripts/validate-balance.mjs): rileggono le tabelle 🔒 dei documenti e le confrontano col codice, fallendo la build su qualsiasi divergenza (dettagli in [`BALANCE.md §10`](BALANCE.md) e [`CLAUDE.md` Regola n.2](../CLAUDE.md)).

**Cosa garantiscono:** che `ZOMBIE_STATS.runner.speed` nel codice sia davvero `210` come scritto nei docs.
**Cosa NON possono garantire:** che `210` produca il movimento giusto, che la mitigazione corazza con corazza distrutta raddoppi davvero il danno, che comprare un upgrade scali i soldi. Sono confronti di numeri statici: **non eseguono nulla**. Tutto ciò che segue parte da qui.

---

## §2 · Test unitari delle formule pure (priorità alta)

Le formule di gioco vivono come **metodi privati di `GameScene`**:

| Formula | Dove (oggi) | Documentata in |
|---|---|---|
| `comboMultiplier()` | [`GameScene.ts:1729`](../src/scenes/GameScene.ts#L1729) | [BALANCE §2](BALANCE.md) |
| `dealDamage()` → mitigazione corazza | [`GameScene.ts:2334`](../src/scenes/GameScene.ts#L2334) | [BALANCE §4](BALANCE.md) |
| `getEffectiveVerticalSpeed()` | [`GameScene.ts:2352`](../src/scenes/GameScene.ts#L2352) | [BALANCE §4](BALANCE.md) |
| `getEffectiveCooldown()` | [`GameScene.ts:2358`](../src/scenes/GameScene.ts#L2358) | [BALANCE §4/§7](BALANCE.md) |
| `getEffectiveFuelDrain()` | [`GameScene.ts:2364`](../src/scenes/GameScene.ts#L2364) | [BALANCE §1/§4](BALANCE.md) |
| ricompensa missione `⌊score/8⌋` | [`GameScene.ts:2374`](../src/scenes/GameScene.ts#L2374) | [BALANCE §2](BALANCE.md) |
| intervallo di spawn | [`GameScene.ts:237`](../src/scenes/GameScene.ts#L237), [`:1765`](../src/scenes/GameScene.ts#L1765) | [BALANCE §5](BALANCE.md) |

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

**Combattimento**
- [ ] Ogni tipo di zombi compare e si comporta come da roster ([BALANCE §5](BALANCE.md)); il **Tossico** rilascia la nube; il **Gigante** appare a timer.
- [ ] Il contatore **combo** sale e il moltiplicatore segue la soglia ([BALANCE §2](BALANCE.md)); l'HUD si aggiorna.

**Danno & morte**
- [ ] La barra salute lampeggia al colpo; con corazza distrutta il danno è nettamente più alto (feel della spirale); a salute 0 → game over.

**Boss**
- [ ] Appare a ~82% della missione; mentre è vivo l'avanzamento si congela; la sconfitta dà monete **+** punteggio e un flash a schermo.

**Fine missione & negozio**
- [ ] `SPAZIO`/conferma → `ShopScene`; monete accreditate = `⌊punteggio/8⌋`.
- [ ] Acquisti: "Ripara" ripetibile; upgrade una-tantum spariscono/disabilitano dopo l'acquisto; soldi scalati; acquisto impossibile se fondi insufficienti.
- [ ] Scelta di **1** sopravvissuto fra 3; "AVANTI" → missione successiva con componenti/veicolo/arma mantenuti.

**Pausa & impostazioni**
- [ ] `ESC` in partita → overlay impostazioni, audio si ferma; "RIPRENDI" ripristina (volume riallineato, motore audio riavviato); "Esci al menu" torna al menu.
- [ ] Volume, toggle **`screenFx`** (overlay filmico on/off), cambio risoluzione e schermo intero funzionano.

**Game over & reset**
- [ ] Da game over → menu; **nuova partita parte pulita** (soldi 0, missione 1, Auto Civile, MG) — verifica diretta del reset di §3.

**Risoluzione & nitidezza** ([ARCHITETTURA §3/§4](ARCHITETTURA.md))
- [ ] In **16:9** si vede più strada a destra; gameplay invariato rispetto a 4:3.
- [ ] Zombi e veicolo restano **nitidi** anche a risoluzione alta (sovracampionamento `OVERSAMPLE`).

**Debug** ([BALANCE §9](BALANCE.md))
- [ ] Tasto `0` → `DebugScene` (galleria modelli); `G` god-mode, `H` cura, `N` completa missione.

---

## §5 · Strumento consigliato e wiring (proposta)

**Vitest** è la scelta naturale: gira sullo stesso transform di **Vite** (già nel progetto), capisce TypeScript senza configurazione, è veloce e ha API minimale. Esegue solo codice puro (§2) — **non** carica Phaser né il canvas.

> ⚠️ **Decisione di dipendenza** ([CLAUDE.md](../CLAUDE.md): «niente dipendenze nuove senza motivo»). Qui il motivo è esplicito: non esiste alcun test runner. Vitest è una **devDependency** (non finisce nel bundle del gioco). Da approvare prima di aggiungerla.

Setup minimo proposto:

```jsonc
// package.json → scripts
"test":        "vitest run",
"test:watch":  "vitest",
// e, se vogliamo il gate duro come per i validatori:
"build": "npm run validate:art && npm run validate:balance && npm run test && tsc && vite build"
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
