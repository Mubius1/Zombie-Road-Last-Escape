export default class SoundManager {
  /** Volume master di riferimento (a volume utente = 1). */
  private static readonly BASE_VOLUME = 0.35;

  private ctx: AudioContext;
  private master: GainNode;
  private limiter: DynamicsCompressorNode;
  private noiseBuffer: AudioBuffer; // rumore bianco generato UNA volta e condiviso (AU4)
  private engineOsc?: OscillatorNode;
  private engineOsc2?: OscillatorNode;
  private engineGain?: GainNode;
  private engineLfo?: OscillatorNode;
  private engineNoise?: AudioBufferSourceNode;
  private engineLowpass?: BiquadFilterNode;
  // ── Drone d'angoscia (pivot horror): seconda voce persistente, sotto il motore.
  //    Bordone grave dissonante che "respira" e cresce con la tensione (setDread).
  private droneOsc?: OscillatorNode;
  private droneOsc2?: OscillatorNode;
  private droneGain?: GainNode;
  private droneLowpass?: BiquadFilterNode;
  private droneLfo?: OscillatorNode;
  private shotVerb: ConvolverNode;   // riverbero CORTO condiviso degli spari (coda d'aria/riflessi)
  private shotWet: GainNode;         // livello del riverbero spari (mix wet)
  private driveCurve: Float32Array<ArrayBuffer>;  // curva di saturazione (grit) condivisa dagli schiocchi

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = SoundManager.BASE_VOLUME;

    // Limiter brick-wall sul bus master (vedi ART_BIBLE_AUDIO §4): protegge da clipping/distorsione
    // quando molte voci si sovrappongono nel picco — es. morte boss = timbro-firma + ~3 esplosioni
    // (0.8 ciascuna) + motore. Tutte le voci → master → limiter → destination.
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;    // dB: interviene appena sotto il fondo scala
    this.limiter.knee.value = 0;          // ginocchio netto → comportamento da limiter, non compressore morbido
    this.limiter.ratio.value = 20;        // 20:1 = muro
    this.limiter.attack.value = 0.003;    // s: cattura i transienti
    this.limiter.release.value = 0.1;     // s
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    // Rumore bianco condiviso: prima ogni sparo allocava+riempiva un nuovo AudioBuffer (AU4). 2s coprono
    // il loop del motore e ogni one-shot (i chiamanti riusano il buffer e gestiscono start/stop).
    this.noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate);
    const nd = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Curva di saturazione (tanh) condivisa: dà "grit" allo schiocco — un colpo è così forte da
    // distorcere sé stesso; il rumore pulito suona "educato"/finto.
    this.driveCurve = SoundManager.makeDriveCurve(2.4);

    // Riverbero CORTO condiviso degli spari (send bus). Un colpo reale ha una coda d'aria/riflessi:
    // senza, lo sparo suona secco come statica. Impulso PROCEDURALE (rumore stereo che decade in 0.18 s)
    // → 100% sintetico, nessun sample esterno (vincolo art bible). Catena: voce → shotVerb → shotWet →
    // master. Tenuto corto e modesto (wet 0.3) per non impastare il fuoco rapido.
    this.shotVerb = ctx.createConvolver();
    this.shotVerb.buffer = this.makeImpulse(0.18, 2.6);
    this.shotWet = ctx.createGain();
    this.shotWet.gain.value = 0.3;
    this.shotVerb.connect(this.shotWet);
    this.shotWet.connect(this.master);
  }

  /** Impulso di riverbero PROCEDURALE: rumore stereo che decade esponenzialmente. Niente sample esterni. */
  private makeImpulse(duration: number, decay: number): AudioBuffer {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** Curva tanh per il WaveShaper: satura i picchi (drive `k`) senza tagliare a gradino. */
  private static makeDriveCurve(k: number): Float32Array<ArrayBuffer> {
    const n = 256, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k); }
    return c;
  }

  /** Se il browser ha sospeso il contesto (tab in background, risparmio energetico mobile), riprendilo (AU6). */
  private resumeIfSuspended() {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Imposta il volume utente (0..1), scalato sul livello master di riferimento. */
  setVolume(v: number) {
    const vol = v < 0 ? 0 : v > 1 ? 1 : v;
    this.master.gain.value = SoundManager.BASE_VOLUME * vol;
  }

  // ─── Gameplay sounds ─────────────────────────────────────────────────────────

  /**
   * SPARO — un timbro per tipo d'arma (realismo: ogni bocca da fuoco "spara a modo suo").
   * Anatomia di un colpo credibile (vs. il vecchio "tss" = solo highpass 2500 Hz):
   *   • CRACK   — rumore highpass SATURATO (`crackTail`): lo schiocco, con grit di waveshaper.
   *   • PUNCH   — oscillatore grave che PRECIPITA (`gunPunch`): il pugno nel petto, tonale (non
   *               rumore: un puff di rumore non "spinge"). Energia nei bassi-medi → udibile anche
   *               su casse di laptop, dove i 50 Hz puri spariscono.
   *   • CODA    — riverbero corto procedurale condiviso (`shotVerb`): l'aria/riflessi. Senza, il
   *               colpo è secco come statica. È questo + il punch a fare il salto di realismo.
   * I razzi = whoosh d'accensione grave (con coda); il lanciafiamme = soffio continuo morbido,
   * niente schiocco né coda (a 70 ms si impasterebbe). Tutte le voci → master, inviluppo esplicito
   * (→ 0.001), picco ≤ esplosione (0.8). Spara-e-dimentica: nessun riferimento tenuto.
   * NB: il primo `frequency.value` (crack MG, 1800 Hz) è la firma validata `shot_filter_hz` (§4.1).
   */
  playShot(kind: 'mg' | 'double_mg' | 'rifle' | 'rockets' | 'flamethrower' = 'mg') {
    const t0 = this.ctx.currentTime;
    switch (kind) {
      case 'mg': {
        const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800; // firma `shot_filter_hz`
        this.crackTail(this.noise(0.07), hp, 0.4, 0.05, t0);
        this.gunPunch(t0, 150, 55, 0.34, 0.09);   // pugno grave (rimpiazza il vecchio puff di rumore)
        break;
      }
      case 'double_mg': {
        // Due canne: doppio schiocco sfalsato 8 ms + pugno più pieno e grave.
        [0, 0.008].forEach((dt) => {
          const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1700;
          this.crackTail(this.noise(0.07), hp, 0.3, 0.05, t0 + dt);
        });
        this.gunPunch(t0, 135, 48, 0.36, 0.1);
        break;
      }
      case 'rifle': {
        // Alta potenza: schiocco più brillante + "tac" tonale velocissimo + pugno asciutto.
        const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
        this.crackTail(this.noise(0.07), hp, 0.42, 0.06, t0);
        this.gunPunch(t0, 200, 70, 0.26, 0.07);
        // snap supersonico: triangle che cade in un lampo (il "tac" secco del fucile)
        const osc = this.ctx.createOscillator(); osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, t0);
        osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.025);
        const og = this.ctx.createGain();
        og.gain.setValueAtTime(0.18, t0);
        og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
        osc.connect(og); this.sendShot(og, false);
        osc.start(t0); osc.stop(t0 + 0.05);
        break;
      }
      case 'rockets': {
        // LANCIO: whoosh d'accensione (lowpass che scende, con coda) + spinta tonale grave. Niente schiocco.
        // (L'esplosione AoE all'impatto resta `playExplosion`.)
        const wh = this.noise(0.3);
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, t0);
        lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.28);
        const wg = this.ctx.createGain();
        wg.gain.setValueAtTime(0.001, t0);
        wg.gain.linearRampToValueAtTime(0.42, t0 + 0.03);
        wg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
        wh.connect(lp); lp.connect(wg); this.sendShot(wg);   // con coda di riverbero
        wh.start(t0); wh.stop(t0 + 0.32);
        this.gunPunch(t0, 150, 55, 0.24, 0.22);              // spinta grave del razzo che parte
        break;
      }
      case 'flamethrower': {
        // SOFFIO continuo del getto: rumore bandpass con attacco morbido (niente transiente).
        // Fuoco rapido (70 ms) → le code si fondono in un boato continuo; volutamente debole (≈ sfrigolio).
        const f = 480 + Math.random() * 320;
        const src = this.noise(0.12);
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.6;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.16, t0 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
        src.connect(bp); bp.connect(g); g.connect(this.master);  // niente coda: a 70 ms impasterebbe
        src.start(t0); src.stop(t0 + 0.13);
        break;
      }
    }
  }

  /** Manda una voce al bus: dritta al master (dry) e, se `wet`, anche al riverbero corto degli spari. */
  private sendShot(node: AudioNode, wet = true) {
    node.connect(this.master);
    if (wet) node.connect(this.shotVerb);
  }

  /** Coda dello schiocco: sorgente → filtro → saturazione (grit) → inviluppo → bus (dry + riverbero). */
  private crackTail(src: AudioBufferSourceNode, filter: BiquadFilterNode, peak: number, dur: number, t0: number) {
    const ws = this.ctx.createWaveShaper(); ws.curve = this.driveCurve;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(ws); ws.connect(g);
    this.sendShot(g);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /** "Punch" della bocca da fuoco: oscillatore grave che PRECIPITA = pugno nel petto. Triangle (armoniche
   *  → udibile anche su casse di laptop). Dry, niente riverbero (i bassi in coda impasterebbero). */
  private gunPunch(t0: number, fStart: number, fEnd: number, peak: number, dur: number) {
    const osc = this.ctx.createOscillator(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(fStart, t0);
    osc.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur * 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); this.sendShot(g, false);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /** Colpo NON letale su un nemico: thwack secco e corto ("l'ho preso"). Pitch variato per non affaticare a fuoco rapido. */
  playHit() {
    const t0 = this.ctx.currentTime;
    const f = 600 + Math.random() * 260;
    // corpo: rumore bandpass medio (carne colpita)
    const src = this.noise(0.05);
    const flt = this.ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.30, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + 0.07);
    // click d'impatto del proiettile
    const osc = this.ctx.createOscillator(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(f * 0.7, t0);
    osc.frequency.exponentialRampToValueAtTime(150, t0 + 0.04);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.16, t0);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    osc.connect(g2); g2.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.06);
  }

  /** Nemico ABBATTUTO: gesto discendente ("muore") + splat di rumore (la carne che cede) → più "ciccia". */
  playZombieKill() {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.30, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.2);
    // splat: rumore lowpass breve (impatto carnoso) sotto il tono
    const src = this.noise(0.12);
    const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 600;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.26, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    src.connect(flt); flt.connect(ng); ng.connect(this.master);
    src.start(t0); src.stop(t0 + 0.14);
  }

  playZombieAttach() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(g); g.connect(this.master);
    osc.start(); osc.stop(this.ctx.currentTime + 0.28);
  }

  playFuelPickup() {
    [261, 329, 392].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.32);
    });
  }

  playImpact() {
    const dur = 0.12;
    const src = this.noise(dur);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 350;
    flt.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(); src.stop(this.ctx.currentTime + dur + 0.05);
  }

  playExplosion() {
    const dur = 0.55;
    const src = this.noise(dur);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.8, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(); src.stop(this.ctx.currentTime + dur + 0.05);
  }

  playToxicSizzle() {
    const src = this.noise(0.2);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(); src.stop(this.ctx.currentTime + 0.22);
  }

  /**
   * BRUSIO DI RADIO — fruscio di una trasmissione che si sintonizza, sotto il bollettino (campagna "Il Convoglio").
   * Soffio portante in bandpass medio-acuto (la radio "respira": attacco morbido, coda lunga) + qualche crepitio
   * sparso in highpass (la statica che scoppietta). Volume modesto: è una texture, non un evento. Vedi ART_BIBLE_AUDIO §5.
   */
  playRadioStatic() {
    this.resumeIfSuspended();
    const t0 = this.ctx.currentTime, dur = 2.4;
    // Soffio portante: rumore in bandpass (firma timbrica 1650 Hz), in loop per coprire l'intera durata.
    const src = this.noise(); src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1650; bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.085, t0 + 0.28);     // si sintonizza
    g.gain.setValueAtTime(0.07, t0 + 1.5);                // tiene basso
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur); // si spegne
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
    // Crepitii: micro-pop in highpass sparsi nel tempo (la radio scoppietta).
    for (let i = 0; i < 4; i++) {
      const t = t0 + 0.25 + Math.random() * (dur - 0.7);
      const cs = this.noise();
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.05 + Math.random() * 0.05, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      cs.connect(hp); hp.connect(cg); cg.connect(this.master);
      cs.start(t); cs.stop(t + 0.08);
    }
  }

  playGameOver() {
    [280, 240, 190, 140].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.2;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.42);
    });
  }

  playMissionComplete() {
    [261, 329, 392, 523, 659].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.6);
    });
  }

  /**
   * MORTE DEL BOSS — timbro-firma per tipo, sovrapposto agli scoppi (Standard AAA:
   * ogni boss "muore a modo suo"). Tutte le voci passano dal master, hanno inviluppo
   * esplicito (esponenziale → 0.001), gesto discendente/minaccia, e picco SOTTO
   * l'esplosione (0.8) che le accompagna. Spara-e-dimentica: nessun riferimento tenuto.
   */
  playBossDeath(kind: 'mega_mutant' | 'giant_worm' | 'armored_colossus' | 'radioactive_beast') {
    const t0 = this.ctx.currentTime;
    switch (kind) {
      case 'mega_mutant': {
        // Boato ORGANICO: due sawtooth gravi detunati che precipitano (più cadaveri) + "splat" lowpass (la sacca si apre).
        [108, 96].forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, t0);
          osc.frequency.exponentialRampToValueAtTime(28, t0 + 0.55);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.001, t0);
          g.gain.linearRampToValueAtTime(0.26, t0 + 0.02 + i * 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
          osc.connect(g); g.connect(this.master);
          osc.start(t0); osc.stop(t0 + 0.62);
        });
        const src = this.noise(0.3);
        const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.4, t0 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
        src.connect(flt); flt.connect(g); g.connect(this.master);
        src.start(t0 + 0.04); src.stop(t0 + 0.36);
        break;
      }
      case 'giant_worm': {
        // SFALDAMENTO: una caduta di tono che si spezza in 4 pulsazioni gravi (i segmenti) + gorgoglio bandpass.
        [150, 120, 96, 72].forEach((f, i) => {
          const t = t0 + i * 0.085;
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.14);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.3, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
          osc.connect(g); g.connect(this.master);
          osc.start(t); osc.stop(t + 0.18);
        });
        const src = this.noise(0.42);
        const flt = this.ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 300; flt.Q.value = 0.5;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
        src.connect(flt); flt.connect(g); g.connect(this.master);
        src.start(t0); src.stop(t0 + 0.44);
        break;
      }
      case 'armored_colossus': {
        // CROLLO D'ACCIAIO: tonfo grave lowpass + 4 rintocchi metallici inarmonici (sawtooth + bandpass alto Q) che decadono.
        const src = this.noise(0.5);
        const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 500;
        const lg = this.ctx.createGain();
        lg.gain.setValueAtTime(0.5, t0);
        lg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
        src.connect(flt); flt.connect(lg); lg.connect(this.master);
        src.start(t0); src.stop(t0 + 0.52);
        ([[523, 0], [785, 0.04], [1170, 0.02], [932, 0.09]] as [number, number][]).forEach(([f, dt]) => {
          const t = t0 + dt;
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = f;
          const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.16, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
          osc.connect(bp); bp.connect(g); g.connect(this.master);
          osc.start(t); osc.stop(t + 0.47);
        });
        break;
      }
      case 'radioactive_beast': {
        // FUSIONE DEL NUCLEO: scarica acuta highpass (geiger) + tono instabile (vibrato LFO) che sale e poi collassa.
        const src = this.noise(0.5);
        const flt = this.ctx.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 1600;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.001, t0);
        ng.gain.linearRampToValueAtTime(0.26, t0 + 0.12);
        ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
        src.connect(flt); flt.connect(ng); ng.connect(this.master);
        src.start(t0); src.stop(t0 + 0.52);
        const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t0);
        osc.frequency.linearRampToValueAtTime(320, t0 + 0.22);
        osc.frequency.exponentialRampToValueAtTime(50, t0 + 0.55);
        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 14;
        const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 30;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.3, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
        osc.connect(g); g.connect(this.master);
        osc.start(t0); osc.stop(t0 + 0.57);
        lfo.start(t0); lfo.stop(t0 + 0.57);
        break;
      }
    }
  }

  /** Stinger di apparizione boss: tono grave minaccioso che sale — telegrafo (AU5). Vedi §5. */
  playBossWarn() {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, t0);
    osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.62);
  }

  /** Allarme carburante basso: due bip brevi acuti, sotto l'azione (AU5). Vedi §5. */
  playLowFuel() {
    [0, 0.18].forEach((dt) => {
      const t = this.ctx.currentTime + dt;
      const osc = this.ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = 880;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.14);
    });
  }

  /** Sovraccarico attivato (A3): triade ascendente brillante + sweep d'aria — gesto power-up. Vedi §5. */
  playOverdrive() {
    const t0 = this.ctx.currentTime;
    // Triade che sale (oro): tre sine sovrapposte, ognuna piega verso l'alto.
    [392, 523, 659].forEach((f, i) => {
      const t = t0 + i * 0.05;
      const osc = this.ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.18);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.26, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.32);
    });
    // Sweep d'aria: rumore highpass che si apre (whoosh ascendente).
    const src = this.noise(0.3);
    const flt = this.ctx.createBiquadFilter(); flt.type = 'highpass';
    flt.frequency.setValueAtTime(600, t0);
    flt.frequency.exponentialRampToValueAtTime(4000, t0 + 0.28);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, t0);
    ng.gain.linearRampToValueAtTime(0.22, t0 + 0.06);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    src.connect(flt); flt.connect(ng); ng.connect(this.master);
    src.start(t0); src.stop(t0 + 0.32);
  }

  // ─── Horror (pivot survival horror) ──────────────────────────────────────────

  /** LAMENTO LONTANO: gemito grave e ondeggiante che emerge dal buio. Atmosfera, volutamente debole.
   *  Pitch randomizzato per colpo (mai due gemiti uguali). Vedi §5.15. */
  playMoan() {
    const t0 = this.ctx.currentTime;
    const f = 70 + Math.random() * 40;                 // 70..110 Hz, voce grave non-umana
    const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.linearRampToValueAtTime(f * 1.18, t0 + 0.35); // sale...
    osc.frequency.exponentialRampToValueAtTime(f * 0.8, t0 + 0.9); // ...e ricade (gemito)
    // vibrato lento = voce instabile/malata
    const vib = this.ctx.createOscillator(); vib.frequency.value = 5.5;
    const vibG = this.ctx.createGain(); vibG.gain.value = 4;
    vib.connect(vibG); vibG.connect(osc.frequency);
    // formante: bandpass medio per dare "bocca" alla voce
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.12, t0 + 0.18);   // attacco morbido (lontano)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.95);
    osc.connect(bp); bp.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 1.0);
    vib.start(t0); vib.stop(t0 + 1.0);
  }

  /** BATTITO CARDIACO: "lub-dub" grave a salute bassa. GameScene lo richiama a cadenza che si stringe
   *  col calo di salute. Spara-e-dimentica (la cadenza è in GameScene). Vedi §5.16. */
  playHeartbeat() {
    const t0 = this.ctx.currentTime;
    [[0, 0.22], [0.17, 0.15]].forEach(([dt, peak]) => {     // lub (forte) → dub (più debole)
      const t = t0 + dt!;
      const osc = this.ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(62, t);
      osc.frequency.exponentialRampToValueAtTime(34, t + 0.12);   // tonfo che affonda
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(peak!, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.18);
    });
  }

  /** STINGER D'ONDATA (dread→burst): "sta arrivando". Tonfo grave + grappolo dissonante che monta e taglia.
   *  Gesto ascendente ammesso (tensione, come playBossWarn), picco SOTTO l'esplosione (0.8). Vedi §5.17. */
  playWaveStinger() {
    const t0 = this.ctx.currentTime;
    // Tonfo sub: rumore lowpass grave (la massa che si muove nel buio).
    const src = this.noise(0.4);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(0.001, t0);
    lg.gain.linearRampToValueAtTime(0.32, t0 + 0.05);
    lg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    src.connect(lp); lp.connect(lg); lg.connect(this.master);
    src.start(t0); src.stop(t0 + 0.42);
    // Grappolo dissonante (seconda minore: 660 + 700 Hz) che sale = allarme che monta.
    [660, 700].forEach((f) => {
      const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 0.8, t0);
      osc.frequency.linearRampToValueAtTime(f, t0 + 0.28);
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.13, t0 + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.36);
      osc.connect(bp); bp.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + 0.38);
    });
  }

  /** SCATTO A VUOTO: click meccanico secco quando un'arma finisce le munizioni (→ fallback alla MG). Vedi §5.18. */
  playDryFire() {
    const t0 = this.ctx.currentTime;
    // soffio del percussore a vuoto (rumore acuto cortissimo)
    const src = this.noise(0.04);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
    src.connect(hp); hp.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + 0.05);
    // tick metallico del cane a vuoto
    const osc = this.ctx.createOscillator(); osc.type = 'square';
    osc.frequency.value = 220;
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.001, t0);
    og.gain.linearRampToValueAtTime(0.1, t0 + 0.003);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
    osc.connect(og); og.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.035);
  }

  // ─── Engine loop ─────────────────────────────────────────────────────────────

  startEngine() {
    if (this.engineOsc) return;
    this.resumeIfSuspended();
    const t = this.ctx.currentTime;

    // ── Bus TONALE: due sawtooth gravi leggermente detunati = "blocco motore" che ringhia.
    //    Il battimento tra i due (≈1 Hz) dà la lopezza organica di un motore reale, al posto
    //    del vecchio vibrato di frequenza che suonava come un drone/UFO.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 46;           // fondamentale (idle); sale col carico
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 46 * 1.012;  // gemello detunato → battimento = crescita viva
    const oscMix = this.ctx.createGain();
    oscMix.gain.value = 0.5;
    this.engineOsc.connect(oscMix);
    this.engineOsc2.connect(oscMix);

    // Lowpass risonante che APRE col carico: idle = cupo/ovattato, pieno regime = ringhio brillante.
    this.engineLowpass = this.ctx.createBiquadFilter();
    this.engineLowpass.type = 'lowpass';
    this.engineLowpass.frequency.value = 240;
    this.engineLowpass.Q.value = 1.2;
    oscMix.connect(this.engineLowpass);

    // ── Bus RUMORE: grana meccanica (aria/valvole) via bandpass medio-grave, debolissima.
    this.engineNoise = this.noise(2);
    this.engineNoise.loop = true;
    const noiseBp = this.ctx.createBiquadFilter();
    noiseBp.type = 'bandpass';
    noiseBp.frequency.value = 320;
    noiseBp.Q.value = 0.7;
    const noiseMix = this.ctx.createGain();
    noiseMix.gain.value = 0.12;
    this.engineNoise.connect(noiseBp);
    noiseBp.connect(noiseMix);

    // ── CHUG: tremolo d'AMPIEZZA alla cadenza di scoppio. È questo (non un vibrato di
    //    frequenza) che fa il "putt-putt" di un motore a scoppio invece di un ronzio piatto.
    const trem = this.ctx.createGain();
    trem.gain.value = 0.8;                          // livello a riposo del tremolo
    this.engineLfo = this.ctx.createOscillator();
    this.engineLfo.type = 'sine';
    this.engineLfo.frequency.value = 9;            // cadenza di scoppio (idle); accelera col carico
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.2;                       // profondità del chug (gain oscilla 0.6..1.0)
    this.engineLfo.connect(lfoGain);
    lfoGain.connect(trem.gain);
    this.engineLowpass.connect(trem);
    noiseMix.connect(trem);

    // ── Livello motore (bordone, volutamente bassissimo: battito del mondo, non protagonista).
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.055;
    trem.connect(this.engineGain);
    this.engineGain.connect(this.master);

    this.engineOsc.start(t);
    this.engineOsc2.start(t);
    this.engineLfo.start(t);
    this.engineNoise.start(t);
  }

  // factor 0..1: 0 = spento/danneggiato, 1 = pieno regime
  setEngineLoad(factor: number) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = 46 + factor * 40;               // fondamentale 46..86 Hz
    this.engineOsc.frequency.setTargetAtTime(target, t, 0.08);
    this.engineOsc2?.frequency.setTargetAtTime(target * 1.012, t, 0.08);
    // il chug accelera col regime: putt-putt lento e faticoso quando è carico/danneggiato,
    // rombo serrato a pieno regime.
    this.engineLfo?.frequency.setTargetAtTime(9 + factor * 16, t, 0.12);
    // il filtro apre col carico → più armoniche, ringhio più aggressivo a pieno regime.
    this.engineLowpass?.frequency.setTargetAtTime(240 + factor * 760, t, 0.1);
  }

  stopEngine() {
    if (!this.engineGain || !this.engineOsc) return;
    const stopAt = this.ctx.currentTime + 1.2;
    this.engineGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.3);
    // Scollega la vecchia catena motore quando gli oscillatori finiscono: a pause/riprese ripetute
    // evita di accumulare nodi orfani sul master (AU2, parte di leak).
    const oldGain = this.engineGain;
    this.engineOsc.onended = () => { try { oldGain.disconnect(); } catch { /* già scollegato */ } };
    this.engineOsc.stop(stopAt);
    this.engineOsc2?.stop(stopAt);
    this.engineLfo?.stop(stopAt);
    this.engineNoise?.stop(stopAt);
    this.engineOsc     = undefined;
    this.engineOsc2    = undefined;
    this.engineGain    = undefined;
    this.engineLfo     = undefined;
    this.engineNoise   = undefined;
    this.engineLowpass = undefined;
  }

  // ─── Drone d'angoscia (seconda voce persistente, pivot horror) ────────────────

  /**
   * Avvia il bordone d'angoscia: due sine gravi leggermente discordi (battimento lento ≈ "respiro"
   * del buio) sotto un lowpass cupo, con un LFO d'ampiezza lentissimo (0.12 Hz) che lo fa gonfiare e
   * ritirare. Volutamente SOTTO il motore (0.055): è atmosfera, non protagonista. Cresce con `setDread`.
   * Idempotente come `startEngine()`.
   */
  startAmbience() {
    if (this.droneOsc) return;
    this.resumeIfSuspended();
    const t = this.ctx.currentTime;

    // Due sine gravi quasi all'unisono → battimento lento e malato (≈2.5 Hz), non un drone "pulito".
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.value = 41;
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.value = 41 * 1.06;     // ~2.5 Hz di battimento
    const mix = this.ctx.createGain(); mix.gain.value = 0.5;
    this.droneOsc.connect(mix); this.droneOsc2.connect(mix);

    // Lowpass cupo: apre un filo con la tensione (setDread) → "edge" che emerge dal nero.
    this.droneLowpass = this.ctx.createBiquadFilter();
    this.droneLowpass.type = 'lowpass';
    this.droneLowpass.frequency.value = 200;
    this.droneLowpass.Q.value = 0.7;
    mix.connect(this.droneLowpass);

    // Respiro: tremolo d'ampiezza lentissimo.
    const trem = this.ctx.createGain(); trem.gain.value = 0.75;
    this.droneLfo = this.ctx.createOscillator();
    this.droneLfo.type = 'sine';
    this.droneLfo.frequency.value = 0.12;           // un gonfiore ogni ~8 s
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.25;
    this.droneLfo.connect(lfoGain); lfoGain.connect(trem.gain);
    this.droneLowpass.connect(trem);

    // Livello del drone: idle bassissimo (quiete tesa); sale con la tensione.
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.03;
    trem.connect(this.droneGain);
    this.droneGain.connect(this.master);

    this.droneOsc.start(t);
    this.droneOsc2.start(t);
    this.droneLfo.start(t);
  }

  /** factor 0..1: tensione (vicinanza boss / salute bassa / ondata in arrivo). Alza livello e apre il filtro. */
  setDread(factor: number) {
    if (!this.droneGain) return;
    const f = factor < 0 ? 0 : factor > 1 ? 1 : factor;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(0.03 + f * 0.06, t, 0.5);          // 0.03..0.09
    this.droneLowpass?.frequency.setTargetAtTime(200 + f * 420, t, 0.5);   // 200..620 Hz
    this.droneOsc2?.frequency.setTargetAtTime(41 * (1.06 + f * 0.02), t, 0.5); // più dissonante sotto tensione
  }

  stopAmbience() {
    if (!this.droneGain || !this.droneOsc) return;
    const stopAt = this.ctx.currentTime + 1.0;
    this.droneGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.3);
    const oldGain = this.droneGain;
    this.droneOsc.onended = () => { try { oldGain.disconnect(); } catch { /* già scollegato */ } };
    this.droneOsc.stop(stopAt);
    this.droneOsc2?.stop(stopAt);
    this.droneLfo?.stop(stopAt);
    this.droneOsc     = undefined;
    this.droneOsc2    = undefined;
    this.droneGain    = undefined;
    this.droneLfo     = undefined;
    this.droneLowpass = undefined;
  }

  /**
   * Smonta il manager: ferma il motore e **scollega master+limiter** da `destination`. Da chiamare allo
   * SHUTDOWN della scena: senza, ogni restart di GameScene (e ogni anteprima di SettingsScene) lascerebbe
   * una catena master+limiter appesa al context condiviso di Phaser (AU7).
   * (NB: definito DOPO stopEngine così `validate-audio` slicia il metodo giusto — la sua regex cerca la
   * prima occorrenza di 'stopEngine()' nel file.)
   */
  dispose() {
    this.stopEngine();
    this.stopAmbience();
    try { this.shotWet.disconnect(); } catch { /* già scollegato */ }
    try { this.shotVerb.disconnect(); } catch { /* già scollegato */ }
    try { this.master.disconnect(); } catch { /* già scollegato */ }
    try { this.limiter.disconnect(); } catch { /* già scollegato */ }
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  private noise(_duration?: number): AudioBufferSourceNode {
    // Riusa il buffer condiviso (AU4): nessuna allocazione/riempimento per chiamata. Il chiamante
    // gestisce start()/stop() per la durata effettiva; per il loop motore imposta `.loop = true`.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    return src;
  }
}
