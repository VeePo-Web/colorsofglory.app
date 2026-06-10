# Plan — Password Gate + Google Search Console

Two independent changes:

## 1. Site-wide password gate (mirrors RoyalMechanical.com)

- Create `src/components/PasswordGate.tsx` — same structure as the reference project, restyled with COG tokens (cream bg, gold accent, serif "Colors of Glory" wordmark instead of the Royal lion). Password constant: `"COLORSOFGLORYCOLORSOFGLORY"`. On success writes `sessionStorage.site_unlocked = "true"`, calls `onUnlock`.
- Edit `src/App.tsx`:
  - `const PasswordGate = React.lazy(() => import("@/components/PasswordGate"));`
  - Add `const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("site_unlocked") === "true");`
  - Before the `<QueryClientProvider>` return, if `!unlocked`, render `<Suspense fallback={<div className="min-h-screen bg-[var(--cog-cream)]" />}><PasswordGate onUnlock={() => setUnlocked(true)} /></Suspense>`.
- Gate runs once per browser session (sessionStorage). Persists across SPA navigations but re-prompts after tab close.
- Important caveat I'll flag in the closing message: the password is client-side (anyone can read it in the JS bundle, same as RoyalMechanical). It also blocks Googlebot from indexing the body content — so page views per URL will be limited to people who type in the password. GSC verification still works because the verification meta tag lives in `<head>` of `index.html`, which is served before React mounts.

## 2. Connect colorsofglory.app to Google Search Console

Connector "Parker's Google Search Console" is available (`linkable: yes`, not yet linked).

Steps:
1. `standard_connectors--connect` with `connector_id: google_search_console` and the connection above → injects `LOVABLE_API_KEY` + `GOOGLE_SEARCH_CONSOLE_API_KEY` into env.
2. Call gateway `POST /siteVerification/v1/token` with `{"site":{"identifier":"https://colorsofglory.app/","type":"SITE"},"verificationMethod":"META"}` → returns the `google-site-verification` content string.
3. Inject `<meta name="google-site-verification" content="<TOKEN>" />` into `index.html` `<head>` (above the title tag is fine; per guard rules `<noscript>` rules don't apply to a normal `<meta>`).
4. Tell the user to **publish** (the verification needs the live `colorsofglory.app` to serve the meta tag). I'll surface the publish action.
5. After they confirm published, call gateway `POST /siteVerification/v1/webResource?verificationMethod=META` with the same site identifier → expect 200.
6. Call gateway `PUT /webmasters/v3/sites/https%3A%2F%2Fcolorsofglory.app%2F` to add it to their Search Console property list.

Sequencing: step 5 needs the deploy live, so I'll do steps 1–4 in one batch, then wait for the user's "published" confirmation before doing 5–6. If step 5 fails with `failedToFindMetaTag`, I'll have the user confirm the deploy finished and retry.

## Out of scope

- No SEO copy changes.
- No sitemap/robots changes (existing files untouched).
- No backend / DB changes.
- Not changing publish visibility (stays public so GSC can reach it).

## Files touched

- create `src/components/PasswordGate.tsx`
- edit `src/App.tsx` (lazy import + gate wrapper)
- edit `index.html` (one `<meta name="google-site-verification">` line)
