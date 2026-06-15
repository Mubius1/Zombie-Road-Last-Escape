export default class SoundManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(ctx.destination);
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
        src.connect(flt);
        flt.connect(g);
        g.connect(this.master);
        src.start();
        src.stop(this.ctx.currentTime + dur);
    }
    playZombieKill() {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.18);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.32, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
        osc.connect(g);
        g.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }
    playZombieAttach() {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.22);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.28, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        osc.connect(g);
        g.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.28);
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
            osc.connect(g);
            g.connect(this.master);
            osc.start(t);
            osc.stop(t + 0.32);
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
        src.connect(flt);
        flt.connect(g);
        g.connect(this.master);
        src.start();
        src.stop(this.ctx.currentTime + dur + 0.05);
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
        src.connect(flt);
        flt.connect(g);
        g.connect(this.master);
        src.start();
        src.stop(this.ctx.currentTime + dur + 0.05);
    }
    playToxicSizzle() {
        const src = this.noise(0.2);
        const flt = this.ctx.createBiquadFilter();
        flt.type = 'highpass';
        flt.frequency.value = 1400;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.18, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        src.connect(flt);
        flt.connect(g);
        g.connect(this.master);
        src.start();
        src.stop(this.ctx.currentTime + 0.22);
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
            osc.connect(g);
            g.connect(this.master);
            osc.start(t);
            osc.stop(t + 0.42);
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
            osc.connect(g);
            g.connect(this.master);
            osc.start(t);
            osc.stop(t + 0.6);
        });
    }
    // ─── Engine loop ─────────────────────────────────────────────────────────────
    startEngine() {
        if (this.engineOsc)
            return;
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 52;
        this.engineLfo = this.ctx.createOscillator();
        this.engineLfo.frequency.value = 7;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 3;
        this.engineLfo.connect(lfoGain);
        lfoGain.connect(this.engineOsc.frequency);
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.055;
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        this.engineLfo.start();
    }
    // factor 0..1: 0 = spento/danneggiato, 1 = pieno regime
    setEngineLoad(factor) {
        if (!this.engineOsc)
            return;
        const target = 42 + factor * 36;
        this.engineOsc.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
    stopEngine() {
        if (!this.engineGain || !this.engineOsc)
            return;
        this.engineGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.3);
        this.engineOsc.stop(this.ctx.currentTime + 1.2);
        this.engineLfo?.stop(this.ctx.currentTime + 1.2);
        this.engineOsc = undefined;
        this.engineGain = undefined;
        this.engineLfo = undefined;
    }
    // ─── Utility ─────────────────────────────────────────────────────────────────
    noise(duration) {
        const sr = this.ctx.sampleRate;
        const size = Math.ceil(sr * duration);
        const buf = this.ctx.createBuffer(1, size, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < size; i++)
            data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        return src;
    }
}
//# sourceMappingURL=SoundManager.js.map