# INDEX.md — Indice della documentazione (doc-of-docs)

> **Mappa unica e navigabile di tutta la documentazione del progetto.** Prima di questo file l'unico
> indice era la sezione "Documentazione" del [README](../README.md), che ne elencava ~6 su 20+ (con
> [`TUTORIAL.md`](TUTORIAL.md) e [`DESKTOP.md`](DESKTOP.md) **orfani**, non linkati da nessuno). Questo è
> il punto di verità sull'**inventario**: ogni doc, il suo scopo in una riga, lo **stato** e quale
> **validatore** (se esiste) lo tiene allineato al codice.

## Legenda

**Stato:** 🟢 stabile (allineato al codice) · 🟡 wip / da riconciliare · 🔵 bozza · 🗄️ archiviato.
**Validatore:** ✅ coperto da un gate `npm run validate:*` (il build fallisce se il doc diverge dal
codice) · ✋ sync **manuale** (nessun gate: l'allineamento è solo per disciplina) · — non applicabile.

> ⚠️ **Attenzione al falso lucchetto.** Solo i doc con ✅ rompono davvero la build su deriva. Alcune
> tabelle marcate 🔒 in doc ✋ (es. palette di [`ART_BIBLE_AMBIENTE.md`](ART_BIBLE_AMBIENTE.md), tabelle di
> [`ART_BIBLE_SOSTE.md`](ART_BIBLE_SOSTE.md)) suggeriscono un lock che **non** è imposto.

---

## Sistema & istruzioni
| Doc | Scopo | Stato | Validatore |
|---|---|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | Istruzioni di sistema: gerarchia fonti-di-verità, regole anti-deriva, mappa del codice, scaling | 🟢 | — |
| [`../README.md`](../README.md) | **Case-study bilingue (IT/EN)**: landing portfolio del repo — highlight ingegneristici, architettura, qualità, 100% procedurale | 🟢 | — |
| [`PANORAMICA.md`](PANORAMICA.md) | Panoramica & guida (ex-README): pitch, avvio rapido, controlli, mappa del codice | 🟢 | — |
| [`INDEX.md`](INDEX.md) | Questo indice | 🟢 | — |

## Design & bilanciamento
| Doc | Scopo | Stato | Validatore |
|---|---|---|---|
| [`GAME_DESIGN.md`](GAME_DESIGN.md) | Design meccanico: pilastri, core loop, comandi, mondo, missione, vittoria/sconfitta | 🟢 *(ha assorbito i pivot: mira-mouse, boss off)* | — |
| [`BALANCE.md`](BALANCE.md) | Economia, curve, formule, costi (tabelle 🔒) | 🟢 *(buco interno: taniche presenti/rimosse)* | ✅ `validate:balance` |

## Narrativa & campagna
| Doc | Scopo | Stato | Validatore |
|---|---|---|---|
| [`NARRATIVA_PERSONAGGI.md`](NARRATIVA_PERSONAGGI.md) | **Character & story bible**: 7 sopravvissuti, archi, radio, finali, stato narrativo | 🟢 | ✋ |
| [`CAMPAGNA_CONVOGLIO.md`](CAMPAGNA_CONVOGLIO.md) | Piano della campagna "Il Convoglio" (atti, tratte, incontri, stato F1–F6) | 🟡 *(header "v0.1 nessun codice" + `MISSION_DIST` 18000 vs 6000 reale: **da riconciliare**)* | ✋ |
| [`SOSTE_DIEGETICHE.md`](SOSTE_DIEGETICHE.md) | Hub di sosta a piedi (piano/scope, avatar, fasi) | 🟡 *(stato Fase 3 contraddittorio §10 vs §13)* | ✋ |
| [`ROADMAP_RIGIOCABILITA.md`](ROADMAP_RIGIOCABILITA.md) | Roadmap rigiocabilità (Track A–D) | 🟡 *(header stantio vs §9 "Track A+B fatti"; §7 foschia superata)* | ✋ |
| [`TUTORIAL.md`](TUTORIAL.md) | Onboarding / tutorial design | 🟢 | ✋ |

## Art bible (estetica & game-feel)
| Doc | Scopo | Stato | Validatore |
|---|---|---|---|
| [`ART_BIBLE_ZOMBIES.md`](ART_BIBLE_ZOMBIES.md) | Nemici/boss + **Standard di Produzione AAA** (cross-titolo) | 🟢 *(linguaggio autofire/boss da marcare "in pausa")* | ✅ `validate:art` |
| [`ART_BIBLE_OGGETTI.md`](ART_BIBLE_OGGETTI.md) | Veicoli, armi/proiettili, pickup, componenti, sopravvissuti | 🟢 | ✅ `validate:art` |
| [`ART_BIBLE_INTERFACCE.md`](ART_BIBLE_INTERFACCE.md) | UI/HUD, negozio, pausa, overlay esito, debug (token UI) | 🟢 | ✅ `validate:art` |
| [`ART_BIBLE_AUDIO.md`](ART_BIBLE_AUDIO.md) | Suoni & loop motore: forme d'onda, frequenze, mix | 🟢 *(linguaggio `fireAutoShot` da aggiornare)* | ✅ `validate:audio` |
| [`ART_BIBLE_AMBIENTE.md`](ART_BIBLE_AMBIENTE.md) | Strada, sfondo a strati, illuminazione del mondo | 🟢 | ✋ *(§14: `validate:art` NON copre ambiente)* |
| [`ART_BIBLE_ICONE.md`](ART_BIBLE_ICONE.md) | Iconografia, glifi HUD procedurali, teach-once | 🟢 | ✋ *(§8: nessun `validate:icone`)* |
| [`ART_BIBLE_SOSTE.md`](ART_BIBLE_SOSTE.md) | Estetica degli hub di sosta | 🔵 *(bozza v0.1)* | ✋ *(§9: gancio solo proposto)* |

## Processo & tecnica
| Doc | Scopo | Stato | Validatore |
|---|---|---|---|
| [`ARCHITETTURA.md`](ARCHITETTURA.md) | Scaling design+zoom, oversampling, flusso scene, registry `RunData` | 🟢 *(§8.1 dice ancora "combat in branch")* | — |
| [`I18N.md`](I18N.md) | Internazionalizzazione: `t()`, 6 lingue, ricette, insidie | 🟢 | ✅ `validate:i18n` *(sui dizionari `src/locales/`)* |
| [`TESTING.md`](TESTING.md) | Strategia QA, checklist playtest, E2E | 🟡 *(test unitari/integrazione proposti; Vitest non installato)* | — |

## Release & distribuzione
| Doc | Scopo | Stato | Validatore |
|---|---|---|---|
| [`DESKTOP.md`](DESKTOP.md) | Wrapper desktop Electron / packaging NSIS | 🟢 *(verifica `dist` parziale)* | — |

## Archivio
| Doc | Scopo | Stato | Validatore |
|---|---|---|---|
| [`archive/ANALISI_2026-06-17.md`](archive/ANALISI_2026-06-17.md) | Audit storico **pre-pivot** (quarantenato) | 🗄️ | — |

---

## Doc ancora da creare (segnalati dall'audit struttura)
- `docs/ACCESSIBILITA.md` — scala testo, contrasto, remap, riduci-movimento, **avviso fotosensibilità**, sottotitoli. *(priorità alta — barriera Steam)*
- `docs/DIREZIONE_VISIVA.md` — ADR **2D procedurale vs prototipi 3D Babylon** (`prototypes/babylon-*.html`, oggi non documentati).
- `docs/MARKETING.md` — pagina store, press kit, comparabili, trailer, branding.
- `docs/RISCHI.md` — risk register unico (rischi oggi sparsi per-doc).

## Convenzione di stato (da adottare)
Fonti-di-verità stabili (`ART_BIBLE_*`, `BALANCE`, `GAME_DESIGN`, `NARRATIVA_PERSONAGGI`) e **piani-con-checklist**
(`ROADMAP_*`, `CAMPAGNA_*`, `SOSTE_*`) hanno nature diverse: i secondi vanno aperti con
**una tabella di stato in cima, sincronizzata col corpo** (evitare header narrativi "v0.1" che il corpo
contraddice). Dove un blocco è superato ma conservato, marcarlo in testa o spostarlo in `archive/`.
