// Web Audio API sound engine - all generated, no external files

class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  // BGM state
  private bgmNodes: { stop: () => void } | null = null;
  private bgmGain: GainNode | null = null;

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(v: boolean) { this.enabled = v; if (!v) this.stopBgm(); }
  isEnabled() { return this.enabled; }

  /** Punch hitting a leather mitt — slap + thud + crack */
  punch() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;

    // 1. Low body thud (deep impact)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(120, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(35, t + 0.15);
    bodyGain.gain.setValueAtTime(0.7, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    bodyOsc.connect(bodyGain).connect(ctx.destination);
    bodyOsc.start(t); bodyOsc.stop(t + 0.22);

    // 2. Mid leather slap (the SLAP sound on mitt)
    const slapOsc = ctx.createOscillator();
    const slapGain = ctx.createGain();
    slapOsc.type = 'triangle';
    slapOsc.frequency.setValueAtTime(380, t);
    slapOsc.frequency.exponentialRampToValueAtTime(180, t + 0.06);
    slapGain.gain.setValueAtTime(0.4, t);
    slapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    slapOsc.connect(slapGain).connect(ctx.destination);
    slapOsc.start(t); slapOsc.stop(t + 0.1);

    // 3. High-frequency leather crack/snap (filtered noise)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, 2.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.value = 0.5;
    noise.connect(bp).connect(ng).connect(ctx.destination);
    noise.start(t);
  }

  /** Perfect hit — punch + bright sparkle (alias also as `perfect`) */
  perfect() { this.perfectHit(); }
  perfectHit() {
    if (!this.enabled) return;
    this.punch();
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    [1568, 2093].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = t + 0.02 + i * 0.04;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(g).connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.27);
    });
  }

  /** Miss buzzer */
  miss() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(80, t + 0.3);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.35);
  }

  /** Boxing bell — round start/end */
  bell() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    [880, 1320, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3 / (i + 1), t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + 1.6);
    });
  }

  /** Countdown beep */
  beep(high = false) {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = high ? 880 : 440;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.16);
  }

  /** Combo milestone — crowd cheer */
  cheer() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.sin((i / data.length) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.6;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.value = 0.4;
    noise.connect(filter).connect(ng).connect(ctx.destination);
    noise.start(t);

    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = t + i * 0.08;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.25, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(g).connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.42);
    });
  }

  /** Rank up fanfare */
  fanfare() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = t + i * 0.12;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(g).connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.42);
    });
  }

  /** Looping background music — tense boxing gym groove */
  startBgm(intensity: 1 | 2 | 3 = 1) {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx) return;
    this.stopBgm();

    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    this.bgmGain = master;

    // Tempo by intensity
    const bpm = intensity === 1 ? 110 : intensity === 2 ? 130 : 150;
    const beatDur = 60 / bpm;
    const stepDur = beatDur / 2; // 8th notes

    // Bass riff (A minor pentatonic boxing groove): A2, A2, E3, A2, G2, A2, C3, E3
    const bassNotes = [110, 110, 164.81, 110, 98, 110, 130.81, 164.81];
    // Lead stabs every 4 beats
    const leadNotes = [220, 261.63, 329.63, 261.63];

    let step = 0;
    let stopped = false;

    const scheduleAhead = 0.3; // sec
    let nextNoteTime = ctx.currentTime + 0.05;

    const playBass = (freq: number, time: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      lp.Q.value = 4;
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.35, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 0.9);
      osc.connect(lp).connect(g).connect(master);
      osc.start(time); osc.stop(time + stepDur);
    };

    const playKick = (time: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      g.gain.setValueAtTime(0.6, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      osc.connect(g).connect(master);
      osc.start(time); osc.stop(time + 0.2);
    };

    const playHat = (time: number, accent = false) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.value = accent ? 0.18 : 0.1;
      src.connect(hp).connect(g).connect(master);
      src.start(time);
    };

    const playLead = (freq: number, time: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.08, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, time + beatDur * 0.8);
      osc.connect(g).connect(master);
      osc.start(time); osc.stop(time + beatDur);
    };

    const tick = () => {
      if (stopped) return;
      const ctxNow = ctx.currentTime;
      while (nextNoteTime < ctxNow + scheduleAhead) {
        const beatIndex = step % 8;
        // Bass on every 8th
        playBass(bassNotes[beatIndex], nextNoteTime);
        // Kick on beats 1 & 3 (steps 0,4)
        if (beatIndex === 0 || beatIndex === 4) playKick(nextNoteTime);
        // Hat every 8th, accent on beat
        playHat(nextNoteTime, beatIndex % 2 === 0);
        // Lead stab every 4 beats (every 8 steps)
        if (beatIndex === 0 && (step / 8) % 2 === 1) {
          playLead(leadNotes[((step / 8) | 0) % leadNotes.length], nextNoteTime);
        }
        nextNoteTime += stepDur;
        step++;
      }
      this.bgmNodes = { stop: () => { stopped = true; } };
      setTimeout(tick, 80);
    };
    this.bgmNodes = { stop: () => { stopped = true; } };
    tick();
  }

  setBgmIntensity(intensity: 1 | 2 | 3) {
    if (!this.bgmNodes) return;
    this.startBgm(intensity);
  }

  stopBgm() {
    if (this.bgmNodes) { this.bgmNodes.stop(); this.bgmNodes = null; }
    if (this.bgmGain) {
      try {
        const ctx = this.ctx!;
        this.bgmGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        const g = this.bgmGain;
        setTimeout(() => g.disconnect(), 400);
      } catch {}
      this.bgmGain = null;
    }
  }
}

export const audio = new AudioEngine();

let vibrationEnabled = true;
export function setVibrationEnabled(v: boolean) { vibrationEnabled = v; }
export function isVibrationEnabled() { return vibrationEnabled; }

export function vibrate(pattern: number | number[]) {
  if (!vibrationEnabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch {}
  }
}
