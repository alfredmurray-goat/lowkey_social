#  lowkey_social — kids-first update plan

Audience: kids and teens finding people their age nearby. Strict age split stays exactly as it is.

## 1. Onboarding v2 (+ catch-up for existing users)

- New steps: school (optional, free text), class/year (e.g. "7b"), birthday month already captured, favourite emoji/vibe, "how did you hear about us", safety pledge (be kind, no sharing addresses/phone numbers), parent/guardian email (optional, under-18 only). Also only for under 18 
- Every user gets an `onboarding_version`. If an existing user is below the current version, opening /app sends them to a short "a few new questions" screen with only the missing steps, then straight back to the feed.

## 2. Same city, different spelling

- Cities stored as a canonical key plus what the user typed. "København", "Kobenhavn", "KBH", "Copenhagen", "CPH" all become `copenhagen`.
- Built-in alias list for Danish and big European cities (Aarhus/Århus, Odense, Aalborg, Malmö, Stockholm, Oslo, Berlin, London...), plus accent/case/space cleanup for everything else.
- Existing profiles backfilled. "Near you" matches on the canonical key.

## 3. Communities (class feeds)

- A community = a closed group (e.g. your class), same age band only, owner + admins + members.
- Create one from scratch, or turn an existing group chat into one (members carry over, chat stays linked).
- Join by invite: each community has a QR code + link that can be reset; joining still checks the age band.
- Posting: in create you choose "everyone" or a community.
- Feed + videos get a toggle row: all · community 1 · community 2... "All" shuffles normal posts and your community posts together; picking one shows only that community.
- Community page: feed, members, invite QR, settings (rename, emoji, remove members, leave).

## 4. Hashtags

- #tags in captions become tappable; tapping opens a tag page with posts in your band.
- Search gets a tags tab and "trending in your band" chips. Create suggests tags while typing.

## 5. Admin super posts

- Admin can write a "super post" (text, optional image, optional end date) shown pinned at the top of every feed in both bands. Can be unpinned/deleted. Clearly labelled as from lowkey_social.

## 6. Installed app opens on the feed

- Cause found: the app manifest is never linked from the page, and an old hand-written offline file caches every page as the landing page.
- Fix: link the manifest (start at /app), replace the old offline file with a clean-up version that removes itself, and send installed-app launches of / straight to /app when signed in.

## 7. Scribble loader

- One shared loading animation: the scribble from the logo drawn stroke-by-stroke on repeat until loading finishes. Replaces every spinner and "loading…" text. Respects reduce motion (gentle pulse instead).

## 8. Create page v2 (YouTube-studio style)

- Left/top: big preview with timeline below. Right/bottom: tabbed panel — details (title, caption, tags, audience: everyone/community), editing, song, cover/thumbnail picker, visibility, schedule-free "post now".
- Drafts shown as a library grid with thumbnails. Same editor features as now.

## 9. Settings overhaul

- Grouped sections with search: account, profile, privacy & safety, communities, notifications, feed (pace, hide tags, hide reposts), screen time (daily limit, quiet hours, break reminders), accessibility, read aloud, appearance, data & GDPR, blocked/muted users, muted words, about & beta feedback.
- New: muted words, mute accounts, break reminders, who can invite me to communities, who can see my city, language (english/dansk labels).

## 10. Feel-good polish

- Smoother screen transitions, pull-to-refresh, empty states with friendly copy, haptic-style tap feedback, consistent cards and spacing. New icons to feel more now and not 2010

## Technical details

- Migrations: profiles (onboarding_version, school, class_name, guardian_email, city_key, muted_words, break_reminders...), `communities`, `community_members`, `community_invites` (token), posts.community_id, `hashtags` / `post_hashtags` (trigger extracts tags), `super_posts` (admin-only write via has_role, all authenticated read). RLS: community posts readable only by members; band checks on join via security-definer RPC `join_community(token)`; `convert_group_to_community(conv)`.
- City normalization in a shared TS module + SQL function for backfill; unit tests for the alias cases.
- QR generated client-side (`qrcode` package).
- PWA: kill-switch sw.js per PWA skill, manifest + theme link in __root head.
- Build order: 6, 2, 1, 7, 5, 3, 4, 8, 9, 10 — large; will likely span several messages.