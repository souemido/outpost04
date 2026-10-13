type Graph = {
  ctx: AudioContext;
  master: GainNode;
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  noiseGain: GainNode;
  filter: BiquadFilterNode;
};

let graph: Graph | null = null;

function contextCtor() {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

export function unlockLeakAudio() {
  const Ctor = contextCtor();
  if (!Ctor) return;
  if (!graph) {
    const ctx = new Ctor({ latencyHint: "interactive" });
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const bed = ctx.createGain();
    bed.gain.value = 0.9;
    bed.connect(master);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    filter.connect(bed);
    const oscA = ctx.createOscillator();
    oscA.type = "sine";
    oscA.frequency.value = 52;
    const oscB = ctx.createOscillator();
    oscB.type = "triangle";
    oscB.frequency.value = 78;
    const thin = ctx.createGain();
    thin.gain.value = 0.08;
    oscA.connect(filter);
    oscB.connect(thin);
    thin.connect(filter);
    oscA.start();
    oscB.start();
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 900;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(high);
    high.connect(noiseGain);
    noiseGain.connect(bed);
    noise.start();
    graph = { ctx, master, oscA, oscB, noiseGain, filter };
  }
  if (graph.ctx.state === "suspended") void graph.ctx.resume();
}

export function resumeLeakAudio() {
  if (graph && graph.ctx.state === "suspended") void graph.ctx.resume();
}

export function setDrone(input: {
  muted: boolean;
  warmth: number;
  silence: number;
  blackout: boolean;
  deep: boolean;
  bubble: number;
}) {
  if (!graph) return;
  const { ctx, master, oscA, oscB, noiseGain, filter } = graph;
  const t = ctx.currentTime;
  const vol = input.muted ? 0 : input.blackout ? 0.2 : 0.38;
  master.gain.setTargetAtTime(vol, t, 0.08);
  const base = 40 + (input.warmth / 100) * 34;
  oscA.frequency.setTargetAtTime(input.blackout ? 34 : base, t, 0.25);
  oscB.frequency.setTargetAtTime(base * 1.49, t, 0.25);
  const hiss = input.muted
    ? 0
    : (input.blackout ? 0.16 : 0.015) +
      (input.deep ? 0.07 : 0) +
      (1 - input.silence / 100) * 0.07 +
      (input.bubble / 100) * 0.035;
  noiseGain.gain.setTargetAtTime(hiss, t, 0.12);
  filter.frequency.setTargetAtTime(160 + input.warmth * 5, t, 0.2);
}

export function squelch() {
  if (!graph || graph.ctx.state !== "running") return;
  const { ctx, master } = graph;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  const now = ctx.currentTime;
  osc.frequency.setValueAtTime(480, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.18);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

export function blip(kind: "act" | "warn") {
  if (!graph || graph.ctx.state !== "running") return;
  const { ctx, master } = graph;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = kind === "warn" ? 128 : 640;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.12);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}
