/**
 * audio.play(id, { volume, loop, rate })  plays a sound, and audio.stop(id) stops a loop.
 * audio.setAir(0..1)  thins engine and world sound as the air thins (1 at sea level, 0 in vacuum). UI sounds ignore it.
 * audio.register(id, url)  swaps a synthesised placeholder for a real file, with nobody else's code changing.
 *
 * Browsers only allow sound after a click or key press. Loops requested earlier start at that moment; one-shots are dropped.
 */

function noiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function tone(ctx, out, { frequency = 880, type = 'sine', time = 0, length = 0.1, volume = 0.2, slide }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t = ctx.currentTime + time;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + length + 0.02);
  return t + length + 0.02;
}

function noiseLoop(ctx, out, { type = 'lowpass', frequency = 400, q = 0.7, volume = 0.3, wobble = 0, wobbleRate = 0.3 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(out);
  src.start();
  const parts = [src];
  if (wobble) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = wobbleRate;
    depth.gain.value = wobble;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();
    parts.push(lfo);
  }
  return { nodes: parts, gain };
}

// Placeholder sounds, so every id works from the first hour. `bus` is 'ui' or 'world'.
const SYNTHS = {
  'ui.hover': { bus: 'ui', play: (c, o) => tone(c, o, { frequency: 1500, length: 0.035, volume: 0.035 }) },
  'ui.click': { bus: 'ui', play: (c, o) => tone(c, o, { frequency: 900, type: 'square', length: 0.05, volume: 0.05 }) },
  'ui.snap': { bus: 'ui', play: (c, o) => { tone(c, o, { frequency: 240, type: 'triangle', length: 0.08, volume: 0.3, slide: 90 }); tone(c, o, { frequency: 1800, type: 'square', length: 0.018, volume: 0.05 }); } },
  'ui.error': { bus: 'ui', play: (c, o) => { tone(c, o, { frequency: 220, type: 'sawtooth', length: 0.13, volume: 0.09 }); tone(c, o, { frequency: 165, type: 'sawtooth', length: 0.18, time: 0.13, volume: 0.09 }); } },
  'gonogo.tick': { bus: 'ui', play: (c, o) => tone(c, o, { frequency: 1200, length: 0.09, volume: 0.1 }) },
  'alarm.master': { bus: 'ui', play: (c, o) => { for (let i = 0; i < 4; i++) tone(c, o, { frequency: i % 2 ? 660 : 880, type: 'square', length: 0.16, time: i * 0.18, volume: 0.08 }); } },
  'alarm.o2': { bus: 'ui', play: (c, o) => { tone(c, o, { frequency: 980, length: 0.12, volume: 0.13 }); tone(c, o, { frequency: 980, length: 0.12, time: 0.22, volume: 0.13 }); } },
  'radio.blip': { bus: 'ui', play: (c, o) => { tone(c, o, { frequency: 1400, length: 0.06, volume: 0.06 }); tone(c, o, { frequency: 1000, length: 0.06, time: 0.07, volume: 0.06 }); } },
  'impact.small': { bus: 'world', play: (c, o) => tone(c, o, { frequency: 150, type: 'triangle', length: 0.3, volume: 0.5, slide: 40 }) },
  'engine.rumble': { bus: 'world', loop: (c, o) => noiseLoop(c, o, { frequency: 150, volume: 0.9, wobble: 0.14, wobbleRate: 7 }) },
  'ambience.ship': { bus: 'ui', loop: (c, o) => noiseLoop(c, o, { frequency: 240, volume: 0.09, wobble: 0.015, wobbleRate: 0.2 }) },
  'ambience.mars': { bus: 'ui', loop: (c, o) => noiseLoop(c, o, { type: 'bandpass', frequency: 420, q: 0.5, volume: 0.05, wobble: 0.025, wobbleRate: 0.13 }) },
  'suit.breath': { bus: 'ui', loop: (c, o) => noiseLoop(c, o, { type: 'bandpass', frequency: 1300, q: 0.8, volume: 0.05, wobble: 0.05, wobbleRate: 0.28 }) },
  'radio.static': { bus: 'ui', loop: (c, o) => noiseLoop(c, o, { type: 'highpass', frequency: 2600, volume: 0.016 }) },
};

class AudioManager {
  #ctx = null;
  #buses = {};
  #air = null;
  #loops = new Map();
  #queuedLoops = new Map();
  #files = new Map();
  #warned = new Set();
  #unlockBound = false;
  #volume = 1;

  constructor() {
    if (typeof window !== 'undefined') this.#bindUnlock();
  }

  #bindUnlock() {
    if (this.#unlockBound) return;
    this.#unlockBound = true;
    const unlock = () => {
      this.#start();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  #start() {
    if (this.#ctx) return;
    const ctx = new AudioContext();
    this.#ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.#volume;
    master.connect(ctx.destination);
    const ui = ctx.createGain();
    const world = ctx.createGain();
    this.#air = ctx.createBiquadFilter();
    this.#air.type = 'lowpass';
    this.#air.frequency.value = 18000;
    ui.connect(master);
    world.connect(this.#air).connect(master);
    this.#buses = { ui, world, master };
    this.#queuedLoops.forEach((options, id) => this.play(id, options));
    this.#queuedLoops.clear();
  }

  get unlocked() {
    return this.#ctx !== null;
  }

  register(id, url, { bus = 'ui', loop = false } = {}) {
    this.#files.set(id, { url, bus, loop, buffer: null });
  }

  play(id, options = {}) {
    const { volume = 1, loop, rate = 1 } = options;
    const synth = SYNTHS[id];
    const file = this.#files.get(id);
    if (!synth && !file) {
      if (!this.#warned.has(id)) {
        this.#warned.add(id);
        console.warn(`[audio] no sound for "${id}" yet`);
      }
      return;
    }
    const looping = loop ?? (file ? file.loop : Boolean(synth.loop));
    if (!this.#ctx) {
      if (looping) this.#queuedLoops.set(id, options);
      return;
    }
    if (this.#ctx.state === 'suspended') this.#ctx.resume();
    const bus = this.#buses[file?.bus ?? synth.bus];
    if (looping && this.#loops.has(id)) return;
    const out = this.#ctx.createGain();
    out.gain.value = volume;
    out.connect(bus);
    if (file) {
      this.#playFile(id, file, out, looping, rate);
    } else if (synth.loop) {
      this.#loops.set(id, { ...synth.loop(this.#ctx, out), out });
    } else {
      synth.play(this.#ctx, out);
    }
  }

  async #playFile(id, file, out, looping, rate) {
    file.buffer ??= await fetch(file.url).then((r) => r.arrayBuffer()).then((b) => this.#ctx.decodeAudioData(b));
    const src = this.#ctx.createBufferSource();
    src.buffer = file.buffer;
    src.loop = looping;
    src.playbackRate.value = rate;
    src.connect(out);
    src.start();
    if (looping) this.#loops.set(id, { nodes: [src], out });
  }

  stop(id, { fade = 0.4 } = {}) {
    this.#queuedLoops.delete(id);
    const loop = this.#loops.get(id);
    if (!loop) return;
    this.#loops.delete(id);
    const now = this.#ctx.currentTime;
    loop.out.gain.setTargetAtTime(0, now, Math.max(fade / 3, 0.001));
    loop.nodes.forEach((node) => node.stop(now + fade + 0.05));
  }

  stopAll(options) {
    [...this.#loops.keys(), ...this.#queuedLoops.keys()].forEach((id) => this.stop(id, options));
  }

  /** Air density from 0 (vacuum) to 1 (sea level). */
  setAir(density) {
    if (!this.#ctx) return;
    const d = Math.min(1, Math.max(0, density));
    const now = this.#ctx.currentTime;
    this.#air.frequency.setTargetAtTime(90 + Math.pow(d, 0.5) * 17000, now, 0.1);
    this.#buses.world.gain.setTargetAtTime(0.14 + 0.86 * Math.pow(d, 0.4), now, 0.1); // hull rumble remains in vacuum
  }

  setVolume(volume) {
    this.#volume = volume;
    if (this.#ctx) this.#buses.master.gain.setTargetAtTime(volume, this.#ctx.currentTime, 0.02);
  }

  ids() {
    return [...Object.keys(SYNTHS), ...this.#files.keys()];
  }
}

export const audio = new AudioManager();
