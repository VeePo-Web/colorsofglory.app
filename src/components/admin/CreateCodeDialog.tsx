import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminCreateFounderCode, adminFounderSummary } from "@/integrations/cog/admin";
import { toast } from "@/hooks/use-toast";

export default function CreateCodeDialog({ founderId }: { founderId?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(founderId ?? "");
  const [code, setCode] = useState("");
  const [maxRed, setMaxRed] = useState("");
  const [expires, setExpires] = useState("");
  const [label, setLabel] = useState("");

  const { data: founders = [] } = useQuery({
    queryKey: ["admin", "founders"],
    queryFn: adminFounderSummary,
    enabled: open && !founderId,
  });

  const mut = useMutation({
    mutationFn: () =>
      adminCreateFounderCode({
        founder_id: founderId ?? selected,
        code: code.trim().toUpperCase(),
        max_redemptions: maxRed ? parseInt(maxRed, 10) : null,
        expires_at: expires || null,
        label: label.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "Code created" });
      qc.invalidateQueries({ queryKey: ["admin"] });
      setOpen(false);
      setCode(""); setMaxRed(""); setExpires(""); setLabel("");
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const validCode = /^[A-Z0-9-]{4,32}$/.test(code.trim().toUpperCase());
  const targetFounder = founderId ?? selected;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New code</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create founder code</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!founderId && (
            <div>
              <Label>Founder</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Pick a founder" /></SelectTrigger>
                <SelectContent>
                  {(founders as Array<{ founder_id: string; display_name: string; slug: string }>).map((f) => (
                    <SelectItem key={f.founder_id} value={f.founder_id}>
                      {f.display_name} ({f.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Code (A-Z, 0-9, dash; 4–32)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max redemptions</Label>
              <Input type="number" value={maxRed} onChange={(e) => setMaxRed(e.target.value)} placeholder="unlimited" />
            </div>
            <div>
              <Label>Expires at</Label>
              <Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!validCode || !targetFounder || mut.isPending}>
            {mut.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}