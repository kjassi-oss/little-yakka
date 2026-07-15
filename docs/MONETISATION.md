# Little Yakka — Monetisation Strategy

**Status:** Draft for decision. Nothing here is built.
**Date:** 2026-07-15
**Author:** drafted with Claude, pending Kiran's sign-off

> **Do not start implementation while the app is Waiting for Review.** Everything below is
> Phase 1+ work. See [Phased rollout](#7-phased-rollout).

---

## 1. TL;DR — the recommendation

| | |
|---|---|
| **Model** | Freemium. Free = **1 child, complete experience**. Premium = **"Family" plan** (2+ children + depth features). |
| **Primary gate** | Number of children. One legible wall, not twelve small ones. |
| **Secondary gates** | Co-parent invite, benchmark photos, history depth >30 days, full reports, theme picker. |
| **Never gate** | Tasks, stars, rewards, redemptions, trophies, bonus wheel, style shop. These *are* the product and the habit that drives conversion. |
| **Price (hero)** | **Annual A$34.99 / US$24.99** with a 7-day free trial. Monthly A$6.99 / US$4.99. Lifetime A$89.99 / US$59.99. |
| **Rails** | RevenueCat → StoreKit (iOS) + Play Billing (Android). Stripe on web-browser only. |
| **Apple's cut** | 15% under the Small Business Program (<US$1M/yr proceeds). Enrol before the first sale. |
| **Ship first** | Entitlement schema + grandfathering. Then the paywall. |

---

## 2. Why this split

The instinct with a chore app is to gate the fun stuff (wheel, trophies, shop) because it *feels*
premium. That is backwards for this category:

- **The kid is the user; the parent is the buyer.** Gating the kid's fun makes the kid disengage,
  and a disengaged kid is a cancelled subscription. The fun features are what make the parent
  believe the app works.
- **Chore apps die of abandonment, not of stinginess.** The enemy is a family that stops opening
  the app in week 3. Every gate you add to the core loop raises that risk.
- **Kids-app reviews are brutal about paywalls.** A crippled free tier earns 1-star "this is a
  paywall with a chore list attached" reviews, which is fatal for organic discovery.

So: make the free tier a genuinely good **single-child** app, and sell the thing that is honestly
more valuable and more expensive to serve — **more children, more parents, more history**.

### The gate candidates, assessed

| Candidate | Verdict | Reasoning |
|---|---|---|
| **Number of children** | ✅ **Primary gate** | Value scales with it, cost scales with it, and it's the most legible pitch in the category: *"free for one kid, Family plan for the rest."* Trivial to enforce at the DB level. |
| **Co-parent invite** (`guardians`, `guardian_invitations`) | ✅ Premium | Strong secondary gate: it gives **single-child families a reason to pay**, which the child-count gate alone does not. Two-parent households are the norm; sharing the load is a real want. |
| **Benchmark photos** (`task_benchmark_photos`) | ✅ Premium | Storage-backed → real marginal cost. Niche enough that gating it annoys nobody. Clean fit. |
| **Task history depth** (`completions`) | ✅ Premium | Free = 30 days, Premium = unlimited. Invisible on day 1, compelling at month 3 — a *time-delayed* gate, which converts the engaged rather than the curious. |
| **Summary / reports** (`/dashboard/report`) | 🟡 Partial | Free = current week. Premium = trends, multi-week, per-child comparison, export. Don't hide the page — hide the depth. A blank teased page beats no page. |
| **Custom themes** (`THEMES`) | 🟡 Partial | Free = 3 themes. Premium = full picker. Low value alone, good *bundle sweetener*. Never gate the default. |
| **Bonus wheel** (`spin_results`) | ❌ Keep free | The single biggest engagement/retention driver you have. Gating it guts the free loop that sells the paid one. **Gate its *configuration* instead** (award %, cadence) — parent-facing, kid-neutral. |
| **Trophies** (`TrophyShelf`) | ❌ Keep free | Pure retention. Long-horizon trophies (90-day streak) only pay off if the kid can see them from day 1. Gating them removes the reason to stay. |
| **Style shop** (`child_unlocks`, `lib/styleShop.ts`) | ❌ **Do not gate** | ⚠️ **Bought with stars the child earned.** Putting a cash wall in front of an earned currency is a bait-and-switch the kid experiences as a punishment — and Apple's reviewers dislike it in 4+ apps. If you want revenue here, add *new* premium-only cosmetics; never revoke earned ones. |

### Recommended split

**Free — "Little Yakka"**
- 1 child
- Unlimited tasks, rewards, redemptions
- Stars, streaks, all 12 trophies
- Bonus wheel (default settings)
- Style shop (full catalogue, star-bought)
- Kids Zone, praise, push notifications
- Current-week summary
- 30 days of task history
- 3 themes
- 1 parent

**Premium — "Little Yakka Family"**
- **Up to 6 children**
- **Co-parent invite** (shared family, both parents get push)
- Benchmark photos
- Unlimited history + full reports (trends, per-child comparison, CSV export)
- Bonus wheel configuration (award %, cadence, day/time)
- All themes + future theme packs
- Premium cosmetic packs for the style shop (still star-bought — the *pack* is unlocked by the plan)
- Priority support

---

## 3. Pricing

### Comparables (kids chore / family organiser)

| App | Model | Approx price |
|---|---|---|
| BusyKid | Sub | ~US$4/mo |
| Homey | Sub | ~US$4.99/mo |
| Cozi Gold | Annual | ~US$39/yr |
| Sweepy | Sub | ~US$3/mo |
| Greenlight | Sub (fintech) | US$5.99–14.98/mo |
| OurHome / Habitica | Free | — |

This is a **low-ARPU, high-churn** category. Parents lapse: the chore chart works for a term, then
the family drifts. Design pricing around that reality rather than fighting it.

### Recommended price points

| Plan | AU | US | Notes |
|---|---|---|---|
| Monthly | **A$6.99** | **US$4.99** | Deliberately unattractive. It exists to make annual look good. |
| **Annual** ⭐ | **A$34.99** | **US$24.99** | **The hero.** ≈A$2.92/mo, ~58% off monthly. 7-day free trial. |
| Lifetime | **A$89.99** | **US$59.99** | ≈2.5× annual. |

**Why lifetime matters here more than in most categories.** Expected subscriber life in a chore app
is plausibly 3–6 months → a monthly sub is worth ~A$20–40 gross. A lifetime at A$89.99 (A$76 net of
Apple's 15%) beats that *today*, with no churn risk and no support tail. It also disarms the
very real "not another subscription" objection from parents. Offer it:
1. as the third option on the paywall, and
2. as a **win-back** at cancellation and at paywall-dismiss.

**Free trial:** 7 days on annual, no card friction beyond StoreKit's own. Do **not** trial the
monthly. Trial length matters: the family needs to set up all their kids and complete a full week
for the value to land. 7 days is the minimum viable; **test 14** — one week is barely one cycle.

### The alternative worth taking seriously: one-time unlock

A **single A$29.99 / US$19.99 "Family Unlock"** (non-consumable IAP) instead of a subscription.

- **For:** Converts far better in this category. No churn management, no billing support, no
  win-back machinery. Matches the honest reality that your marginal cost per family is cents
  (Supabase + Vercel + APNs). Parents *like* it. Much simpler to build (no expiry logic, no
  webhook renewal handling).
- **Against:** Caps LTV, no recurring revenue, and it's hard to walk back later without annoying
  early buyers.

**My read:** if this stays a side project you want to be *sustainable and low-maintenance*, the
one-time unlock is probably the better business. If you want it to be a *growing* business you'd
plausibly sell or work on full-time, go subscription. Recommendation above assumes the latter —
**but this is a genuine fork and worth your explicit decision.**

---

## 4. The architecture reality ⚠️

This is the part that makes Little Yakka harder to monetise than a normal app.

**The setup:** a Next.js SSR web app on Vercel, wrapped in Capacitor 8 with
`server.url = https://www.littleyakka.com`. The native shell loads the **live remote site** into a
WKWebView. The JS is remote; the Capacitor native bridge is still injected (this is exactly how
your existing `@capacitor/haptics` and native APNs push already work — same mechanism, so a
purchases plugin will work the same way).

### 4.1 You cannot use Stripe in the iOS app

Guideline 3.1.1: digital content unlocking app features **must** use In-App Purchase. A web
checkout inside the WKWebView is a rejection, and a well-known one. Same for Google Play Billing.

**But the rules moved in 2025–26 and it matters for you:**

- **🇺🇸 US storefront:** after *Epic v. Apple* (30 Apr 2025 contempt ruling, Apple's appeal failed,
  SCOTUS stay denied), Apple's anti-steering rules are **gone in the US**. US apps may include
  buttons and external links to web checkout, **no entitlement required**, and Apple currently
  charges **0% commission** on those purchases — pending a district-court-approved rate.
  ⚠️ This is actively litigated and *will* change. Treat it as upside, not foundation.
- **🇦🇺 Australia — your home market — is unchanged.** IAP is mandatory. Assume the 15% cut.
- **🇪🇺 EU (DMA):** link-outs allowed but carry an initial acquisition fee + store services fee.
- **🇧🇷 Brazil (from 20 Jun 2026):** alternative payments allowed alongside IAP.

**Implication:** build IAP first (it's mandatory for AU/most storefronts). *Then*, if US volume
justifies it, add a US-storefront-only external link to a Stripe checkout to dodge the 15%.
Don't invert that order.

**The web PWA in a real browser is unrestricted** — Stripe is fine there. Apple's rules only bind
what happens inside the app.

### 4.2 What implementing it actually takes

**a) Native purchase bridging — use RevenueCat**

```
@revenuecat/purchases-capacitor
```

Do **not** hand-roll StoreKit. The hard part isn't showing a purchase sheet — it's *receipt
validation, renewals, grace periods, refunds, restores, family sharing, and cross-platform
identity*. RevenueCat gives you all of it plus a webhook, and it's **free under US$2.5k/mo
revenue** — you'd pay nothing for a long time.

⚠️ **Adding the plugin requires a new native binary + a full App Store review.** This is not a
web-side change; it cannot ride the remote-URL model like your UI waves did. Budget for a
Codemagic build + review cycle.

**b) Server-side entitlements in Supabase**

Add to `families` (family-scoped, **not** guardian-scoped — co-parents share one plan):

```sql
alter table families add column if not exists plan text not null default 'free'
  check (plan in ('free','premium'));
alter table families add column if not exists plan_source text
  check (plan_source in ('ios','android','web','promo','grandfathered'));
alter table families add column if not exists plan_expires_at timestamptz;
alter table families add column if not exists rc_customer_id text;
```

Flow: **RevenueCat webhook → `/api/webhooks/revenuecat` (Next route handler, service-role client,
verify the auth header) → update `families`.** Never let the client write these columns — RLS must
deny it.

**c) ⚠️ The gating must live in the database, not the client**

This is the single most important implementation note in this document.

Your `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public (it ships in the bundle — by design), and the app
talks to Supabase directly from the browser under RLS. **A client-side `if (plan === 'free')`
check is decorative.** Anyone can open devtools and `POST` a fourth child straight to PostgREST.

The child limit has to be enforced by a trigger:

```sql
create or replace function enforce_child_limit() returns trigger as $$
declare
  n int;
  p text;
begin
  select count(*) into n from children where family_id = new.family_id;
  select plan into p from families where id = new.family_id;
  if p = 'free' and n >= 1 then
    raise exception 'CHILD_LIMIT_FREE' using errcode = 'P0001';
  elsif p = 'premium' and n >= 6 then
    raise exception 'CHILD_LIMIT_PREMIUM' using errcode = 'P0001';
  end if;
  return new;
end $$ language plpgsql security definer;

create trigger trg_child_limit before insert on children
  for each row execute function enforce_child_limit();
```

Same principle for `guardian_invitations` (co-parent) and `task_benchmark_photos`. Client checks
then exist purely to show a *nice* paywall instead of an error toast.

**Note:** `plan_expires_at` must be part of the `plan = 'premium'` test, or a lapsed subscriber
keeps their kids. Prefer a `families_effective_plan` view or an `is_premium(family_id)` SQL
function so the logic lives in one place.

**d) Downgrade behaviour — decide this before you ship**

What happens to a 3-child family whose subscription lapses? **Never delete data.** Recommendation:
soft-lock — all children stay, but the family picks **one active** child; the rest go read-only
with an "Upgrade to reactivate" state. Deleting a child's stars because a card expired is a 1-star
review and an upset 7-year-old.

**e) Kids-app / IAP rules**

- You **did not opt into the Kids Category** (per `APP-STORE-METADATA.md` — parent-managed
  positioning). Good: the strict Kids Category rules (mandatory parental gate, no third-party
  analytics) don't formally bind you. The 4+ rating still invites scrutiny.
- **Put the paywall in the parent dashboard, behind the existing `PinModal`. Never in Kid Zone.**
  This is a natural parental gate, it's good practice regardless, and it pre-empts the reviewer's
  obvious question. A kid must not be able to reach a purchase sheet.
- Guideline 3.1.2: subscriptions need visible title, length, price, and links to Terms/Privacy on
  the paywall itself. You have `/privacy`; you'll need Terms.
- **Restore Purchases button is mandatory.** Rejections for its absence are routine.
- Google Play Families policy mirrors most of this.
- Your ASC listing is currently **Free**. Adding IAP is fine — but IAP products are reviewed with
  the binary that introduces them, so the first paid build carries extra review risk.

**f) Enrol in the Small Business Program** — 15% instead of 30%, from day one, for anyone under
US$1M/yr proceeds. It is an application, not automatic. **Do it before the first sale.**

---

## 5. Grandfathering

Existing TestFlight testers and early organic users should be **grandfathered to premium
permanently** (`plan_source = 'grandfathered'`). They're your reviews, your word of mouth, and your
bug reports. The revenue you'd extract from a few dozen early families is a rounding error against
the goodwill. Set the default *before* the paywall ships:

```sql
update families set plan = 'premium', plan_source = 'grandfathered'
where created_at < '<paywall-launch-date>';
```

---

## 6. Instrument before you gate

You are about to pick "1 child" as a wall without knowing the distribution of children per family.
**Find out first** — it's one query against your own data:

```sql
select n_children, count(*) from (
  select family_id, count(*) as n_children from children group by family_id
) t group by n_children order by n_children;
```

- If most families have 1 child, the child gate converts nobody → lean on co-parent/history/reports.
- If most have 2–3, the child gate is your whole business → make free = 1 and don't over-think the rest.

This single query should decide the split. Everything above is a hypothesis until you run it.

---

## 7. Phased rollout

**Phase 0 — now (while Waiting for Review): do nothing.** No paywall code, no IAP products, no
metadata changes. Do not give the reviewer a new surface. ✋

**Phase 1 — groundwork (web-side, no binary, ships via the normal Vercel deploy)**
1. Run the children-per-family query. Decide the split for real.
2. Ship the entitlement schema + `is_premium()` + grandfather every existing family to premium.
3. Ship the DB triggers with the limits set to *premium* values, so nothing changes behaviour yet.
4. Enrol in the Small Business Program.
5. Write Terms of Service.

*Nothing is gated. Nothing is visible. All reversible.*

**Phase 2 — prove demand on the web (optional, no Apple cut, no binary)**
Stripe checkout for the browser PWA only. Small audience, but it tests price and messaging with
zero review risk. Skip if your traffic is overwhelmingly in-app.

**Phase 3 — native IAP (the real one)**
RevenueCat + `@revenuecat/purchases-capacitor` → new Codemagic build → App Store review. Paywall
behind the parent PIN, Restore Purchases, annual-hero + lifetime. Flip free-tier limits on for
**new** families only.

**Phase 4 — Android.** Play Billing via the same RevenueCat integration. Gated on the Play launch
(12-tester/14-day closed test) landing first.

**Phase 5 — optimise.** Win-back offers, lifetime at cancellation, trial length A/B (7 vs 14),
US-storefront external link if US volume justifies dodging the 15%.

---

## 8. Open decisions for Kiran

1. **Subscription vs one-time unlock?** (§3) — the biggest fork in this doc.
2. **Free = 1 child, or 2?** Run the query in §6 first.
3. **Is the co-parent invite premium?** It's the main lever on single-child families, but it also
   makes the app worse for the exact households most likely to recommend it.
4. **Downgrade behaviour** — soft-lock confirmed? (§4.2d)
5. **Trial length** — 7 or 14 days?

---

## Sources

- [RevenueCat — Apple anti-steering ruling & monetisation strategy](https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy/)
- [Apple — App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [RevenueCat — The 15% App Store Fee: A Guide for Developers (2026)](https://www.revenuecat.com/blog/engineering/small-business-program)
- [Apple — External Purchase (StoreKit)](https://developer.apple.com/documentation/storekit/external-purchase)
- [Apple — Communication and promotion of offers in the EU](https://developer.apple.com/support/communication-and-promotion-of-offers-on-the-app-store-in-the-eu/)
- [RevenueCat — App-to-web purchase guidelines](https://www.revenuecat.com/blog/engineering/app-to-web-purchase-guidelines)
- [Apple App Store fees 2026 — EU/DMA changes](https://blog.funnelfox.com/apple-app-store-fees-2026-eu-dma/)
