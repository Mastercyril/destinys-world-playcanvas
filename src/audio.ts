/** WebAudio-only bed: rain, drone, footsteps, melee, fragment chime. No sample files. */
export class GameAudio {
  chimes = 0;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private threatGain: GainNode | null = null;
  private started = false;

  start(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + white) * 0.5;
      data[i] = last;
    }
    this.noise = buffer;

    const rain = ctx.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1400;
    rainFilter.Q.value = 0.6;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.18;
    rain.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.master);
    rain.start();

    const droneA = ctx.createOscillator();
    droneA.type = 'sine';
    droneA.frequency.value = 55;
    const droneB = ctx.createOscillator();
    droneB.type = 'triangle';
    droneB.frequency.value = 82.4;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.045;
    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneGain.connect(this.master);
    droneA.start();
    droneB.start();

    this.threatGain = ctx.createGain();
    this.threatGain.gain.value = 0;
    const threat = ctx.createOscillator();
    threat.type = 'sawtooth';
    threat.frequency.value = 46;
    const threatFilter = ctx.createBiquadFilter();
    threatFilter.type = 'lowpass';
    threatFilter.frequency.value = 180;
    threat.connect(threatFilter);
    threatFilter.connect(this.threatGain);
    this.threatGain.connect(this.master);
    threat.start();

    this.started = true;
    void ctx.resume();
  }

  setThreat(amount: number): void {
    if (!this.threatGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.threatGain.gain.cancelScheduledValues(now);
    this.threatGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, amount)) * 0.05, now + 0.2);
  }

  footstep(): void {
    this.blip(180, 0.045, 'lowpass', 0.16, 90 + Math.random() * 40);
  }

  whoosh(): void {
    this.blip(900, 0.09, 'bandpass', 0.12, 0);
  }

  hit(): void {
    this.tone(140, 0.12, 'square', 0.2);
    this.blip(300, 0.08, 'lowpass', 0.22, 0);
  }

  hurt(): void {
    this.tone(90, 0.18, 'sawtooth', 0.18);
  }

  chime(): void {
    this.chimes += 1;
    this.tone(880, 0.18, 'sine', 0.1);
    this.tone(1320, 0.22, 'sine', 0.07);
    this.tone(1760, 0.28, 'sine', 0.05);
  }

  paper(): void {
    this.blip(2200, 0.05, 'highpass', 0.06, 0);
  }

  attack(): void {
    this.tone(70, 0.2, 'sawtooth', 0.16);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private blip(freq: number, dur: number, type: BiquadFilterType, gain: number, oscFreq: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    if (oscFreq > 0) {
      const osc = ctx.createOscillator();
      osc.frequency.value = oscFreq;
      osc.type = 'sine';
      const og = ctx.createGain();
      og.gain.setValueAtTime(gain * 0.6, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(og);
      og.connect(this.master);
      osc.start(now);
      osc.stop(now + dur);
    }
    src.start(now);
    src.stop(now + dur);
  }
}
