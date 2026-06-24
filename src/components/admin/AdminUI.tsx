import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Shared admin UI primitives — consistent money formatting, skeletons, and a
// polished in-app prompt/confirm dialog that replaces jarring window.prompt /
// window.confirm calls (frictionless, Temu-style: inline, non-blocking, fast).

export const money = (c: number) =>
  `$${((c ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Skeleton rows for a table body while loading (skeletons over spinners). */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-[var(--cog-border)]">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-4 rounded bg-[var(--cog-cream-dark)] animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * Controlled prompt/confirm dialog. Omit `label` for a pure confirm (no input).
 * Enter submits; Esc/Cancel closes. `tone="danger"` styles the confirm button.
 */
export function PromptDialog({
  open,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  required = false,
  confirmLabel = "Confirm",
  tone = "default",
  busy = false,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  confirmLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onConfirm: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const hasInput = label !== undefined;
  const [v, setV] = useState(defaultValue);
  useEffect(() => {
    if (open) setV(defaultValue);
  }, [open, defaultValue]);

  const canConfirm = !busy && (!required || v.trim().length > 0);
  const submit = () => { if (canConfirm) onConfirm(v.trim()); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && <p className="text-sm text-[var(--cog-warm-gray)]">{description}</p>}
        {hasInput && (
          <label className="flex flex-col gap-1">
            {label && <span className="text-xs uppercase tracking-wider text-[var(--cog-warm-gray)]">{label}</span>}
            <Input
              autoFocus
              value={v}
              onChange={(e) => setV(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!canConfirm}
            onClick={submit}
            className={tone === "danger" ? "bg-[#b3261e] hover:bg-[#9a201a] text-white" : undefined}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
