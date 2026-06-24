# ART BIBLE — Icone

> Fonte di verità dell'**iconografia** di *Zombie Road: Last Escape*. Le icone sono un vocabolario visivo a sé:
> glifi piccoli, ad altissima leggibilità, letti in **visione periferica** e **sotto pressione**. Questo documento
> definisce *quando* usare un'icona invece del testo, *come* si disegnano (100% procedurali) e *cosa* significa ognuna.
>
> Vedi anche: [`ART_BIBLE_INTERFACCE.md`](ART_BIBLE_INTERFACCE.md) (HUD/menu), [`ART_BIBLE_OGGETTI.md`](ART_BIBLE_OGGETTI.md)
> (veicoli/armi/pickup/sopravvissuti, che hanno già una loro rappresentazione visiva).

---

## 1. Dottrina: icona o testo?

La regola non è "icone ovunque". È **dove si legge il pixel**:

| Superficie | Scelta | Perché |
|---|---|---|
| **HUD di gioco** (sempre a schermo, durante l'azione) | **ICONA** | si decodifica *pre-attentivamente* (colpo d'occhio, niente lettura); language-neutral; daltonico-safe (la forma porta l'informazione, non solo il colore) |
| **Menu / Negozio** (il giocatore è fermo, ha tempo) | **TESTO** (eventualmente + icona) | la lettura precisa conta più della velocità; i nomi/numeri vanno letti con calma. È prassi AAA: i menu possono essere testuali |
| **Stati transitori** (affamato, ferito, evento attivo) | **ICONA + colore** | devono "saltare all'occhio" senza essere letti |

> **Standard AAA.** Negli HUD tripla-A le risorse ricorrenti sono **icone** (cuore, pompa, glifo arma + numero), non parole.
> Il testo nell'HUD è un odore da prototipo. Ma per concetti **astratti o specifici** (es. un componente del veicolo) l'icona
> nuda è ambigua la prima volta → si risolve con il **teach-once** (§5), non tornando al testo.

---

## 2. Principi tecnici (non negoziabili)

- **100% procedurale.** Ogni icona è geometria via `Graphics` API → `generateTexture` (chiave `icon_*`). **Nessun PNG**, nessun asset
  esterno — coerente col vincolo del titolo. Codice: [`src/IconTextures.ts`](../src/IconTextures.ts) → `buildIcons(scene)`.
- **Box 16×16** di design, **sovracampionato a `OVERSAMPLE`×** (come zombie/veicoli) → nitido a risoluzione nativa. Display in HUD a
  **12–14 px** (`HudController.hudIcon` scala con `px / (16·OVERSAMPLE)`).
- **Silhouette prima del dettaglio.** A 14 px conta la forma esterna riconoscibile, non i dettagli interni. Test: leggibile in scala di grigi e a metà dimensione.
- **Luce alto-sinistra**, coerente con tutto il titolo (ombra in basso-destra, highlight in alto-sinistra).
- **Daltonico-safe.** Forma distintiva + colore: chi non distingue rosso/verde riconosce comunque il glifo. L'icona *somma* informazione al colore della barra, non lo duplica soltanto.
- **Una sola generazione** per sessione (guard `textures.exists('icon_health')`).

---

## 3. Palette delle icone

Due famiglie cromatiche, per separare a colpo d'occhio **risorse** da **componenti**:

| Famiglia | Token (hex) | Uso |
|---|---|---|
| **Metallo neutro** | `STEEL 0x9aa4b0` · `STEEL_SH 0x59616d` · `STEEL_HI 0xc8d0da` · `DARK 0x2a2f37` | componenti meccanici (motore, ruote, serbatoio, torretta), aste/cornici |
| **Accenti semantici** | `RED 0xff5a5a`/`RED_HI 0xffa6a6` · `AMBER 0xffb24a`/`AMBER_HI 0xffd79a` · `BRASS 0xc99a2a`/`BRASS_HI 0xeac669` | salute (rosso), carburante/contenuto (ambra), munizioni (ottone) |

> Questi token vivono in `src/IconTextures.ts` (in cima al file). Se ne cambi uno, aggiorna questa tabella.

---

## 4. Catalogo HUD — **implementato**

Box 16×16. "Display" = dimensione in px di design nell'HUD. Tutte hanno **tooltip in hover** (nome i18n) — vedi §5.

| Chiave texture | Concetto | Silhouette / ricetta | Display | Tooltip (i18n) |
|---|---|---|---|---|
| `icon_health` | Salute | croce medica rossa, highlight alto-sx | 14 | `hud.health` |
| `icon_fuel` | Carburante | pompa di benzina (distributore) ambra: corpo + display scuro + erogatore | 14 | `hud.fuel` |
| `icon_engine` | Motore | ingranaggio in metallo + mozzo scuro | 13 | `hud.engine`* |
| `icon_wheels` | Ruote | pneumatico (gomma scura) + cerchione | 13 | `hud.wheels`* |
| `icon_tank` | Serbatoio | fusto/tanica con bande + goccia ambra | 13 | `hud.tank`* |
| `icon_turret` | Torretta | cannone (base + canna) bocca scura | 13 | `hud.turret`* |
| `icon_route` | Percorso | bandiera a scacchi su asta | 12 | `hud.route` |
| `icon_ammo` | Munizioni | cartuccia (ottone + ogiva) | 12 | `hud.ammo`* |

\* la chiave i18n del componente arriva da `ComponentData.label` (vedi `GameScene`); per le munizioni il glifo è pronto e verrà
cablato nella riga arma/munizioni (oggi testuale `NOME · N`).

**Mapping componenti → icona:** `icon_${ComponentKey}` (`engine`/`wheels`/`tank`/`turret`) — la chiave combacia col componente, niente lookup.

---

## 5. Teach-once (come si impara un'icona)

Un'icona astratta è ambigua **la prima volta**. Non si risolve col testo permanente, ma insegnandola una volta:

- **Mouse:** `HudController.hudIcon` rende ogni icona interattiva → al passaggio appare un **tooltip** col nome (chiave i18n).
  Il giocatore impara il simbolo, poi vola sull'icona.
- **Gamepad:** niente cursore → la legenda vive nell'**onboarding** / nella schermata del veicolo / in questo documento. (TODO: una
  legenda opzionale richiamabile dall'HUD col pad.)

> **Eccezione — barre componenti (HUD).** Per le 4 icone di componente (motore/ruote/serbatoio/torretta) il teach-once
> via hover **non basta**: in combattimento il mouse è impegnato a mirare e sparare, nessuno passa il cursore sull'HUD.
> Lì l'icona è affiancata da una **sigla 3-lettere sempre visibile** (`comp.<key>Abbr` i18n: `MOT · RUO · SER · TOR` in
> italiano) + la `%`. Non è un ritorno al testo-prototipo: è icona **+** sigla minima per un concetto astratto e specifico
> non leggibile a colpo d'occhio mid-azione. Il tooltip in hover resta e mostra il **nome esteso** (`comp.<key>`). Le icone-risorsa
> immediate (salute, carburante) restano **icona nuda** — lì la silhouette basta. Resa in `HudController` (vedi
> `ART_BIBLE_INTERFACCE` §4.2).

---

## 6. Vocabolario esteso — **pianificato**

Il sistema-icone copre l'intero titolo. Stato attuale e piano:

| Dominio | Stato | Nota |
|---|---|---|
| **HUD risorse/componenti** | ✅ fatto (§4) | salute, carburante, 4 componenti, percorso, munizioni |
| **Armi** (5) | ⏳ da fare | glifo per arma nel selettore HUD + negozio. Esistono già le anteprime-proiettile; serve un glifo-silhouette per slot |
| **Sopravvissuti** (ruoli) | ◐ parziale | esistono già i **ritratti** procedurali (`survivor_*`, vedi OGGETTI); l'HUD usa ancora token `[M]/[+]…`. Servono glifi-ruolo piccoli (chiave inglese, croce, mirino…) |
| **Stati** (affamato/ferito) | ⏳ da fare | oggi emoji `🍖/🩹`; sostituibili con glifi procedurali coerenti |
| **Pickup** (carburante/munizioni) | ✅ esistono come texture mondo | `fuel_can`, `ammo_crate` (vedi OGGETTI) — non serve un'icona HUD separata |
| **Potenziamenti negozio** | ➖ testo (volutamente) | il negozio è una superficie a lettura calma → testo OK (§1). Un'icona è "nice-to-have", non necessaria |

---

## 7. Dove sta il codice

| Cosa | File / simbolo |
|---|---|
| Factory delle icone (tutte le `icon_*`) | [`src/IconTextures.ts`](../src/IconTextures.ts) → `buildIcons(scene)` |
| Generazione (in gioco) | `GameScene.buildTextures()` → `buildIcons(this)` |
| Resa nell'HUD + tooltip | `HudController.hudIcon(x, y, key, px, labelKey, depth)` |

---

## 8. Validazione

> ⚠️ **Non ancora coperta da un validatore automatico** (a differenza di art/balance/audio/i18n). Per ora questo documento è la
> fonte di verità *manuale* del catalogo §4. Tooling futuro (vedi [`ROADMAP_RIGIOCABILITA.md`](ROADMAP_RIGIOCABILITA.md) §9): un
> `validate:icone` che confronti le chiavi `icon_*` generate da `buildIcons` con il catalogo qui sopra e fallisca sulla deriva.

Finché non esiste: se **aggiungi/rinomini** un'icona in `IconTextures.ts`, aggiorna la tabella §4 **nello stesso commit**.

---

## 9. Scheda-template — nuova icona

```
Nome concetto: …                      Chiave texture: icon_…
Famiglia: metallo neutro | accento semantico (quale colore-firma?)
Silhouette (a parole): … (cosa si riconosce a 14px in scala di grigi?)
Ricetta (ordine di disegno): ombra basso-dx → corpo → highlight alto-sx → dettaglio
Display HUD: …px        Superficie: HUD | (menu/negozio → valuta se serve davvero)
Tooltip i18n: chiave 'hud.…' (+ traduzione in tutte le 6 lingue)
Teach-once: hover (mouse) OK? legenda pad prevista?
```

> Aggiorna **§4** (catalogo) e i token **§3** se introduci un colore nuovo. Niente PNG: solo `Graphics` → `generateTexture`.
