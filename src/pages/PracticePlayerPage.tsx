import { Suspense, lazy } from "react";

const PracticePlayerExperience = lazy(() => import("./PracticePlayerExperience"));

const PracticePlayerPageFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-[var(--cog-cream)]">
    <div className="pointer-events-none absolute inset-0 cog-glow" />
    <p className="relative text-sm font-medium text-[var(--cog-warm-gray)]">Preparing practice...</p>
  </div>
);

const PracticePlayerPage = () => (
  <Suspense fallback={<PracticePlayerPageFallback />}>
    <PracticePlayerExperience />
  </Suspense>
);

export default PracticePlayerPage;
