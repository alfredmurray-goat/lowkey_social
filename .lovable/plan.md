# Hashtag algorithm, community privacy, and new-style chats / saved / notifications

## 1. Hashtags that actually matter in the feed
Today the feed only bumps posts matching your onboarding interests, then sorts newest first. Hashtags have no effect.

New "for you" mix for both the home feed and short videos:
- **Your tag taste**: every like, comment, bookmark and longer video watch adds weight to that post's hashtags for you (remembered on your device, slowly fades over time).
- **Trending tags**: tags used a lot in your age band in the last few days get a boost.
- **Interests**: onboarding interests still count, and also match hashtags (e.g. interest "gaming" matches #gaming).
- **Freshness + who you follow**: newer posts and people you follow score higher.
- **Variety**: no more than 2 posts in a row from the same person or same tag.
- **Reshuffle on every app open**: a new random seed each time the app is opened, so the order changes every visit but stays stable while you scroll (no jumping around).
- Hashtags on posts and shorts get a nicer look: rounded yellow chips under the caption, tappable to the tag page. The tag page also gets a "trending" row.

## 2. Community posts only for members
- Posts made to a community are visible only to that community's members, in both the community feed and the "all" feed. Non-members never see them anywhere (search, tag pages, videos, profiles).
- This is enforced in the database, not just hidden on screen, so non-members can't load them at all (the post, its photo/video, likes and comments).
- Community posts are removed from profile pages (yours and other people's) — they only live inside the community.

## 3. Top bar icons match the bottom nav
- Saved, notifications and search icons use the same chunky style as the bottom nav: same icon size and line weight, same rounded yellow highlight shape when active, and the same badge style for unread notifications.

## 4. New chat experience
- **Fix group settings**: the settings sheet opens reliably, sits above the bottom nav and message bar, and scrolls inside itself.
- **Fix scrolling in every chat**: the conversation scrolls in its own area between the header and the message bar, opens at the newest message, and the keyboard doesn't push things around on mobile.
- **New design** in the bottom-nav style: rounded header card with avatar/group emoji and streak pill, chunky yellow bubbles for your messages and soft cards for theirs, grouped by day with small date pills, a rounded pill message bar with photo + send buttons, and a cleaner group settings sheet (name & emoji, members, add people, turn into community, leave).

## 5. New saved (bookmarks) page
- Grid of saved posts and videos with a toggle (all / posts / videos), rounded cards, tap to open, quick unsave button, friendly empty state.

## 6. New notifications page
- Grouped into "today", "this week", "earlier", with chunky icon badges per type (follow, like, comment), rounded cards, unread highlight, and a yellow pill "follow back" button.

## Technical details
- Ranking lives in a pure function in `src/lib/lowkey/rank.ts` (score = tag affinity + trending + interest + follow + recency + seeded jitter, then a diversity pass). Seed generated once per app load (module-level). Tag affinity stored in localStorage, updated from like/comment/bookmark/watch actions in the store. `useBandPosts` uses it; videos page too. Unit tests in `rank.test.ts` for: same seed = same order, different seed = different order, diversity cap of 2, liked-tag posts rank higher.
- Migration: replace the posts SELECT policy so `community_id IS NULL OR is_community_member(community_id, auth.uid())`; mirror in likes/comments/post_hashtags reads and the media storage read rule.
- Profiles filter `communityId == null`.
- Chat: header + message list + composer in a full-height flex column with the list as the only scroller (`min-h-0 overflow-y-auto`, `dvh`); group sheet raised above dock z-index and portalled.
