/**
 * Tiny Web Audio sound-design engine — no audio files, everything is synthesized
 * from oscillators so there are no assets to ship. Sound is OFF until the user
 * enables it (browsers block autoplay; the toggle click is the required gesture).
 */

type Sub = (enabled: boolean) => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
let ambient: { stop: () => void } | null = null;
const subs = new Set<Sub>();

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  {
    type = "sine",
    vol = 0.2,
    glideTo,
    delay = 0,
    attack = 0.005,
    filter,
  }: {
    type?: OscillatorType;
    vol?: number;
    glideTo?: number;
    delay?: number;
    attack?: number;
    filter?: number;
  } = {}
) {
  if (!enabled) return;
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);

  let node: AudioNode = osc;
  if (filter) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = filter;
    osc.connect(lp);
    node = lp;
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  node.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function startAmbient() {
  const c = ensure();
  if (!c || !master || ambient) return;
  const g = c.createGain();
  g.gain.value = 0.0;
  g.gain.linearRampToValueAtTime(0.06, c.currentTime + 2);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 500;
  const a = c.createOscillator();
  a.type = "sine";
  a.frequency.value = 55;
  const b = c.createOscillator();
  b.type = "sine";
  b.frequency.value = 82.5; // a fifth, slightly detuned drone
  b.detune.value = 6;
  // slow filter LFO for movement
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 220;
  lfo.connect(lfoGain);
  lfoGain.connect(lp.frequency);
  a.connect(lp);
  b.connect(lp);
  lp.connect(g);
  g.connect(master);
  a.start();
  b.start();
  lfo.start();
  ambient = {
    stop: () => {
      g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.6);
      setTimeout(() => {
        a.stop();
        b.stop();
        lfo.stop();
      }, 700);
      ambient = null;
    },
  };
}

export const sfx = {
  hover() {
    tone(880, 0.08, { type: "sine", vol: 0.04 });
  },
  click() {
    tone(523.25, 0.09, { type: "triangle", vol: 0.14 });
    tone(784, 0.12, { type: "sine", vol: 0.1, delay: 0.04 });
  },
  whoosh() {
    tone(180, 0.5, { type: "sawtooth", vol: 0.14, glideTo: 1300, filter: 1400 });
    tone(90, 0.5, { type: "sine", vol: 0.08, glideTo: 500 });
  },
  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(f, 0.22, { type: "triangle", vol: 0.12, delay: i * 0.07 })
    );
  },
};

export function setSoundEnabled(v: boolean) {
  enabled = v;
  ensure();
  if (v) {
    startAmbient();
    sfx.click();
  } else if (ambient) {
    ambient.stop();
  }
  subs.forEach((s) => s(enabled));
}

export function isSoundEnabled() {
  return enabled;
}

export function subscribeSound(fn: Sub) {
  subs.add(fn);
  return () => subs.delete(fn);
}
