# Little Yakka — App Store & Google Play Submission Plan

> Working doc for getting Little Yakka (Next.js 16 PWA → Capacitor native app) onto the
> Apple App Store first, then Google Play. Built and maintained on **Windows, no Mac.**

---

## ▶ START HERE — current status (updated 2026-07-08)

**Where we are:** Already on **TestFlight (Build 9/10)**. The **Codemagic** cloud-build pipeline
signs + uploads end-to-end on Windows/no-Mac. **Signing profile is regenerated and valid**
(includes Sign in with Apple + Push). **Sign in with Apple login is confirmed working.** The
full post-launch **UI overhaul is complete and deployed** to `www.littleyakka.com` — and because
the native app uses the **remote-URL model** (`server.url = https://www.littleyakka.com`), all of
it is **already live inside the TestFlight app with no rebuild**.

**Next steps to reach App Store submission:**
1. Confirm pending push setup is done — APNs SQL migration in Supabase + Vercel env vars
   `APNS_KEY_ID / APNS_TEAM_ID / APNS_BUNDLE_ID / APNS_PRIVATE_KEY`.
2. Device test via TestFlight — haptics, native push, offline, Apple + Google sign-in.
3. App Store Connect metadata — screenshots, description, privacy nutrition label, age rating,
   privacy-policy URL (mandatory for a kids app).
4. Kids-app compliance — Guideline 5.1.4 (children's data), 4.2 (native push/haptics/offline),
   4.8 (Sign in with Apple alongside Google — done).
5. Submit for review; handle any rejections (may need a rented cloud Mac for on-device debugging).
6. Google Play second (US$25 one-time; Families policy).

**Local preview / audit:** dev server = `.claude/launch.json` config `little-yakka` (`npm run dev`,
port 3001). Sign in via the real `/login` form with the throwaway account **kjtest@gmail.com /
kjtest** (3 kids + sample data). ⚠️ Client-fetched pages (`/dashboard/chores`, `/rewards`,
`/report`, likely `/settings`) hang in the headless preview browser (Supabase `navigator.locks`);
server-rendered pages (`/login`, `/dashboard`, `/kid-mode/[childId]`) work. See the memory file
`reference_little_yakka_preview.md` for details.

The full history + signing lessons live in project memory (folder
`…\.claude\projects\C--Users-kiran-OneDrive-Desktop-Claude-Code-Dashboard\memory\`,
file `project_little_yakka_store.md`). The detailed log below is the source of truth.

---

## Locked-in decisions (don't re-litigate)

- **No Mac, not buying one.** iOS builds run on **Codemagic** cloud CI (free tier = 500 macOS
  build min/month). **Not** using Ionic Appflow (too costly for a solo dev).
- **Break-glass fallback** for the rare Mac-only need (Safari Web Inspector on-device, chasing a
  native rejection): **rent a cloud Mac by the hour** (e.g. MacinCloud), not a purchase.
- **Wrap the PWA with Capacitor** (not a rewrite). Keep the web app; add a thin native shell.
- On iOS, **migrate push to Capacitor native push (APNs)**; keep web push for the browser PWA.
  Map existing haptics to Capacitor Haptics.
- Location: **Australia**. Apple Developer Program just enrolled — Individual vs Organization TBD.
- **App Store first, Google Play second.**

---

## Progress log

- **2026-07-06 — Domain move DONE.** App now live at **https://www.littleyakka.com** (canonical;
  apex `littleyakka.com` 308-redirects to www). GoDaddy DNS: `A @ → 216.198.79.1`,
  `CNAME www → 3a34297e95d3ab0e.vercel-dns-017.com`. All ✅ Valid in Vercel. Old
  `little-yakka.vercel.app` still works. **Zero code changes needed** — every auth redirect uses
  `window.location.origin`, so the app is already domain-agnostic.
- **Supabase Auth updated:** Site URL = `https://www.littleyakka.com`; redirect URLs added
  (`/**`, `/auth/callback`, `/reset-password`). Login + Google sign-in verified working on new domain.
- **Google OAuth consent screen** branded ("Little Yakka"); logo removed (a custom logo triggers
  Google brand verification); app published to Production.
- **Open cosmetic item:** mobile Google account-picker still shows `nzhjrf….supabase.co` on the
  email-entry screen. Full fix = **Supabase Custom Domain** add-on (~US$10/mo → `auth.littleyakka.com`).
  **Deferred to just before launch.**
- **Compliance to track (Phase 4):** Guideline 4.8 — offering Google login may require
  **Sign in with Apple** (email login *may* satisfy it; budget for adding it).
- **Bundle ID LOCKED:** `com.littleyakka.app`. Apple Developer Program **enrolled + paid** as
  **Individual** (2026-07-06); **ACTIVE**. Team ID `9D5QNNA5ZT`, Key ID `2T2MT7JX3L`; App ID registered with
  Push capability + APNs `.p8` key created (`.p8` saved locally, NOT in repo). Push backend = **direct APNs `.p8`**.
- **Native push code DONE** (branch `capacitor-ios`): server sender `lib/apnsServer.ts` (ES256 JWT via `.p8` + HTTP/2),
  client `lib/nativePush.ts`, settings-page native branch, `push_subscriptions.platform` column (endpoint holds APNs
  token; p256dh/auth now nullable), `AppDelegate` forwards token, `App.entitlements` (aps-environment=production).
  **PENDING MANUAL:** (1) run the new `push_subscriptions` ALTERs from `supabase_migration.sql` in Supabase SQL editor;
  (2) add Vercel env `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_BUNDLE_ID` / `APNS_PRIVATE_KEY` (the `.p8` contents).
  Untestable until the first Codemagic/TestFlight build.
- **Branding:** app **icon** = "Little Yakka" wordmark on white (opaque, no alpha), source `assets/icon-only.png`.
  **Splash** = full logo on **indigo `#334487`** (sampled from the logo's "Yakka" navy). Pink dropped as a
  base colour (too gender-leaning); `#334487` is the new neutral base for native surfaces (splash, offline).
  Generated into `ios/.../Assets.xcassets` via `@capacitor/assets`.
- **Capacitor decision LOCKED:** app is fully server-rendered (App Router + `app/api/*` + Supabase
  SSR cookie auth) → **cannot** be statically bundled. Capacitor loads the **remote URL**
  (`server.url = https://www.littleyakka.com`). Native APNs push + Capacitor Haptics + native
  splash are the Guideline 4.2 defense (proves it's more than a wrapped website).

---

## Costs (reference)

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | ~A$149/yr | Recurring. |
| Google Play Developer | US$25 one-time | Phase 2. |
| Codemagic builds | $0 likely | 500 free macOS min/month; a build is ~10–20 min. |
| Privacy policy hosting | $0–US$5/mo | Mandatory URL; kids app → do it properly. |
| Domain (if needed) | ~US$12/yr | Support + privacy + marketing URL. |
| Supabase / Vercel | current plan | Watch free-tier limits (photo storage) as users grow. |
| **IAP commission** | **15–30%** | **Only if monetizing.** 15% under Apple/Google small-business programs. |

**Launch floor for a free app:** ~A$149 (Apple) + A$38 (Google, once) + a few $/mo for a privacy policy.

---

## Trade-offs of no-Mac + Codemagic

- ❌ **No Safari Web Inspector on-device** (Mac-only) — can't inspect the WKWebView on a real iPhone.
  Mitigate: debug in Chrome on Windows (same web code); rent a Mac by the hour when truly needed.
- ❌ No local iOS Simulator; test via TestFlight builds or a physical iPhone (black-box).
- ❌ Slower native-config iteration (push → wait for cloud build).
- ❌ Harder to diagnose native signing/rejection issues without Xcode.
- ✅ Publishing, app quality, push, haptics, code signing — **all fully possible.**

---

## Phases & checklist

### Phase 0 — Apple account
- [ ] Confirm membership shows **Active** at developer.apple.com/account.
- [ ] Decide **Individual vs Organization** (Org → free D-U-N-S number, ~1–2 wks; needs ABN/Pty Ltd in AU).

### Phase 1 — Wrap with Capacitor (coding)
- [x] Audit current push setup, `next.config`, service worker, `package.json`. *(done 2026-07-06)*
- [x] Add Capacitor 8 + iOS platform (SPM, no CocoaPods → Windows-friendly). Remote-URL model. *(done 2026-07-06)*
- [x] Migrate iOS push to Capacitor native push (APNs); keep web push for browser PWA. *(code done 2026-07-06; needs Supabase SQL + Vercel env + on-device test)*
- [x] Wire haptics to Capacitor Haptics. *(done 2026-07-06)*
- [x] App icons + splash screens generated. *(done 2026-07-06)*

### Phase 2 — Codemagic iOS pipeline (no Mac)
- [ ] Connect repo to Codemagic; configure macOS iOS workflow.
- [ ] Automatic code signing (App Store Connect API key).
- [ ] Produce a TestFlight-ready `.ipa` entirely cloud-side.

### Phase 3 — App Store Connect
- [ ] Create app record + **Bundle ID** (e.g. `com.littleyakka.app`).
- [ ] **App Privacy** nutrition label (accounts, kids' names/photos, push tokens).
- [ ] **Age rating** questionnaire.
- [ ] **Screenshots** for required device sizes (6.7" iPhone + others).
- [ ] Description, keywords, support URL, **privacy policy URL** (mandatory).

### Phase 4 — Kids-app compliance (highest review risk)
- [ ] Real privacy policy; no third-party ad/tracking SDKs.
- [ ] Guideline **5.1.4** (kids' data handling).
- [ ] Guideline **4.2** — ensure native push/haptics/offline prove it's more than a wrapped website.
- [ ] Decide whether to opt into the **Kids Category** (extra restrictions) or target parents.

### Phase 5 — Submit → review → iterate
- [ ] Submit for review (expect ~a few days; budget for one rejection + fix cycle).

### Phase 6 — Google Play (later)
- [ ] Android build (works on Windows), **Data safety** form, content rating.
- [ ] **Families policy** section.
- [ ] Note: new personal dev accounts require ~**12 testers for 14 days** before publishing.

---

## Handoff prompt for a fresh session

See the paste-ready prompt agreed on 2026-07-06 (also summarized in the assistant's memory).
Start any new store-work session by asking for a repo audit + Phase 1 plan before writing code.
