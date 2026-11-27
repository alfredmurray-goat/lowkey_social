import { describe, expect, it } from "bun:test";
import {
  DEFAULT_AI_SETTINGS,
  isAiFeatureEnabled,
  normalizeAiSettings,
  sanitizeCaptionSuggestions,
} from "./ai-settings";
import { detectBeatsFromSamples, snapToNearestBeat } from "./beat";

describe("ai settings gating", () => {
  it("disables every feature when master switch is off", () => {
    const off = { ...DEFAULT_AI_SETTINGS, enabled: false };
    expect(isAiFeatureEnabled(off, "captions")).toBe(false);
    expect(isAiFeatureEnabled(off, "tldr")).toBe(false);
    expect(isAiFeatureEnabled(off, "hubs")).toBe(false);
    expect(isAiFeatureEnabled(off, "beatSync")).toBe(false);
  });

  it("gates individual features independently when master is on", () => {
    const partial = normalizeAiSettings({ enabled: true, captions: false, tldr: true });
    expect(isAiFeatureEnabled(partial, "captions")).toBe(false);
    expect(isAiFeatureEnabled(partial, "tldr")).toBe(true);
  });
});

describe("caption sanitization", () => {
  it("enforces lowercase, strips hashes/quotes, and bounds counts", () => {
    const out = sanitizeCaptionSuggestions({
      captions: ['"CPH Golden Hour"', "Bro Really Thought", "  chill vibes  ", "fourth ignored"],
      tags: ["#KBH", "kbh", "Weekend!", "a", "cph", "school", "friends", "extra"],
    });
    expect(out.captions).toEqual(["cph golden hour", "bro really thought", "chill vibes"]);
    expect(out.tags).toEqual(["kbh", "weekend", "cph", "school", "friends"]);
  });
});

describe("beat-sync detection", () => {
  it("detects ~120 bpm on a synthetic click track and snaps trim times", () => {
    const sr = 22050;
    const duration = 6; // 6 seconds = 12 beats at 120 BPM (every 0.5s)
    const samples = new Float32Array(sr * duration);
    for (let t = 0.5; t < duration; t += 0.5) {
      const idx = Math.floor(t * sr);
      const amp = t === 2.5 ? 0.95 : 0.45; // louder drop at 2.5s
      for (let k = 0; k < 400 && idx + k < samples.length; k++) {
        samples[idx + k] = amp * Math.sin((2 * Math.PI * 180 * k) / sr) * (1 - k / 400);
      }
    }
    const analysis = detectBeatsFromSamples(samples, sr);
    expect(analysis.bpm >= 115 && analysis.bpm <= 125).toBe(true);
    expect(analysis.beats.length >= 8).toBe(true);
    expect(Math.abs(snapToNearestBeat(1.04, analysis.beats, 0.15) - 1.0) < 0.1).toBe(true);
  });
});