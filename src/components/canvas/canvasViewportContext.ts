import { createContext, useContext } from "react";

export interface CanvasViewportContextValue {
  canvasToScreen: (cx: number, cy: number) => { x: number; y: number };
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number };
  panTo: (cx: number, cy: number, vcx: number, vcy: number, ms?: number) => void;
  zoom: number;
  panX: number;
  panY: number;
}

export const CanvasViewportContext = createContext<CanvasViewportContextValue | null>(null);

export function useCanvasViewport(): CanvasViewportContextValue {
  const ctx = useContext(CanvasViewportContext);
  if (!ctx) throw new Error("useCanvasViewport must be used inside <CanvasViewport>");
  return ctx;
}

