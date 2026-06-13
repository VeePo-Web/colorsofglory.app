# Frictionless Google Sign-In — The Right Path at Scale

## The honest answer

There is no integration shortcut that gives you Google sign-in with **zero "Lovable" branding** *without* you registering your own Google OAuth app. That's a Google requirement, not a Lovable one — whoever owns the OAuth client is the name Google shows on the consent screen.

Two paths exist. Only one matches your bar ("scale to millions, perfect, frictionless, no Lovable").

---

## Path A — Your own Google OAuth app (RECOMMENDED)

**What the user sees:**
- Tap "Continue with Google"
- Google consent screen says: **"Colors of Glory wants to access your Google Account"** with your logo
- Tap allow → returned to `colorsofglory.app`, signed in
- One tap. No Lovable anywhere. Ever.

**What it costs you:** ~5 minutes, one time, free forever. Google does not charge for OAuth.

**What I do:**
1. Code is already wired to native Google OAuth (`src/integrations/cog/auth.ts`).
2. Once you give me the Client ID + Secret, I store them on the backend Google provider via the secure secrets tool.
3. I verify the full flow end-to-end in preview and confirm zero Lovable branding appears at any step.

**What you do (one time, in Google Cloud Console — console.cloud.google.com):**
1. Create project "Colors of Glory"
2. **OAuth consent screen** → External
   - App name: `Colors of Glory`
   - User support email: your email
   - Logo: upload your gold COG mark
   - Authorized domains: `colorsofglory.app`
   - Scopes: `openid`, `userinfo.email`, `userinfo.profile`
   - Publish (move out of Testing → Production so anyone can sign in)
3. **Credentials → Create OAuth Client ID → Web application**
   - Name: `Colors of Glory Web`
   - Authorized redirect URI: `https://vsiecltcxsuuulbczexl.supabase.co/auth/v1/callback`
4. Copy **Client ID** and **Client Secret**, paste them to me

That's it. From then on, every user — first one or millionth — sees only your brand.

---

## Path B — Email + password only (skip Google for now)

If you don't want to do the Google Cloud step today, we ship with email/password + magic link only. Still frictionless (one field, one tap), zero Lovable branding, and we add Google later when you have 5 minutes. The Google button is hidden until then.

---

## What I need from you

Pick one:
- **A** — "I'll do the Google Cloud step now" → I'll send the exact screenshots/links and stand by to wire the credentials the moment you have them.
- **B** — "Hide Google for now, ship email-only" → I remove the Google button cleanly and we revisit later.

There is no Path C that gives unbranded Google sign-in without owning the OAuth app — that's a Google policy, not a platform limitation.