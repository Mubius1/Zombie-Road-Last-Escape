# 🔊 Art Bible — Comparto Audio
### Zombie Road: Last Escape · Direzione Sonora (qualità AAA)

> **Stato:** v1.0 · vivo (living document) · chiude l'asimmetria "occhio/orecchio" (4 art bible visive, 0 audio).
> **Ambito:** **tutti** i suoni del gioco — i 10 effetti gameplay (sparo, uccisione, aggancio zombi, pickup carburante, impatto, esplosione, sfrigolio tossico, game over, missione completata, **morte boss**), il **loop del motore** dinamico e l'**anteprima sonora** delle impostazioni. Tutto ciò che il giocatore **sente**.
> **Vincolo fondante:** audio **100% procedurale** (Web Audio API → oscillatori, rumore, filtri biquad, inviluppi di gain). **Nessun file audio, nessun sample, nessuna libreria esterna.** Tutto vive in [`src/SoundManager.ts`](../src/SoundManager.ts).

Questo documento è la **fonte di verità** per chiunque (umano o AI) tocchi un suono. Se modifichi una forma d'onda, una frequenza o un inviluppo, **aggiorna anche la sua scheda qui**. È il quinto strato della direzione artistica: la voce del mondo all'orecchio.

> **Documenti gemelli:**
> - [`ART_BIBLE_ZOMBIES.md`](./ART_BIBLE_ZOMBIES.md) — i nemici. Contiene la sezione **⭐ Standard di Produzione AAA**, valida per **tutto il titolo**: è la **stella polare** condivisa. Qui non la riscrivo — la **applico al suono**.
> - [`ART_BIBLE_AMBIENTE.md`](./ART_BIBLE_AMBIENTE.md) — strada e sfondo.
> - [`ART_BIBLE_OGGETTI.md`](./ART_BIBLE_OGGETTI.md) — veicoli, armi, pickup, sopravvissuti.
> - [`ART_BIBLE_INTERFACCE.md`](./ART_BIBLE_INTERFACCE.md) — UI/HUD.
>
> Per il *quando* e *quanto* (chi spara, quando muore uno zombi, ricompense) la fonte resta [`GAME_DESIGN.md`](./GAME_DESIGN.md) / [`BALANCE.md`](./BALANCE.md). Per l'**architettura** del wiring audio (AudioContext di Phaser, gating su `Settings.volume`, ciclo di vita motore) vedi [`ARCHITETTURA.md`](./ARCHITETTURA.md) §Audio.

---

## ⭐ Come l'audio serve lo Standard AAA

I tre pilastri del titolo (coesione · game feel · rifinitura) tradotti sul suono:

- **Coesione.** Il gioco è desaturato, sporco, cupo. L'audio **suona come appare**: niente timbri puliti "da sintetizzatore allegro". Le minacce e gli impatti vivono nel **rumore filtrato** (esplosioni, sparo, sfrigolio) e in **toni gravi che precipitano** (uccisione, aggancio, game over); le ricompense sono **brevi arpeggi consonanti** (carburante, missione completata) — l'unico colore "caldo" concesso, come l'accento emissivo nella UI. Il **motore** è un ronzio grave costante che fa da bordone a tutta la partita: è il battito del mondo.

- **Game feel.** Ogni suono **pesa e reagisce**. Gli effetti d'azione sono **percussivi** (attacco istantaneo, decadimento esponenziale rapido) → l'azione "morde". Il motore **non è statico**: la sua frequenza segue il carico (`setEngineLoad`) — sale a pieno regime, **scende** se il motore è danneggiato o coperto di zombi. Le code di esito (game over, missione completata) sono **sequenze temporizzate**, non un colpo unico: danno respiro al momento.

- **Rifinitura.** Niente suono "secco" senza inviluppo: **ogni** voce ha attacco e decadimento espliciti (mai un on/off a gradino, che fa "click"). Il master è a un **livello di riferimento basso** (`BASE_VOLUME = 0.35`) per lasciare headroom quando 10 suoni si sovrappongono, e un **limiter brick-wall** sul master (§4) fa da rete di sicurezza contro il clipping nei picchi (morte boss). Il loop del motore si **spegne in dissolvenza** (0.3 s), mai con un taglio netto.

> **Regola d'oro dell'audio:** *Leggibilità prima di tutto. In 1 colpo d'orecchio il giocatore deve distinguere — senza guardare — un colpo andato a segno (uccisione, grave che precipita) da un danno subìto (impatto/aggancio), e una ricompensa (arpeggio salente) da una sconfitta (arpeggio discendente). Se "ricco" e "leggibile" sono in conflitto, vince **leggibile**. Nessun suono copre il feedback di un altro più importante.*

---

## 0. Mappa del codice (dove vive tutto)

| Cosa | Dove |
|---|---|
| **Tutti i suoni** (sintesi, filtri, inviluppi) | [`src/SoundManager.ts`](../src/SoundManager.ts) |
| **Master gain / volume** | `SoundManager.master`, `BASE_VOLUME`, `setVolume()` |
| **Limiter brick-wall** | `SoundManager.limiter` (`DynamicsCompressorNode`; `master → limiter → ctx.destination`) |
| **Generatore di rumore bianco** | `SoundManager.noise(duration)` |
| **Loop del motore** | `startEngine()` / `setEngineLoad(factor)` / `stopEngine()` |
| **Istanza in partita** + start/stop + gating volume | [`GameScene.create()`](../src/scenes/GameScene.ts) (`this.sfx = new SoundManager(...)`) |
| **AudioContext condiviso** (da Phaser) | `(this.sound as Phaser.Sound.WebAudioSoundManager).context` |
| **Trigger dei suoni** | chiamate `this.sfx?.play…()` sparse in `GameScene` (collisioni, fuoco, pickup, esito) |
| **Anteprima sonora UI** | [`SettingsScene.playPreview()`](../src/scenes/SettingsScene.ts) → `playZombieKill()` |
| **Preferenza volume persistente** | [`src/Settings.ts`](../src/Settings.ts) → `Settings.volume` (localStorage) |

**Catena di segnale (sempre):** sorgente (`OscillatorNode` o `AudioBufferSourceNode`) → [`BiquadFilterNode` opzionale] → `GainNode` (inviluppo) → **`master`** (`GainNode`, `BASE_VOLUME · volumeUtente`) → **`limiter`** (`DynamicsCompressorNode` brick-wall, §4) → `ctx.destination`. **Nessuna voce** salta il master: è l'unico punto di controllo del volume; il limiter è una rete di sicurezza dopo il master, non un secondo controllo di volume.

---

## 1. I tre livelli di lettura (per il suono)

Come per i nemici (silhouette → movimento → texture), un suono si legge in tre strati. **Se devi tagliare, taglia dal fondo.**

1. **FUNZIONE** — *cosa mi dice?* In 1 colpo d'orecchio: ricompensa / minaccia / azione mia / esito. Questa lettura vive nel **gesto melodico** (sale = bene, scende = male) e nel **timbro** (rumore = fisico/violento, tono puro = astratto/UI) prima ancora del dettaglio.
2. **PESO** — *quanto è grosso?* L'**inviluppo** e il **livello** dicono la scala: un colpo MG è breve e leggero, un'esplosione è lunga, scura e forte. La differenza di durata/ampiezza è la differenza di importanza.
3. **MATERIA & MOOD** — filtro, frequenza, vibrato del motore: il *carattere* sporco e cupo. È l'ultimo 20%, ma è ciò che distingue "beep da prototipo" da "audio del mondo".

> **Regola d'oro:** *Gesto corretto (su/giù) + inviluppo percussivo per l'azione + timbro coerente col mondo (sporco, grave) + un solo bordone continuo (motore). Mai un on/off a gradino, mai due ricompense col gesto discendente, mai un'esplosione più acuta di uno sparo.*

---

## 2. Vincoli tecnici (non negoziabili)

- **Solo Web Audio API.** `OscillatorNode` (`sine`/`sawtooth`), `AudioBufferSourceNode` (rumore), `BiquadFilterNode` (`highpass`/`bandpass`/`lowpass`), `GainNode`. **Niente** `<audio>`, niente sample importati, niente librerie audio.
- **Un solo `AudioContext`**, quello di Phaser (`WebAudioSoundManager.context`). Non crearne di nuovi: il browser ne limita il numero e richiede un gesto utente per sbloccarli. `SoundManager` riceve il contesto nel costruttore.
- **Un solo master.** Tutte le voci passano da `this.master`. Il volume utente si applica **solo** lì, via `setVolume()` (scala `BASE_VOLUME`). Mai regolare il volume modificando i gain delle singole voci.
- **Spara-e-dimentica.** Ogni effetto crea i suoi nodi, programma `start()`/`stop()` e li lascia raccogliere dal GC. **Non** tenere riferimenti agli effetti one-shot. L'**unica** voce con stato persistente è il motore (`engineOsc`/`engineGain`/`engineLfo`), perché è un loop.
- **Sempre un inviluppo.** Mai `gain.value = X` seguito da uno stop secco: produce un "click". Usa `setValueAtTime` + `exponentialRampToValueAtTime`/`linearRampToValueAtTime`. L'esponenziale non può puntare a 0 → si punta a `0.001`.
- **Gating sul gameplay.** Gli effetti si chiamano via `this.sfx?.…` (optional chaining): se l'AudioContext non è disponibile, **silenzio**, nessun crash.

---

## 3. Linguaggio sonoro condiviso

### 3.1 Palette timbrica (i "colori" del suono)

| Timbro | Sorgente | Significato | Usato da |
|---|---|---|---|
| **Rumore filtrato — acuto** | `noise` + `highpass` | scarica secca, attrito | sparo (2500 Hz), sfrigolio tossico (1400 Hz) |
| **Rumore filtrato — medio** | `noise` + `bandpass` | colpo fisico, urto | impatto (350 Hz, Q 0.4) |
| **Rumore filtrato — grave** | `noise` + `lowpass` | deflagrazione, massa | esplosione (600 Hz) |
| **Tono che precipita** | `sine`/`sawtooth` con ramp di frequenza ↓ | morte, danno, fallimento | uccisione (sine 160→40), aggancio (saw 90→25), game over (saw discendente) |
| **Arpeggio consonante salente** | più `sine` a frequenze di scala maggiore | ricompensa, successo | carburante (C-E-G), missione completata (C-E-G-C-E) |
| **Bordone grave che pulsa (chug)** | 2 × `sawtooth` 46–86 Hz detunati → `lowpass` + tremolo d'ampiezza 9–25 Hz + grana di `noise` | il mondo è vivo / motore a scoppio | loop motore |

### 3.2 Gesto melodico (la regola del su/giù)

- **Sale o è consonante → bene** (pickup, missione completata).
- **Scende → male / fine** (uccisione zombi, aggancio, game over).
- Le frequenze delle ricompense sono note di una **scala di Do maggiore** (Do4 261 · Mi4 329 · Sol4 392 · Do5 523 · Mi5 659) → suonano "giuste" insieme. **Non** scegliere frequenze a caso per un nuovo suono di successo: prendile da questa serie.

### 3.3 Inviluppo (la regola del peso)

L'azione è **percussiva**: attacco quasi istantaneo, decadimento **esponenziale** breve (niente sustain). Più l'evento è "grosso", più lunga è la coda:

```
sparo 0.07s  │█▁                      (schiocco)
impatto 0.12 │██▁▁
uccisione .18│███▁▁
esplosione   │██████████▁▁▁▁  0.55s   (massa, coda lunga)
```

Le ricompense e gli esiti usano invece un **attacco lineare morbido** (~0.02–0.03 s, niente click di partenza) + coda lunga, e sono **sequenze** di più voci sfalsate nel tempo (arpeggio).

---

## 4. Mixaggio & master

| Parametro | Valore | Note |
|---|---|---|
| `BASE_VOLUME` | **0.35** | livello del master a volume utente = 1. Basso di proposito: headroom per le sovrapposizioni. |
| `setVolume(v)` | `master.gain = 0.35 · clamp01(v)` | unico punto di controllo. `v` viene da `Settings.volume`. |
| Voce più forte | esplosione (gain di voce **0.8**) | la deflagrazione domina, come dev'essere. |
| Voce più debole | sfrigolio tossico (**0.18**), motore (**0.055**) | ambientali, non devono coprire l'azione. |
| **Limiter master** | `DynamicsCompressor`: soglia **−3 dB**, ratio **20:1**, knee **0**, attacco **3 ms**, rilascio **100 ms** | brick-wall tra `master` e `ctx.destination`. Trasparente ai livelli normali; interviene solo quando le voci sommate superano il fondo scala (morte boss: timbro-firma + ~3 esplosioni + motore). Evita il clipping senza dover riequilibrare ogni picco. È una *protezione*, non un'identità tonale → descritto qui, **non** validato a numero (come gli inviluppi di dettaglio, vedi §4.1). |

**Gerarchia di volume di voce (gain di picco, prima del master):** esplosione 0.8 › impatto 0.55 › **morte boss (timbro-firma 0.3–0.5, layer SOTTO l'esplosione che la accompagna)** › sparo 0.45 › uccisione 0.32 › game over / missione / carburante 0.30–0.28 › aggancio 0.28 › sfrigolio 0.18 › **motore 0.055**. Rispetta quest'ordine quando aggiungi un suono: la sua importanza per il giocatore = la sua posizione qui.

### 4.1 Valori-firma validati 🔒

Sottoinsieme di numeri verificato automaticamente da `npm run validate:audio` contro [`src/SoundManager.ts`](../src/SoundManager.ts) (anti-deriva, come per arte e bilanciamento — vedi [CLAUDE.md Regola n.2](../CLAUDE.md)). Coprono l'**identità sonora portante**: livello del master, il bordone del **motore**, e le **frequenze-firma dei filtri** dei suoni a rumore. Gli inviluppi/durate di dettaglio restano nelle schede §5 (descritti, non validati a numero). Se cambi uno di questi valori nel codice, aggiorna qui la riga 🔒 o la build fallisce.

| `chiave` | Valore | Dove nel codice (`SoundManager.ts`) |
|---|---|---|
| `base_volume` | 0.35 | `BASE_VOLUME` (livello del master) |
| `engine_osc_hz` | 46 | `startEngine` → `engineOsc.frequency.value` (fondamentale idle) |
| `engine_lfo_hz` | 9 | `startEngine` → `engineLfo.frequency.value` (cadenza del chug idle) |
| `engine_lfo_gain` | 0.2 | `startEngine` → `lfoGain.gain.value` (profondità del chug d'ampiezza) |
| `engine_gain` | 0.055 | `startEngine` → `engineGain.gain.value` |
| `engine_load_base` | 46 | `setEngineLoad` → `46 + factor·40` (frequenza minima) |
| `engine_load_span` | 40 | `setEngineLoad` → `46 + factor·40` (escursione → max 86) |
| `engine_fade_s` | 0.3 | `stopEngine` → costante di dissolvenza `setTargetAtTime(…, 0.3)` |
| `shot_filter_hz` | 2500 | `playShot` → highpass |
| `impact_filter_hz` | 350 | `playImpact` → bandpass |
| `explosion_filter_hz` | 600 | `playExplosion` → lowpass |
| `explosion_peak` | 0.8 | `playExplosion` → gain di picco (la voce più forte) |
| `toxic_filter_hz` | 1400 | `playToxicSizzle` → highpass |

---

## 5. Schede dei suoni

> Legenda: **F** = forma d'onda/sorgente · **Freq** = frequenza/e (Hz) · **Filtro** = biquad · **Env** = inviluppo di gain (picco → fine, durata) · **Trigger** = quando suona.

### 5.1 SPARO — `playShot()`
- **F:** rumore bianco · **Filtro:** highpass 2500 Hz · **Env:** 0.45 → 0.001 esponenziale in **0.07 s**.
- **Trigger:** ogni proiettile sparato (MG, doppia MG, fucile, razzi, lanciafiamme) — `fireWeapon()`/`updateFiring()`.
- **Intento:** schiocco secco e leggero. Acuto perché si ripete tantissimo: non deve affaticare né mascherare gli impatti.

### 5.2 UCCISIONE ZOMBI — `playZombieKill()`
- **F:** sine · **Freq:** 160 → **40** (precipita) esponenziale in 0.18 s · **Env:** 0.32 → 0.001 in **0.18 s**.
- **Trigger:** uno zombi muore per i colpi del giocatore. Anche **anteprima** nelle Impostazioni.
- **Intento:** "tonfo" cupo discendente = qualcosa è caduto. Tono puro (non rumore) per staccare dall'impatto fisico.

### 5.3 AGGANCIO ZOMBI — `playZombieAttach()`
- **F:** sawtooth (sporco) · **Freq:** 90 → **25** in 0.22 s · **Env:** 0.28 → 0.001 in **0.25 s**.
- **Trigger:** uno zombi si aggrappa al veicolo (`attachedZombies`) — danno persistente.
- **Intento:** grave ringhioso e malato. Sawtooth + frequenza bassissima = minaccia organica addosso a te. Va distinto dall'impatto (rumore) perché è una **minaccia che resta**.

### 5.4 PICKUP CARBURANTE — `playFuelPickup()`
- **F:** 3 × sine · **Freq:** Do4 261 · Mi4 329 · Sol4 392 (arpeggio maggiore salente), sfalsate di **0.09 s** · **Env per voce:** attacco lineare a 0.28 in 0.02 s → 0.001 in ~0.28 s.
- **Trigger:** raccolta di una tanica di carburante.
- **Intento:** "ding" positivo a 3 note. Triade di Do maggiore = ricompensa inequivocabile.

### 5.5 IMPATTO — `playImpact()`
- **F:** rumore bianco · **Filtro:** bandpass 350 Hz, Q 0.4 · **Env:** 0.55 → 0.001 in **0.12 s**.
- **Trigger:** collisione veicolo↔zombi, proiettile↔corpo, vari urti fisici (più siti in `GameScene`).
- **Intento:** "thud" corposo a banda media. Il colpo fisico generico: più pesante dello sparo, più corto dell'esplosione.

### 5.6 ESPLOSIONE — `playExplosion()`
- **F:** rumore bianco · **Filtro:** lowpass 600 Hz · **Env:** **0.8** → 0.001 in **0.55 s** (coda lunga).
- **Trigger:** razzi (AoE), morte di un boss, distruzioni grosse, esplosioni veicolo.
- **Intento:** **la voce più forte e più scura del gioco.** Lowpass = tutta massa e niente acuti = deflagrazione. La coda lunga le dà scala.

### 5.7 SFRIGOLIO TOSSICO — `playToxicSizzle()`
- **F:** rumore bianco · **Filtro:** highpass 1400 Hz · **Env:** 0.18 → 0.001 in **0.2 s**.
- **Trigger:** nube tossica dello zombi Tossico / danno da veleno.
- **Intento:** sibilo acido sottile. Volutamente **debole** (0.18): è atmosfera/avviso, non un colpo.

### 5.8 GAME OVER — `playGameOver()`
- **F:** 4 × sawtooth · **Freq:** 280 · 240 · 190 · 140 (**discendente**), sfalsate di **0.2 s** · **Env per voce:** 0.3 → 0.001 in 0.38 s.
- **Trigger:** sconfitta (veicolo distrutto). In coppia con `stopEngine()`.
- **Intento:** sequenza grave che **scende e si spegne** = motore/vita che si arresta. Sawtooth = sporco, senza speranza.

### 5.9 MISSIONE COMPLETATA — `playMissionComplete()`
- **F:** 5 × sine · **Freq:** Do4 261 · Mi4 329 · Sol4 392 · Do5 523 · Mi5 659 (**fanfara salente**), sfalsate di **0.11 s** · **Env per voce:** attacco a 0.3 in 0.03 s → 0.001 in ~0.55 s.
- **Trigger:** missione completata / boss sconfitto. In coppia con `stopEngine()`.
- **Intento:** fanfara di vittoria pulita e luminosa — l'unico momento davvero "caldo" del mix. Cinque note di Do maggiore che salgono di ottava.

### 5.10 MORTE BOSS — `playBossDeath(kind)`
- **F/Env:** un **timbro-firma per tipo**, sovrapposto a ~3 `playExplosion()` (decoupling voluto: 6 lampi visivi, 3 boati → respiro al timbro). Tutte le voci → master, inviluppo esplicito (→ 0.001), gesto **discendente/che collassa**, picco **sotto** l'esplosione (0.8).
  - **`mega_mutant`** — *boato organico*: 2 × `sawtooth` gravi detunati 108/96 → **28 Hz** (più cadaveri) + "splat" `noise`+`lowpass` 800 Hz. Picco ~0.4.
  - **`giant_worm`** — *sfaldamento*: 4 pulsazioni `sawtooth` discendenti 150·120·96·72 Hz (i segmenti che si staccano) sfalsate 0.085 s + gorgoglio `noise`+`bandpass` 300 Hz. Picco ~0.3.
  - **`armored_colossus`** — *crollo d'acciaio*: tonfo `noise`+`lowpass` 500 Hz (0.5) + 4 rintocchi metallici inarmonici (`sawtooth`+`bandpass` Q6 @ 523·785·932·1170 Hz). Picco ~0.5.
  - **`radioactive_beast`** — *fusione del nucleo*: scarica `noise`+`highpass` 1600 Hz (geiger) + tono instabile con **vibrato LFO 14 Hz** che sale 180→320 poi collassa a 50 Hz. Picco ~0.3.
- **Trigger:** `bossDeathFx()` (da `killBoss`), una volta, al momento della morte.
- **Intento:** dare a ogni boss una **voce di morte riconoscibile**, coerente col modello e coi VFX dedicati (ART_BIBLE_ZOMBIES §6.7.6): viscerale · che si spezza · metallico · radioattivo. Mai un gesto salente (= ricompensa): la morte del boss è una deflagrazione, non una fanfara (quella è `playMissionComplete`, che parte subito dopo).

### 5.11 APPARIZIONE BOSS — `playBossWarn()`
- **F:** sawtooth · **Freq:** 55 → **110** (sale, minaccia che cresce) in 0.5 s · **Env:** attacco lineare a 0.5 in 0.08 s → 0.001 in 0.6 s.
- **Trigger:** `BossController.spawn()` (sostituisce il vecchio `playExplosion` generico).
- **Intento:** stinger di **telegrafo**: grave che sale = "sta arrivando qualcosa di grosso". Gesto ascendente ammesso qui perché è *tensione*, non ricompensa.

### 5.12 ALLARME CARBURANTE — `playLowFuel()`
- **F:** 2 × sine · **Freq:** 880 Hz · **Env per bip:** attacco a 0.2 in 0.01 s → 0.001 in 0.12 s, due bip sfalsati di 0.18 s.
- **Trigger:** in `updateFuel`, una volta sola, quando il carburante scende **sotto il 25%** (isteresi: si riarma sopra il 30%).
- **Intento:** avviso secco e acuto, sotto l'azione, per la risorsa-tempo critica. Volutamente breve e poco invadente (non deve coprire l'azione).

### 5.13 SOVRACCARICO — `playOverdrive()`
- **Voci:** triade `392·523·659 Hz` (3 × sine, ognuna piega ×1.5 verso l'alto, sfalsate di 0.05 s) + **sweep d'aria** (rumore `highpass` 600→4000 Hz in 0.28 s). **Env:** attacco rapido (lin → 0.26 / 0.22), coda esponenziale → 0.001 a ~0.3 s.
- **Trigger:** in `activateOverdrive` (tasto F a barra piena del Sovraccarico, A3), una volta per attivazione.
- **Intento:** gesto **power-up** ascendente e brillante — la ricompensa *attiva* della combo. Sale come `playBossWarn`, ma in tono **trionfale** (triade maggiore) anziché minaccioso.

> **Lifecycle (AU):** il `master` ha un **buffer di rumore condiviso** (`noiseBuffer`, generato una volta) riusato da tutte le voci a rumore; `startEngine()` fa `ctx.resume()` se il contesto è sospeso; `dispose()` (chiamato allo SHUTDOWN di GameScene e SettingsScene) ferma il motore e **scollega master+limiter** da `destination` → nessun nodo orfano sul context condiviso a ogni restart.

---

## 6. Loop del motore (l'unica voce con stato)

Bordone continuo che fa da battito del mondo per tutta la partita. **Non è un tono singolo:** un vero motore a scoppio è un *blocco che ringhia* + il *putt-putt* ritmico degli scoppi + la *grana meccanica* dell'aria. Per questo il loop somma tre strati, tutti pilotati dal carico (`setEngineLoad`), e fonde il tutto con un **tremolo d'ampiezza** (il "chug") — è quest'ultimo, non un vibrato di frequenza, a dare il carattere di motore invece di un drone.

Nodi persistenti: `engineOsc` + `engineOsc2` (tonale), `engineLfo` + lfoGain (chug), `engineLowpass` (timbro), `engineNoise` (grana), `engineGain` (livello).

| Parte | Valore | Ruolo |
|---|---|---|
| Oscillatori tonali | 2 × `sawtooth`, base **46 Hz** + gemello **×1.012** (detune) | ringhio "a blocco"; il battimento ≈1 Hz dà la lopezza viva |
| Lowpass | **240 Hz** (idle) → **1000 Hz** (pieno regime), Q 1.2 | apre col carico: cupo/ovattato fermo, brillante a tutto gas |
| LFO chug | **9 Hz** (idle) → **25 Hz** (pieno) → gain **0.2** → `trem.gain` (centro 0.8) | tremolo d'ampiezza = il *putt-putt* degli scoppi |
| Grana | `noise` loop → `bandpass` 320 Hz (mix 0.12) | aria/valvole; sotto il tonale, anch'essa pulsata dal chug |
| Gain | **0.055** | volutamente bassissimo: bordone, non protagonista |

- **`startEngine()`** — crea e avvia i nodi (2 osc + LFO + noise loop). **Idempotente**: se il motore è già attivo, esce subito (no doppioni).
- **`setEngineLoad(factor)`** — `factor` 0..1 pilota *tutto e insieme*: la fondamentale **46 + factor·40 Hz** (range **46–86 Hz**), la cadenza del chug **9 + factor·16 Hz**, e l'apertura del lowpass **240 + factor·760 Hz** — con `setTargetAtTime` (transizioni morbide, niente salti). Chiamato ogni frame in `updateVehicle()` con
  `factor = (engine.health/100) · max(0.3, 1 − nZombiAggrappati·0.15)` → **a pieno regime ringhia serrato e brillante; quando è danneggiato o coperto di zombi cala di tono, il chug rallenta in un putt-putt faticoso e il timbro si fa cupo.**
- **`stopEngine()`** — dissolve `engineGain` a 0.001 in **0.3 s**, poi ferma tutti gli oscillatori e il rumore a +1.2 s e azzera i riferimenti. **Mai un taglio secco.**

**Ciclo di vita** (vedi [`ARCHITETTURA.md`](./ARCHITETTURA.md)): start in `GameScene.create()`; stop allo `SHUTDOWN` della scena, alla pausa (overlay impostazioni), a missione completata e a game over; **restart** all'evento `RESUME` (ritorno dalla pausa), che riallinea anche il volume.

---

## 7. Gating, volume e ciclo di vita

- **In partita:** `GameScene.create()` istanzia `this.sfx`, chiama `setVolume(Settings.volume)` e `startEngine()`. Tutti i trigger usano `this.sfx?.…`.
- **Volume utente:** la barra a 10 segmenti in `SettingsScene` scrive `Settings.volume` (persistito in localStorage) e suona un'**anteprima** (`playZombieKill()`) al livello scelto, così il giocatore *sente* il valore.
- **Pausa (ESC in gioco):** apre `SettingsScene` come overlay (`scene.launch` + `scene.pause`) e ferma il motore; al `RESUME` il motore riparte e il volume si riallinea.
- **Nessun gate `screenFx`:** quel flag governa **solo** l'overlay filmico video. L'audio è governato unicamente da `Settings.volume` (0 = muto).

---

## 8. Antipattern da evitare

- ❌ **On/off a gradino** (`gain.value = X` poi stop) → "click". Sempre un ramp.
- ❌ **Esponenziale verso 0** → errore Web Audio. Punta a `0.001`.
- ❌ **Saltare il master** o regolare il volume sulle singole voci → il controllo volume si rompe.
- ❌ **Creare un nuovo `AudioContext`** invece di usare quello di Phaser → il browser lo blocca.
- ❌ **Tenere riferimenti agli one-shot** → leak. Solo il motore ha stato.
- ❌ **Ricompensa con gesto discendente** o **frequenze fuori dalla scala di Do** → suona "sbagliato".
- ❌ **Un nuovo suono più forte dell'esplosione** o più acuto dello sparo senza motivo → rompe la gerarchia di §4 e la leggibilità.
- ❌ **Chiamare un suono senza `?.`** → crash se l'audio non è inizializzato.

---

## 9. Pipeline: aggiungere un nuovo suono

1. **Decidi la funzione** (§1): ricompensa / minaccia / azione / esito → da lì derivano gesto (su/giù) e timbro (tono puro vs rumore).
2. **Scegli il livello** in base all'importanza, rispettando la gerarchia di §4.
3. **Scrivi il metodo** in `SoundManager.ts` seguendo il template §10: sorgente → filtro opzionale → `GainNode` con inviluppo → `this.master` → `start()/stop()`.
4. **Per un suono "positivo"** prendi le frequenze dalla scala di Do (§3.2). **Per un colpo/minaccia** parti da `this.noise()` + filtro, o da un tono che precipita.
5. **Triggera** da `GameScene` (o dalla scena pertinente) con `this.sfx?.nuovoSuono()`.
6. **Compila la scheda** in §5 (F · Freq · Filtro · Env · Trigger · Intento) e, se serve, aggiorna la gerarchia di §4.
7. **Testa** ai volumi estremi (1 e ~0.1) e **in sovrapposizione** con esplosione + sparo + motore: non deve mascherare l'azione né saturare.

---

## 10. Scheda-template (nuovo suono)

### 10.1 — Codice (da incollare in `SoundManager.ts`)

```ts
playNuovoSuono() {
  const dur = 0.15;
  // Sorgente: oscillatore per un tono, this.noise(dur) per rumore.
  const osc = this.ctx.createOscillator();
  osc.type = 'sine';                       // 'sine' (pulito) | 'sawtooth' (sporco)
  osc.frequency.setValueAtTime(261, this.ctx.currentTime);          // da scala di Do se "positivo"
  // osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + dur); // precipita = "male"

  // Filtro opzionale (per il rumore): highpass=acuto, bandpass=medio, lowpass=grave.
  // const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 600;

  const g = this.ctx.createGain();         // SEMPRE un inviluppo, mai gain.value secco
  g.gain.setValueAtTime(0.30, this.ctx.currentTime);                 // picco: vedi gerarchia §4
  g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

  osc.connect(g); g.connect(this.master);  // SEMPRE → this.master
  osc.start(); osc.stop(this.ctx.currentTime + dur);
}
```

### 10.2 — Scheda Markdown (da incollare in §5)

```md
### 5.N NOME — `playNuovoSuono()`
- **F:** … · **Freq:** … · **Filtro:** … · **Env:** picco → 0.001 in … s.
- **Trigger:** quando suona, da quale metodo.
- **Intento:** cosa deve far sentire al giocatore (1 riga).
```

### 10.3 — Dopo aver compilato il template
- Inserisci la scheda al posto giusto in §5 e, se cambia l'equilibrio, aggiorna la gerarchia di §4.
- Triggera con `this.sfx?.playNuovoSuono()`.
- Riascolta in sovrapposizione (§9.7).

---

## 11. Checklist di qualità (definition of done)

- [ ] La voce passa da `this.master` (volume controllabile).
- [ ] Inviluppo esplicito su ogni voce (niente click); esponenziali → `0.001`, mai 0.
- [ ] Gesto coerente con la funzione (su = bene, giù = male); frequenze "positive" dalla scala di Do.
- [ ] Livello di picco coerente con la gerarchia di §4 (non più forte dell'esplosione, non più acuto dello sparo senza motivo).
- [ ] Triggerato via `this.sfx?.…` (nessun crash se l'audio non c'è).
- [ ] Nessun riferimento persistente per gli one-shot (solo il motore ha stato).
- [ ] Testato a volume 1 e ~0.1 e **in sovrapposizione** con esplosione + sparo + motore.
- [ ] Nessun clipping nei picchi: il **limiter master** (§4) fa da rete, ma il mix deve restare pulito ai livelli di §4 (il limiter non è una scusa per voci troppo forti).
- [ ] Scheda in §5 aggiornata.
