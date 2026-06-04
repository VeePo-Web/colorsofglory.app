import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCreateFounder } from "@/integrations/cog/admin";
import { toast } from "@/hooks/use-toast";

export default function CreateFounderDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [first6, setFirst6] = useState("500");
  const [ongoing, setOngoing] = useState("200");
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      adminCreateFounder({
        display_name: displayName.trim(),
        slug: slug.trim().toLowerCase(),
        reward_profile: {
          first6_cents: parseInt(first6, 10) || 0,
          ongoing_cents: parseInt(ongoing, 10) || 0,
          first6_months: 6,
        },
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "Founder created" });
      qc.invalidateQueries({ queryKey: ["admin", "founders"] });
      setOpen(false);
      setDisplayName(""); setSlug(""); setNotes("");
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New founder</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create founder</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="jane-doe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First 6mo (cents/mo)</Label>
              <Input type="number" value={first6} onChange={(e) => setFirst6(e.target.value)} />
            </div>
            <div>
              <Label>Ongoing (cents/mo)</Label>
              <Input type="number" value={ongoing} onChange={(e) => setOngoing(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!displayName || !slug || mut.isPending}>
            {mut.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}