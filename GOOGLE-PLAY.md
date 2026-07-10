# Little Yakka — Google Play submission (paste-ready)

> Companion to `APP-STORE-METADATA.md`. Play Console: https://play.google.com/console

## ▶ Timeline reality check

New personal developer accounts must run a **closed test with 12+ testers for
14 consecutive days** before production access. Plan: account today → closed
test ASAP → invite 12+ friends/family → submit to production in ~2.5 weeks.

## 1. Account + app record

1. Register (US$25 one-time, personal) — may require ID verification.
2. Create app: **Little Yakka** · App (not game) · **Free** · English (AU) default.

## 2. Store listing

| Field | Value |
|---|---|
| App name (30) | `Little Yakka` |
| Short description (80) | `Chores become a game — stars, streaks, trophies and a weekly bonus wheel.` (74) |
| Full description (4000) | Reuse the App Store description from `APP-STORE-METADATA.md` §2 verbatim. |
| App icon (512×512 PNG) | Export from `assets/icon-only.png` (already square; resize to 512). |
| Feature graphic (1024×500) | Required — logo on white or the indigo `#334487`. Ask Claude to generate it. |
| Phone screenshots | The same 9 from `Downloads\AppStore-Screenshots` work (Play accepts 16:9–2:1; 1284×2778 is fine). Min 2, max 8 per type — pick the best 8. |
| Category | Lifestyle (secondary tags: Parenting) |
| Contact email | contact@littleyakka.com |
| Website | https://www.littleyakka.com |
| Privacy policy | https://www.littleyakka.com/privacy |

## 3. Data safety form (App content → Data safety)

Collects data? **Yes**. Shares data? **No**. All encrypted in transit? **Yes**.
Deletion mechanism? **Yes** (in-app account deletion + email).

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| Personal info → Email address | Yes | No | Account management |
| Personal info → Name | Yes | No | Account management |
| Photos → Photos | Yes (optional child avatars) | No | App functionality |
| App activity → Other user-generated content (tasks, rewards, stars) | Yes | No | App functionality |
| Device IDs (push token, only if enabled) | Yes | No | App functionality |

Everything else: not collected. No ads, no analytics SDKs, no tracking.

## 4. Target audience & content

- **Target age: 18 and over** (the account holder is the parent; children never
  sign in or provide data — same positioning as the App Store). Answering 18+
  keeps you out of the Families policy's teacher-approval track.
- "Appeals to children" question: answer honestly that the *user* is the parent;
  the store listing copy targets parents.
- Content rating questionnaire (IARC): no violence/sex/drugs/gambling/UGC-sharing
  → rates **Everyone / 3+** automatically.
- News app? No. COVID app? No. Government app? No.

## 5. App access (reviewers)

Provide the demo login: `kjtest@gmail.com` / `kjtest` — "All features available
after sign-in. Parent creates everything; child profiles are opened from Home."

## 6. Release path

1. **Closed testing** track → create release → upload the `.aab` from Codemagic
   (workflow `android-play`, artifact `app-release.aab`).
2. Testers tab → create an email list with 12+ Gmail addresses → share the
   opt-in link with them; they must opt in AND install.
3. Keep the test running 14 days (release can be updated during this).
4. When Play Console shows production access unlocked → **Promote release →
   Production**.

## 7. Signing

- Upload keystore: `Documents\little-yakka-signing\upload.jks` (BACK THIS UP —
  password in the same folder's README). Play App Signing manages the real
  app signing key; the upload key can be reset via support if ever lost.
- Codemagic variable group `android_signing`: `KEYSTORE_B64`, `KEYSTORE_PASSWORD`,
  `KEY_ALIAS`, `KEY_PASSWORD`.

## 8. Deferred (not blockers)

- **Push notifications on Android** — needs Firebase/FCM (server + client).
  v1 ships without; iOS keeps APNs push. Add post-launch.
- Play Console ↔ Codemagic auto-publish (service account) — manual uploads are
  fine at this cadence.
