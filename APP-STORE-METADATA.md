# Little Yakka — App Store Connect metadata (paste-ready)

> Companion to `STORE-SUBMISSION.md`. Everything below is ready to paste into
> App Store Connect → My Apps → Little Yakka. Char limits are respected.

---

## 1. App Information

| Field | Value |
|---|---|
| **Name** (30 max) | `Little Yakka` |
| **Subtitle** (30 max) | `Kids chores, stars & rewards` (28) |
| **Bundle ID** | `com.littleyakka.app` (locked) |
| **Primary category** | Lifestyle — confirmed over Education: Education is for apps that teach content (courses, languages, maths); a chore/habit app there invites reviewer skepticism. Lifestyle + Productivity is where comparable family chore apps sit. |
| **Secondary category** | Productivity |
| **Content rights** | Does not contain third-party content |
| **Age rating** | Complete questionnaire — all content types "None" → expect **4+**. Do **NOT** opt into the Kids Category (see §6). |

## 2. Version Information

**Promotional text** (170 max — editable without review):

> Turn chores into a game — stars, streaks, trophies and a weekly Bonus Wheel your kids will actually look forward to. Set up your family in under two minutes.

**Description** (4000 max):

```
Little Yakka turns everyday chores into a game your kids actually want to play.

Set up tasks in seconds, and every child gets their own colourful Kids Zone where
they tick things off, earn stars, build streaks, and unlock trophies. You stay in
control from the parent dashboard; they get the fun.

FOR PARENTS
• Create tasks in seconds with 20 ready-made templates (or your own)
• Daily, weekly or monthly schedules — pick exact days
• Assign tasks to one child, several, or leave them "Up For Grabs"
• Set star values, carry-over rules, and do-early permission per task
• Weekly summary: completion %, stars earned, and Completion Champions
• Invite a co-parent to share the load
• Reminders by push notification (optional)

FOR KIDS
• Their own Kids Zone with photo, star jar, and streak counter
• Tap DONE and watch the celebration — stars land in the jar instantly
• 12 trophies to unlock, from the first star to superstar status
• The Bonus Wheel: a weekly spin that pays out based on how much of the
  week's work got done — finish more, win more
• Spend stars on rewards you set: ice cream, movie night, pocket money —
  whatever works for your family

BUILT FOR FAMILIES
• One account covers the whole family — no child accounts, no child sign-ins
• A parent or guardian enters and controls all information about a child
• No ads. No third-party trackers. Ever.
• Delete your data any time from Settings

Little Yakka helps kids build lifelong habits — and gives parents one less
thing to nag about.
```

**Keywords** (100 max, comma-separated, no spaces needed after commas):

```
chores,kids,rewards,chore chart,star chart,pocket money,family,routine,tasks,allowance,parenting
```
(96 chars)

**URLs**

| Field | Value |
|---|---|
| Support URL | `https://www.littleyakka.com/support` |
| Marketing URL | `https://www.littleyakka.com` |
| Privacy Policy URL | `https://www.littleyakka.com/privacy` |

**Version** `1.0` · **Copyright** `© 2026 Kiran Jassi`

## 3. Screenshots (take on your iPhone from TestFlight)

iPhone screenshots from a Pro Max are already the exact required resolution —
just screenshot (Side + Volume-Up) and upload. Required: **6.9" set** (or 6.7"
on an older Max). One size is enough; Apple scales the rest. 4–6 screenshots,
suggested order (lead with the kid-facing fun):

1. **Kids Zone** — a child with stars, jar, trophies visible
2. **Bonus Wheel** — mid-spin or the win screen
3. **Home** — the three kid tiles with medals + today's tasks
4. **Create Task** — the template picker open (shows how easy setup is)
5. **Rewards** — catalogue with a couple of rewards
6. **Summary** — Completion Champions + stars chart

Tip: use the kjtest family (photos + data already populated) or your real
family if you're comfortable. Avoid any notification banners in shot.

## 4. App Privacy (nutrition label)

Answer "Do you or your third-party partners collect data from this app?" → **Yes**, then:

| Data type | Collected? | Linked to user? | Tracking? | Purpose |
|---|---|---|---|---|
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| Contact Info → Name | Yes | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes (child avatars, optional) | Yes | No | App Functionality |
| User Content → Other User Content | Yes (tasks, rewards, stars) | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality |
| Identifiers → Device ID | Yes (push token, only if notifications enabled) | Yes | No | App Functionality |

Everything else (Location, Health, Financial, Browsing, Search History,
Diagnostics, Analytics, Advertising Data…) → **Not collected**.
"Data used to track you" → **None**. No third-party advertising. No analytics SDKs.

## 5. App Review Information

| Field | Value |
|---|---|
| Sign-in required | **Yes** — provide demo account |
| Demo account | `kjtest@gmail.com` / `kjtest` |
| Contact | Kiran Jassi · contact@littleyakka.com · +61 434 567 804 |

**Notes for the reviewer** (paste):

```
Little Yakka is a family chore-and-reward app set up and managed by a parent
or guardian. Children do not create accounts and cannot sign in — a parent
signs in and opens a read-write "Kids Zone" for each child on the family
device. All child profile information is entered and controlled by the parent.

The demo account is pre-loaded with a family (3 children, sample tasks and
rewards). From Home, tap a child's tile to see the child experience (tick off
tasks, star jar, trophies, bonus wheel). The + button on Tasks/Rewards shows
task and reward creation.

Sign in with Apple and Sign in with Google are both offered alongside email.
Account deletion is available in-app under Settings → Delete Account.
Notifications are optional (APNs). No ads, no third-party tracking or
analytics SDKs. Privacy policy: https://www.littleyakka.com/privacy
```

## 6. Kids Category decision — do NOT opt in

Recommendation locked after review of 5.1.4:
- Little Yakka is **parent-managed**: parents create the account, sign in, and
  enter all child data. Kids never provide data to us directly.
- Position the app as **made for parents** (age rating 4+ falls out of the
  questionnaire, but the *target audience* is adults). Do not tick "Made for
  Kids"/Kids Category — that triggers the much stricter kids-app rule set
  (no outbound links without a parental gate, etc.) that the app is not built for.
- This is the same positioning used by comparable chore apps (OurHome, Homey).
- Guideline 5.1.4 still applies to any app that *collects data from* children —
  we don't: the parent enters it. The privacy policy states this explicitly.

## 7. Submission checklist (in order)

1. ~~APNs SQL migration in Supabase~~ ✅ verified 2026-07-09 (platform column live)
2. ~~Vercel env APNS_KEY_ID / TEAM_ID / BUNDLE_ID / PRIVATE_KEY~~ ✅ verified 2026-07-09 (all four in Production)
3. ~~Support URL~~ ✅ https://www.littleyakka.com/support live 2026-07-09
4. **Device test on iPhone (TestFlight Build 10)** — see checklist below ⬅ YOU
5. Take screenshots during the device test ⬅ YOU
6. Create the version in App Store Connect, paste §1–§5 ⬅ YOU (10 min of clicking)
7. Select Build 10, answer export compliance (already `ITSAppUsesNonExemptEncryption=false` → no prompt expected)
8. Submit for review

## 8. Device-test checklist (Build 10, ~15 min)

- [ ] Cold-start: splash (indigo) → app loads littleyakka.com
- [ ] Sign in with Apple (fresh sign-in, not cached)
- [ ] Sign out → Sign in with Google
- [ ] Settings → Notifications → enable → iOS permission prompt → status "on"
- [ ] Receive a real push (mark a task done as a kid → parent praise/completion flow, or use the reminder cron)
- [ ] Haptics: tick a task in Kids Zone — feel the tap
- [ ] Kids Zone: complete task → celebration + star jar updates
- [ ] Bonus wheel spins (bonus day is configurable in Settings — set it to today, time just past, to force-test)
- [ ] Offline: airplane mode → app shows a sane offline state (not a white screen); reconnect recovers
- [ ] Create a task + a reward; edit + delete both
- [ ] Account: Settings shows Sign Out + Delete Account (don't run delete on your real family!)

Anything that fails here, report back — web-side fixes deploy without a rebuild.
