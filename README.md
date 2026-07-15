# Siterifty — Next.js migration

> **Stack: Next.js 15 + React 19.** This project targets Next.js 15 (not 14) —
> upgraded deliberately for SEO and because `fetch()` is no longer cached by
> default in Server Components/Route Handlers (opt IN with `cache: 'force-cache'`
> when you want caching, instead of opting out). If you're an AI picking this
> project up, do not scaffold or suggest Next.js 14 patterns/APIs. `params`/
> `searchParams` in Server Components are async (`Promise`-based) in this
> version — await them, don't destructure synchronously. Client-side
> `fetch()` calls in `"use client"` hooks (all current data fetching in this
> repo) are unaffected by either version's caching default.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000

**4 env vars get login/signup working** — the public Firebase client config
is hardcoded directly in `lib/firebase.ts` since those values aren't secret
(they're visible in any browser's dev tools on a live Firebase web app
regardless). These 4 are the Firebase Admin SDK credentials, used
server-side by every ported API route:

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
ADMIN_EMAIL=
```

**Beyond these 4**, Step 7 ported several more API routes (paypal, deal,
push, webhooks, aistudio) that each need their own secrets (PayPal API
keys, VAPID keys, webhook signing secret, cron secret, AI provider keys,
etc.) before *those specific features* work — see Step 7's changelog
entry below for the full list. None of those are required just to run
the app or to sign in; each one only matters once you're exercising the
specific feature that needs it (e.g. `PAYPAL_CLIENT_SECRET` only matters
once something calls `/api/paypal`).

These are the same values your old Vercel deployment already has set —
copy them from Vercel dashboard → your project → Settings → Environment Variables.
Keep the `\n` escapes in `FIREBASE_PRIVATE_KEY` literal (don't convert to
real newlines) — the code converts them at runtime.

Without these 4 set, the site will build and load fine, but login/signup
(anything touching `app/api/account`) will fail until they're added.

If `npm run dev` throws any error, copy the full error message back to Claude —
this scaffold was hand-written (no network access in the build sandbox to run
`npm install` and verify), so there may be a small mismatch to fix on first run.

## What's done

**Step 1 — scaffold:**
- Next.js 15, App Router, TypeScript
- `app/globals.css` — your full `styles/siterifty.css` copied in unchanged
- Layout shell as real components (Header, NavDrawer, BottomNav, AnnouncementBar)
- `lib/firebase.ts` — Firebase client init as a real module, replacing `window.__db`
- Real routes replacing the old `vercel.json` rewrites (placeholder content):
  `/marketplace`, `/settings`, `/myprofile`, `/profile`, `/sellers`, `/messages`,
  `/messages/deal/[id]`, `/messages/group/[id]`, `/aiagent`, `/leaderboard`, `/sell`,
  `/seller/[id]`, `/listing/[id]`

**Step 2 — Auth modal (this step):**
- `lib/AuthContext.tsx` — replaces `window.__fbUser` / `window.__authReady` /
  `__syncUserSession` with real React state (`useAuth()` hook), backed by
  `onAuthStateChanged` + a live Firestore `onSnapshot` on `users/{uid}`
  (upgraded from the old one-time `getDoc`, so wallet balance/plan update live)
- `lib/authActions.ts` — replaces `window.__doLogin` / `__doSignup` / `__doGoogle` /
  `__doGithub` / `__doForgot` / `__doLogout` as plain importable functions
- `components/auth/AuthModal.tsx` — full login/signup UI (email+password,
  Google, GitHub, forgot password, username validation, avatar picker),
  same markup/styling as the original, driven by React state instead of
  `getElementById`
- `components/auth/AuthModalProvider.tsx` — lets any component open the
  modal via `useAuthModal().openAuthModal()`
- `app/api/account/route.ts` + `_handler.js` — your original `api/account.js`
  copied byte-for-byte (all 6 actions: ensureAccount, amIAdmin, setPrivacy,
  revokeApiKey, notifyOnRestore, submitAppeal) with a thin adapter so it runs
  under Next.js's route handler signature. Account creation still happens
  server-side only, exactly as the original comments require — the client
  can never set its own `walletBalance`/`plan`.
- Header and NavDrawer now show real logged-in/out state, real avatar,
  wallet balance, and plan; login button opens the modal; logout button works

**Step 3 — Marketplace grid (this step):**
- `app/api/_lib/limits.js`, `app/api/_lib/storage.js` — copied from the
  original `api/limits.js` / `api/storage.js` unchanged, shared by any
  route that needs them (currently just listings)
- `app/api/listings/_handler.js` + `route.ts` — your original
  `api/listings.js` ported the same way as `account` (byte-for-byte copy,
  only its two relative imports repointed to `_lib/`; adapter translates
  Vercel's `(req,res)` shape to a Next.js route handler). Only `POST` is
  wired since the original API is POST-only even for reads (action-based
  dispatch: `listing.feed`, `.mine`, `.create`, etc. — see that file's
  top-of-file comment block for the full list). Only `listing.feed` has a
  client caller wired up so far.
- `lib/listings.ts` — `Listing` type (superset covering website/app/game
  fields, since the feed returns raw Firestore docs), `fetchFeed()`,
  `trackListing()` (impression/view beacon), and formatting helpers
  (`fmtPrice`, `fmtFinVal`, `isBoosted`, `isPremiumSeller`) ported from
  marketplace.js
- `lib/useFeed.ts` — React hook wrapping `fetchFeed`, handling the
  seed/cursor pagination contract (seed generated server-side on first
  call, echoed back verbatim on every subsequent page/reset)
- `lib/useSeller.ts` — **lightweight** seller lookup (username/profilePic/
  rating only, single `getDoc`) for the card strip. Deliberately NOT a
  port of `mpGetSeller`, which also fetches the seller's listings,
  follower count, and lifetime deals for the full profile popup — that's
  heavier and belongs to a future "seller profile modal" step
- `components/marketplace/`: `Stars`, `SellerStrip`, `SaveButton` (direct
  Firestore writes, optimistic UI + revert-on-failure, same as
  `mpToggleSave`), `SiteCard`, `AppCard`, `GameCard` (all three ported
  1:1 from `mpRenderCard`'s three template branches), `ListingCard`
  (type dispatcher)
- `components/marketplace/MarketplaceGrid.tsx` — real grid wired to
  `useFeed`, with loading/empty/error states matching the original's
  `mp-state` markup, and an `IntersectionObserver`-based infinite scroll
  sentinel (`rootMargin: '200px'`, same as `_setupSentinel`). Clicking a
  card opens a bare placeholder modal (not the real listing detail/seller
  modals yet) just so the click wiring is visibly testable. (Originally
  written directly in `app/marketplace/page.tsx`; extracted into this
  shared component in Step 4 below so both `/` and `/marketplace` can
  render it — see Step 4 for why.)
- Trust badges (`sellerBadgesHtml` — verified checkmarks, deal-tier badge)
  are NOT shown on cards yet since they need the heavier seller data
  `useSeller` deliberately doesn't fetch. `_srBadgeCluster` (boosted-listing
  badge) was confirmed a genuine no-op in the original source (its own
  comment says "Badges disabled — CSS missing, causes layout breakage") so
  it was not ported at all, not even as a stub.

**Step 4 — Hero section + homepage layout fix:**
- `components/home/Hero.tsx` — ports the `.hero` section 1:1 (eyebrow,
  title, description, two CTAs). Both CTAs are auth-gated exactly like
  the original's `__requireAuth` in `auth-modal.js`: signed-out visitors
  get the auth modal instead of navigating; signed-in visitors go to
  `/sell` (Start Selling) or `/marketplace` (Browse Marketplace) via
  `next/navigation`'s router.
- `components/home/CreditsTicker.tsx` — the auto-scrolling "credits" strip
  under the hero CTAs (founder/mission/etc. one-liners), ported from
  `announcement-settings.js`'s `initCredits()` — same
  `requestAnimationFrame` loop, same seamless-loop-via-doubled-list trick,
  same resize-based remeasuring of the ticker's clipping window against
  the CTA row's position.
- **Layout fix while wiring this in:** the original site renders the hero
  and the marketplace grid on the *same page* (`index.html` has
  `<section class="hero">` immediately followed by `#marketplaceOverlay`,
  inline, not on separate routes) — this wasn't reflected in the Next.js
  version yet. Extracted the grid out of `app/marketplace/page.tsx` into
  `components/marketplace/MarketplaceGrid.tsx` so it can render in two
  places without duplicating code: the homepage (`app/page.tsx`, now
  `<Hero /><MarketplaceGrid />`) and the standalone `/marketplace` route
  (kept as its own linkable page for share links/SEO/nav). The grid
  component itself carries no top margin; each page that renders it
  controls its own top spacing (`/marketplace` adds `marginTop: 92` since
  there's no hero above it there; the homepage doesn't need to, since
  `.hero`'s own CSS already has `margin-top: 92px` built in).
- `.hero-bg`'s background image is a placeholder Amazon CDN URL that was
  already in the original CSS — not changed, but worth swapping for a
  real hosted asset before launch.

**Step 5 — Settings sidebar + first 3 panels:**
- `lib/useSettingsState.ts` — `SettingsState` type (same fields as the
  original's module-scope `state` object in `support-modals.js`, now
  React state instead of a mutable global) + `useSettingsState()` hook,
  porting `loadStateFromFirebase()`: reads `users/{uid}`, resolves
  `apiKeyIds` against the `apiKeys` collection, and applies font-size/
  compact-mode to `<body>` on load exactly like the original (these are
  document-wide effects, not scoped to the settings page). Sessions are
  intentionally NOT loaded here — ported the original's own comment that
  they're fetched lazily only when the Sessions panel opens.
- `lib/useToast.ts` — ports the `toast()` helper (bottom-center pill,
  fade-in-up, 2s display + 0.4s fade) as a hook + `<ToastHost/>` component
  instead of a raw DOM-append function. Added its keyframe to
  `globals.css` (renamed `fadeInUp` → `srf-toast-fade-in-up` to avoid any
  future name collision in that 8000+ line stylesheet — original didn't
  have that class name reserved anywhere else, this was just caution).
- `components/settings/SettingsSidebar.tsx` — the actual sidebar nav: all
  5 sections, all 14 items in original order, both badges (Security "2",
  Referrals "New"), active-state switching. Footer has two real behaviors:
  **Sign Out** is fully wired (confirm modal → `signOut(auth)` → hard
  redirect home, porting `__logoutWithConfirm`/`__doLogout` exactly,
  including the hard `window.location.href` reload rather than client-side
  nav, so no stale in-memory session data lingers). **Raise a Dispute**
  is a placeholder callback — the real flow needs a deal-picker modal and
  `/api/deal`'s `escrow-dispute` action, neither of which exist yet
  (see `misc-modals.js`'s `_loadDeals`); wired as a prop so the parent
  page controls what "not built yet" looks like, rather than a silent
  no-op.
- Three real panels in `components/settings/panels/`:
  - **`AccountPanel.tsx`** — avatar upload (Imgur, using the *same*
    Client-ID `support-modals.js` itself used — note the original
    codebase actually has two different Imgur Client-IDs across different
    files, a pre-existing inconsistency, not something introduced here),
    display name / username / timezone save with the same client-side
    username validation + direct-Firestore uniqueness check as the
    original. Email field is intentionally left editable-but-functionally-
    inert, matching the original exactly — `saveAccountBtn` never reads
    it; real email changes would need Firebase Auth's `updateEmail()` +
    verification, which the original never implemented either.
  - **`SecurityPanel.tsx`** — real password change via
    `reauthenticateWithCredential` + `updatePassword`, with the same
    error-code-specific messages as the original. 2FA and Login Alerts
    toggles auto-save to Firestore on change, no separate save button,
    matching the original.
  - **`NotificationsPanel.tsx`** — four toggles instant-save to
    `notificationPrefs.<key>`, plus a batch "Save Notification Settings"
    button that writes all five at once (redundant with the toggles, but
    that's how the original works too — both paths hit the same field).
    Push toggle is the one place this deliberately **degrades** from the
    original: subscribing needs a registered service worker + the real
    VAPID key (`core-early.js` has it: `window.__VAPID_PUBLIC_KEY`, not
    yet ported anywhere) + `/api/push/subscribe` (not yet ported either).
    Rather than silently pretending to subscribe, the toggle checks for
    an existing service worker registration and tells the user plainly if
    push isn't wired up yet, while still saving the Firestore preference
    flag either way — same as what the original does when the enable
    path fails partway through.
- `app/settings/page.tsx` — real page (not the original's full-screen
  modal-over-everything — this app uses dedicated routes, matching the
  pattern already established for `/marketplace` etc.) wiring sidebar +
  the three built panels; the other 11 panels show a specific "not built
  yet" message per panel rather than a generic placeholder.

**Step 6 — Listing detail page, App type only (Layer A):**
- Scoped explicitly with the user before building: `mpOpenModal` is ~690
  lines covering 3 listing types plus several sub-features (ad-gated
  preview/play buttons, game fullscreen runner, seller reveals/reviews,
  lightbox, SEO). Agreed to build one type at a time, and within each
  type to build the static layout with real data first ("Layer A"),
  deferring the heavier interactive sub-features to follow-up passes
  ("Layer B" — see the list below).
- `app/listing/[id]/page.tsx` is now a real page, not a placeholder. On
  mount it fetches the full listing doc directly from Firestore by id
  (`lib/listings.ts`'s new `fetchListingById`) and shows
  `ListingDetailSkeleton` (built from the existing `.skel-block`/
  `mp-skel-shimmer` shimmer classes already in `globals.css` — the same
  ones the marketplace grid's own card skeleton uses) while that load is
  in flight. **Deliberately no in-memory "seed" shortcut** — even though
  a card click already has the full listing object in memory, the page
  always re-fetches from Firestore as the single source of truth and
  shows the shimmer during that fetch, rather than trying to instant-paint
  from whatever the previous page happened to have and risk it going
  stale or inconsistent with what's actually saved. This matches how the
  original itself always treats Firestore as the source of truth for a
  detail view. `MarketplaceGrid`'s card `onClick` now calls
  `router.push('/listing/'+id)` instead of the old placeholder modal.
- `lib/listings.ts`: `Listing` type extended with the fields the app body
  needs that the feed-only version didn't have yet — `settings`,
  `platforms` (typed), `apkIpaFileName`/`apkFileName`, `additionalFiles`,
  `notLive`/`notLiveBuildFiles`, `attachedRepo`. Added `fetchListingById`
  (a plain Firestore `getDoc` against the `listings` collection — same
  collection every other part of this app already reads from).
- `components/listing/`: new shared pieces used by the app body and
  reusable for website/game bodies later — `FinancialsBlock` (ports the
  shared `finHtml`), `SellerBlock` (ports the seller-row portion of
  `sellerHtml`, deliberately using the same lightweight `useSeller` hook
  cards already use rather than the full `mpGetSeller` — same deferral
  `SellerStrip` already established, so no trust-badge cluster yet),
  `TransferMethodsBlock` (ports `_buildTransferMethodsHtml`, full 24-entry
  icon+label table), `AttachedRepoBlock` (ports `_buildAttachedRepoHtml`),
  `DescriptionBlock` (ports the read-more truncation — `WORD_LIMIT`
  hardcoded to 50, the same fallback value the original itself falls back
  to when `window.__limits` isn't loaded, since `/api/limits` isn't wired
  into a client global here yet), `ListingDetailSkeleton`.
- `components/listing/AppListingBody.tsx` — the actual app-type body,
  ported from the `type === 'app'` branch of `mpOpenModal`: hero with
  icon badge + platform pills, screenshot gallery, description, app-store
  links, build-file download list (handles both direct `url` files and
  `storagePath` files that need `listing.file-url` signing at click time,
  same as `window.__downloadListingBuildFile`), tech stack grid,
  financials, app details grid, attached repo, transfer methods, seller.
- **Layer B — explicitly deferred, not built this pass:** ad-gated
  interstitial before store links / preview open (`mpShowAdThenAction` —
  store links and the demo-preview toggle just act immediately here
  instead); seller reveals/reviews sub-list (separate Firestore query,
  own loading/empty/error states); lightbox for cover/gallery images;
  "View Seller" click → seller profile page (page itself doesn't exist
  yet either); dynamic per-listing SEO (`__seo.applyListing` — will be
  re-approached via Next's native `generateMetadata` rather than ported
  verbatim, since that's the idiomatic equivalent in this framework).
  Website and game type bodies were not built in this step — Website
  was ported in Step 8; the page still shows a "not built yet" message
  for game only.

**Step 7 — Remaining API routes:**
- Ported every remaining main-site `/api/*.js` using the same adapter
  pattern as `account`/`listings`: `aistudio`, `deal`, `objectives`,
  `paypal`, `push` (as `/api/push/[...slug]`), `webhooks`. Skipped `admin`
  and `edit-file` — confirmed by grepping every `Js/*.js` file that
  neither is ever called from the main site; `admin` only serves
  `admin.html`/`tools/admin` (explicitly out of scope per the ground
  rules) and `edit-file` only serves `tools/github` (a separate internal
  tool, same category as admin.html). Left both untouched rather than
  guessing they might be needed.
- **Extracted the adapter shim into `app/api/_lib/legacyAdapter.ts`**
  (`runLegacyHandler`), refactoring `account`/`listings`'s route.ts to
  use it too, since duplicating the same ~50-line shim across 8 routes
  would just invite drift. Behavior is identical to what those two had
  before. The shared version also now forwards **real request headers**
  and supports `res.end()`/`res.setHeader()`, neither of which
  `account.js`/`listings.js` ever needed but several of these new ones
  do: `deal.js` reads `req.headers.authorization` for its two Vercel Cron
  endpoints (`sweep-expired-deals`, `agent-sweep` — both GET, gated by a
  shared `CRON_SECRET`) and `req.headers.cookie` for the `admin_session`
  gate on dispute-resolution actions; `paypal.js` reads
  `req.headers['paypal-transmission-id']` to detect webhook calls before
  its normal POST/action dispatch, and also reads `req.headers.cookie`
  for the same admin gate on payout approve/reject.
- **Shared-dependency files copied into `_lib/` instead of duplicated**:
  `push.js` and `webhooks.js` are both an HTTP endpoint AND a module
  `deal.js` imports from (`sendPushToUser`, `dispatchWebhook`) — same
  situation `limits.js`/`storage.js` were already in. Canonical copies
  live in `_lib/push.js` and `_lib/webhooks.js`; each route's
  `_handler.js` is either the real file (`push`'s catch-all imports
  `_lib/push.js` directly) or a one-line re-export (`webhooks/_handler.js`
  → `export { default } from '../_lib/webhooks.js'`) — either way there's
  only one real copy of each, so `deal.js` and the HTTP route can never
  drift apart.
- **`/api/push` is a catch-all route** (`app/api/push/[...slug]/route.ts`),
  not a plain route — the original routes `/api/push/subscribe` and
  `/api/push/unsubscribe` by checking `req.url`'s suffix inside one
  Vercel function (see that file's own "same convention github.js uses"
  comment) rather than being two separate files. The shared adapter
  forwards the real request pathname as `req.url`, so that suffix check
  keeps working unmodified.
- Relative imports repointed (same mechanical fix as `listings.js`
  already had): `paypal.js`'s `./limits.js` → `../_lib/limits.js`;
  `deal.js`'s four imports (`storage.js`, `limits.js`, `push.js`,
  `webhooks.js`) → their `../_lib/` equivalents. `aistudio.js` and
  `objectives.js` had no relative imports to fix (only the
  `firebase-admin` package). Every internal action/business-logic line
  is otherwise byte-for-byte unchanged from the original.
- **Env vars this adds**, beyond the 4 already documented above (grepped
  every newly-ported file for `process.env.*`) — none of these existed in
  the app before this step, so none currently have a value:
  `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`,
  `VAPID_PUBLIC_KEY`, `VAPID_SECRET`, `VAPID_SUBJECT`,
  `WEBHOOK_SIGNING_SECRET`, `CRON_SECRET`, `AUTOSEND_CRON_SECRET`,
  `SESSION_SECRET`, `AISTUDIO_INTERNAL_TOKEN`, `GEMINI_API_KEY`,
  `GROQ_API_KEY`, `RESEND_API_KEY`, `DEAL_EMAIL_FROM`,
  `PUBLIC_BASE_URL`/`NEXT_PUBLIC_SITE_URL`/`VERCEL_URL` (base-URL fields
  used for building links in emails/webhooks — check which of these
  three each file actually reads before assuming one covers all of them).
  All of these are the same values your old Vercel deployment already
  has set — copy them the same way as the original 4.
- **Not covered by this step**: none of these routes have client callers
  wired up yet except `listing.feed`/`listing.view`/`listing.file-url`
  (from earlier steps) — e.g. the Settings panels that will eventually
  call `paypal`/`push`/`webhooks` (Payment Methods, Notifications' push
  toggle, Webhooks panel) still need their client-side fetch calls
  written in a later step; this step only makes the server routes exist
  and work.

**Step 8 — Listing detail page, Website type (Layer A):**
- `components/listing/WebsiteListingBody.tsx` — ported from the
  `type === 'website'` branch of `mpOpenModal` (marketplace.js
  ~line 1774), same Layer A scope already agreed for the App type in
  Step 6: static layout with real data, heavier interactive
  sub-features deferred. Section order matches the original exactly:
  hero → gallery (images[0]/[1] as portrait shots, images[3] as a wide
  shot — index 2 is reserved for the hero/cover, same as the original)
  → description+URL row → tech stack → financials → business details
  (category/site age/location/structure/reason for selling) → attached
  repo → transfer methods → seller.
- Reuses the same shared blocks `AppListingBody` already established
  (`FinancialsBlock`, `SellerBlock`, `TransferMethodsBlock`,
  `AttachedRepoBlock`, `DescriptionBlock`) — no new shared
  infrastructure needed, only the type-specific hero/fields.
- `lib/listings.ts`: added `location` to `ListingSettings` — it's a
  website-only field the app type never uses, so the feed/app-body
  work in Steps 3/6 hadn't needed it yet.
- **Layer B deferral, consistent with Step 6's precedent for the App
  type**: the original wires the "Preview" button through
  `mpShowAdThenAction` (ad-gated interstitial) before opening an
  in-page preview iframe via `mpOpenPreview`. This port opens the URL
  directly in a new tab instead — same simplification already applied
  to `AppListingBody`'s store links and demo-preview toggle, not a new
  deviation. Lightbox for cover/gallery images and per-listing SEO are
  still deferred site-wide (see Step 6's Layer B list).
- `app/listing/[id]/page.tsx` now dispatches on type for both `app`
  and `website`; only `game` still shows the "not built yet" message.

**Step 9 — Listing detail page, Game type (Layer A) — all 3 types now done:**
- `components/listing/GameListingBody.tsx` — ported from the
  `type === 'game'` branch of `mpOpenModal` (marketplace.js ~line
  2026). Same Layer A scope as Website/App: static layout with real
  data. Section order: title/description + "View Game" external link →
  Launch Game → game details (platform/genre/game age/structure/
  delivery method/reason) → financials → attached repo → transfer
  methods → seller. Reuses the same `platform`/`genre` field mapping
  the original uses (`tech.frontend`/`tech.backend`, repurposed from
  their website/app meaning) and the same hero-image mapping
  (`images[2]` landscape as hero, `images[0]`/`[1]` portraits as the
  gallery strip).
- **Layer B deferral, same pattern as Website/App**: the original
  wires "Launch Game" through `mpShowAdThenAction` into
  `mpOpenGameFullscreen` — a full-screen runner that fetches/unzips
  browser-upload builds or embeds the external link in an iframe, with
  its own ad-countdown gate. That's a substantially heavier
  sub-feature (same category as the lightbox and per-listing SEO), so
  this port opens the game URL directly in a new tab instead, matching
  the same simplification already applied to the other two types'
  preview/store-link buttons.
- `app/listing/[id]/page.tsx` now dispatches all three listing types
  to a real body; the fallback branch only catches an unexpected/
  corrupt `type` value on the Firestore doc, not "not built yet".

**Step 10 — Settings panels: Appearance + Privacy & Data:**
- `components/settings/panels/AppearancePanel.tsx` — ported from
  `support-modals.js`'s `renderAppearance()` + its `case 'appearance':`
  handler block. Theme picker is a placeholder button (real theme-picker
  modal is a separate future feature, same as other unbuilt sub-features
  elsewhere in this port) toasting "isn't built yet" instead of a silent
  no-op. Font size 3-way picker applies instantly (CSS var + `body`
  font-size + `localStorage` fallback) and saves to Firestore on click,
  matching the original's instant-apply behavior. Compact mode toggle
  also applies its class instantly. Save button persists both
  `fontSize`+`compactMode` together, same redundant-but-faithful pattern
  as the original (instant-apply AND an explicit save button both write
  the same fields).
- `components/settings/panels/PrivacyPanel.tsx` — ported from
  `renderPrivacy()` + its `case 'privacy':` handler. Profile visibility
  select (public/members/private), with "Private" disabled unless
  `state.plan !== 'free'` — mirrors the original's client-side guard,
  which is explicitly a UX nicety only; real enforcement is server-side
  in `/api/account`'s `setPrivacy` action (already ported, Step 2) via a
  fresh plan check on write, exactly as the original comment says the
  client-only check alone left a devtools-exploitable gap. Show
  email/show social/data collection toggles. Save button posts to
  `/api/account?action=setPrivacy`.
- Both wired into `app/settings/page.tsx`'s panel switch. Settings is now
  5 of 14 panels built (Account, Security, Notifications, Appearance,
  Privacy & Data); 9 remain: Billing & Plans, Payment Methods, API &
  Integrations, Webhooks, Active Sessions, Referrals, Listing Analytics,
  Seller Badge, Danger Zone.
- No new state fields needed — `useSettingsState.ts` already had
  `fontSize`/`compactMode`/`theme` and `profileVisibility`/`showEmail`/
  `showSocial`/`dataCollection` from Step 5's original scaffold.

**Step 11 — Settings panels: Billing & Plans + Payment Methods:**
- `components/settings/panels/BillingPanel.tsx` — ported from
  `support-modals.js`'s `renderBilling()` + its `case 'billing':` handler.
  Current-plan card, Cancel Subscription (only shown for paid plans) with
  a danger-themed confirm dialog before calling `/api/paypal` with
  `action: 'cancel-sub'` (route already ported server-side, Step 7), and
  upgrade cards for the other 3 plans.
  - **Flagged simplification**: the original's plan pricing/fee/description
    data normally comes from `window.__limits.plans`, populated by a
    `fetch('/api/limits')` call in `core-early.js`. `/api/limits` itself
    is not ported in this app yet — only its shared `_lib/limits.js`
    helper was copied (Step 3). This panel uses the same hardcoded
    fallback values `renderBilling()` itself falls back to when
    `__limits` hasn't loaded (`free`/`starter`/`growth`/`pro` prices,
    colors, fees, descriptions) — not new numbers invented for this port.
    Porting `/api/limits` as a real GET route is still open (add to task
    list if plan data ever needs to be dynamic here).
  - Upgrade buttons are a placeholder toast, same pattern as
    AppearancePanel's theme picker — the original wires `data-paypal-plan`
    buttons through a separate standalone Plans modal
    (`window.__openPlansModal`) via document-level delegation, not
    through this panel's own handler, so that modal is out of scope here.
  - No shared confirm-modal system exists in this port yet, so the cancel
    confirmation follows the same lightweight inline-overlay pattern
    already used for the Sign Out confirm in `SettingsSidebar.tsx`
    (Step 5), rather than porting `window.srfModal.confirm` as a new
    generic component.
- `components/settings/panels/PaymentsPanel.tsx` — ported from
  `renderPayments()` + its `case 'payments':` handler. PayPal-connected
  info card (shown when `paypalEmail` is already set), editable email
  input with the same `@`-contains validation, save button writing
  directly to Firestore. Credit/debit card section ported as a disabled
  "COMING SOON" placeholder, exactly as the original — not a gap in this
  port, the original never built that path either.
- Both wired into `app/settings/page.tsx`'s panel switch. Settings is now
  7 of 14 panels built (Account, Security, Notifications, Appearance,
  Privacy & Data, Billing & Plans, Payment Methods); 7 remain: API &
  Integrations, Webhooks, Active Sessions, Referrals, Listing Analytics,
  Seller Badge, Danger Zone.
- No new state fields needed — `useSettingsState.ts` already had `plan`
  and `paypalEmail` from Step 5's original scaffold.

**Step 12 — Settings panels: API & Integrations + Webhooks + Active Sessions (10 of 14 done):**
- `components/settings/panels/ApiPanel.tsx` — ported from
  `support-modals.js`'s `renderAPI()` + its `case 'api':` handler.
  - Key-count badge: `GET /api/deal?action=agent-limits&uid=...`, a
    public read-only lookup (route already ported, Step 7).
  - Generate key: `POST /api/deal` with `agent-check-key-limit` first (no
    key limits hardcoded client-side, matches original), then
    `agent-create-key` if allowed. Limit-reached case shows an inline
    dialog (same pattern as below) instead of proceeding, mirroring
    `window.srfModal.alert`'s danger dialog.
  - Revoke key: `POST /api/account?action=revokeApiKey` (already ported,
    Step 2) — ownership of the key is verified server-side against the
    caller's own token, not trusted from the client, exactly as the
    original comment describes (this used to be a raw client `updateDoc`
    with no ownership check at all before that route existed).
  - Add external key: direct client-side Firestore query against the
    `apiKeys` collection (`where key == ..., active == true`) — ported
    as-is, this is a real Firestore read from the client in the original
    too, not a route this port is missing.
  - No shared confirm-modal system exists yet in this port, so the
    revoke-key confirmation and the key-limit-reached alert both use the
    same lightweight inline-overlay pattern already established for Sign
    Out (`SettingsSidebar`, Step 5) and Cancel Subscription
    (`BillingPanel`, Step 11).
- `components/settings/panels/WebhooksPanel.tsx` — ported from
  `renderWebhooks()` + its `case 'webhooks':` handler, including the
  shared `_apiWebhooks()` caller (ported as a local `apiWebhooks()`
  helper at the top of the file — every action needs a fresh idToken and
  uses the same `{ ok, data }` envelope as `deal.js`/`listings.js`).
  `/api/webhooks` was already ported server-side (Step 7) with all 5
  actions (`webhook.list`/`.add`/`.delete`/`.test`/`.logs`) — this step
  only writes the client calls. Loads webhooks + delivery logs once per
  mount (guarded by `state.webhooksLoaded`, same as the original, so
  switching tabs back and forth doesn't refetch every time; only marks
  loaded on success so a failed load can be retried by revisiting the
  panel rather than being permanently cached as empty).
- `components/settings/panels/SessionsPanel.tsx` — ported from
  `renderSessions()` + its `case 'sessions':` handler. Fetches the
  current device's session doc from `users/{uid}/sessions/{sKey}`, where
  `sKey` comes from `localStorage.getItem('__srSK')`.
  - **Flagged finding, not a gap introduced by this port**: grepped the
    entire original source for `__srSK` — it is only ever *read*
    (`support-modals.js`), never *written* anywhere in the codebase. No
    file sets that localStorage key at login. In practice this means the
    lookup almost always falls through to the userAgent-sniffing
    fallback card (browser/OS/mobile detected from
    `navigator.userAgent`, no `createdAt`/`lastSeen` dates) — which the
    original also does whenever the key is missing, so this port
    reproduces that exact same fallback rather than inventing a
    session-key writer that doesn't exist in the source. If a future
    step finds the missing writer (maybe in a file outside this zip), the
    Firestore-doc path is already wired and will pick it up automatically.
  - `fetchSessions()` in `lib/useSettingsState.ts` (added speculatively
    before this step, per the original handoff notes) turned out to be
    for a *different* original code path (a hypothetical full
    session-list view) than what `renderSessions()` actually does (a
    single-device lookup by key) — this panel does its own direct
    `getDoc` instead, matching the real original function. Left
    `fetchSessions()` in place unused rather than deleting it, in case a
    future multi-session-list feature wants it.
- All three wired into `app/settings/page.tsx`'s panel switch. Settings
  is now 10 of 14 panels built (Account, Security, Notifications,
  Appearance, Privacy & Data, Billing & Plans, Payment Methods, API &
  Integrations, Webhooks, Active Sessions); 4 remain: Referrals, Listing
  Analytics, Seller Badge, Danger Zone.
- No new state fields needed for API/Sessions — `useSettingsState.ts`
  already had `apiKeys`/`externalApiKeys` and `currentSession` from
  Step 5's original scaffold. Webhooks panel writes `webhooks`/
  `webhookLogs`/`webhooksLoaded` into the same state object, also
  already present.

**Step 13 — Settings panels: Referrals + Listing Analytics + Seller Badge + Danger Zone (14 of 14 done — all settings panels complete):**
- `components/settings/panels/ReferralsPanel.tsx` — ported from
  `renderReferrals()` + its `case 'referrals':` handler. Referral link
  is `${origin}/r/${username}` (no dedicated route for this — the
  original builds it client-side too). Copy-link uses
  `navigator.clipboard`, same as source, with the same silent
  fallback toast if the browser blocks it. `referralCount`/
  `referralEarned` are read directly off the user doc via a plain
  `getDoc` — there's no `/api/*` route for referral stats in the
  original, so nothing here was skipped; it's a genuine direct
  Firestore read same as the source. Commission-per-plan table is
  static copy (30% of $15/$30/$60), matching the original's hardcoded
  numbers exactly.
- `components/settings/panels/AnalyticsPanel.tsx` — ported from
  `renderAnalytics()` + its `case 'analytics':` handler. Same
  `getDoc(users/{uid})` read as Referrals, pulling
  `totalListingViews`/`totalOffersReceived`/`totalDealsClosed` and
  computing conversion rate client-side exactly like the original
  (`offers > 0 ? deals/offers*100 : '—'`). Compact-number formatting
  (`1.2k` etc.) ported as its own `fmtCompact()` helper, matching the
  original's inline `>= 1000 ? …+'k' : v` expressions verbatim. No
  per-listing analytics here — the panel's own copy says that lives on
  each listing card, which is out of scope for this step.
- `components/settings/panels/SellerBadgePanel.tsx` — ported from
  `renderSellerBadge()`. Its `case 'sellerbadge':` handler in the
  original is a no-op ("badge data is rendered statically from state
  — no extra listeners needed"), so this panel has no side effects,
  just render logic. **Flagged, not introduced by this port**: only
  the "Verified Seller" badge has real unlock logic (`plan !== 'free'`)
  — the other three (Trusted/Top Rated/Power Seller) are hardcoded
  `unlocked: false` in the original source itself. There's no
  deal-count, rating, or sales-volume check anywhere in the codebase
  for those three; this isn't a simplification, the upstream feature
  is genuinely unfinished. Ported as-is per the "don't silently fix"
  rule rather than inventing unlock logic that doesn't exist.
- `components/settings/panels/DangerZonePanel.tsx` — ported from
  `renderDanger()` + its `case 'danger':` handler. Two real destructive
  flows:
  - **Export All Data**: gathers `users/{uid}` (profile, minus
    `passwordHash`/`token`), `users/{uid}/transactions`, `listings`
    where `ownerUid == uid`, and `apiKeys` where `ownerUid == uid`
    (metadata only — key values themselves are never included, same
    as original), then builds a ZIP client-side with JSZip and
    triggers a browser download. JSZip is lazy-loaded from the exact
    same CDN URL (`cdnjs.cloudflare.com/.../jszip/3.10.1/jszip.min.js`)
    the original uses, only on click — not bundled up front, matching
    the source's on-demand load.
  - **Delete Account**: confirm-toggle gates the delete button (same
    as original), click opens an inline password re-auth prompt
    (styled to match the original's dynamically-injected overlay
    exactly — same copy, same layout), successful re-auth writes
    `{ scheduledDelete: true, deleteAt: Date.now(), deletionConfirmedAt:
    serverTimestamp() }` to the user doc, then calls real Firebase Auth
    `user.delete()`, then reloads the page after a toast — same
    sequence and same Firestore flag shape as the original, nothing
    added or removed from the flow.
- All four wired into `app/settings/page.tsx`'s panel switch.
  **Settings is now complete: all 14 of 14 panels built** (Account,
  Security, Notifications, Appearance, Privacy & Data, Billing &
  Plans, Payment Methods, API & Integrations, Webhooks, Active
  Sessions, Referrals, Listing Analytics, Seller Badge, Danger Zone).
  No panels remain as placeholders.
- No new fields needed in `useSettingsState.ts` — Referrals/Analytics
  read their own `getDoc` directly (matching how Sessions already
  works, since neither original render function pulls from the shared
  `state` object beyond `username`/`plan`, which were already there).

**Step 14 — App boot/splash overlay + post-signup onboarding tour:**
- `components/layout/BootOverlay.tsx` — ports `appBootOverlay` (the
  full-screen loading splash shown on every cold load) from
  `index.html`'s markup + the "BOOT OVERLAY" block in `firebase-init.js`.
  Same behavior as the original: shown immediately, dismissed once
  `AuthContext`'s `loading` flips false (same moment the original's
  `onAuthStateChanged` first fires), then a further **1.5s hold**
  before fading out over **~0.55s** via the existing `.boot-hidden` CSS
  class, then unmounted. An **8s absolute safety-net timer** (ported
  verbatim) guarantees it can never get stuck up if auth stalls. Also
  ports the falling-glitter particle generator (an inline IIFE actually
  living in `maintenance-banned.js`, despite rendering into the boot
  overlay's markup in `index.html` — the original's own file
  organization is a little scattered here, not something this port
  changed) — same 18-particle count, same random spawn/drift/size/
  timing ranges, computed once via `useMemo` so particles don't
  re-randomize on re-render, same as the original's one-time IIFE.
  Mounted as the first child inside `AuthProvider` in `app/layout.tsx`,
  matching its position as the first thing in `<body>` in the original.
  **Not included** (explicitly out of scope for this step, tracked
  separately below): the "Welcome Back" full-screen takeover that the
  original's `__dismissBootOverlay` chains into via
  `window.__welcomeBackPending` — that's still a separate, unbuilt
  feature; this component only owns the boot splash itself.
- `components/onboarding/TourModal.tsx` — ports the 5-step onboarding
  tour (`tourStepData` + `__startTour`/`__updateTourStep`/
  `__nextTourStep`/`__closeTour`) from `auth-modal.js`'s "TOUR
  MANAGEMENT" section. Same 5 steps, same copy, personalized step-1
  title (`Welcome, @username.`). **Flagged, not introduced by this
  port**: the original defines per-step icon data (rocket/coin/
  community/target) and an icon-only rendering branch
  (`showBanner: false`), but all 5 entries in `tourStepData` actually
  set `showBanner: true` — so the icon branch is dead code in the
  live site today. Ported faithfully as unreachable code (the icon SVGs
  and the branch both exist in `TourModal.tsx`) rather than deleting it,
  per the "don't silently fix" rule — if a future edit to the original's
  step data ever flips `showBanner` to `false` for a step, this
  component already renders it correctly.
- Tour trigger wiring in `AuthModal.tsx` + `authActions.ts`: matches the
  original's actual gating exactly, which is **not symmetric between
  email and OAuth signup** — email signup fires the tour
  *unconditionally* after every successful signup (ported as
  `onSignupComplete?.(...)` called with no `isNew` check, mirroring the
  original's plain `setTimeout(() => window.__startTour(...), 300)`
  right in the signup success path), while Google/GitHub only fire it
  when `isNew` is true (an existing user logging back in via OAuth never
  sees it again) — ported via the existing `isNew` flag `loginWithGoogle`/
  `loginWithGithub` already returned. The 300ms delay between modal
  close and tour open is ported verbatim.
- **Correction to a claim in this README from before Step 12**: earlier
  steps assumed a real "OAuth onboarding modal" (`oauthSetupModal`,
  username/avatar setup for new Google/GitHub users) needed building,
  and `AuthModalProvider`'s `onNewOAuthUser` callback was left as an
  intentional no-op pending that. Checking the actual source in this
  step found `window.__openOauthSetup` is **defined but never called
  anywhere** in the original — it's dead code. The real flow
  (`_finishOauthSignup`) auto-derives username (from `displayName`,
  de-duplicated server-side) and profile picture (from the provider's
  `photoURL`) with no user-facing setup step at all, then goes straight
  into the same onboarding tour as email signup. This port already
  matched that real behavior (server-side auto-derivation in
  `ensureAccount`, Step 7) — only the tour trigger itself was actually
  missing, which this step adds. No standalone username/avatar
  "onboarding modal" exists in the original to port, so none was built
  here; item #10 on the outstanding task list is resolved as "already
  correct, nothing further to build" rather than actually needing new
  work.
- `app/api/account/_handler.js`'s `ensureAccount` action now echoes
  `username`/`profilePic` back in its JSON response (both the
  new-account and existing-account branches) — a small additive change,
  not a behavior change, so callers (the tour) can personalize
  immediately without a second Firestore read. This mirrors what the
  original's `_finishOauthSignup` did by re-reading the doc after
  calling `ensureUserDoc`; this port just returns the same data in the
  same round trip since the handler already has the doc in hand,
  instead of making the client fetch it separately.

**Step 15 — Seller profile page (`mpOpenSellerModal` equivalent) — built in full, no Layer A/B split:**
- `lib/useSeller.ts` — added `fetchFullSeller` (ports `mpGetSeller`
  exactly: user doc + active listings capped 20, no `orderBy` to avoid
  needing a composite index, client-sorted instead; follower count via
  `getCountFromServer`; `dealsCompleted` read off the user doc with a
  one-time `/api/deal` `get-seller-stats` fallback for sellers who
  predate that field) and `fetchSellerDealStats` (ports
  `spLoadSellerStats`) alongside the existing lightweight `useSeller`
  hook used by cards — kept separate since the shapes and caching
  needs differ.
- `components/seller/SellerBadges.tsx` — ports `sellerBadgesHtml` +
  `srDealTierFor` exactly: premium-plan lime check, verified check
  (blue via 1k+ followers, gold via Legendary tier), deal-tier badge
  with exact count. Same SVGs, same tier thresholds, same title/
  aria-label text as the original.
- `components/seller/SellerProfileHeader.tsx` — cover (seeded
  `picsum.photos` placeholder — confirmed this is what the original
  does too, not a simplification), avatar, name + badges, bio with
  "Read more" (only shown when the bio actually overflows its 3-line
  clamp, measured via `scrollHeight`), stats row (listings/rating/
  followers/joined), and the full follow/donate/rate/report action
  row.
  - Follow: writes/deletes `users/{seller}/followers/{me}` +
    `users/{me}/following/{seller}` in a pair, optimistic local
    follower-count update, same as the original.
  - Report: writes to `reports`, then fire-and-forget calls
    `/api/aistudio` `triage-report` (matches the original: the report
    is filed regardless of whether triage succeeds). The confirm step
    uses an inline-styled overlay (same convention as the Sign Out
    confirm in `SettingsSidebar.tsx`) instead of the original's global
    `window.srfModal.confirm()`, since that global dialog helper
    hasn't been ported to this app — flagging this as a deliberate
    infra substitution, not a dropped feature.
- `components/seller/RateOverlay.tsx` — ports the star picker + review
  text + Firestore write/transaction from `_openRateOverlay` and its
  submit handler. One review per user per seller (doc id = reviewer's
  own uid). **Matches the original's own inconsistency deliberately**:
  after submit, the stats display shows the just-submitted star value,
  not the recomputed average — that's what `marketplace.js` actually
  does (`spStatRating.textContent = _rateStarVal.toFixed(1)`), so this
  port preserves it rather than "fixing" it to show the true average.
- `components/seller/DonateOverlay.tsx` — ports `spOpenDonateOverlay`:
  amount input with quick-amount buttons, live 15%-fee breakdown
  preview (matches `DONATION_FEE_RATE` in `paypal.js`), note field,
  recent-donations list via `/api/paypal` `get-donations`, submits via
  `/api/paypal` `donate`. Wallet balance check uses
  `profile.walletBalance` from `AuthContext`'s existing live Firestore
  listener — the original's `window.__wallet*` bridge functions exist
  to work around not having that live listener, so this port doesn't
  need them; noted as a simplification of plumbing only, not of
  behavior (the balance check and post-donation balance update both
  still happen, just through the listener that already existed).
- `components/seller/SellerDetailsOverlay.tsx` — ports `spOpenDetailsOverlay`:
  full bio, socials, the exact 5-row buying-safety tips block (escrow,
  history/reviews, verify-before-buy, pressure-tactics warning,
  never-share-credentials warning — same copy as the original), and
  the deal-stats breakdown (lifetime deals/revenue, 7-day revenue,
  per-category bar chart) sourced from `fetchSellerDealStats`.
- `components/seller/SellerListingsGrid.tsx` — ports the listings grid
  + all/website/game/app filter tabs with the original's exact
  per-type empty-state copy (`SP_LISTING_TYPE_META`).
- `app/seller/[id]/page.tsx` — wires it together. Ports the privacy
  gate from `mpOpenSellerModal` exactly: `private` profiles are fully
  hidden (username/handle only) from anyone but the owner; `members`
  profiles are hidden from signed-out visitors. Fires the
  fire-and-forget profile-view beacon to `/api/deal`
  `record-profile-view`, same as the original.
- **"View Seller" links wired up everywhere they previously dead-ended**:
  `components/marketplace/MarketplaceGrid.tsx` (cards' seller row —
  removed the placeholder popup, now navigates to `/seller/[id]`) and
  `components/listing/SellerBlock.tsx` (listing detail page's seller
  row — removed the no-op click handler, same navigation).
- **Deliberately not built in this step** (out of scope for
  `mpOpenSellerModal` itself): the "Seller Reveals" reviews list UI
  (a separate lazy-loaded sub-feature the original defers too — no
  reviews-list render function was found wired to the seller modal;
  only the review *write* path via Rate exists) and trust badges on
  marketplace *cards* (still intentionally using the lightweight
  `useSeller`, per Steps 6-9's existing note — a separate, smaller
  follow-up if wanted).

**Step 16 — Hamburger nav drawer wired up (ports the "── NAV DRAWER ──" and "── PUSH NOTIFICATIONS ──" sections of `auth-modal.js`, plus `__refreshNavListingsCount` from `firebase-init.js`):**
- `components/layout/NavDrawerProvider.tsx` (new) — shared open/close
  state via context, since `Header` (hamburger button) and `NavDrawer`
  are sibling components with no other way to coordinate. Ports
  `openNav`/`closeNav` exactly: locks page scroll while open (simple
  `document.body.style.overflow`, matching how `AuthModal` already
  handles this — no shared scroll-lock utility exists in this app yet,
  so this doesn't invent one), and resets the drawer's scroll position
  to the top on close.
- `components/layout/NavDrawerOverlay.tsx` (new) — the `#navOverlay`
  backdrop, now a small client component (was a static empty div) so
  it can read open state and close on click.
- `components/layout/Header.tsx` — the hamburger button previously had
  no click handler at all (the drawer could never open). Now calls
  `toggleNav()`. The "Profile" pill (shown when logged in) previously
  did nothing on click either — ports the original's `.btn-login`
  handler, which opens the profile modal for a signed-in user; since
  that modal doesn't exist yet, this navigates to `/myprofile` (the
  existing placeholder route) instead, so the click does something
  useful rather than nothing, and starts working fully the moment that
  route is built.
- `lib/useNavListingsCount.ts` (new) — ports
  `__refreshNavListingsCount`: live `getCountFromServer` query,
  refetched fresh every time the drawer opens (bumped via a
  `openCount` key, not cached), same as the original. Keeps the last
  known value on failure rather than showing a fabricated 0 — matches
  the original's own "don't fabricate a number" comment. This
  supersedes the previous placeholder "—" display.
- `components/layout/NavDrawer.tsx` — every button/link now does what
  the original does:
  - **Real routes wired to real navigation**: My Profile card/pill →
    `/myprofile`, Settings → `/settings`, List Now / Start Selling →
    `/sell`, Marketplace → `/marketplace` (yes, gated behind
    `requireAuth` — confirmed that's the original's actual behavior,
    not a bug introduced here).
  - **`requireAuth` guard** ported exactly (`__requireAuth`): runs the
    action if signed in, opens the auth modal otherwise.
  - **Links to pages that don't exist yet** (About, Contact, Help,
    How It Works, Escrow & Payments, Buyer Protection, Terms &
    Privacy) now navigate to their future route paths (`/about`,
    `/contact`, etc.) instead of being inert `href="#"`. They'll 404
    today and start working the moment those pages are built.
  - **Theme picker, wallet top-up, plan upgrade/manage, push
    notifications** — these are substantial features in their own
    right (premium-gated theme grid + Firestore persistence; a
    deposit flow; a plans/billing flow; a full VAPID/service-worker
    subscribe flow — note push specifically is a separate, still-
    unbuilt feature from the Notifications *settings panel*'s own
    push toggle, which also only saves a preference flag right now;
    both need the same underlying service worker + VAPID + `/api/push`
    work) that weren't in scope to silently build as a side effect of
    nav wiring. Each now shows a toast ("… isn't built yet — coming
    soon.") via the existing `useToast` hook instead of doing nothing,
    so the click gives honest feedback rather than looking broken.
  - Wallet balance and plan name/CTA (Upgrade vs. Manage) read live
    from `AuthContext`'s existing `onSnapshot` listener — no manual
    refresh call needed on drawer open, same conclusion as Step 15's
    donate flow.
- `app/layout.tsx` — wraps the app in `NavDrawerProvider` (added
  around the existing `AuthModalProvider`/`BootOverlay` structure from
  Step 14, not replacing it).

**Step 17 — Marketplace grid polish: filter chips, trust badges, boosted row, premium sellers strip, ad slots, promo cards:**
- **Trust badge cluster on cards — confirmed already done, no new work
  needed**: re-checked `_srBadgeCluster` in the original source; its own
  comment says it's disabled ("CSS missing, causes layout breakage") and
  it returns empty markup unconditionally. What actually renders on cards
  is the `sr-boosted`/`sr-premium-shimmer` classes from `_isBoosted`/
  `_isPremiumSeller` — and `SiteCard`/`AppCard`/`GameCard` already apply
  both (built alongside the cards themselves, Step 3). This item is
  closed as already-correct rather than newly built.
- `lib/useMarketplaceFilters.ts` — ports the type/template/price filter
  state and `mpApplyAndRender`'s filter predicate. Type is forwarded into
  `useFeed`'s existing server-side `type` param (same as the original
  passing `mpTypeFilter` into `/api/listings`); template and price stay
  client-side only, matching the original exactly (`handleFeed` has no
  template/price params at all).
- `components/marketplace/MarketplaceFilterBar.tsx` — the chips row (All/
  Websites/Apps/Games), the 3-state template toggle (any → templates
  only → full products, cycling exactly like the original's
  `data-state` cycle), the price popover (dual range slider + exact min/
  max inputs, same `PRICE_CAP` fallback of 10000 the original itself
  falls back to since `/api/limits` isn't wired client-side yet — see
  Step 11's note on this same fallback), and the active-filter-tags row
  with per-tag clear buttons. All markup/CSS classes were already
  present verbatim in `globals.css` from Step 1 — this step only wires
  real state and handlers to them.
- **Search bar/suggestions dropdown was explicitly out of scope for this
  pass** (not part of the "filter chips" polish item) — `mpSearchInput`/
  `mpRenderSuggestions` were not ported here; a future step can add
  client-side search filtering the same way template/price were done.
- `lib/feedInterleave.ts` — ports the ad/promo cadence math
  (`_mpShouldShowSellerPromo`, `_mpShouldShowAiPromo`, `AD_CADENCE`'s
  modulo checks) as a pure function that builds one interleaved array
  of `{listing | ad | seller-promo | ai-promo}` items from a filtered
  listing-id list, since React needs a flat item list to map over
  rather than the original's imperative `frag.appendChild` loop.
- `components/marketplace/AdSlot.tsx` — ports `mpBuildAdCard`. Same two
  ad units (300×250 rect, 320×50 banner), same sandboxed `srcdoc` iframe
  approach so each unit's `atOptions` global stays isolated. These are
  the same live ad-network unit keys/URLs already in the original
  production site, carried over unchanged — not new third-party embeds
  introduced by this port. Flagging this explicitly since it's real
  third-party ad code, not a design decision made in this step.
- `components/marketplace/SellerPromoCard.tsx` / `AiPromoCard.tsx` —
  port `mpBuildSellerPromoCard`/`mpBuildAiPromoCard` verbatim (same
  copy, same images, same cadence via `feedInterleave.ts`). Seller-promo
  CTA reuses the same `requireAuth` pattern already established in
  `Hero.tsx` (Step 4) — signed-in goes to `/sell`, signed-out opens the
  auth modal. AI-promo's CTA is a plain link to `/aitools` (mirroring
  the original's plain `<a href="/pages/aitools">`, no modal wiring) —
  that page doesn't exist yet in this app, same "will 404 until built"
  situation as the nav drawer's static-page links (Step 16).
- `components/marketplace/BoostedRow.tsx` — ports `_mpRenderBoostedRow`.
  Groups currently-boosted listings by type (never mixed, since the
  three card shapes differ structurally), capped at 6 per type, reusing
  `ListingCard` so a boosted card here is pixel-identical to its
  counterpart in the main grid. A type's group only renders if it has
  boosted listings; if none exist across every type, the row renders
  nothing at all (matches the original's `mpBoostedRow.style.display =
  any ? '' : 'none'`).
- `lib/premiumSellers.ts` + `components/marketplace/PremiumSellersStrip.tsx`
  — ports `mpFetchPremiumSellers`/`mpLoadTopSellers`/`mpRenderTopSellers`/
  `mpWireTopSellerFollowBtn`. Server-side filtering (`listing.premium-
  sellers`, a single `planIndex/premium` doc read + per-seller count()
  aggregations) was already ported in Step 7 — this step only adds the
  client caller. Same seed-echo convention as the main feed (stable
  random 5 for the session, not re-rolled on every render). Follow
  button reuses the exact same followers/following doc-pair pattern
  already established in `SellerProfileHeader.tsx` (Step 15), including
  optimistic UI + revert-on-failure. Row click (excluding the follow
  button) navigates to `/seller/[uid]`, same as the original's
  `mpOpenSellerModal` call.
- `MarketplaceGrid.tsx` now composes all of the above: filter bar →
  premium sellers strip → result count → boosted row → main grid (now
  built from `feedInterleave.ts`'s flat item list instead of a plain
  `listings.map`, so ads/promo cards actually appear at the right
  positions in both the homepage and `/marketplace` route, matching the
  original's single shared render path).
- **Not covered by this step**: search bar/suggestions (see above), the
  global unified skeleton loader (`mpGlobalLoader` — the original hides
  one shared shimmer only once both listings AND top sellers have
  settled; this port still shows each section's own independent loading
  state, e.g. the premium strip's skeleton cards vs. the grid's own
  `mpLoading` state, rather than one combined overlay).

**Step 18 — Wallet top-up (deposit) + Plans & Billing upgrade flow:**
- `lib/paypalSdk.ts` — ports `window.__loadPaypalSdk` /
  `window.__paypalNamespaceFor` from `Js/paypal.js`. Both new flows below
  need the PayPal SDK loaded with different, incompatible query configs
  (wallet deposit: `intent=capture`; plan subscriptions:
  `intent=subscription&vault=true`) on the same page — the original's
  namespace trick (only the non-default config gets a `data-namespace`,
  so it doesn't clobber `window.paypal`) is preserved exactly, including
  the same in-flight/resolved promise cache keyed by query string so
  repeated calls with the same suffix don't re-inject the script tag.
- `lib/useWalletSummary.ts` — ports `_walletFetchSummary`/`_walletSummary`
  from `wallet.js`: calls `/api/paypal`'s `wallet-summary` action (ported
  server-side in Step 7) for the escrow-held/escrow-incoming/withdrawable
  breakdown that AuthContext's `users/{uid}` listener deliberately
  doesn't carry (Step 2's own comment: wallet-modal-specific fields).
- `components/wallet/WalletModal.tsx` + `WalletModalProvider.tsx` — ports
  `openWalletModal`/`window.__openWallet` and the **Deposit tab only**
  (Layer A) of the wallet modal: quick-amount buttons, custom amount
  input (same $5–$10,000 validation), 350ms-debounced PayPal Buttons
  (re)mount keyed to the current amount, `create-order`/`capture-order`
  round trip against `/api/paypal`, success/error messaging. Withdraw /
  Send / History / Auto Top-Up / Auto Send are Layer B — this modal shows
  a "coming soon" panel on those tabs rather than omitting them entirely,
  so the tab strip's shape matches the original even though only one tab
  is functional yet. Provider follows `AuthModalProvider`'s exact shape
  (`useWalletModal().openWallet()`), including the same `__requireAuth`-
  equivalent guard (signed-out click opens the auth modal instead).
- `components/billing/PlansModal.tsx` + `PlansModalProvider.tsx` — ports
  `openPlansModal`/`window.__openPlansModal` in full: 3-tab plan picker
  (Starter/Growth/Pro) with the same preselect-or-smart-default logic
  (preselect wins if given; otherwise current paid plan wins; otherwise
  steps up one tier from current, defaulting to Growth), feature
  checklist, "Subscribe" button that reveals the PayPal Buttons container
  on click (same click-must-belong-to-PayPal's-own-render pattern as the
  original, rather than firing checkout from a raw handler),
  `get-plan-id`/`activate-sub` round trip. Plan prices/fees/taglines are
  the same hardcoded fallback values `BillingPanel.tsx` already uses
  (matching `app/api/_lib/limits.js` exactly) — `/api/limits`'s GET route
  isn't client-callable in this app yet, so neither panel fetches it
  live; both are one edit away from doing so once that route exists.
  Subscription success relies on `activate-sub` writing the new plan to
  Firestore server-side + AuthContext's existing `onSnapshot` listener
  picking it up live, rather than a manual `window.__fbUserData` write +
  custom event (`srf:plan-changed`) like the original — same end result,
  fewer moving parts now that plan state is already reactive.
- **Trigger points wired** (all 5 the original had, minus the ones
  routed through DOM delegation that don't apply in React): NavDrawer's
  Wallet "Top Up" button → `openWallet()`; NavDrawer's Plan
  "Upgrade"/"Manage" button → `openPlansModal()`; Header's wallet balance
  pill (`#headerBalance`) → `openWallet()`, matching the original's
  standalone click listener on that element; Settings → Billing panel's
  per-plan "Upgrade" buttons → `openPlansModal(plan)` with that card's
  plan preselected, replacing the placeholder toast Step 11 left there.
  Cancel-subscription flow (Step 11) was already wired to `cancel-sub`
  and needed no changes.
- **Not covered by this step**: Wallet Withdraw/Send/History/Auto Top-Up/
  Auto Send tabs (Layer B, `/api/paypal`'s `withdraw`, `transfer`,
  `lookup-recipient`, `autotopup-*`, `autosend-*`, `autowithdraw-*`
  actions — all ported server-side already, just not called from the UI
  yet); a live `/api/limits` fetch for plan pricing (see above); the
  public marketing-page pricing cards' `.pcard[data-plan]` click wiring
  (that section of the homepage/landing content hasn't been ported at
  all yet, so there's nothing to wire it to).

**Step 19 — Theme picker:**
- `components/theme/ThemeModalProvider.tsx` — ports `__applyTheme`
  (color/gradient/image branches → the same `--app-theme-bg` /
  `--app-theme-color` / `--app-theme-overlay` custom properties the
  original set, read by `#appThemeBg` in `app/globals.css`, unchanged
  since Step 1), `__saveThemeToFirestore` (best-effort `users/{uid}`
  write, never blocks the UI), and the on-load `_restoreTheme` IIFE
  (localStorage → instant apply, no network round trip). Exposes
  `useThemeModal().openThemePicker()` / `closeThemePicker()`, same shape
  as `useWalletModal()` / `usePlansModal()`.
- `components/theme/ThemeModal.tsx` — ports the `.theme-grid` markup
  from `index.html` 1:1: all 12 options in source order (10 premium
  image themes, 1 free image theme "Minimal", 1 free color swatch
  "Black"), premium badge/lock-icon treatment, the "Blocked" state for
  images that fail to load (`onError`), and the upgrade nudge toast
  (`free`-plan users tapping a Pro theme) — same 2.2s-visible timing as
  the original's `setTimeout` pair. Selecting a theme applies + persists
  instantly, no confirm button, matching the original's unified
  `themeGrid` click listener (`__confirmTheme` exists in the original
  only as a second, redundant entry point — same-shape logic, not
  separately ported since nothing in this app's UI calls it).
- `<div id="appThemeBg">` added to `app/layout.tsx` (was missing
  entirely before this step — the CSS targeting it existed since Step 1,
  but nothing rendered the element).
- **Provider nesting note:** `ThemeModalProvider` wraps
  `AuthModalProvider` in `app/layout.tsx` (not nested inside it, unlike
  Wallet/Plans) because `AuthModalProvider`'s tour-finish handler needs
  `useThemeModal()` itself, to open the picker right after onboarding —
  same order-of-operations as the original's `__nextTourStep` calling
  `__openThemePicker()` on its last step.
- **Trigger points wired** (all 3 the original had): NavDrawer's
  "Change theme" button (previously a toast placeholder); Settings →
  Appearance panel's "Open Theme Picker" button (previously a toast
  placeholder); onboarding tour's final step, "Get started" (previously
  just closed the tour with a comment marking this as the one line to
  change later).
- **Not covered by this step:** the plan-gating check reads
  `profile.plan` from `AuthContext`, which is correct for enforcing the
  free/paid split, but `AuthContext`'s `users/{uid}` listener still
  doesn't carry a synced `theme` field (Step 2's own comment: only the
  subset the UI needs so far) — so a signed-in user's theme currently
  only round-trips through localStorage on this device, not through the
  live profile listener on a second device/tab. The Firestore write
  happens (`__saveThemeToFirestore` is ported faithfully), so the data
  needed for a future "hydrate initial theme from `profile.theme`
  instead of localStorage-only" fix already exists server-side — it's a
  small follow-up to `AuthContext.tsx`'s `UserProfile` interface + the
  `onSnapshot` mapping, not a new feature.

**Step 20 — Push notifications (subscribe/unsubscribe wiring + server send):**
- `public/sw.js` — the original's service worker copied unchanged
  (install/activate/push/notificationclick handlers). Wasn't present
  anywhere in this app before this step — `app/api/_lib/push.js`
  (server subscribe/unsubscribe/send handler) and `deal.js`'s
  `notifyDeal` calls into `sendPushToUser` were already fully ported
  server-side since Step 7, but nothing served the service worker file
  itself, so no browser could ever have a live subscription yet.
- `lib/push.ts` — the shared client helper both toggles below import:
  `registerServiceWorker()` (cached promise, same one-registration-only
  behavior as `window.__swReady`), `subscribeToPush(uid)` /
  `unsubscribeFromPush(uid)` (permission → `pushManager.subscribe` →
  `POST /api/push/subscribe`, and the reverse), and the same VAPID
  public key + base64 decode helper the original hardcoded in
  `core-early.js`. The original had this logic duplicated twice
  (auth-modal.js's nav drawer toggle, support-modals.js's Settings
  panel toggle) — this port has one implementation, imported twice.
- `components/layout/PushServiceWorkerRegister.tsx` — mounted at the
  root of `app/layout.tsx`, registers `/sw.js` once on first paint
  (the closest equivalent to core-early.js running inline in `<head>`
  before any button could be clicked).
- **NavDrawer's notification row** — was a toast placeholder
  ("aren't built yet"); now a real toggle: syncs its on/off state from
  the actual browser subscription + `Notification.permission` on mount
  (ports `syncToggleState`), calls `subscribeToPush`/`unsubscribeFromPush`
  on click, shows the same status strings as the original
  ("✓ Push notifications enabled" / "Notifications blocked — check
  browser settings" / etc.). Unlike other nav-drawer links, this one
  does NOT close the drawer on click — matches the original, so the
  status text update is visible. **One intentional deviation:** the
  original lets a signed-out visitor trigger the browser's permission
  prompt and subscribe, then silently fails server-side (`/api/push/
  subscribe` 400s on a missing `uid`, caught non-fatally) — this port
  opens the auth modal instead of prompting for permission when signed
  out, since the original's behavior wastes the user's one permission
  prompt on a subscription the server can never save anyway.
- **Settings → Notifications panel's push toggle** — was a degraded
  placeholder that stopped at "isn't set up on this site yet — coming
  in a later step" even when granted permission; now calls the same
  `lib/push.ts` helpers as NavDrawer, saves the `notificationPrefs.
  pushNotifs` Firestore flag either way (matching the original even
  when the enable path fails partway through), same toast messages.
- **Server-side send confirmed already wired, not new this step:**
  `app/api/_lib/push.js`'s `sendPushToUser(uid, payload)` — real Web
  Push via the `web-push` package (VAPID-signed, RFC 8291/8292), dead
  subscriptions (404/410) auto-removed — was already imported and
  called by `deal.js`'s `notifyDeal` helper on every escrow lifecycle
  event that already sends an email (deal accepted, escrow funded,
  delivered, released, refunded, disputed) since Step 7's byte-for-byte
  port. That means actions now actually deliver a push once: (a) a
  browser has subscribed via the wiring in this step, and (b) the
  `VAPID_PUBLIC_KEY` / `VAPID_SECRET` env vars are set (see
  `.env.example`, updated this step).
- **`.env.example`** — added `VAPID_PUBLIC_KEY`, `VAPID_SECRET`,
  `VAPID_SUBJECT` with a note that the public key must match the one
  hardcoded in `lib/push.ts` (same reasoning as the original: a VAPID
  public key is safe to hardcode client-side, same as Firebase's public
  client config already is in `lib/firebase.ts`).
- **Not covered by this step:** `icon-192.png` / `badge-72.png` (the
  notification icon/badge images `sw.js` references) don't exist in
  either the original bundle or this one — pre-existing gap, not
  introduced here; browsers fall back to a default icon until those
  are added. The Settings panel's four non-push toggles (email/in-app/
  deal-alerts/marketing) were already fully wired before this step —
  only the push toggle itself was a placeholder.

**Step 21 — Wallet: Withdraw, Send, History, Auto Top-Up, Auto Send, Auto Withdrawal (completes Layer B from Step 18):**
- `lib/useWalletHistory.ts` — ports `_walletLoadHistory`/`_walletRenderHistory`'s
  data layer: a live `onSnapshot` listener on `users/{uid}/transactions`
  (newest 50, same query shape as the original). Uses this app's existing
  static `firebase/firestore` import (same pattern as `useSeller.ts`/
  `useSettingsState.ts`) instead of the original's dynamic CDN import —
  same end behavior, no functional difference. Lazy-mounts only once the
  History tab is actually opened, same as the original's
  `_walletHistoryLoaded` gate.
- `lib/walletHistoryHelpers.ts` — ports `_walletTxIcon`/`_walletFeeSub`
  exactly: same per-type icon color mapping, same per-type fee-breakdown
  copy (send/withdraw/receive/donate/escrow_release all read the same
  `fee`/`receive`/`receiveAmount`/`grossAmount` fields the Step 7 API
  responses already write).
- `lib/useRecipientLookup.ts` — ports `_walletLookupRecipient` /
  `_asendLookupRecipient`, which were byte-for-byte duplicate 500ms-
  debounced `lookup-recipient` calls in the original (only the DOM
  target differed) — extracted once here and shared by `SendTab.tsx`
  and `AutoSendAddon.tsx` instead of duplicating the fetch/debounce/
  stale-response-token logic twice.
- `components/wallet/RecipientPreview.tsx` — shared recipient-found/
  loading/error card, ports the `wrp-avatar`/`wrp-mid`/`wrp-badge`
  markup built inline by both lookup functions above.
- `components/wallet/WithdrawTab.tsx` — full port: PayPal/Bank method
  cards, ASAP-vs-scheduled chips with a date/time picker (tomorrow ≤
  date ≤ +90 days, same bounds as the original's `_walletInitScheduleDate`),
  live fee breakdown, `withdraw` action call. Fee/min/max fall back to
  the same hardcoded values `app/api/_lib/limits.js`'s `wallet` block
  defines (`withdrawFee:0.05`, `withdrawMin:10`, `withdrawMax:10000`) —
  same simplification as Step 18, since `/api/limits`'s GET route isn't
  client-callable yet.
- `components/wallet/SendTab.tsx` — full port: recipient lookup +
  preview, amount/note fields, live fee breakdown, `transfer` action
  call, with the Auto Send addon nested inline underneath (matches the
  original's DOM placement, not a separate top-level tab).
- `components/wallet/AutoSendAddon.tsx` — full port of the recurring-
  transfer scheduler: create form (reuses the same recipient lookup),
  `autosend-list` on mount, per-row `autosend-cancel`. Interval options
  ([1,3,7,14,21,30] days) match `app/api/_lib/limits.js`'s
  `autoSend.intervals` exactly.
- `components/wallet/AutoTopUpAddon.tsx` — full port: enable toggle
  gated on a saved PayPal vault token (`hasVault` from
  `autotopup-get`, same "make one deposit first" messaging as the
  original when absent), threshold/amount fields, `autotopup-save`.
  Bounds match `app/api/_lib/limits.js`'s `autoTopUp` block exactly.
- `components/wallet/AutoWithdrawAddon.tsx` — full port: enable
  toggle, PayPal/Bank method cards, payout email, threshold/keep-
  balance fields (same `keep < threshold` validation as the original),
  `autowithdraw-save`. Bounds match `app/api/_lib/limits.js`'s
  `autoWithdraw` block exactly. Enabling can trigger an immediate
  payout server-side if the user's already over threshold — same as
  the original, this refreshes the wallet summary right after a
  successful enable so that isn't left looking stale.
- `components/wallet/HistoryTab.tsx` — full port of
  `_walletRenderHistory`'s display logic (icon/label/date/fee-sub/
  amount-with-sign row), backed by `useWalletHistory`. Shows the same
  3-skeleton-row loading state and empty state as the original.
- `components/wallet/WalletModal.tsx` — all 4 tabs now wired: Withdraw/
  Send/History tabs render their real components instead of "coming
  soon"; Deposit tab gained the Auto Top-Up disclosure and Withdraw tab
  gained the Auto Withdrawal disclosure, both nested inline exactly
  where `index.html`'s own comments say they moved to ("was its own
  tab; now lives inside Add Funds").
- **Not covered by this step:** a live `/api/limits` fetch for the
  various fee/threshold/interval bounds hardcoded above (see Step 18's
  same note — still applies here for the same reason); a
  confirmation step before submitting a withdrawal/transfer (the
  original doesn't have one either — both go straight from
  form-valid to submit).

**Step 22 — Search: full-screen overlay with recent-searches history (enhancement, not a port — the original never had this; see below):**
- This step has **no legacy source** — `marketplace.js`'s search was
  always the small fixed-position popover (`mp-search-suggest`) that
  `MarketplaceSearchBar.tsx` already ported faithfully. There's no
  original `mpRecentSearches`/full-screen-takeover code to port from;
  everything in this step is new, requested directly (a YouTube-style
  search UX: tap the bar → full-screen takeover → recent searches when
  empty → live results while typing → tap a result or press Enter to
  apply, no navigation or data refetch at any point).
- `lib/useRecentSearches.ts` — localStorage-backed recent-searches list
  (`srf_recentSearches` key, same `srf_` prefix convention as
  `useSettingsState.ts`'s `srf_compactMode` and the theme picker's
  `srf_theme`). Case-insensitive de-dupe-and-bump-to-top on repeat
  searches, capped at 15 entries, with per-item remove and clear-all.
- `components/marketplace/SearchOverlay.tsx` — the full-screen overlay
  itself. Reuses `MarketplaceSearchBar.tsx`'s exact match-scoring
  (startsWith=100/includes=80/type=60/desc=40, same highlight-first-
  match helper) so results are identical to what the old popover
  showed — only the presentation changed. Shows the recent-searches
  list (clock icon, per-row × to remove, "Clear all") when the input is
  empty, live-scored results (colored type dot, highlighted match,
  price, "See all results for…" footer) while typing, and an empty
  state for zero matches. Backdrop-locks body scroll while open;
  closes on the back arrow, Escape, selecting a result, or committing a
  search. Driven by the same `searchQuery` state
  `MarketplaceFilterBar.tsx` already threads into
  `useMarketplaceFilters` — opening, typing, and closing this overlay
  never navigates or refetches anything, same as the popover it
  replaces.
- `components/marketplace/MarketplaceSearchBar.tsx` — the visible bar
  in `#mpSearchRow` is now a tap target (`<button>` styled to look like
  the old `<input>`, showing the current query or the placeholder) that
  opens `SearchOverlay`, instead of being a live `<input>` with its own
  popover. `AiSearchButton`/`AiSearchPanel` next to it are untouched.
- **Theming**: every new class (`.mp-search-trigger`, `.mp-so-*`) uses
  the existing `--mp-bg`/`--mp-surface-raised`/`--mp-border`/`--mp-text`/
  `--mp-accent`/etc. custom properties already defined in
  `app/globals.css`'s marketplace `:root` block — same lime-green
  accent (`#a3e635`), same dark surfaces, same border/radius/transition
  tokens as the rest of the marketplace UI, not a new palette.
- **Not covered by this step:** search history isn't synced to
  Firestore/the user's account — it's per-device localStorage only,
  same scope as the theme picker's local persistence before its
  Step 19 "Not covered" follow-up. A signed-in user won't see the same
  recent-searches list on a second device.

- Listing detail Layer B sub-features (ad-gated preview/play, seller
  reveals/reviews, lightbox, game fullscreen runner, per-listing SEO) —
  see Step 6 for the full deferred list
- ~~Trust badge cluster on marketplace *cards*~~ — resolved in Step 17
  as "already correct, nothing further to build": the original's own
  `_srBadgeCluster` is dead/disabled code (its own comment says so);
  what actually shows on cards is the boosted/premium-shimmer classes,
  which `SiteCard`/`AppCard`/`GameCard` already apply (Step 3).
  `SellerBadges.tsx` (verified-checkmark/deal-tier cluster) remains a
  seller-profile-page-only component (Step 15) and premium-sellers-strip
  component (Step 17) — cards correctly never showed it, even in the
  original.
- ~~Theme picker (photo/color grid, premium-plan gating, localStorage +
  Firestore persistence)~~ — resolved in Step 19 (all 3 trigger points
  wired: nav drawer, Settings → Appearance, post-onboarding tour). Only
  remaining gap: a signed-in user's theme doesn't yet hydrate from
  `profile.theme` on a second device/tab — see Step 19's "Not covered"
  note for the small `AuthContext.tsx` follow-up.
- ~~Wallet top-up/deposit flow and Plans & Billing (upgrade/manage)
  flow~~ — resolved in Step 18 (deposit tab + full plans modal built).
  ~~Wallet's Withdraw/Send/History/Auto Top-Up/Auto Send tabs~~ —
  resolved in Step 21 (all 4 tabs + Auto Top-Up/Auto Send/Auto
  Withdrawal addons built).
- ~~Push notification subscribe/unsubscribe (both the Notifications
  settings panel's push toggle AND the nav drawer's notification row
  only show placeholder feedback right now)~~ — resolved in Step 20:
  service worker registered, both toggles wired to real
  subscribe/unsubscribe, server-side `sendPushToUser` (already ported
  since Step 7) now actually reaches a subscribed browser. Remaining
  gap: `icon-192.png` / `badge-72.png` notification images don't exist
  yet (pre-existing, not new).
- Seven static/info pages the nav drawer now links to but don't exist
  yet: `/about`, `/contact`, `/help`, `/how-it-works`, `/escrow`,
  `/buyer-protection`, `/terms` (Step 16 — these will 404 until built)
- My Profile modal (`__openProfileModal` equivalent) — a separate,
  large feature from the seller profile page built in Step 15 (own
  profile editing, not the public seller view). The nav drawer's "My
  Profile" pill/card and the header's logged-in "Profile" button both
  navigate to `/myprofile` (Step 16), which is still a placeholder page
- A global confirm-dialog helper (`window.srfModal.confirm` equivalent)
  doesn't exist in this app yet — Step 15's report-seller confirm and
  Step 5's sign-out confirm both use one-off inline-styled overlays
  instead. Fine for now; worth centralizing if a third caller shows up.
- ~~Filter chips, boosted row, premium sellers strip, ad slots,
  seller-promo/AI-promo interstitial cards~~ — built in Step 17.
- ~~Search bar + suggestions dropdown~~ (`mpSearchInput`,
  `mpRenderSuggestions`) — the text-search matching itself
  (startsWith/includes/type/description scoring) was already built
  alongside the filter chips (`MarketplaceSearchBar.tsx`,
  undocumented as its own step at the time). Its *presentation* was
  upgraded in Step 22 from a small popover to a full-screen overlay.
- "Welcome back" screen (full-screen takeover for returning users,
  chained off the boot overlay via `window.__welcomeBackPending` in the
  original — see Step 14's `BootOverlay.tsx` for where this would hook
  in), banned/suspended account overlay, admin flag — these read more
  fields from the user doc than Step 2 brought over
- Plan badge and unread-message action slot in the announcement bar
- All main-site API routes are now ported server-side (Step 7) — but
  most have no client caller wired up yet (only `listing.feed`/`.view`/
  `.file-url`; `deal`'s `get-seller-stats`/`record-profile-view`;
  and `paypal`'s `donate`/`get-donations`/`wallet-summary`/`create-order`/
  `capture-order`/`get-plan-id`/`activate-sub`/`cancel-sub` (Step 18) and
  `withdraw`/`transfer`/`lookup-recipient`/`autosend-create`/
  `autosend-list`/`autosend-cancel`/`autotopup-get`/`autotopup-save`/
  `autowithdraw-get`/`autowithdraw-save` (Step 21), are actually called
  from the UI so far). `admin` and `edit-file` are intentionally not
  ported (see Step 7) since neither is used outside `admin.html`/
  `tools/github`, both out of scope.
- No content in the other route placeholder pages yet (sell, profile,
  myprofile, messages, sellers, aiagent, leaderboard, etc.) —
  `/settings` (all 14 panels, Steps 5 & 10-13), `/listing/[id]` (all 3
  types, Steps 6, 8 & 9), and `/seller/[id]` (Step 15) are the three
  routes with real content so far
- Settings is fully built: all 14 of 14 panels done as of Step 13
  (Account, Security, Notifications, Appearance, Privacy & Data, Billing
  & Plans, Payment Methods, API & Integrations, Webhooks, Active
  Sessions, Referrals, Listing Analytics, Seller Badge, Danger Zone). No
  panels remain as placeholders — this task is complete and off the
  priority list.
- Dispute picker (deal-selection modal + `/api/deal`'s `escrow-dispute`
  action) — the sidebar's "Raise a Dispute" button is currently a
  placeholder alert

## Notes

- Header/NavDrawer/AnnouncementBar are siblings of `<main>` in `app/layout.tsx`,
  matching the original — the original code has comments warning that nesting
  modals inside `<main>` breaks z-index stacking, so this is preserved deliberately.
- All original element `id`s were kept as-is in the ported markup so future JS
  logic (event handlers, DOM queries) can be ported without renaming lookups.
- `app/api/account/_handler.js` and `app/api/listings/_handler.js` are direct
  copies of the old `api/account.js` / `api/listings.js`. If you need to
  change what an action actually does, edit `_handler.js` — `route.ts` is
  only a request/response format adapter. This adapter pattern is the
  template for porting the rest of `/api/*.js`: copy the file into
  `app/api/<name>/_handler.js`, fix any relative imports to point at
  `app/api/_lib/`, then copy an existing `route.ts` and swap the import.
