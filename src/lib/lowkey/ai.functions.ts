import { createServerFn } from "@tanstack/react-start";
import { GatewayError, editImage } from "@lovable.dev/ai-gateway";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  isAiFeatureEnabled,
  normalizeAiSettings,
  sanitizeCaptionSuggestions,
  type AiFeatureKey,
} from "./ai-settings";
import { GROQ_TEXT_MODEL, GROQ_VISION_MODEL, GroqError, groqChatJson } from "./groq.server";

const DAILY_LIMITS: Record<AiFeatureKey, number> = {
  captions: 25,
  tldr: 20,
  doodle: 6,
  hubs: 10,
  beatSync: 100,
};

function friendlyGatewayError(err: unknown): string {
  if (err instanceof GroqError) {
    if (err.code === "missing_key" || err.code === "unauthorized") {
      return "groq ai key isn't set up right — check your settings";
    }
    if (err.code === "rate_limited") {
      return "too many ai requests right now — give it a minute";
    }
    return "ai had a hiccup — try again in a sec";
  }
  if (err instanceof GatewayError) {
    if (err.code === "payment_required") {
      return "ai credits are out right now — try again later";
    }
    if (err.code === "rate_limited") {
      return "too many ai requests right now — give it a minute";
    }
    if (err.code === "permission_denied") {
      return "this ai feature isn't available right now";
    }
    return "ai had a hiccup — try again in a sec";
  }
  return "something went wrong — try again";
}

async function checkAiGate(
  supabase: SupabaseClient<Database>,
  userId: string,
  feature: AiFeatureKey,
): Promise<{ ok: true; city: string | null } | { ok: false; error: string }> {
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("ai_settings, city")
    .eq("user_id", userId)
    .maybeSingle();

  if (profErr || !profile) {
    return { ok: false, error: "could not load your profile" };
  }

  const settings = normalizeAiSettings(profile.ai_settings);
  if (!isAiFeatureEnabled(settings, feature)) {
    return { ok: false, error: "this ai feature is turned off in your settings" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from("ai_usage_daily")
    .select("count")
    .eq("user_id", userId)
    .eq("day", today)
    .eq("feature", feature)
    .maybeSingle();

  const currentCount = usage?.count ?? 0;
  const limit = DAILY_LIMITS[feature];
  if (currentCount >= limit) {
    return { ok: false, error: `daily limit reached (${limit}/day) — resets tomorrow` };
  }

  await supabase.from("ai_usage_daily").upsert(
    { user_id: userId, day: today, feature, count: currentCount + 1 },
    { onConflict: "user_id,day,feature" },
  );

  return { ok: true, city: profile.city ?? null };
}

export const suggestCaptionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { imageDataUrl?: string | null; hint?: string | null }) => ({
      imageDataUrl:
        typeof input.imageDataUrl === "string" && input.imageDataUrl.startsWith("data:image/")
          ? input.imageDataUrl.slice(0, 2_500_000)
          : null,
      hint: typeof input.hint === "string" ? input.hint.trim().slice(0, 200) : null,
    }),
  )
  .handler(async ({ data, context }) => {
    const gate = await checkAiGate(context.supabase, context.userId, "captions");
    if (!gate.ok) return { ok: false as const, error: gate.error };

    const cityPart = gate.city ? `user city: ${gate.city}.` : "";
    const hintPart = data.hint ? `user draft text: "${data.hint}".` : "";
    const promptText = `pitch 3 short effortless lowercase captions and 3-5 lowercase hashtags (include a local city tag if relevant). respond as JSON with {"captions": string[], "tags": string[]}. ${cityPart} ${hintPart}`.trim();
    const userContent = data.imageDataUrl
      ? [
          { type: "text" as const, text: promptText },
          { type: "image_url" as const, image_url: { url: data.imageDataUrl } },
        ]
      : promptText;

    try {
      const parsed = await groqChatJson<{ captions?: unknown; tags?: unknown }>({
        model: data.imageDataUrl ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content:
              'you write ultra-chill lowercase captions for lowkey_social, a friendly app for teens and young people. rules: always lowercase, short (3-8 words), natural and effortless, never cheesy or try-hard, no emoji spam (0-1 emoji max), never comment on people\'s faces, bodies, or appearance. always return valid JSON: {"captions": [...], "tags": [...]}.',
          },
          { role: "user", content: userContent },
        ],
      });
      const clean = sanitizeCaptionSuggestions(parsed);
      return { ok: true as const, ...clean };
    } catch (err) {
      return { ok: false as const, error: friendlyGatewayError(err) };
    }
  });

export const summarizeChatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => ({
    conversationId: String(input.conversationId || "").trim(),
  }))
  .handler(async ({ data, context }) => {
    if (!data.conversationId) return { ok: false as const, error: "missing chat id" };
    const gate = await checkAiGate(context.supabase, context.userId, "tldr");
    if (!gate.ok) return { ok: false as const, error: gate.error };

    // Fetch my handle so we can spot mentions
    const { data: me } = await context.supabase
      .from("profiles")
      .select("handle, display_name")
      .eq("user_id", context.userId)
      .maybeSingle();

    // RLS on messages enforces that the caller is a member of this conversation
    const { data: msgs, error: msgErr } = await context.supabase
      .from("messages")
      .select("body, created_at, sender_id")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (msgErr || !msgs || msgs.length === 0) {
      return { ok: false as const, error: "no recent messages to summarize" };
    }

    const textLines = [...msgs]
      .reverse()
      .map((m) => (m.body ?? "").trim())
      .filter((b) => b.length > 0)
      .slice(-60);

    if (textLines.length === 0) {
      return { ok: false as const, error: "only photos so far — nothing to summarize" };
    }

    try {
      const parsed = await groqChatJson<{ bullets?: unknown }>({
        model: GROQ_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content:
              'summarize a class or friend group chat into 3 short lowercase bullets: plans/meetups, homework/school stuff, and anything directed at the reader. keep each bullet under 14 words, chill tone, no gossip or drama. always return valid JSON: {"bullets": ["...", "...", "..."]}.',
          },
          {
            role: "user",
            content: `reader: ${me?.display_name ?? ""} (@${me?.handle ?? ""})\nmessages:\n${textLines.join("\n")}`,
          },
        ],
      });
      const bullets = (Array.isArray(parsed.bullets) ? parsed.bullets : [])
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        .map((b) => b.trim().toLowerCase().slice(0, 140))
        .slice(0, 3);

      return { ok: true as const, bullets };
    } catch (err) {
      return { ok: false as const, error: friendlyGatewayError(err) };
    }
  });

export const generateDoodleAvatarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imageDataUrl: string }) => ({
    imageDataUrl:
      typeof input.imageDataUrl === "string" && input.imageDataUrl.startsWith("data:image/")
        ? input.imageDataUrl.slice(0, 4_000_000)
        : "",
  }))
  .handler(async ({ data, context }) => {
    if (!data.imageDataUrl) return { ok: false as const, error: "please pick a photo first" };
    const gate = await checkAiGate(context.supabase, context.userId, "doodle");
    if (!gate.ok) return { ok: false as const, error: gate.error };

    try {
      const comma = data.imageDataUrl.indexOf(",");
      const header = data.imageDataUrl.slice(0, comma);
      const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);
      const mime = mimeMatch?.[1] ?? "image/jpeg";
      const b64 = data.imageDataUrl.slice(comma + 1);
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });

      const res = await editImage({
        model: "openai/gpt-image-2.5-sunburst",
        image: blob,
        prompt:
          "Turn this person into a cute, friendly, stylized hand-drawn doodle avatar illustration. Thick charcoal ink outlines, warm sunny yellow and off-white accents, minimal flat colors, playful scribble vibe, centered head-and-shoulders portrait, no text, no real-photo look, privacy-preserving cartoon character.",
        n: 2,
        size: "512x512",
        output_format: "png",
      });

      const options: string[] = [];
      for (const item of res.data ?? []) {
        if (item.b64_json) {
          options.push(`data:image/png;base64,${item.b64_json}`);
        } else if (item.url) {
          options.push(item.url);
        }
      }
      if (options.length === 0) {
        return { ok: false as const, error: "could not draw your doodle — try another photo" };
      }
      return { ok: true as const, options: options.slice(0, 2) };
    } catch (err) {
      return { ok: false as const, error: friendlyGatewayError(err) };
    }
  });

export const triggerTagClusteringFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, error: "admin only" };
    const { runTagHubClustering } = await import("./ai-cluster.server");
    return runTagHubClustering({ forceResume: true });
  });