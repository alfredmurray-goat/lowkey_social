# AI features for lowkey_social

## Which AI service
Groq and similar free services all need an API key. Instead we use the built-in Lovable AI service: no key for you to get or paste, it works straight away, and usage is billed to your workspace's AI balance (it includes a free monthly amount). Beat-sync runs fully on the phone with no AI service at all, so it is free and private.

## 1. AI settings (built first)
- New "ai features" section in settings.
- Master switch: "turn off all ai" (hides every AI button when off).
- One switch per feature: caption help, doodle me, chat tldr, local hubs, beat-sync.
- Saved to the user's account, so it follows them across devices.
- Short plain note: "nothing you send to ai is saved or used for training".

## 2. "no-caps" caption & tag assistant
- Magic wand button on the create page, next to the caption box.
- Sends a small preview (photo, or one frame from a video) plus the user's city.
- Returns 3 short lowercase captions and 3–5 hashtags, incl. local ones (#kbh).
- Tap a caption to use it; tap tags to add them. Reroll button.
- Style rules: lowercase, no emojis spam, no cringe, never mentions faces/bodies.

## 3. doodle me (privacy avatar)
- On profile → change photo: "make a doodle of me".
- Takes a selfie or uploaded photo, turns it into a lowkey doodle illustration in the app's yellow/charcoal style.
- Shows 2 options, user picks one, it becomes the profile picture.
- The original selfie is never stored; only the chosen doodle is saved.
- Note: the selfie is sent to the AI service to be drawn — the consent screen says so before it runs.

## 4. chat "tldr"
- In group and class chats with 20+ unread messages, a "tldr" pill appears at the top.
- Gives 3 bullets: plans, homework, anything addressed to you.
- Only reads messages from that chat that the user is allowed to see.
- Summary shown once, not stored.

## 5. smart local hubs (tag clustering)
- Groups similar hashtags into one hub, e.g. #cph #københavn #kbh7thgrade → "kbh".
- Runs in the background once a day (and on demand from admin), not on every open.
- Hubs show on the hashtag page and search as one tappable chip; tapping shows posts from every tag in the hub.
- Hubs stay inside each age band, like everything else.
- Users with local hubs turned off just see normal tags.

## 6. beat-sync assistant
- In the video editor, after picking a song: "snap to beat" button.
- Detects the beats and the drop in the song on the device.
- Shows beat markers on the timeline; trim handles snap to them; option to auto-start the clip on the drop.
- Works offline, no AI service.

## Build order
1. AI settings + switches
2. Caption & tag assistant
3. Chat tldr
4. Beat-sync
5. Doodle me
6. Local hubs
7. Tests + check everything in the preview

## Technical details
- Lovable AI Gateway via `@lovable.dev/ai-gateway`, called only from `createServerFn` handlers with `LOVABLE_API_KEY` (create with lovable_api_key--create). Default text/vision model per the ai-gateway knowledge; image model for doodle me.
- Every server fn: requires auth, checks the user's ai settings server-side, rate-limits per user per day, returns 402/429 as friendly messages.
- Migration: `ai_settings` jsonb (or columns) on profiles with defaults on; `tag_hubs` (id, band, name) + `tag_hub_members` (hub_id, tag) with GRANTs + RLS scoped to age band; hub job writes via service role.
- Captions: structured output (tool calling) → `{captions: string[3], tags: string[]}`; video frame grabbed client-side via canvas.
- tldr: server fn loads the last N unread messages with the user's own client (RLS enforces membership), text-only.
- Doodle: image sent as data URL, result uploaded to avatars bucket; source never written to storage.
- Hubs: daily scheduled route under `/api/public/` with secret check, sends top tags per band to the model, upserts hubs; feed tag affinity in `rank.ts` treats hub tags as one.
- Beat-sync: Web Audio decode + spectral-flux onset detection and tempo estimate in a small `beat.ts` module with unit tests on synthetic click tracks.
- Tests: settings gating (off = server refuses), caption output shape/lowercase, beat detection.
