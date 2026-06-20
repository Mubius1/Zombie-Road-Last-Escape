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

  playShot() {
    const dur = 0.07;
    const src = this.noise(dur);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = 2500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(); src.stop(this.ctx.currentTime + dur);
  }

  playZombieKill() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    osc.connect(g); g.connect(this.master);
    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
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

  /**
   * Smonta il manager: ferma il motore e **scollega master+limiter** da `destination`. Da chiamare allo
   * SHUTDOWN della scena: senza, ogni restart di GameScene (e ogni anteprima di SettingsScene) lascerebbe
   * una catena master+limiter appesa al context condiviso di Phaser (AU7).
   * (NB: definito DOPO stopEngine così `validate-audio` slicia il metodo giusto — la sua regex cerca la
   * prima occorrenza di 'stopEngine()' nel file.)
   */
  dispose() {
    this.stopEngine();
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
