## Goal
The app should load straight to the real experience — no "Private preview" password screen.

## Changes

1. **`src/App.tsx`**
   - Drop the `unlocked` state, the `isPreviewUnlocked()` import, the lazy `PasswordGate` import, and the early-return branch that renders the gate.
   - App renders the provider stack + router unconditionally.

2. **Cleanup**
   - Delete `src/components/PasswordGate.tsx` (contains a hardcoded site password — should not ship).
   - Delete `src/lib/preview/previewUnlock.ts` if nothing else imports it (verify with a search first; if other files reference it, leave it and just unwire App).

## Notes
- The real auth wall (`RequireAuth`, `BYPASS_AUTH = false`) is unaffected — protected routes still require sign-in.
- After the edit I'll typecheck/build and load the preview to confirm the app boots straight to the catalog/auth route.
