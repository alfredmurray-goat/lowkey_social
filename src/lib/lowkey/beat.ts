export interface BeatAnalysis {
  bpm: number;
  /** Beat timestamps in seconds */
  beats: number[];
  /** Estimated drop / highest-energy onset in seconds */
  dropSec: number;
  durationSec: number;
}

/**
 * Pure onset / beat detector on mono PCM samples.
 * Runs offline on-device (no AI service) and is unit-testable on synthetic audio.
 */
export function detectBeatsFromSamples(
  samples: Float32Array,
  sampleRate: number,
): BeatAnalysis {
  const durationSec = samples.length / sampleRate;
  if (samples.length === 0 || sampleRate <= 0 || durationSec < 0.5) {
    return { bpm: 120, beats: [], dropSec: 0, durationSec: Math.max(0, durationSec) };
  }

  // Energy envelope in ~23ms hops
  const hop = Math.max(256, Math.round(sampleRate * 0.023));
  const frameCount = Math.floor(samples.length / hop);
  const energies = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    const start = i * hop;
    for (let j = 0; j < hop; j++) {
      const v = samples[start + j] ?? 0;
      sum += v * v;
    }
    energies[i] = Math.sqrt(sum / hop);
  }

  // Positive energy flux (onset strength)
  const flux = new Float32Array(frameCount);
  for (let i = 1; i < frameCount; i++) {
    const diff = (energies[i] ?? 0) - (energies[i - 1] ?? 0);
    flux[i] = diff > 0 ? diff : 0;
  }

  // Adaptive local threshold peak picking
  const win = 16; // ~0.37s
  const minGapFrames = Math.max(4, Math.round(0.24 / (hop / sampleRate))); // <= 250 BPM
  const peaks: { idx: number; strength: number }[] = [];
  let lastPeak = -minGapFrames;

  for (let i = 2; i < frameCount - 2; i++) {
    const val = flux[i] ?? 0;
    if (val <= 0.005) continue;
    if (val < (flux[i - 1] ?? 0) || val < (flux[i + 1] ?? 0)) continue;

    let localSum = 0;
    let count = 0;
    const lo = Math.max(0, i - win);
    const hi = Math.min(frameCount - 1, i + win);
    for (let k = lo; k <= hi; k++) {
      localSum += flux[k] ?? 0;
      count++;
    }
    const threshold = (localSum / Math.max(1, count)) * 1.45 + 0.004;
    if (val >= threshold && i - lastPeak >= minGapFrames) {
      peaks.push({ idx: i, strength: val });
      lastPeak = i;
    }
  }

  const secPerFrame = hop / sampleRate;
  const beats = peaks.map((p) => Number((p.idx * secPerFrame).toFixed(2)));

  // Estimate BPM from median inter-onset interval (clamped to 70..180 BPM)
  let bpm = 120;
  if (beats.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < beats.length; i++) {
      const dt = (beats[i] ?? 0) - (beats[i - 1] ?? 0);
      if (dt >= 0.25 && dt <= 1.2) intervals.push(dt);
    }
    if (intervals.length > 0) {
      intervals.sort((a, b) => a - b);
      const med = intervals[Math.floor(intervals.length / 2)] ?? 0.5;
      let est = 60 / med;
      while (est < 75) est *= 2;
      while (est > 175) est /= 2;
      bpm = Math.round(est);
    }
  }

  // Find the "drop": strongest energy jump after the first 10% of the track
  let dropSec = beats[0] ?? 0;
  let bestScore = -1;
  const minDropIdx = Math.floor(frameCount * 0.1);
  const maxDropIdx = Math.floor(frameCount * 0.85);
  for (const p of peaks) {
    if (p.idx < minDropIdx || p.idx > maxDropIdx) continue;
    // Score by peak strength + sustained energy right after
    let afterEnergy = 0;
    const afterEnd = Math.min(frameCount, p.idx + 12);
    for (let k = p.idx; k < afterEnd; k++) afterEnergy += energies[k] ?? 0;
    const score = p.strength * 2 + afterEnergy / 12;
    if (score > bestScore) {
      bestScore = score;
      dropSec = Number((p.idx * secPerFrame).toFixed(2));
    }
  }

  return { bpm, beats, dropSec, durationSec };
}

/** Snap a time value to the nearest beat within `toleranceSec`. */
export function snapToNearestBeat(
  timeSec: number,
  beats: number[],
  toleranceSec = 0.25,
): number {
  let best = timeSec;
  let bestDist = toleranceSec;
  for (const b of beats) {
    const d = Math.abs(b - timeSec);
    if (d <= bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return Number(best.toFixed(2));
}

/** Browser helper: fetches an audio URL, decodes via Web Audio API, and detects beats. */
export async function analyzeAudioUrl(url: string): Promise<BeatAnalysis> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("could not load audio track");
  const buf = await res.arrayBuffer();
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(buf);
    const mono = decoded.getChannelData(0);
    return detectBeatsFromSamples(mono, decoded.sampleRate);
  } finally {
    await ctx.close().catch(() => {});
  }
}