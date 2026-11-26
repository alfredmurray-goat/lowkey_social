# lowkey_social roadmap

## done
- 6 screens + search/settings on a localStorage store mirroring the planned schema
- age band split (under 18 / 18+), streaks, daily limit
- logo, favicon, beta labelling, feedback email (alfredcasper1010@gmail.com)
- free on-device face age check (face-api.js, nothing uploaded) + simulated eID fallback
- supabase-backed store, email + google auth
- long onboarding (identity, interests, vibe, pace, limit, consent)
- privacy notice route + gdpr export/delete in settings
- consent logging for face scan / eid
- likes/comments/follows/bookmarks real + optimistic, /saved, notifications + realtime toasts
- clickable handles -> /u/$handle with follow / follow back / chat
- profile picture upload (private bucket, signed urls), real media uploads
- gdpr cookie notice, favicon, sitemap, robots.txt, json-ld
- big settings page, real instagram data-export import, heic upload fix
- low-vision accessibility (text scale, high contrast, bold), read-aloud screen reader

## in progress (approved plan 2026-09-01)
- moderation & content deletion: delete/edit own posts, delete own comments/messages,
  report posts/comments/profiles, admin inbox at /admin with user_roles + has_role
- photos in DMs (private media bucket, signed urls)
- installable home-screen PWA (manifest + icons, no service worker)
- email notifications (follow/like/comment/dm) with per-user toggles — blocked on email
  domain setup for the project
- status updates on profiles ("what are you doing right now")
- redo create screen + post titles shown on the home feed; remove verified badge on own profile
- daily limit resets at midnight in the user's local timezone (was UTC)
- [bug] "change my limit" from the limit screen does nothing — AppScreen re-blocks /settings

## done (plan 2026-09-29)
- admin dashboard /app/admin, group chats, birthday + face match, google sign-in removed
- rename lowkey_social, near-you (city only), light default, landing at /, app at /app
- mobile input zoom + sideways scroll fixed; push notifications dropped (user decision)
- mobile navigation converted to a flush safe-area dock; chat composer aligned above it
- create/upload experience refreshed with clearer hierarchy and calmer controls

## done (plan 2026-09-30)
- replace create page with full-screen multi-step media studio
- advanced photo editing and multi-clip video editing
- built-in and user-uploaded music with song attribution
- account-synced private upload drafts
- full-screen photo viewer from the home feed

## open
- [done] profile redesign; restored sound on the one old edited video whose original file still exists
- own supabase project instead of managed backend (workspace-admin action, blocked)
- [done] kids-first update (plan 2026-11-26): onboarding v2 + catch-up, city aliases, communities + QR invites + group-to-community conversion, hashtags, admin super posts, PWA opens on /app, uploaded drawing loader with background removed, YouTube-style studio create page, settings overhaul, automatic video subtitles, modern icons & polish

## verified live 2026-11-26 (signed-in browser audit)
- feed, videos, settings, search all render signed-in with zero console errors; admin dashboard
  is role-gated (non-admin bounced to /app) and shows overview/reports/users/feeds/super posts
- community create -> chip in the feed toggle row -> community page with feed/members/qr invite/
  settings; QR renders and "copy invite link" / "reset" are there
- admin super post pins to the top of the feed labelled "from lowkey_social"
- caption #tags are tappable and open /app/tag/$tag
- city alias tests pass (3), typecheck clean
- fixed: create_community / convert_group_to_community / reset_community_invite crashed on
  gen_random_bytes (pgcrypto lives in the extensions schema, functions pin search_path=public),
  so community creation was dead -> migration 0016 uses gen_random_uuid()
- fixed: home-feed captions and the full-screen photo caption were plain text, so #tags were not
  links there -> CaptionText now renders them (also inside the text-post poster card)
- still unverified: installed home-screen PWA launch on a real phone; joining a community with a
  second real account; email notifications (blocked on the email domain)

## backend ownership (open decision)
- user wants their own supabase project + api keys instead of the managed cloud backend
- blocked on me: disconnecting the managed backend is a workspace-admin action (cloud tab -> advanced) and is irreversible; connecting a byo supabase project is done in project settings
- schema is portable: drizzle/migrations/*.sql can be run on any supabase project