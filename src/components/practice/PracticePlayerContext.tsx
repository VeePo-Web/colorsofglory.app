import { type ReactNode } from "react";
import { usePracticePlayer } from "@/hooks/usePracticePlayer";
import { PracticePlayerContext } from "./practicePlayerContextValue";

export function PracticePlayerProvider({ children }: { children: ReactNode }) {
  const hook = usePracticePlayer();
  return (
    <PracticePlayerContext.Provider value={hook}>
      {children}
    </PracticePlayerContext.Provider>
  );
}
