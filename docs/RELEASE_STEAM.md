# RELEASE_STEAM.md — Readiness verso Steam (i "due muri")

> **Risponde alla domanda ricorrente: "a che punto siamo verso Steam?"**
>
> Questo è il doc di **release**: la fonte di verità sullo stato di pubblicazione. Assorbe e promuove la
> sezione "Fuori scopo" di [`DESKTOP.md`](DESKTOP.md) (che resta la guida tecnica del wrapper Electron) e
> indicizza i gate di qualità che vivono in [`TESTING.md`](TESTING.md), [`BALANCE.md`](BALANCE.md),
> [`GAME_DESIGN.md`](GAME_DESIGN.md), [`SOSTE_DIEGETICHE.md`](SOSTE_DIEGETICHE.md).
>
> **Stato:** WIP. Lo stato verificato qui rispecchia `dev` ad oggi; le caselle ⬜ sono lavoro reale aperto.
> Aggiornare le checklist a ogni avanzamento (questo doc *è* il cruscotto).

---

## §0 — I due muri

La readiness verso Steam si misura su **due muri indipendenti**. Servono **entrambi**: un gioco rifinito
che non sai pubblicare resta in cartella; un canale di distribuzione perfetto attorno a un gioco acerbo
non vende.

- **MURO 1 — Qualità del gioco.** Il gioco è *finibile, leggibile, tarato, accessibile, testato*? (§1)
- **MURO 2 — Distribuzione.** Sai *impacchettarlo, firmarlo, pubblicarlo su Steam, farlo trovare*? (§2)

> Framing canonico per ogni futura risposta "verso Steam?": **dichiara su quale muro siamo e cosa manca a
> ciascuno**, non un'unica percentuale.

---

## §1 — MURO 1: Qualità del gioco

Il *core* gira (combat a mira-mouse mainline su `dev`, campagna a 6 atti con epilogo, soste diegetiche,
economia, i18n a 6 lingue). I gap residui sono di **rifinitura, taratura, verifica e test**, non di
fondamenta.

### 1.1 — Verifica visiva non ancora fatta
- ⬜ **Soste/hub a schermo.** Verificate solo via `tsc`/`lint`/`build`, **non ancora giudicate in
  Galleria** ([`SOSTE_DIEGETICHE.md`](SOSTE_DIEGETICHE.md) §10/§13, [`ART_BIBLE_SOSTE.md`](ART_BIBLE_SOSTE.md) §10):
  6 rischi visivi noti aperti (banding della pozza di luce, ombre a "lozenge", fuoco del diorama, teste
  fluttuanti). → Passare ogni sosta in `DebugScene`/Galleria e chiudere i 6 rischi.

### 1.2 — Debito di gate anti-deriva
- ⬜ **`validate:art` copre solo 3 art bible su 6** (ZOMBIES/OGGETTI/INTERFACCE). **AMBIENTE, ICONE, SOSTE
  sono in sync manuale** → palette ambiente e hub senza gate (vedi [`ART_BIBLE_AMBIENTE.md`](ART_BIBLE_AMBIENTE.md) §14,
  [`ART_BIBLE_ICONE.md`](ART_BIBLE_ICONE.md) §8, [`ART_BIBLE_SOSTE.md`](ART_BIBLE_SOSTE.md) §9). I glifi 🔒 in
  quei doc segnalano un lock che il build **non** impone. → Estendere `scripts/validate-art-bible.mjs` ad
  AMBIENTE + ICONE, o riservare 🔒 alle sole righe realmente validate.

### 1.3 — Test automatici
- ⬜ **Test unitari delle formule pure** ([`TESTING.md`](TESTING.md) §2): proposti, non implementati.
  **Vitest non installato.** → Estrarre `src/Formulas.ts` + casi-oracolo.
- ⬜ **Test d'integrazione** (§3): proposti.
- ⬜ **Reperto E2E aperto:** velocità del veicolo non azzerata in `endGame` → lo sprite deriva
  ([`TESTING.md`](TESTING.md) §7). → Fix + invariante nel bot.

### 1.4 — Taratura / bilanciamento
- ⬜ Pervasivi *"da tarare a playtest"* su throttle, director dread/burst, munizioni, carburante, scaling
  ([`BALANCE.md`](BALANCE.md)). → Sessioni di playtest mirate.
- ⬜ Difficoltà piatta oltre la missione ~18 ([`BALANCE.md`](BALANCE.md) §5) non risolta — meno rilevante
  col pivot a campagna finita, ma da confermare sul manifest a 31 tratte.

### 1.5 — Playtest manuale
- ⬜ La checklist di playtest ([`TESTING.md`](TESTING.md) §4) **non copre ancora la mira-mouse** (solo
  gamepad/tastiera) né i sopravvissuti come **personaggi** (beat, morale, finali, vedi
  [`NARRATIVA_PERSONAGGI.md`](NARRATIVA_PERSONAGGI.md)). → Aggiungere voci.

### 1.6 — Accessibilità (barriera nota all'ingresso Steam)
- ⬜ **Nessun doc né feature di accessibilità** ([`ART_BIBLE_INTERFACCE.md`](ART_BIBLE_INTERFACCE.md) §8 lo
  ammette: manca scala testo / contrasto alto; monospace 8–9px duro su schermi piccoli). Mancano: scala
  testo, contrasto alto, remap completo tasti, toggle screen-shake/flash/aberrazione/bloom (riusando
  `Settings.screenFx`), riduci-movimento, **avviso fotosensibilità** (gioco horror con shake/flash/bloom →
  rischio etico oltre che feature), sottotitoli/cue per l'audio. → Doc dedicato `docs/ACCESSIBILITA.md` +
  feature gate. *(Già concesso: palette daltonico-safe HUD.)*

---

## §2 — MURO 2: Distribuzione

### 2.1 — Packaging desktop (Electron / NSIS) — *quasi pronto, mai eseguito end-to-end*
Base tecnica in [`DESKTOP.md`](DESKTOP.md). **Verificato in ambiente:**
- ☑ `npm run lint` verde; build web con `base: './'` (path relativi, niente schermo nero da `file://`).
- ☑ `tsc -p tsconfig.electron.json` compila CommonJS valido.
- ☑ **Modalità PROD reale (probe headless):** Electron carica `dist/index.html` da `file://`, Phaser 3.90
  (WebGL | Web Audio) parte, canvas presente, bridge `window.desktop.isDesktop === true`.
- ☑ Sicurezza: `contextIsolation`/`sandbox` on, `nodeIntegration` off, single-instance lock, link esterni
  al browser di sistema.

**Aperti (bloccanti per `dist`):**
- ⬜ **`npm run dist` mai eseguito** (packaging NSIS completo). → Eseguire e validare l'installer.
- ⬜ **`EBADENGINE`:** `electron-builder`/`node-abi` preferisce **Node ≥ 22.12** (ambiente attuale Node
  **20.19**). Il warning non ha bloccato l'install ma il packaging va fatto su Node aggiornato. →
  Allineare l'ambiente a Node ≥ 22.12.
- ⬜ **`build/icon.ico` mancante** (256×256): oggi icona default Electron, `win.icon` commentato in
  `electron-builder.yml`. *(La regola "niente PNG" riguarda la grafica di gioco, non il packaging.)*
- ⬜ **CSP "Insecure"** loggata in prod: innocua per app locale, da chiudere prima del rilascio.
- ⬜ **Persistenza tra riavvii dell'app installata**: verificata solo *concettualmente* (stesso
  `localStorage` per-origin `file://`). → Confermare a mano dopo una `dist` installata.

### 2.2 — Steam vero e proprio — *fuori scopo oggi, qui la roadmap*
Tutto sotto è **non iniziato** (scaffold pronto: il bridge `preload`/`bridge.ts` è il punto d'innesto IPC).

- ⬜ **Pagina store Steam** (capsule, descrizione, screenshot, trailer) → vedi futuro `docs/MARKETING.md`.
- ⬜ **Titolo canonico deciso** (vedi §3) — *prerequisito assoluto della pagina store*.
- ⬜ **Steamworks SDK**: integrazione minima.
- ⬜ **Achievement** (cablare su milestone campagna/finali).
- ⬜ **Cloud save** (oggi `localStorage` per-origin locale).
- ⬜ **Code signing** dell'eseguibile Windows (evita avvisi SmartScreen).
- ⬜ **Auto-update**.
- ⬜ **Age rating / IARC** (gioco horror violento → rating onesto).
- ⬜ **Requisiti minimi pubblicati** (vedi §3.4: nessun target HW definito).
- ⬜ **Depot / build branch** (default + beta).
- ⬜ **Demo + wishlist + Next Fest** (per un solo-dev, il motore di lancio principale).
- ⬜ **Target Linux/macOS** (opzionale).

---

## §3 — Decisioni bloccanti (a basso costo, alto impatto)

Non sono lavoro tecnico: sono **scelte da mettere a verbale**. Bloccano altro finché restano implicite.

### 3.1 — Titolo canonico ⬜ **DA DECIDERE**
"**Zombie Road: Last Escape**" (hard-coded in README, CLAUDE.md, e trattato come brand intoccabile in
[`I18N.md`](I18N.md)) **vs** "**Il Convoglio**" (north star, usato in CAMPAGNA/SOSTE/NARRATIVA). Senza una
decisione scritta non si apre la pagina Steam e l'i18n contraddice la direzione. → Decidere in **un solo
posto** (`CLAUDE.md` "Il progetto in breve"), poi propagare a README H1 + sezione brand di `I18N.md`.

### 3.2 — Pricing ⬜ **DA VERBALIZZARE**
Modello di fatto già scelto: **premium, una tantum, nessuna microtransazione**. Manca solo metterlo a
verbale (qui) e fissare una fascia di prezzo + eventuale Early Access vs 1.0.

### 3.3 — Telemetria ⬜ **DA VERBALIZZARE**
Oggi nessun backend; l'unico hook è `window.__ZR` dev-only ([`TESTING.md`](TESTING.md) §7), **non**
telemetria di prodotto. → Dichiarare la scelta ("**nessuna telemetria**" è una posizione legittima e
vendibile per un single-player offline), o decidere un minimo crash-report.

### 3.4 — Target hardware / performance budget ⬜ **ASSENTE**
Nessun requisito HW né budget prestazionale definito (solo un "60fps da profilare" non spuntato). →
Fissare specifiche minime/raccomandate da pubblicare su Steam (§2.2).

### 3.5 — Legale ⬜ **ASSENTE**
Mancano a livello progetto: `LICENSE` (codice proprio), `CREDITS.md` (solo-dev + librerie MIT:
Phaser/Vite/Electron), nota **privacy/EULA** minima se Steam/cloud raccolgono dati. Basso sforzo,
obbligatori al checkout di pubblicazione.

---

## §4 — Cruscotto consolidato

Legenda: ☑ fatto/verificato · 🟡 parziale · ⬜ aperto.

| Muro | Voce | Stato |
|---|---|---|
| 1 | Core gameplay (mira-mouse, campagna, soste, economia, i18n) | ☑ |
| 1 | Verifica visiva soste (6 rischi) | ⬜ |
| 1 | `validate:art` su tutte le 6 art bible | 🟡 (3/6) |
| 1 | Test unitari formule (Vitest) | ⬜ |
| 1 | Fix E2E `endGame` velocità | ⬜ |
| 1 | Taratura difficoltà/economia a playtest | 🟡 |
| 1 | Playtest mira-mouse + sopravvissuti | ⬜ |
| 1 | Accessibilità (`docs/ACCESSIBILITA.md` + feature) | ⬜ |
| 2 | Packaging web→Electron PROD (probe) | ☑ |
| 2 | `npm run dist` (installer NSIS) eseguito | ⬜ |
| 2 | Ambiente Node ≥ 22.12 | ⬜ |
| 2 | `build/icon.ico` + `win.icon` | ⬜ |
| 2 | CSP di produzione chiusa | ⬜ |
| 2 | Persistenza tra riavvii (app installata) | 🟡 |
| 2 | Steamworks / achievement / cloud save | ⬜ |
| 2 | Code signing eseguibile | ⬜ |
| 2 | Pagina store + trailer + wishlist | ⬜ |
| 2 | Age rating IARC | ⬜ |
| 3 | Titolo canonico deciso | ⬜ |
| 3 | Pricing / telemetria / legale verbalizzati | ⬜ |

---

## §5 — Sequenza consigliata (ordine, non date)

1. **Sblocca le decisioni a costo zero** (§3): titolo, pricing, telemetria → 1 ora di scrittura, sblocca
   store e branding.
2. **Chiudi il packaging** (§2.1): Node ≥ 22.12 → `npm run dist` → installer verificato su macchina pulita
   + icona. È il primo "muro 2" tangibile.
3. **Verifica visiva soste** (§1.1) e **estendi `validate:art`** (§1.2): chiudono il debito di qualità più
   visibile.
4. **Accessibilità minima** (§1.6): scala testo + toggle effetti + avviso fotosensibilità. Sblocca anche
   parte della compliance Steam.
5. **Pagina store + wishlist** (§2.2): apre il funnel di lancio mentre rifinisci.
6. **Steamworks + code signing**: ultimo miglio tecnico prima del bottone "Pubblica".

> **Rischi correlati** (2D-procedurale vs prototipi 3D Babylon, stato merge combat, carico solo-dev):
> da consolidare in un futuro `docs/RISCHI.md`. Nessuno blocca i passi 1–4 qui sopra.
