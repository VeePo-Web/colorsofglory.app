import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import MemoStack, { type StackMemoView } from "./MemoStack";

/**
 * StackSheet — the tap-to-expand bottom sheet that holds a memo stack.
 *
 * On the canvas a voice base shows as one calm card; tapping "Layers" lifts
 * this sheet so the base and everything recorded over it play together, with
 * "Record over this" right there. Safe-area aware, dismissible, never traps.
 */
interface StackSheetProps {
  base: StackMemoView;
  layers: StackMemoView[];
  bpm?: number | null;
  canRecordOver: boolean;
  onRecordOver: (baseMemoId: string) => void;
  onClose: () => void;
  /** Optional pre-record tempo transport (TempoRow) — shown under the stack. */
  tempoSlot?: ReactNode;
}

const StackSheet = ({ base, layers, bpm, canRecordOver, onRecordOver, onClose, tempoSlot }: StackSheetProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.55)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          opacity: visible ? 1 : 0, transition: "opacity 280ms ease",
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Voice memo stack: ${base.title}`}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 800,
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          maxHeight: "85dvh", overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div style={{ position: "relative", padding: "0 20px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "#CCC", margin: "12px auto 16px" }} aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute", top: 8, right: 16,
              width: 44, height: 44, borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#666",
            }}
            aria-label="Close stack"
          >
            <X size={18} />
          </button>
          <MemoStack
            base={base}
            layers={layers}
            bpm={bpm}
            canRecordOver={canRecordOver}
            onRecordOver={onRecordOver}
          />
          {tempoSlot}
        </div>
      </div>
    </>
  );
};

export default StackSheet;
