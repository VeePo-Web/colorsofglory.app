## Cause
The app is not routing to an empty page; the deployed JavaScript crashes before React mounts.

Console error on `https://colorsofglory.app/`:

```text
TypeError: Cannot read properties of undefined (reading 'createContext')
at /assets/vendor-CIe1uVee.js
```

The deployed chunks have a circular dependency created by the custom `manualChunks` setup in `vite.config.ts`:

```text
vendor-CIe1uVee.js imports React from vendor-react-C08XpkqY.js
vendor-react-C08XpkqY.js imports helpers/modules back from vendor-CIe1uVee.js
```

Because of that cycle, React is still undefined when a dependency calls `React.createContext`, so the app never renders. CSS still loads, which is why every route appears as a blank cream/white page.

## Fix plan
1. Update `vite.config.ts` to remove the fragile custom `manualChunks` split that separates React from packages that depend on React.
2. Let Vite/Rollup create safe chunks automatically, or use a simpler chunk strategy that keeps React-dependent libraries out of the generic vendor cycle.
3. Re-check the app in the preview after the dev server restarts.
4. After you approve and the fix is implemented, publish again so `colorsofglory.app` receives the corrected bundle.

## Files to change
- `vite.config.ts` only.

## Expected result
- No `createContext` crash.
- React mounts normally.
- The password gate/auth pages render instead of a blank background.