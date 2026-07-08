import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminCreateFounderCode, adminFounderSummary } from "@/integrations/cog/admin";
import { qk } from "@/hooks/queryKeys";

const CODE_RE = /^[A-Z0-9-]{4,32}$/;

export default function CreateCodeDialog({
  trigger,
  defaultFounderId,
}: {
  trigger?: React.ReactNode;
  defaultFounderId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [founderId, setFounderId] = useState(defaultFounderId ?? "");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState("");
  const qc = useQueryClient();

  const { data: founders } = useQuery({
    queryKey: qk.admin.founderSummary(),
    queryFn: adminFounderSummary,
    enabled: open && !defaultFounderId,
  });

  const upper = code.toUpperCase();
  const valid = CODE_RE.test(upper) && (defaultFounderId || founderId);

  const m = useMutation({
    mutationFn: () =>
      adminCreateFounderCode({
        founder_id: (defaultFounderId ?? founderId) as string,
        code: upper,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        label: label || null,
      }),
    onSuccess: () => {
      toast.success("Code created");
      qc.invalidateQueries({ queryKey: qk.admin.root() });
      setOpen(false);
      setCode(""); setLabel(""); setMaxRedemptions(""); setExpiresAt("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button>New code</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create founder code</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!defaultFounderId && (
            <div>
              <Label>Founder</Label>
              <Select value={founderId} onValueChange={setFounderId}>
                <SelectTrigger><SelectValue placeholder="Pick a founder" /></SelectTrigger>
                <SelectContent>
                  {(founders ?? []).map((f) => (
                    <SelectItem key={f.founder_id} value={f.founder_id}>
                      {f.display_name} ({f.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GRACE-2026" />
            <p className="text-xs text-[var(--cog-muted)] mt-1">A–Z, 0–9, dash. 4–32 chars.</p>
          </div>
          <div>
            <Label>Label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Spring launch" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max redemptions</Label>
              <Input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="unlimited" />
            </div>
            <div>
              <Label>Expires at</Label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !valid}>
            {m.isPending ? "Creating…" : "Create code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}