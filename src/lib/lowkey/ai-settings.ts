export interface AiSettings {
  /** Master switch — when false, every AI feature is off */
  enabled: boolean;
  captions: boolean;
  tldr: boolean;
  hubs: boolean;
  beatSync: boolean;
}

export type AiFeatureKey = Exclude<keyof AiSettings, "enabled">;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  captions: true,
  tldr: true,
  hubs: true,
  beatSync: true,
};

export function normalizeAiSettings(raw: unknown): AiSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AI_SETTINGS };
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r["enabled"] === "boolean" ? r["enabled"] : true,
    captions: typeof r["captions"] === "boolean" ? r["captions"] : true,
    tldr: typeof r["tldr"] === "boolean" ? r["tldr"] : true,
    hubs: typeof r["hubs"] === "boolean" ? r["hubs"] : true,
    beatSync: typeof r["beatSync"] === "boolean" ? r["beatSync"] : true,
  };
}

export function isAiFeatureEnabled(
  settings: AiSettings | null | undefined,
  feature: AiFeatureKey,
): boolean {
  const s = settings ?? DEFAULT_AI_SETTINGS;
  return s.enabled && s[feature];
}

/** Extracts concatenated text from a Responses API output array. */
export function extractResponseText(output: unknown): string {
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c && typeof c === "object" && "text" in c && typeof (c as { text: unknown }).text === "string") {
        parts.push((c as { text: string }).text);
      }
    }
  }
  return parts.join("");
}

/** Sanitizes AI-generated captions to enforce the lowercase, chill lowkey style. */
export function sanitizeCaptionSuggestions(raw: {
  captions?: unknown;
  tags?: unknown;
}): { captions: string[]; tags: string[] } {
  const rawCaptions = Array.isArray(raw.captions) ? raw.captions : [];
  const captions = rawCaptions
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim().toLowerCase().replace(/^["']|["']$/g, "").slice(0, 90))
    .filter((c) => c.length > 0)
    .slice(0, 3);

  const rawTags = Array.isArray(raw.tags) ? raw.tags : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const t of rawTags) {
    if (typeof t !== "string") continue;
    const clean = t
      .trim()
      .toLowerCase()
      .replace(/^#+/, "")
      .replace(/[^a-z0-9æøå_]/g, "")
      .slice(0, 28);
    if (clean.length >= 2 && !seen.has(clean)) {
      seen.add(clean);
      tags.push(clean);
      if (tags.length >= 5) break;
    }
  }
  return { captions, tags };
}