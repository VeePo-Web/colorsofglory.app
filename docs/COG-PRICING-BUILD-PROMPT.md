# Colors of Glory — Pricing & Payment System
## Complete Build Prompt for Claude
## Ogilvy × Hormozi Sales Architecture × Supabase Billing
## 2026-06-04

---

## READ THIS FIRST — THE BUSINESS MODEL IN PLAIN ENGLISH

Before writing a single component, understand what we are selling and WHY each tier exists.

### The three tiers

**Free — "One Song, Full Power"**
The free tier is the most generous free tier in the songwriting app category. One song. All features. No restrictions. The user can write lyrics, record voice memos, add chords, invite collaborators, see the activity feed, and use version history — all on their one song. This is not a crippled demo. It is a complete creative workspace for one song.

Why: The first song is proof. If we can make a user believe in what we are building with one song, they will pay for more. The free tier is not charity — it is the best sales tool we have.

**Starter ($5/month) — "Your First Catalog"**
$5/month for 4 total songs (the 1 free + 3 more). No founder code discount on this tier — it is already priced for accessibility. This tier exists for the songwriter who wants to grow beyond their first song but is not ready to commit to Pro. It should feel like the obvious next step after the free tier, not a compromise.

Why: $5 is a decision that requires almost no mental energy. The psychological barrier between free and $5 is far lower than between free and $100. This tier captures users who would otherwise churn.

**Pro ($100/month) — "Your Full Songwriting Business"**
$100/month for 50 songs, unlimited voice memos, full version history, priority support, and export capabilities. This is the tier for professional songwriters, worship leaders with catalogs, and co-writing teams.

Founder code discount: 50% off = $49/month. This makes Pro feel like a steal for anyone with a code.

Referred pricing: If someone arrives via a referral link from a regular user, they see $49/month on the Pro card with the 50% referral discount clearly shown. This incentivizes both the referrer and the new user.

Why: $100/month is not expensive for a professional tool. The anchor is $100. The founder code and referral discount make $49 feel like an extraordinary deal because the anchor is $100.

---

### The referral structure

**Regular user referral (applies to Pro tier only):**
- User refers someone who signs up for Pro ($100/month or $49/month via referral)
- Referrer earns **$5/month** while the person stays on Pro
- The referred person sees **50% off** on the Pro card (pays $49/month)
- This is one level deep only. No multi-level.

**Founder code referral (applies to Pro tier only):**
- Founder uses their personal code to refer someone to Pro
- Founder earns **$25/month for the first 3 months**, then **$10/month ongoing**
- The person who used the founder code still gets **50% off Pro** ($49/month)
- Founder code does NOT work on Starter. Never.

### The "Referred" badge
When a user arrives via referral link (regular OR founder), the Pro pricing card must display:
- Price shown as ~~$100~~ **$49/month**
- A gold badge: "50% off — referred pricing"
- This is shown before they even click anything — it is the first thing they see

---

## OGILVY / HORMOZI SALES PRINCIPLES APPLIED TO EVERY SCREEN

**Ogilvy:** "The consumer is not a moron. She is your wife. Don't insult her intelligence."
→ Every price must be justified. Never just say "$100/month." Say "$100/month for 50 songs and a complete professional songwriting workspace."

**Hormozi:** "Make an offer so good people feel stupid saying no."
→ The founder code deal ($49/month for Pro) must be presented so clearly that not upgrading feels irrational.

**Ogilvy:** "Headlines are the most important element. Five times as many people read the headline as the body copy."
→ Every pricing card headline must sell the transformation, not the features.

**Hormozi:** "The price of the offer should always be revealed AFTER the value has been shown."
→ Show the songwriting workspace, the voice memos, the collaboration — then reveal the price.

**Applied rules for every pricing screen:**
1. Lead with the user's desired outcome, not the product's features
2. Show the "what you get" before the price
3. The ~~strikethrough~~ price technique creates loss aversion (always use it on discounted tiers)
4. Social proof near the price point — "songwriters trust COG" or similar
5. The secondary action (Stay on Free / Keep current plan) must not feel shameful
6. No fake urgency. No countdown timers. Real scarcity only.

---

## THE PRICING PAGE DESIGN

### Route: `/upgrade`
### Route: `/pricing` (same component, different entry point)

### Layout — Mobile first, one scroll

```
┌─────────────────────────────────────────────────────┐
│  [COG Crown + Colors of Glory — centered]            │
│                                                      │
│  Ready to build your catalog?                        │  ← Playfair 700, 34px
│  Free proves the workspace.                          │  ← Inter 400, 16px, #666
│  Pro becomes your creative business.                 │  ← Inter 400, 16px, #666
│                                                      │
│  [If referred: gold banner]                          │
│  ┌──────────────────────────────────────────────────┐│
│  │ 🎁 You were referred. 50% off Pro is yours.      ││  ← gold bg, warm copy
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──── FREE ────────────────────────────────────────┐│
│  │ Free                                              ││  ← #666 label
│  │ $0/month forever                                 ││  ← headline
│  │ ─────────────────────────────────────────────── ││
│  │ ✓ 1 complete song workspace                      ││
│  │ ✓ All features (lyrics, voice, chords, notes)    ││
│  │ ✓ Unlimited collaborators on that song           ││
│  │ ✓ Version history on that song                   ││
│  │ ✗ More songs                                     ││  ← red X for missing
│  │ ✗ Exports                                        ││
│  │                                                   ││
│  │ [Your current plan] — ghost state if on Free     ││
│  └───────────────────────────────────────────────── ┘│
│                                                      │
│  ┌──── STARTER ─────────────────────────────────────┐│
│  │ Starter                                           ││  ← #666 label
│  │ $5/month                                          ││
│  │ Your first real catalog                           ││  ← value headline
│  │ ─────────────────────────────────────────────── ││
│  │ ✓ Everything in Free                              ││
│  │ ✓ 3 more songs (4 total)                          ││
│  │ ✓ All features on all 4 songs                    ││
│  │ ✗ More songs                                     ││
│  │ ✗ Exports                                        ││
│  │ ✗ Founder code discount                          ││  ← explicit callout
│  │                                                   ││
│  │ [Start for $5/month] — gold pill CTA             ││
│  └───────────────────────────────────────────────── ┘│
│                                                      │
│  ┌──── PRO ─────────────────────────────────────────┐│  ← gold border, elevated
│  │ Pro         [MOST POPULAR]                        ││  ← gold chip
│  │                                                   ││
│  │  ~~$100~~  $49/month   [50% off — referred]      ││  ← if referred
│  │  $100/month                                       ││  ← if not referred
│  │                                                   ││
│  │ Your complete songwriting business                ││  ← value headline
│  │ ─────────────────────────────────────────────── ││
│  │ ✓ Everything in Starter                           ││
│  │ ✓ 50 songs                                       ││
│  │ ✓ 100GB voice memo storage                       ││
│  │ ✓ Unlimited exports (PDF, audio)                 ││
│  │ ✓ Founder code: 50% off forever                  ││
│  │ ✓ Priority support                               ││
│  │ ✓ Advanced version history                       ││
│  │                                                   ││
│  │ [Go Pro for $100/month] — gold, 56px pill        ││
│  │ (or: [Go Pro for $49/month — 50% off] if referred)│
│  └───────────────────────────────────────────────── ┘│
│                                                      │
│  [Founder code? Enter here to unlock 50% off Pro]   │  ← gold text link
│                                                      │
│  ─────────────────────────────────────────────────  │
│  Refer a songwriter. Earn every month.               │  ← Inter 600, 16px
│  $5/month per person you bring to Pro.               │  ← #666
│  [Copy my referral link →]                          │  ← gold, if Pro member
│                                                      │
│  [Stay on Free / Keep current plan]                 │  ← muted text link, never shamed
└─────────────────────────────────────────────────────┘
```

---

## COMPONENT ARCHITECTURE

```
src/
  pages/
    PricingPage.tsx                 ← /upgrade and /pricing
    checkout/
      CheckoutSuccessPage.tsx       ← after Stripe redirect
      CheckoutCancelPage.tsx        ← if they back out of Stripe

  components/
    pricing/
      PricingHero.tsx               ← headline + referred banner
      PricingCard.tsx               ← reusable tier card
      ReferredBanner.tsx            ← gold "50% off — referred pricing" banner
      FounderCodeInput.tsx          ← inline code entry on pricing page
      FeatureRow.tsx                ← ✓ / ✗ feature line
      ReferralEarnPanel.tsx         ← "Refer and earn" section at bottom

  hooks/
    usePricingContext.ts            ← loads current plan, referral state, founder code state
    useReferralAttribution.ts       ← reads referral code from URL/session

  lib/
    pricing/
      pricingApi.ts                 ← createCheckoutSession, getPortalUrl, getPlanDetails
      pricingConstants.ts           ← tier definitions, feature lists
```

---

## PRICING CONSTANTS (source of truth)

```typescript
// src/lib/pricing/pricingConstants.ts

export type PlanId = 'free' | 'starter' | 'pro';

export interface PricingTier {
  id: PlanId;
  name: string;
  tagline: string;               // value headline under the price
  priceMonthly: number;          // in cents: 0, 500, 10000
  pricedAt: number;              // display price (may differ if referred)
  referredPrice: number;         // in cents: same as priceMonthly for free/starter, 4900 for pro
  founderCodeApplies: boolean;   // false for starter
  songLimit: number;             // 1, 4, 50
  stripeLookupKey: string;       // 'starter_monthly' | 'pro_monthly'
  features: string[];
  missingFeatures: string[];
  ctaLabel: string;
  ctaLabelReferred?: string;     // different CTA copy when referred
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'One song. Full power.',
    priceMonthly: 0,
    pricedAt: 0,
    referredPrice: 0,
    founderCodeApplies: false,
    songLimit: 1,
    stripeLookupKey: '',
    features: [
      '1 complete song workspace',
      'All features (lyrics, voice, chords, notes)',
      'Unlimited collaborators on that song',
      'Version history on that song',
    ],
    missingFeatures: ['More songs', 'Exports'],
    ctaLabel: 'Your current plan',
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Your first real catalog.',
    priceMonthly: 500,       // $5.00
    pricedAt: 500,
    referredPrice: 500,      // no referred discount on Starter
    founderCodeApplies: false,
    songLimit: 4,
    stripeLookupKey: 'starter_monthly',
    features: [
      'Everything in Free',
      '3 more songs (4 total)',
      'All features on every song',
    ],
    missingFeatures: [
      'More than 4 songs',
      'Exports',
      'Founder code discount',
    ],
    ctaLabel: 'Start for $5/month',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Your complete songwriting business.',
    priceMonthly: 10000,     // $100.00
    pricedAt: 10000,
    referredPrice: 4900,     // $49.00 — referred or founder code
    founderCodeApplies: true,
    songLimit: 50,
    stripeLookupKey: 'pro_monthly',
    features: [
      'Everything in Starter',
      '50 songs',
      '100GB voice memo storage',
      'Unlimited exports (PDF, audio)',
      'Founder code: 50% off forever',
      'Priority support',
      'Advanced version history',
    ],
    missingFeatures: [],
    ctaLabel: 'Go Pro — $100/month',
    ctaLabelReferred: 'Go Pro — $49/month',
  },
];

// Referral earnings
export const REFERRAL_EARNINGS = {
  regular: {
    perMonth: 500,           // $5/month per active Pro referral
    appliesTo: ['pro'],
    description: '$5/month while your referral stays on Pro',
  },
  founder: {
    firstThreeMonths: 2500,  // $25/month for months 1-3
    ongoing: 1000,           // $10/month after month 3
    appliesTo: ['pro'],
    description: '$25/month for 3 months, then $10/month',
  },
};
```

---

## `PricingPage.tsx` — FULL SPECIFICATION

### State to load on mount
```typescript
const usePricingContext = () => {
  const [currentPlan, setCurrentPlan] = useState<PlanId>('free');
  const [isReferred, setIsReferred] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [founderCode, setFounderCode] = useState<string | null>(null);
  const [founderCodeValid, setFounderCodeValid] = useState(false);
  const [isFounderUser, setIsFounderUser] = useState(false);
  
  // Check URL params for referral code
  // Check sessionStorage for saved referral/founder context
  // Check Supabase for current user's plan tier
  // Check Supabase for founder status
};
```

### Referred banner (shown at TOP when isReferred === true)
```
Gold background: rgba(181,147,90,0.10)
Border: 1.5px solid rgba(181,147,90,0.30)
Text: "🎁 You were referred. 50% off Pro is waiting for you."
Icon: Gift or Sparkles
Position: between the headline and the first pricing card
Animation: slides down from above, 400ms cinematic ease
```

### Pro card special states

**State 1: No referral, no founder code (default)**
```
Price shown: $100/month
CTA: "Go Pro — $100/month"
No strikethrough
```

**State 2: Referred user OR valid founder code entered**
```
Price shown: ~~$100~~ $49/month
Gold chip: "50% off — referred pricing" or "50% off — founder code"
CTA: "Go Pro — $49/month  (50% off)"
Strikethrough on $100 using <del> or CSS
```

**State 3: Current Pro subscriber**
```
Price shown: $49 or $100 (their actual price)
CTA: "Your current plan" (disabled, not gold)
Small link: "Manage subscription →"
```

### Founder code inline entry (bottom of page)
```
"Have a founder code?" — gold text link, underlined
  → reveals an inline input (animates in, 280ms)
  → Input: "FOUNDER-XXXXXX", uppercase, monospace
  → "Apply code" button (small, gold)
  → On valid code: Pro card instantly updates to $49/month state
  → On invalid: friendly error below input
  → Note: code only works on Pro tier, not Starter — show this explicitly
```

### "Refer and earn" panel (shown only to Pro subscribers)
```
Position: below all pricing cards, above "Stay on Free"
Background: white card, subtle gold border

"Invite songwriters. Earn every month."
"You earn $5/month for every songwriter who stays on Pro."

Referral link card: app.colorsofglory.com/ref/[code]
[Copy link] [Share →]

"Direct referrals only. Payouts begin 30 days after their first payment."
```

---

## CHECKOUT FLOW

### When user taps a paid tier CTA:

```typescript
async function handleUpgrade(tierId: 'starter' | 'pro', isReferred: boolean) {
  // 1. Get or create Stripe checkout session
  const { url } = await pricingApi.createCheckoutSession({
    tierId,
    lookupKey: tier.stripeLookupKey,
    referralCode: isReferred ? referralCode : null,
    founderCode: founderCodeValid ? founderCode : null,
    successUrl: `${window.location.origin}/checkout/success`,
    cancelUrl: `${window.location.origin}/upgrade`,
  });
  
  // 2. Redirect to Stripe hosted checkout
  window.location.href = url;
}
```

### `CheckoutSuccessPage.tsx` (`/checkout/success`)
```
Layout: centered, cream background, CogBrand logo

[Gold checkmark circle — 64px]

"You're in."                         ← Playfair 700, 36px
"Your Pro workspace is ready."        ← Inter 400, 16px, #666

[Short delay: 1500ms → auto-navigate to song catalog]
OR
[Open my songs →] gold pill CTA

"Need help? help@colorsofglory.app"  ← small muted
```

### `CheckoutCancelPage.tsx` (`/checkout/cancel`)
```
[Back arrow]

"Changed your mind?"                  ← Playfair 600, 28px
"Your songs are safe. You can upgrade anytime." ← warm, no pressure

[See pricing again] — gold pill
[Back to my songs] — ghost / text link
```

---

## `pricingApi.ts` — SUPABASE + STRIPE CALLS

```typescript
// src/lib/pricing/pricingApi.ts

import { supabase } from '@/integrations/supabase/client';

/**
 * Create a Stripe checkout session via Supabase Edge Function.
 * Lovable must create: supabase/functions/create-checkout-session/index.ts
 */
export async function createCheckoutSession(params: {
  tierId: string;
  lookupKey: string;
  referralCode: string | null;
  founderCode: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: params,
  });
  if (error) throw error;
  return data as { url: string };
}

/**
 * Get Stripe customer portal URL for managing subscriptions.
 * Lovable must create: supabase/functions/create-portal-session/index.ts
 */
export async function getPortalUrl(returnUrl: string): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: { returnUrl },
  });
  if (error) throw error;
  return data as { url: string };
}

/**
 * Get the current user's plan and referral information.
 * Reads from Supabase tables: subscriptions, profiles, referral_attributions
 */
export async function getCurrentPlanDetails(): Promise<{
  planId: PlanId;
  isFounder: boolean;
  referralCode: string | null;
  referralCount: number;
  pendingEarnings: number;
  payableEarnings: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { planId: 'free', isFounder: false, referralCode: null, referralCount: 0, pendingEarnings: 0, payableEarnings: 0 };
  
  // Get subscription tier
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('sub_plan, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  
  // Get profile for referral code and founder status
  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code, referred_by_user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  
  const planId: PlanId = sub?.sub_plan === 'pro' || sub?.sub_plan === 'founder_pro' 
    ? 'pro' 
    : sub?.sub_plan === 'free' && sub?.status === 'active' 
    ? 'starter'  // sub_plan='free' with active sub = Starter in this schema?
    : 'free';
  
  return {
    planId,
    isFounder: sub?.sub_plan === 'founder_pro',
    referralCode: profile?.referral_code ?? null,
    referralCount: 0,  // fetch from referral_attributions if needed
    pendingEarnings: 0,
    payableEarnings: 0,
  };
}

/**
 * Validate a founder code on the pricing page.
 * Only valid for Pro tier — returns error if user tries on Starter.
 */
export async function validateFounderCode(code: string): Promise<{
  valid: boolean;
  errorMessage?: string;
}> {
  // Look up in Supabase founder_codes or codes table
  const { data } = await supabase
    .from('codes')
    .select('id, kind, status, max_redemptions')
    .eq('id', code.toUpperCase())  // adjust field name to match schema
    .maybeSingle();
  
  if (!data) return { valid: false, errorMessage: "We couldn't find that code. Check it and try again." };
  if (data.status !== 'active') return { valid: false, errorMessage: "This code is no longer active." };
  
  return { valid: true };
}
```

---

## LOVABLE BACKEND REQUIREMENTS (paste this into Lovable)

Before Claude can wire the checkout, Lovable must build:

### 1. Stripe Products + Prices (Stripe Dashboard)
```
Product: Colors of Glory Starter
  Price: $5.00/month recurring, lookup_key = 'starter_monthly'

Product: Colors of Glory Pro  
  Price: $100.00/month recurring, lookup_key = 'pro_monthly'
  Price: $49.00/month recurring, lookup_key = 'pro_monthly_referred'
    (this price is used when a referral/founder code is applied)
```

### 2. Supabase Edge Functions

**`create-checkout-session`**
```typescript
// Receives: { lookupKey, referralCode, founderCode, successUrl, cancelUrl }
// - Get or create Stripe customer for this user
// - If founderCode: validate code, apply referred price (pro_monthly_referred)
// - If referralCode: look up referrer, use pro_monthly_referred price
// - Create Stripe checkout session with correct price_id
// - Add metadata: { userId, referralCode, founderCode }
// - Return { url } of Stripe hosted checkout
```

**`create-portal-session`**
```typescript
// Receives: { returnUrl }
// - Get Stripe customer ID for current user
// - Create Stripe billing portal session
// - Return { url }
```

**`stripe-webhook`** (must exist)
```typescript
// Handles:
// - checkout.session.completed → activate subscription in Supabase
//   → if referralCode in metadata: create referral_attribution record
//   → if founderCode in metadata: validate and record code redemption
// - customer.subscription.deleted → cancel in Supabase
// - invoice.payment_failed → flag subscription as past_due
```

### 3. Referral commission logic (Supabase Edge Function or cron)
```
When a new Pro subscription activates with a referral_attribution:
  - Look up the referrer's plan status
  - If referrer is a founder: schedule $25/month × 3, then $10/month
  - If referrer is a regular user: schedule $5/month
  - Write to referral_commissions table
  - Payout runs on the 1st of each month (existing payout system)
```

### 4. Schema additions needed
```sql
-- referral_commissions (if not already exists)
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID REFERENCES auth.users(id),
  referee_user_id UUID REFERENCES auth.users(id),
  month_number INTEGER,          -- 1, 2, 3, 4...
  amount_cents INTEGER,          -- 2500 for first 3, 1000 after, 500 for regular
  commission_type TEXT,          -- 'founder_month_1_3' | 'founder_ongoing' | 'regular'
  status TEXT DEFAULT 'pending', -- pending | payable | paid
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## `UpgradePage.tsx` REBUILD — EXACT COMPONENT SPEC

Replace the existing `/upgrade` page with this full implementation. The current UpgradePage is a placeholder.

### Props / state
```typescript
interface UpgradePageState {
  currentPlan: PlanId;
  isReferred: boolean;
  referralCode: string | null;
  founderCode: string;            // input value
  founderCodeValid: boolean;
  founderCodeError: string | null;
  isValidatingCode: boolean;
  showCodeInput: boolean;
  isLoadingCheckout: boolean;
  checkoutError: string | null;
}
```

### Trigger conditions (when this page appears)
```typescript
// 1. User taps "Upgrade" anywhere in the app
// 2. User tries to create a 2nd song (free tier gate)
// 3. User tries to create a 5th song (starter tier gate)
// 4. User navigates to /upgrade or /pricing directly
// 5. User arrives via referral link (pre-populate referred state)

// Graceful gate message when triggered by song limit:
// Free → Starter trigger: "Your first song proved the workspace. Ready for more?"
// Starter → Pro trigger: "You're building a catalog. Time to go Pro."
```

### PricingCard component spec
```tsx
interface PricingCardProps {
  tier: PricingTier;
  isCurrentPlan: boolean;
  isHighlighted: boolean;        // Pro is highlighted
  isReferred: boolean;           // shows strikethrough + 50% badge
  founderCodeValid: boolean;     // same effect as isReferred for Pro
  onSelect: () => void;
  isLoading: boolean;
}

// Visual states:
// - Default: white card, standard border
// - Highlighted (Pro): gold border 1.5px #B5935A, slight elevation, "Most Popular" chip
// - isReferred Pro: adds strikethrough on original price, gold "50% off" chip
// - Current plan: CTA disabled, shows "Your current plan" label
// - Loading: CTA shows spinner, text "Opening checkout..."
```

---

## SALES COPY — EXACT STRINGS (verbatim, never deviate)

### Page headline
**Default:** "Ready to build your catalog?"
**When triggered by 2nd song attempt:** "Your first song is ready. Time to start the next one."
**When triggered by 5th song attempt:** "You've outgrown the Starter plan. Go Pro and keep writing."
**When referred user lands:** "You were referred. Here's what's waiting for you."

### Tier taglines (under the price)
- Free: "One song. Everything it needs."
- Starter: "Your first real catalog."
- Pro: "Your complete songwriting business."

### Pro card value headline (above features, below price)
"Professional songwriters use Colors of Glory to write, capture, and collaborate on 50 songs — with every voice memo, chord, and lyric version protected."

### Referred banner copy
"🎁 [First Name] invited you. 50% off Pro is yours — $49/month instead of $100."
If referrer name not known: "You were referred to Colors of Glory. 50% off Pro is yours."

### Founder code section
"Have a founder code? Enter it below to unlock 50% off Pro — forever."
Note below input: "Founder codes apply to Pro only, not Starter."
Invalid code: "That code didn't work. Check it and try again."
Valid code: "✓ Founder code applied. Pro is now $49/month for you."

### "Stay on Free" / "Keep current plan" link
"Keep my current plan" — always small, always muted, never red, never shaming

### Referral earn panel (Pro members only)
Headline: "Invite songwriters. Earn every month."
Body: "You earn $5/month for every songwriter who stays on Pro."
Rules: "Direct referrals only · 30-day payout hold · No commission during free trials"

---

## FEATURE GATING SYSTEM

When a free user tries to create a 2nd song, or a Starter user tries to create a 5th song, they should NOT see a generic error. They should see a **contextual upgrade nudge** that transitions smoothly into the pricing page.

### Gate trigger system

```typescript
// src/lib/pricing/useFeatureGate.ts

export function useFeatureGate() {
  const checkSongCreation = async (): Promise<'allowed' | 'needs_upgrade'> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'allowed'; // demo mode

    // Get current plan limit
    const { planId } = await getCurrentPlanDetails();
    const limit = PRICING_TIERS.find(t => t.id === planId)?.songLimit ?? 1;

    // Count owned songs
    const { count } = await supabase
      .from('song_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'owner');

    if ((count ?? 0) >= limit) return 'needs_upgrade';
    return 'allowed';
  };

  return { checkSongCreation };
}
```

### Gate UI (bottom sheet, not full page navigation)
```
Trigger: user taps "Create song" and they're at their limit.

Bottom sheet slides up:

[Crown icon + "Colors of Glory"]

"You've used your [1 / 4] song [slot / slots]."   ← dynamic
"[Upgrade to add more songs.]"

[Two inline cards: Starter / Pro — compact versions]
[with their CTAs]

[Keep my current plan] — text link, dismisses sheet
```

---

## PAGE TRANSITIONS ON UPGRADE SCREENS

Every pricing screen uses the existing `cog-page-enter` animation class (250ms slide from right). The bottom sheet gate uses `cog-sheet-enter` (400ms slide up).

The `CheckoutSuccessPage` uses a special celebration entrance:
```css
@keyframes cog-success-scale {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
.success-icon {
  animation: cog-success-scale 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
```

---

## TESTING CHECKLIST

**Tier visibility:**
- [ ] Free user sees all 3 tiers, current plan marked
- [ ] Starter user sees upgrade options to Pro, current plan marked
- [ ] Pro user sees "Your current plan" on Pro, referral earn panel visible
- [ ] Founder Pro user sees referral earn panel with founder commission rates

**Referred state:**
- [ ] User arrives via referral link → referred banner appears
- [ ] Pro card shows ~~$100~~ $49/month with 50% chip
- [ ] CTA copy changes to "Go Pro — $49/month"
- [ ] Non-Pro tiers are unaffected by referral (Starter stays $5)
- [ ] Referral state survives page refresh (sessionStorage)

**Founder code:**
- [ ] Valid Pro founder code → Pro card updates to $49/month
- [ ] Entering founder code on a non-Pro tier shows "applies to Pro only"
- [ ] Invalid code shows friendly error, Pro card unchanged
- [ ] Code field does not appear if user is already Pro

**Checkout:**
- [ ] Starter checkout creates Stripe session with starter_monthly lookup key
- [ ] Pro checkout (no code) creates session with pro_monthly (full price)
- [ ] Pro checkout (referred/code) creates session with pro_monthly_referred price
- [ ] Success page appears after Stripe redirect
- [ ] Cancel page appears if user exits Stripe checkout
- [ ] Plan updates in Supabase after webhook fires (may be 5-10s delay)

**Song gate:**
- [ ] Free user creating 2nd song → gate sheet appears
- [ ] Starter user creating 5th song → gate sheet appears
- [ ] After successful upgrade → song creation continues without interruption

**Referral earnings (Pro members):**
- [ ] Referral earn panel visible only to Pro members
- [ ] Referral link copies to clipboard
- [ ] Share button triggers native share sheet on iOS
- [ ] Panel not visible to Free or Starter members

---

## WHAT NOT TO BUILD

- No fake countdown timers or "offer expires" language — this brand is honest
- No aggressive popups that block content — the gate uses a bottom sheet only
- No dark patterns (hide the "keep free" option, confusing checkbox pre-selection)
- No "unlimited" claims — we say "50 songs" and "100GB" specifically
- No comparison to competitors by name
- No social proof numbers we cannot verify ("10,000 songwriters trust us")
- No price anchoring that isn't real (the $100 anchor IS real — it's the actual Pro price)

---

*Prompt prepared: 2026-06-04*
*Implement UpgradePage.tsx first (visible immediately), then CheckoutSuccessPage, then the gate system*
*All Stripe integration goes through Lovable's Edge Functions — Claude handles only the frontend*
