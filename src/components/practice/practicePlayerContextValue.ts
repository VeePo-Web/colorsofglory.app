import { createContext } from "react";
import type { PracticePlayerHook } from "@/hooks/usePracticePlayer";

export const PracticePlayerContext = createContext<PracticePlayerHook | null>(null);
