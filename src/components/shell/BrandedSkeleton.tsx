/**
 * BrandedSkeleton — the ONE calm loading state for the whole app.
 *
 * Two consumers share it so there is never drift between "the route chunk is
 * still downloading" and "auth is still resolving":
 *   1. App.tsx <Suspense fallback> — lazy route chunk in flight.
 *   2. RequireAuth — auth status === "loading" (waits, never flashes anon→authed).
 *
 * Cream field + the signature gold glow + the "Colors of Glory" eyebrow + a
 * three-bar skeleton. Deliberately standalone (does NOT compose AppShell) so it
 * is always safe to render as a Suspense fallback with zero further lazy work.
 */
const BrandedSkeleton = () => (
  <div className="relative min-h-screen bg-[var(--cog-cream)]" role="status" aria-live="polite">
    <div aria-hidden className="pointer-events-none fixed inset-0 cog-glow" />
    <div className="relative mx-auto flex min-h-screen w-full max-w-[var(--max-w-app)] flex-col justify-center px-8">
      <p
        className="mb-6 text-center text-xs font-medium uppercase"
        style={{ color: "var(--cog-muted)", letterSpacing: "0.24em" }}
      >
        Colors of Glory
      </p>
      <div className="space-y-3" aria-label="Loading">
        <div className="h-5 w-32 rounded-full" style={{ backgroundColor: "rgba(184,149,58,0.12)" }} />
        <div className="h-12 rounded-2xl bg-[var(--cog-cream-light)] shadow-[var(--cog-shadow-sm)]" />
        <div className="h-12 rounded-2xl bg-[var(--cog-cream-light)] shadow-[var(--cog-shadow-sm)]" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  </div>
);

export default BrandedSkeleton;
