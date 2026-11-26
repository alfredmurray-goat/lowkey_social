import { useNavigate } from "@tanstack/react-router";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, ArrowRight, Camera, Check,
  ChevronDown, ChevronUp, Clapperboard, Crop, FileText, FlipHorizontal2, ImagePlus,
  Loader2, Move, Music2, Play, RotateCw, Save, SlidersHorizontal, SquarePlus, Trash2,
  Type, Upload, Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLowkey } from "@/lib/lowkey/store";
import { INTERESTS } from "@/lib/lowkey/types";
import { defaultAdjustments, type MediaAdjustments, type StudioClip, type StudioSong } from "@/lib/lowkey/editor/types";
import { renderPhoto, renderVideo } from "@/lib/lowkey/editor/render";
import { ScribbleLoader } from "@/components/lowkey/scribble-loader";

type Step = "start" | "edit" | "details" | "publish";
type Tool = "adjust" | "transform" | "text" | "clips" | "music";
type DraftRow = { id: string; title: string; caption: string; kind: "post" | "video"; edit_document: Record<string, unknown>; preview_path: string | null; source_paths: string[]; updated_at: string };

const CATALOG: StudioSong[] = [
  { id: "sunroom", title: "sunroom", artist: "lowkey originals", url: "/audio/sunroom.wav", catalog: true },
  { id: "after-school", title: "after school", artist: "lowkey originals", url: "/audio/after-school.wav", catalog: true },
  { id: "soft-focus", title: "soft focus", artist: "lowkey originals", url: "/audio/soft-focus.wav", catalog: true },
  { id: "bike-lane", title: "bike lane", artist: "lowkey originals", url: "/audio/bike-lane.wav", catalog: true },
  { id: "late-bus", title: "late bus", artist: "lowkey originals", url: "/audio/late-bus.wav", catalog: true },
  { id: "window-seat", title: "window seat", artist: "lowkey originals", url: "/audio/window-seat.wav", catalog: true },
  { id: "night-walk", title: "night walk", artist: "lowkey originals", url: "/audio/night-walk.wav", catalog: true },
];

const isVideoFile = (file: File) => file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(file.name);
const filterStyle = (a: MediaAdjustments) => ({ filter: `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%) sepia(${Math.max(0, a.warmth) * .35}%) opacity(${100 - a.fade * .45}%)`, transform: `rotate(${a.rotation}deg) scaleX(${a.flipX ? -1 : 1}) scale(${a.zoom})` });

function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <label className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 py-2 text-sm"><span className="lowkey font-semibold">{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-primary"/><span className="text-right text-xs text-muted-foreground">{value}</span></label>;
}

export function MediaStudio() {
  const { state, me, createPost, uploadMedia } = useLowkey();
  const navigate = useNavigate();
  const mediaInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("start");
  const [tool, setTool] = useState<Tool>("adjust");
  const [clips, setClips] = useState<StudioClip[]>([]);
  const [active, setActive] = useState(0);
  const [adjustments, setAdjustments] = useState(defaultAdjustments);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [song, setSong] = useState<StudioSong | null>(null);
  const [rights, setRights] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const myCommunities = state.communities.filter((c) => me && c.memberIds.includes(me.id));
  const suggestedTags = ["lowkey", "school", "afterschool", "fits", "gaming", "music", "friends"];
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [posting, setPosting] = useState(false);
  const clip = clips[active];
  const kind = clips.some((c) => c.kind === "video") ? "video" : "post";

  const loadDrafts = async () => {
    if (!me) return;
    const { data } = await supabase.from("post_drafts").select("*").eq("author_id", me.id).order("updated_at", { ascending: false });
    setDrafts((data ?? []) as DraftRow[]);
  };
  useEffect(() => { void loadDrafts(); }, [me?.id]);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, 8);
    const next = await Promise.all(files.map(async (file): Promise<StudioClip> => {
      if (file.size > 200_000_000) throw new Error(`${file.name} is over 200mb`);
      const video = isVideoFile(file);
      const url = URL.createObjectURL(file);
      let duration = 0;
      if (video) duration = await new Promise<number>((resolve) => { const el = document.createElement("video"); el.preload = "metadata"; el.src = url; el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 0); el.onerror = () => resolve(0); });
      return { id: crypto.randomUUID(), file, url, kind: video ? "video" : "image", name: file.name, duration, trimStart: 0, trimEnd: duration || 1 };
    }));
    setClips((current) => [...current, ...next]);
    setStep("edit");
    setTool(next.some((item) => item.kind === "video") ? "clips" : "adjust");
  };

  const saveDraft = async () => {
    if (!me || (!clips.length && !caption.trim())) return;
    setSaving(true);
    const paths: string[] = [];
    for (const item of clips) {
      const uploaded = await uploadMedia(item.file);
      if (uploaded) paths.push(uploaded.path);
    }
    const payload = { adjustments, clips: clips.map((c) => ({ name: c.name, kind: c.kind, duration: c.duration, trimStart: c.trimStart, trimEnd: c.trimEnd })), song: song ? { title: song.title, artist: song.artist, url: song.catalog ? song.url : null, storagePath: song.storagePath ?? null, catalog: song.catalog } : null };
    const row = { author_id: me.id, title, caption, topic, kind, edit_document: payload, preview_path: paths[0] ?? null, source_paths: paths, updated_at: new Date().toISOString() };
    const result = draftId ? await supabase.from("post_drafts").update(row).eq("id", draftId).select("id").single() : await supabase.from("post_drafts").insert(row).select("id").single();
    if (result.error) toast.error("couldn't save this draft"); else { setDraftId(result.data.id); toast.success("draft saved across your devices"); await loadDrafts(); }
    setSaving(false);
  };

  const deleteDraft = async (id: string) => { await supabase.from("post_drafts").delete().eq("id", id); await loadDrafts(); };
  const resumeDraft = async (draft: DraftRow) => {
    setDraftId(draft.id); setTitle(draft.title); setCaption(draft.caption);
    const doc = draft.edit_document as { adjustments?: MediaAdjustments; clips?: Array<Pick<StudioClip, "name" | "kind" | "duration" | "trimStart" | "trimEnd">>; song?: Omit<StudioSong, "id" | "file"> | null };
    if (doc.adjustments) setAdjustments(doc.adjustments);
    const { data } = await supabase.storage.from("media").createSignedUrls(draft.source_paths, 60 * 60);
    const restored = await Promise.all((data ?? []).map(async (item, index): Promise<StudioClip | null> => {
      if (!item.signedUrl) return null;
      const saved = doc.clips?.[index];
      const response = await fetch(item.signedUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      const file = new File([blob], saved?.name ?? `draft-${index + 1}`, { type: blob.type });
      return {
        id: crypto.randomUUID(), file, url: URL.createObjectURL(file),
        kind: saved?.kind ?? (isVideoFile(file) ? "video" : "image"),
        name: file.name, duration: saved?.duration ?? 0,
        trimStart: saved?.trimStart ?? 0, trimEnd: saved?.trimEnd ?? saved?.duration ?? 1,
      };
    }));
    const ready = restored.filter((item): item is StudioClip => item !== null);
    setClips(ready); setActive(0);
    if (doc.song) setSong({ ...doc.song, id: crypto.randomUUID() });
    toast.success("draft restored");
    setStep(ready.length ? "edit" : "details");
  };

  const uploadSong = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("audio/")) { toast.error("choose an audio file"); return; }
    const uploaded = await uploadMedia(file);
    if (!uploaded || !me) { toast.error("audio upload failed"); return; }
    const titleValue = file.name.replace(/\.[^.]+$/, "");
    const { data } = await supabase.from("music_tracks").insert({ owner_id: me.id, title: titleValue, artist: me.displayName, storage_path: uploaded.path, license_name: "user confirmed rights", is_catalog: false }).select("id").single();
    setSong({ id: data?.id ?? crypto.randomUUID(), title: titleValue, artist: me.displayName, url: uploaded.url, file, storagePath: uploaded.path, catalog: false });
    setRights(false);
  };

  const publish = async () => {
    if (!caption.trim() && !clips.length) { toast.error("add media or a caption"); return; }
    if (song && !song.catalog && !rights) { toast.error("confirm you can use this audio"); setTool("music"); setStep("edit"); return; }
    setPosting(true); setStep("publish"); setRenderProgress(0); setUploadProgress(0);
    try {
      let mediaPath: string | null = null;
      const firstClip = clips[0];
      if (firstClip) {
        const finalFile = kind === "video" ? await renderVideo(clips.filter((c) => c.kind === "video"), adjustments, setRenderProgress) : await renderPhoto(firstClip.file, adjustments);
        setRenderProgress(100);
        const uploaded = await uploadMedia(finalFile, setUploadProgress);
        if (!uploaded) throw new Error("upload failed");
        mediaPath = uploaded.path;
      }
      const id = await createPost({ kind, title: title || null, caption: caption.trim() || "no caption", mediaUrl: mediaPath, topic, communityId, songTitle: song?.title ?? null, songArtist: song?.artist ?? null, audioPath: song?.storagePath ?? song?.url ?? null, editManifest: adjustments });
      if (!id) throw new Error("verify your age before posting");
      if (draftId) await supabase.from("post_drafts").delete().eq("id", draftId);
      toast.success("posted");
      void navigate({ to: kind === "video" ? "/app/videos" : "/app" });
    } catch (error) { toast.error(error instanceof Error ? error.message.toLowerCase() : "couldn't post"); setStep("details"); }
    finally { setPosting(false); }
  };

  const updateAdjustment = <K extends keyof MediaAdjustments>(key: K, value: MediaAdjustments[K]) => setAdjustments((a) => ({ ...a, [key]: value }));
  const previewStyle = useMemo(() => filterStyle(adjustments), [adjustments]);
  const moveClip = (direction: -1 | 1) => {
    const nextIndex = active + direction;
    const current = clips[active];
    const target = clips[nextIndex];
    if (!current || !target) return;
    const next = [...clips];
    next[active] = target;
    next[nextIndex] = current;
    setClips(next);
    setActive(nextIndex);
  };

  const moveText = (clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAdjustments((current) => ({
      ...current,
      textX: Math.min(0.92, Math.max(0.08, (clientX - rect.left) / rect.width)),
      textY: Math.min(0.86, Math.max(0.08, (clientY - rect.top) / rect.height)),
    }));
  };

  if (step === "start") {
    return (
      <div className="min-h-[calc(100dvh-8rem)] space-y-5 px-4 py-5 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-13 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
              <SquarePlus className="size-6" strokeWidth={2.4} />
            </span>
            <div>
              <h1 className="lowkey font-display text-2xl leading-tight font-bold">create studio</h1>
              <p className="lowkey text-xs text-muted-foreground">post to your age band or class</p>
            </div>
          </div>
          {(clips.length > 0 || caption) && (
            <button type="button" onClick={() => setStep("edit")} className="lowkey lk-btn-soft px-3.5 py-2 text-xs">
              continue
            </button>
          )}
        </header>

        <button
          type="button"
          onClick={() => mediaInput.current?.click()}
          className="lk-card group flex w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-border px-6 py-10 text-center transition-all hover:border-primary hover:bg-primary-soft/30 active:scale-[0.99]"
        >
          <span className="flex h-14 w-18 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
            <Clapperboard className="size-7" strokeWidth={2.4} />
          </span>
          <div>
            <p className="lowkey font-display text-lg font-bold">pick photos or videos</p>
            <p className="lowkey mt-0.5 text-xs text-muted-foreground">up to 8 clips · edit light, text, trim &amp; music</p>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="lk-card flex flex-col items-center gap-2.5 p-4 transition-all hover:bg-primary-soft/40 active:scale-95"
          >
            <span className="lk-pill-icon h-10 w-13">
              <Camera className="size-5" strokeWidth={2.3} />
            </span>
            <span className="lowkey text-sm font-bold">camera</span>
          </button>
          <button
            type="button"
            onClick={() => { setClips([]); setStep("details"); }}
            className="lk-card flex flex-col items-center gap-2.5 p-4 transition-all hover:bg-primary-soft/40 active:scale-95"
          >
            <span className="lk-pill-icon h-10 w-13">
              <FileText className="size-5" strokeWidth={2.3} />
            </span>
            <span className="lowkey text-sm font-bold">text post</span>
          </button>
        </div>

        <input ref={cameraInput} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files)} />
        <input ref={mediaInput} type="file" accept="image/*,video/*,.heic,.heif" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />

        {drafts.length > 0 && (
          <section className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="lowkey font-display text-base font-bold">saved drafts</h2>
              <span className="lowkey rounded-xl bg-primary-soft px-2.5 py-0.5 text-xs font-bold">{drafts.length}</span>
            </div>
            <div className="space-y-2">
              {drafts.map((d) => (
                <div key={d.id} className="lk-card flex items-center gap-3 p-3">
                  <span className="lk-pill-icon size-11 shrink-0">
                    {d.kind === "video" ? <Video className="size-5" /> : <ImagePlus className="size-5" />}
                  </span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void resumeDraft(d)}>
                    <p className="lowkey truncate text-sm font-bold">{d.title || d.caption || "untitled draft"}</p>
                    <p className="lowkey text-xs text-muted-foreground">saved {new Date(d.updated_at).toLocaleDateString()}</p>
                  </button>
                  <button
                    type="button"
                    aria-label="delete draft"
                    onClick={() => void deleteDraft(d.id)}
                    className="flex size-9 items-center justify-center rounded-2xl text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-90"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  if (step === "publish") {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-8 text-center">
        <ScribbleLoader label={renderProgress < 100 ? `editing ${renderProgress}%` : `uploading ${uploadProgress}%`} />
        <div className="mt-4 h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${renderProgress < 100 ? renderProgress : uploadProgress}%` }}
          />
        </div>
      </div>
    );
  }

  if (step === "details") {
    return (
      <div className="min-h-[calc(100dvh-8rem)] space-y-5 px-4 py-4 sm:px-6">
        <header className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep(clips.length ? "edit" : "start")}
            aria-label="back"
            className="lk-pill-icon h-9 w-11"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="lowkey rounded-xl bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">1 edit</span>
            <span className="lowkey rounded-xl bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-xs">2 publish</span>
          </div>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={saving}
            className="lowkey lk-btn-soft h-9 px-3 text-xs"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "save draft"}
          </button>
        </header>

        <div className="grid gap-5 md:grid-cols-[1fr_1.15fr]">
          <div className="flex flex-col gap-3">
            {clip ? (
              <div className="lk-card aspect-video overflow-hidden bg-muted">
                {clip.kind === "video" ? (
                  <video src={clip.url} controls className="size-full object-contain" />
                ) : (
                  <img src={clip.url} alt="edited preview" className="size-full object-contain" style={previewStyle} />
                )}
              </div>
            ) : (
              <div className="lk-card flex aspect-video flex-col items-center justify-center gap-2 border-dashed text-xs text-muted-foreground">
                <span className="lk-pill-icon h-10 w-12">
                  <FileText className="size-5" />
                </span>
                <span className="lowkey font-semibold">text-only post</span>
              </div>
            )}
            {song && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-primary-soft p-3 text-xs">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <Music2 className="size-4" />
                </span>
                <span className="lowkey truncate">song playing is: <strong>{song.title} — {song.artist}</strong></span>
              </div>
            )}
            <div className="lk-card p-3.5">
              <p className="lowkey mb-2 text-xs font-bold text-muted-foreground">who can see this</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCommunityId(null)}
                  className={`lowkey rounded-2xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                    communityId === null ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
                  }`}
                >
                  everyone ({me?.ageBand === "under_18" ? "under 18" : "18+"})
                </button>
                {myCommunities.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCommunityId(c.id)}
                    className={`lowkey rounded-2xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                      communityId === c.id ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="lowkey text-xs font-bold text-muted-foreground">title · optional</span>
              <input
                value={title}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="give it a title"
                className="mt-1 w-full rounded-2xl border border-input bg-card px-4 py-2.5 font-display text-lg font-bold outline-none"
              />
            </label>
            <label className="block">
              <span className="lowkey text-xs font-bold text-muted-foreground">caption &amp; #hashtags</span>
              <textarea
                value={caption}
                maxLength={280}
                rows={4}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="say it lowkey… add #tags"
                className="mt-1 w-full resize-none rounded-2xl border border-input bg-card p-3.5 outline-none"
              />
              <span className="block text-right text-xs text-muted-foreground">{caption.length}/280</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTags.map((tg) => (
                <button
                  key={tg}
                  type="button"
                  onClick={() => setCaption((c) => (c.includes(`#${tg}`) ? c : `${c.trim()} #${tg}`.trim()))}
                  className="lowkey rounded-xl bg-primary-soft/70 px-2.5 py-1 text-[11px] font-bold text-foreground transition-all hover:bg-primary hover:text-primary-foreground active:scale-95"
                >
                  #{tg}
                </button>
              ))}
            </div>
            <div>
              <p className="lowkey mb-2 text-xs font-bold text-muted-foreground">topic</p>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS.slice(0, 12).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(topic === t ? null : t)}
                    className={`lowkey rounded-2xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                      topic === t ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="lowkey lk-btn-primary h-12 w-full text-base"
              disabled={posting}
              onClick={() => void publish()}
            >
              post now <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-3 backdrop-blur-xl">
        <button type="button" onClick={() => setStep("start")} aria-label="back" className="lk-pill-icon h-9 w-10">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="lowkey rounded-xl bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-xs">
            1 edit · {clips.length} {clips.length === 1 ? "item" : "items"}
          </span>
          <span className="lowkey rounded-xl bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">2 publish</span>
        </div>
        <button type="button" onClick={() => void saveDraft()} disabled={saving} aria-label="save draft" className="lk-pill-icon h-9 w-10">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-foreground/95 p-4">
        <div ref={previewRef} className="relative flex max-h-[56dvh] w-full max-w-md items-center justify-center overflow-hidden rounded-2xl">
          {clip?.kind === "video" ? (
            <video src={clip.url} controls playsInline className="max-h-[56dvh] w-full object-contain" style={previewStyle} />
          ) : clip ? (
            <img src={clip.url} alt="editing preview" className="max-h-[56dvh] w-full object-contain" style={previewStyle} />
          ) : null}
          {adjustments.text && (
            <button
              type="button"
              aria-label="move text"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); moveText(event.clientX, event.clientY); }}
              onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveText(event.clientX, event.clientY); }}
              className="absolute max-w-[84%] cursor-move touch-none font-bold text-background drop-shadow-lg"
              style={{ left: `${adjustments.textX * 100}%`, top: `${adjustments.textY * 100}%`, transform: "translate(-50%, -50%)", fontSize: Math.min(adjustments.textSize, 64), textAlign: adjustments.textAlign }}
            >
              {adjustments.text}
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card/95">
        <div className="max-h-52 overflow-y-auto px-4 py-3">
          {tool === "adjust" && (
            <>
              <Range label="light" value={adjustments.brightness} min={50} max={150} onChange={(v) => updateAdjustment("brightness", v)} />
              <Range label="contrast" value={adjustments.contrast} min={50} max={150} onChange={(v) => updateAdjustment("contrast", v)} />
              <Range label="saturation" value={adjustments.saturation} min={0} max={200} onChange={(v) => updateAdjustment("saturation", v)} />
              <Range label="warmth" value={adjustments.warmth} min={0} max={100} onChange={(v) => updateAdjustment("warmth", v)} />
              <Range label="fade" value={adjustments.fade} min={0} max={100} onChange={(v) => updateAdjustment("fade", v)} />
            </>
          )}
          {tool === "transform" && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" className="rounded-2xl" onClick={() => updateAdjustment("rotation", (adjustments.rotation + 90) % 360)}><RotateCw />rotate</Button>
              <Button variant="secondary" className="rounded-2xl" onClick={() => updateAdjustment("flipX", !adjustments.flipX)}><FlipHorizontal2 />flip</Button>
              <div className="min-w-36"><Range label="zoom" value={adjustments.zoom} min={1} max={2} step={0.05} onChange={(v) => updateAdjustment("zoom", v)} /></div>
            </div>
          )}
          {tool === "text" && (
            <div className="space-y-2">
              <input value={adjustments.text} maxLength={80} onChange={(e) => updateAdjustment("text", e.target.value)} placeholder="add text on your media" className="w-full rounded-2xl border border-input bg-background px-3.5 py-2 outline-none" />
              <p className="lowkey flex items-center gap-1 text-xs text-muted-foreground"><Move className="size-3.5" />drag the text on the preview to place it</p>
              <div className="flex gap-2">
                <Button size="icon" className="rounded-2xl" variant={adjustments.textAlign === "left" ? "default" : "secondary"} onClick={() => updateAdjustment("textAlign", "left")}><AlignLeft /></Button>
                <Button size="icon" className="rounded-2xl" variant={adjustments.textAlign === "center" ? "default" : "secondary"} onClick={() => updateAdjustment("textAlign", "center")}><AlignCenter /></Button>
                <Button size="icon" className="rounded-2xl" variant={adjustments.textAlign === "right" ? "default" : "secondary"} onClick={() => updateAdjustment("textAlign", "right")}><AlignRight /></Button>
                <div className="flex-1"><Range label="size" value={adjustments.textSize} min={20} max={80} onChange={(v) => updateAdjustment("textSize", v)} /></div>
              </div>
            </div>
          )}
          {tool === "clips" && (
            <div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {clips.map((c, i) => (
                  <button key={c.id} onClick={() => setActive(i)} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl border-2 ${active === i ? "border-primary" : "border-transparent"}`}>
                    {c.kind === "video" ? <video src={c.url} className="size-full object-cover" /> : <img src={c.url} alt="" className="size-full object-cover" />}
                    <span className="absolute bottom-1 left-1 rounded-lg bg-background/85 px-1.5 text-[10px] font-bold">{i + 1}</span>
                  </button>
                ))}
                <button type="button" onClick={() => mediaInput.current?.click()} className="lk-pill-icon h-16 w-20 shrink-0"><Upload className="size-5" /></button>
              </div>
              {clip?.kind === "video" && (
                <>
                  <Range label="starts" value={clip.trimStart} min={0} max={Math.max(0.1, clip.trimEnd - 0.1)} step={0.1} onChange={(v) => setClips((all) => all.map((c, i) => (i === active ? { ...c, trimStart: v } : c)))} />
                  <Range label="ends" value={clip.trimEnd} min={Math.min(clip.duration, clip.trimStart + 0.1)} max={clip.duration} step={0.1} onChange={(v) => setClips((all) => all.map((c, i) => (i === active ? { ...c, trimEnd: v } : c)))} />
                  <Range label="speed" value={adjustments.speed} min={0.5} max={2} step={0.25} onChange={(v) => updateAdjustment("speed", v)} />
                  <Range label="original vol" value={adjustments.originalVolume} min={0} max={100} onChange={(v) => updateAdjustment("originalVolume", v)} />
                </>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="rounded-2xl" disabled={active === 0} onClick={() => moveClip(-1)}><ChevronUp />earlier</Button>
                <Button variant="secondary" className="rounded-2xl" disabled={active === clips.length - 1} onClick={() => moveClip(1)}><ChevronDown />later</Button>
                <Button variant="destructive" className="rounded-2xl" onClick={() => { setClips((all) => all.filter((_, i) => i !== active)); setActive(Math.max(0, active - 1)); }}><Trash2 />remove</Button>
              </div>
            </div>
          )}
          {tool === "music" && (
            <div>
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {CATALOG.map((track) => (
                  <Button key={track.id} className="shrink-0 rounded-2xl" variant={song?.id === track.id ? "default" : "secondary"} onClick={() => setSong(track)}>
                    <Play className="size-3" />{track.title}
                  </Button>
                ))}
                <Button className="shrink-0 rounded-2xl" variant="outline" onClick={() => audioInput.current?.click()}><Upload />your audio</Button>
              </div>
              {song && (
                <>
                  <p className="lowkey rounded-2xl bg-primary-soft p-2.5 text-sm">song playing is: <strong>{song.title} — {song.artist}</strong></p>
                  <audio src={song.url} controls loop className="mt-2 w-full" />
                  <Range label="song vol" value={adjustments.songVolume} min={0} max={100} onChange={(v) => updateAdjustment("songVolume", v)} />
                  {!song.catalog && (
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />i have permission to use this audio
                    </label>
                  )}
                  <Button variant="ghost" onClick={() => setSong(null)}>remove song</Button>
                </>
              )}
            </div>
          )}
        </div>

        <nav className="grid grid-cols-5 border-t border-border px-1 py-1.5">
          {([
            { id: "adjust", icon: SlidersHorizontal, label: "adjust" },
            { id: "transform", icon: Crop, label: "crop" },
            { id: "text", icon: Type, label: "text" },
            { id: "clips", icon: Video, label: "clips" },
            { id: "music", icon: Music2, label: "music" },
          ] as const).map(({ id, icon: Icon, label }) => {
            const activeTool = tool === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                className="flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90"
              >
                <span
                  className={`flex h-8 w-11 items-center justify-center rounded-2xl transition-colors ${
                    activeTool ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={activeTool ? 2.4 : 2} />
                </span>
                <span className={`lowkey text-[10px] ${activeTool ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex gap-2 p-3">
          <button type="button" className="lowkey lk-btn-soft h-11 flex-1 text-sm" onClick={() => void saveDraft()} disabled={saving}>
            <Save className="size-4" />{saving ? "saving" : "save draft"}
          </button>
          <button type="button" className="lowkey lk-btn-primary h-11 flex-1 text-sm" onClick={() => setStep("details")}>
            next <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
      <input ref={mediaInput} type="file" accept="image/*,video/*,.heic,.heif" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />
      <input ref={audioInput} type="file" accept="audio/*" className="hidden" onChange={(e) => void uploadSong(e.target.files?.[0])} />
    </div>
  );
}
