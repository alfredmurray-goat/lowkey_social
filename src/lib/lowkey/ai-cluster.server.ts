import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { GROQ_TEXT_MODEL, GroqError, groqChatJson } from "./groq.server";
import type { AgeBand } from "./types";

const JOB_NAME = "cluster_tag_hubs";
const LOCK_MINUTES = 10;
const MAX_TAGS_PER_BAND = 60;

export interface ClusterRunResult {
  ok: boolean;
  skipped?: string;
  paused?: boolean;
  hubsCreated?: number;
  error?: string;
}

/**
 * Clusters top hashtags per age band into local hubs.
 * Enforces single-flight lock, paused-state guard, and circuit breaker.
 */
export async function runTagHubClustering(opts?: {
  forceResume?: boolean;
}): Promise<ClusterRunResult> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();

  const { data: state } = await supabaseAdmin
    .from("ai_job_state")
    .select("*")
    .eq("job_name", JOB_NAME)
    .maybeSingle();

  if (state?.paused && !opts?.forceResume) {
    return { ok: false, skipped: `paused: ${state.pause_reason ?? "manual"}`, paused: true };
  }
  if (state?.locked_until && new Date(state.locked_until) > now) {
    return { ok: false, skipped: "already running" };
  }

  await supabaseAdmin.from("ai_job_state").upsert({
    job_name: JOB_NAME,
    locked_until: lockUntil,
    paused: false,
    pause_reason: null,
  });

  let hubsCreated = 0;
  try {
    const bands: AgeBand[] = ["under_18", "adult"];
    for (const band of bands) {
      const { data: rows } = await supabaseAdmin
        .from("post_hashtags")
        .select("tag")
        .eq("age_band", band)
        .limit(1000);

      if (!rows || rows.length < 3) continue;

      const counts = new Map<string, number>();
      for (const r of rows) {
        const t = r.tag.toLowerCase();
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const topTags = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_TAGS_PER_BAND)
        .map(([tag, count]) => ({ tag, count }));

      if (topTags.length < 3) continue;

      const parsed = await groqChatJson<{ hubs?: { name: string; tags: string[] }[] }>({
        model: GROQ_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content:
              'group related hashtags from a chill local social app into short lowercase local hubs (e.g. cph, københavn, kbh7thgrade -> hub "kbh"). only group tags that clearly belong together (same city, school, or topic). each hub needs at least 2 tags from the list. max 8 hubs. lowercase only. return valid JSON: {"hubs": [{"name": string, "tags": string[]}]}.',
          },
          {
            role: "user",
            content: `hashtags: ${topTags.map((t) => `#${t.tag} (${t.count})`).join(", ")}`,
          },
        ],
      });
      const validTags = new Set(topTags.map((t) => t.tag));
      const hubs = (parsed.hubs ?? [])
        .map((h) => ({
          name: h.name.trim().toLowerCase().replace(/^#+/, "").slice(0, 28),
          tags: [...new Set(h.tags.map((t) => t.trim().toLowerCase().replace(/^#+/, "")))].filter(
            (t) => validTags.has(t),
          ),
        }))
        .filter((h) => h.name.length >= 2 && h.tags.length >= 2)
        .slice(0, 8);

      // Replace hubs for this band
      await supabaseAdmin.from("tag_hubs").delete().eq("age_band", band);
      for (const h of hubs) {
        const { data: inserted } = await supabaseAdmin
          .from("tag_hubs")
          .insert({ age_band: band, name: h.name })
          .select("id")
          .single();
        if (!inserted) continue;
        await supabaseAdmin
          .from("tag_hub_members")
          .insert(h.tags.map((tag) => ({ hub_id: inserted.id, tag })));
        hubsCreated++;
      }
    }

    await supabaseAdmin.from("ai_job_state").upsert({
      job_name: JOB_NAME,
      locked_until: null,
      paused: false,
      pause_reason: null,
      last_run_at: new Date().toISOString(),
      last_result: { ok: true, hubsCreated },
    });
    return { ok: true, hubsCreated };
  } catch (err) {
    let shouldPause = false;
    let reason = "clustering failed";
    if (err instanceof GroqError) {
      reason = `${err.code}: ${err.message}`.slice(0, 200);
      if (err.code === "missing_key" || err.code === "unauthorized" || err.code === "rate_limited") {
        shouldPause = true;
      }
    } else if (err instanceof Error) {
      reason = err.message.slice(0, 200);
    }
    await supabaseAdmin.from("ai_job_state").upsert({
      job_name: JOB_NAME,
      locked_until: null,
      paused: shouldPause,
      pause_reason: shouldPause ? reason : null,
      last_run_at: new Date().toISOString(),
      last_result: { ok: false, error: reason },
    });
    return { ok: false, paused: shouldPause, error: reason };
  }
}