/**
 * D2 feature-logic layer — the canvas interaction state machines.
 * D3 layers multiplayer onto these hooks; A4 replaces the mutations impl.
 * Contract: docs/CANVAS-FEATURES-CONTRACT.md
 */
export { useListenPath, type ListenPathApi } from "./useListenPath";
export { useCompareMode, type CompareModeApi } from "./useCompareMode";
export { useMergeSplice, type MergeSpliceApi } from "./useMergeSplice";
export { useFinalArrangement, type FinalArrangementApi } from "./useFinalArrangement";
export { useCanvasMetronome, type CanvasMetronomeApi } from "./useCanvasMetronome";
export { usePrefersReducedMotion } from "./usePrefersReducedMotion";
export {
  newFeatureCardId,
  type CanvasFeatureMutations,
  type CanvasFeatureMeta,
} from "./mutations";
export { memoIdForCard, playMemoOnCanvas, pauseCanvasAudio, stopCanvasAudio } from "./canvasAudio";
