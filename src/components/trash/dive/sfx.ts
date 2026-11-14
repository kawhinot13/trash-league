"use client";

/**
 * Tiny synthesized sound kit for Dumpster Dive (Web Audio, no files). Every sound is a few
 * oscillators or a burst of filtered noise. Starts only after a click (browsers require a
 * gesture), and the mute choice is remembered.
 */
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = typeof window !== "undefined" && localStorage.getItem("dive:muted") === "1";
} catch {}

const ac = () => {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.18, when = 0, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, from: number, to: number, gain = 0.2, when = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem("dive:muted", m ? "1" : "0");
    } catch {}
  },
  /** Card thrown. */
  whoosh: () => noise(0.35, 600, 2600, 0.12),
  /** Lid swings open. */
  creak: () => tone(140, 0.28, "sawtooth", 0.04, 0, 220),
  /** Lands in the trash; deeper lands lower. */
  thud: (depth: number) => {
    tone(110 - depth * 0.4, 0.22, "sine", 0.32, 0, 48);
    noise(0.18, 400, 180, 0.12);
  },
  tick: () => tone(1400, 0.035, "square", 0.025),
  /** Tier reveal: brighter chords for deeper cuts. */
  chime: (score: number) => {
    const base = score >= 90 ? 523 : score >= 60 ? 440 : score >= 25 ? 392 : 330;
    const steps = score >= 90 ? [0, 4, 7, 12, 16] : score >= 60 ? [0, 4, 7] : [0, 5];
    steps.forEach((s, i) => tone(base * 2 ** (s / 12), 0.5, "triangle", 0.12, i * 0.07));
  },
  /** Wrong answer: lid slam and a buzzer. */
  slam: () => {
    tone(70, 0.25, "square", 0.18, 0, 40);
    noise(0.12, 900, 200, 0.18);
  },
  buzz: () => tone(110, 0.45, "sawtooth", 0.09, 0.08, 90),
  /** Final report fanfare. */
  fanfare: () => [0, 4, 7, 12].forEach((s, i) => tone(392 * 2 ** (s / 12), 0.6, "triangle", 0.12, i * 0.11)),
};
