// ============================================================================
// THE SEAL OF BOMBAY — procedural WebAudio (no audio files)
// stamp thud = filtered noise burst + low thump; typewriter tick; mute toggle
// ============================================================================

const MUTE_KEY = 'seal-of-bombay-muted';

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  muted = false;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (m) stopRain(); // a running ambient must die with the toggle
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Stamp slam: short filtered noise burst with a low sine thump underneath. */
export function playThud(): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;

  // noise burst
  const dur = 0.22;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(180, t + dur);
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.5, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(lp).connect(noiseGain).connect(c.destination);
  noise.start(t);

  // low thump
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.35, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(oscGain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

/** Typewriter tick: very short high blip. `volume` scales the blip down
    for quieter uses (the shift-clock hand). */
export function playTick(volume = 1): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1600 + Math.random() * 500, t);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.025 * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.035);
}

// ---------------------------------------------------------------------------
// Ambient loops & one-shots
// ---------------------------------------------------------------------------

interface RainNodes {
  src: AudioBufferSourceNode;
  lfo: OscillatorNode;
  gain: GainNode;
}

let rain: RainNodes | null = null;

/**
 * Monsoon ambient: looping brown noise through a lowpass, with a slow LFO
 * breathing on the gain. Low volume — weather, not a soundtrack. Idempotent;
 * call startRain() as often as the phase changes. No-op while muted.
 */
export function startRain(): void {
  if (rain) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;

  // 3s brown-noise loop
  const len = Math.floor(c.sampleRate * 3);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 750;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.055, t + 1.2);

  // slow swell, like gusts against the shutter
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.13;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain).connect(gain.gain);

  src.connect(lp).connect(gain).connect(c.destination);
  src.start(t);
  lfo.start(t);
  rain = { src, lfo, gain };
}

/** Fade the monsoon out and release its nodes. Safe to call when not raining. */
export function stopRain(): void {
  const r = rain;
  rain = null;
  if (!r || !ctx) return;
  const t = ctx.currentTime;
  try {
    r.gain.gain.cancelScheduledValues(t);
    r.gain.gain.setValueAtTime(Math.max(0.0001, r.gain.gain.value), t);
    r.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    r.src.stop(t + 0.6);
    r.lfo.stop(t + 0.6);
  } catch {
    /* already stopped */
  }
}

/**
 * One distant explosion rumble: a low sine dropping 60→30Hz under a
 * decaying noise burst, about 2.5s. Fired once as the blast day opens.
 */
export function playBlast(): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const dur = 2.5;

  // the rumble — felt more than heard
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + dur);
  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.0001, t);
  oscGain.gain.exponentialRampToValueAtTime(0.4, t + 0.08);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(oscGain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.1);

  // the far-off crack, low-passed into a roll
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.6);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(220, t);
  lp.frequency.exponentialRampToValueAtTime(55, t + dur);
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.28, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(lp).connect(noiseGain).connect(c.destination);
  noise.start(t);
}

/** Soft paper shuffle for advancing beats. */
export function playPaper(): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const dur = 0.12;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp).connect(gain).connect(c.destination);
  src.start(t);
}
