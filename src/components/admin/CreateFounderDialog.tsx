import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateFounder } from "@/integrations/cog/admin";

export default function CreateFounderDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [first6, setFirst6] = useState(2000);
  const [ongoing, setOngoing] = useState(1000);
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: () =>
      adminCreateFounder({
        display_name: displayName,
        slug: slug.toLowerCase(),
        reward_profile: { first6_cents: first6, ongoing_cents: ongoing, first6_months: 6 },
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success("Founder created");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setOpen(false);
      setDisplayName(""); setSlug(""); setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button>New founder</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create founder</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="jane-doe" />
            <p className="text-xs text-[var(--cog-muted)] mt-1">lowercase, numbers, dashes (2–40)</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First 6mo (cents/mo)</Label>
              <Input type="number" value={first6} onChange={(e) => setFirst6(Number(e.target.value))} />
            </div>
            <div>
              <Label>Ongoing (cents/mo)</Label>
              <Input type="number" value={ongoing} onChange={(e) => setOngoing(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !displayName || !slug}>
            {m.isPending ? "Creating…" : "Create founder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}