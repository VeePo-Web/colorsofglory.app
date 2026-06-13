import { useContext } from "react";
import { PracticePlayerContext } from "@/components/practice/practicePlayerContextValue";
import type { PracticePlayerHook } from "@/hooks/usePracticePlayer";

export function usePracticeContext(): PracticePlayerHook {
  const ctx = useContext(PracticePlayerContext);
  if (!ctx) {
    throw new Error("usePracticeContext must be used inside <PracticePlayerProvider>");
  }
  return ctx;
}
