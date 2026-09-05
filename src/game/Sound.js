export class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;
    this.wind = null;
  }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain();
        this.master.gain.value = 0.24;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume();
    } catch {
      this.enabled = false;
    }
  }

  tone(frequency, duration, { type = 'sine', volume = 0.12, endFrequency = null } = {}) {
    if (!this.context || !this.master || !this.enabled) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(.035, duration * .2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + .03);
  }

  noise(duration = .1, volume = .05, cutoff = 1100) {
    if (!this.context || !this.master || !this.enabled) return;
    const buffer = this.context.createBuffer(1, Math.max(1, this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  jump() { this.tone(310, .12, { type: 'triangle', volume: .12, endFrequency: 640 }); }
  glide() { this.tone(270, .19, { type: 'sine', volume: .06, endFrequency: 420 }); }
  collect() {
    this.tone(523, .12, { type: 'sine', volume: .12, endFrequency: 730 });
    window.setTimeout(() => this.tone(784, .19, { type: 'sine', volume: .11, endFrequency: 1050 }), 75);
  }
  fruit() { this.tone(430, .09, { type: 'triangle', volume: .08, endFrequency: 600 }); }
  dash() { this.noise(.09, .08, 1500); this.tone(140, .17, { type: 'sawtooth', volume: .07, endFrequency: 70 }); }
  hit() { this.noise(.14, .12, 650); this.tone(130, .22, { type: 'square', volume: .06, endFrequency: 76 }); }
  enemyDown() { this.tone(190, .12, { type: 'square', volume: .07, endFrequency: 105 }); this.tone(520, .16, { type: 'triangle', volume: .08, endFrequency: 300 }); }
  bossHit() { this.tone(100, .18, { type: 'sawtooth', volume: .12, endFrequency: 45 }); }
  victory() {
    [392, 494, 587, 784].forEach((note, index) => window.setTimeout(() => this.tone(note, .42, { type: 'sine', volume: .12, endFrequency: note * 1.01 }), index * 120));
  }
}
