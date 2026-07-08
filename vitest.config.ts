import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Heavier render tests (e.g. the canvas suite) can exceed the 5s default
    // under full-suite CPU contention; give them headroom so CI is deterministic.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Type-level contract tests (A2). Only activated by the `--typecheck` flag
    // (see `npm run test:types`), so a plain `vitest run` is unaffected. Scoped
    // to *.test-d.ts and `ignoreSourceErrors` so ONLY the contract assertions in
    // those files can fail — never unrelated in-progress errors elsewhere.
    typecheck: {
      tsconfig: "./tsconfig.app.json",
      include: ["src/test/**/*.test-d.ts"],
      ignoreSourceErrors: true,
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
