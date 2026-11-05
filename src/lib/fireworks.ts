import type { BloomStyle } from "./firework-visuals";
export const FIREWORK_CUES: readonly {
  at: number;
  x: number;
  y: number;
  style: BloomStyle;
  radius: number;
  rotation: number;
  power: number;
}[] = [
  {
    at: 0.6,
    x: 0.32,
    y: 0.36,
    style: "chrysanthemum",
    radius: 0.43,
    rotation: 0,
    power: 1,
  },
  {
    at: 1.05,
    x: 0.73,
    y: 0.3,
    style: "peony",
    radius: 0.39,
    rotation: 0.2,
    power: 0.8,
  },
  {
    at: 1.6,
    x: 0.5,
    y: 0.28,
    style: "willow",
    radius: 0.49,
    rotation: 0,
    power: 1.1,
  },
  {
    at: 2.1,
    x: 0.18,
    y: 0.48,
    style: "sapphire",
    radius: 0.32,
    rotation: -0.1,
    power: 0.6,
  },
  {
    at: 2.4,
    x: 0.81,
    y: 0.43,
    style: "chrysanthemum",
    radius: 0.37,
    rotation: 0.3,
    power: 0.7,
  },
  {
    at: 2.95,
    x: 0.39,
    y: 0.38,
    style: "peony",
    radius: 0.42,
    rotation: -0.1,
    power: 0.85,
  },
  {
    at: 3.25,
    x: 0.65,
    y: 0.37,
    style: "sapphire",
    radius: 0.4,
    rotation: 0.3,
    power: 0.85,
  },
  {
    at: 3.9,
    x: 0.26,
    y: 0.36,
    style: "willow",
    radius: 0.46,
    rotation: 0.08,
    power: 0.8,
  },
  {
    at: 4.05,
    x: 0.75,
    y: 0.34,
    style: "chrysanthemum",
    radius: 0.45,
    rotation: 0.1,
    power: 0.8,
  },
  {
    at: 4.3,
    x: 0.5,
    y: 0.3,
    style: "willow",
    radius: 0.56,
    rotation: -0.06,
    power: 1.2,
  },
];
export const FIREWORK_DURATION = 7.2;

// Original procedural audio: no network downloads or microphone input.
export function scheduleFireworksSound(
  context: BaseAudioContext,
  destination: AudioNode,
  start: number,
) {
  const master = context.createGain();
  master.gain.value = 0.42;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 8;
  master.connect(limiter);
  limiter.connect(destination);
  const noise = context.createBuffer(
    1,
    Math.ceil(context.sampleRate),
    context.sampleRate,
  );
  const samples = noise.getChannelData(0);
  let seed = 85213;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    samples[i] = (seed >>> 0) / 2147483648 - 1;
  }
  const sources: AudioScheduledSourceNode[] = [],
    nodes: AudioNode[] = [master, limiter];
  function tone(
    at: number,
    duration: number,
    from: number,
    to: number,
    volume: number,
  ) {
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.01);
    sources.push(oscillator);
    nodes.push(oscillator, gain);
  }
  for (const cue of FIREWORK_CUES) {
    const at = start + cue.at;
    tone(at - 0.34, 0.32, 700, 1700, 0.022);
    tone(at, 0.65, 135, 35, 0.3 * cue.power);
    const boom = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    boom.buffer = noise;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2300, at);
    filter.frequency.exponentialRampToValueAtTime(100, at + 0.85);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.3 * cue.power, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    boom.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    boom.start(at);
    boom.stop(at + 0.95);
    const crackle = context.createBufferSource(),
      highpass = context.createBiquadFilter(),
      sparks = context.createGain();
    crackle.buffer = noise;
    highpass.type = "highpass";
    highpass.frequency.value = 3500;
    sparks.gain.setValueAtTime(0, at);
    for (let i = 0; i < 12; i++) {
      const time = at + 0.12 + i * 0.055;
      sparks.gain.setValueAtTime(0, time);
      sparks.gain.linearRampToValueAtTime(0.07 * (1 - i / 14), time + 0.002);
      sparks.gain.exponentialRampToValueAtTime(0.0001, time + 0.018);
    }
    crackle.connect(highpass);
    highpass.connect(sparks);
    sparks.connect(master);
    crackle.start(at + 0.1);
    crackle.stop(at + 0.9);
    sources.push(boom, crackle);
    nodes.push(boom, filter, gain, crackle, highpass, sparks);
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
    }
    for (const node of nodes) node.disconnect();
  };
}

let audio: AudioContext | null = null;
export function unlockFireworksAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
  } catch {
    /* The visual effect remains available when audio is unsupported. */
  }
}
export function playFireworksSound(): (() => void) | null {
  if (!audio || audio.state !== "running") return null;
  return scheduleFireworksSound(
    audio,
    audio.destination,
    audio.currentTime + 0.015,
  );
}
