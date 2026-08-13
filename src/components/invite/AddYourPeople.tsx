import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { addMember, removeMember } from "@/integrations/cog/members";
import { useKnownPeople } from "@/lib/invite/useKnownPeople";

interface AddYourPeopleProps {
  songId: string;
  songTitle: string;
  /** The signed-in owner's user id — the hook and inserts key off it. */
  myUserId: string | null;
}

/**
 * "Your people" — THE BAND SHELF's one-tap band lever, inside the ONE door.
 *
 * Everyone already writing with you in other songs, who isn't in this one:
 * one tap adds them (owner-only by RLS — the host only mounts this for the
 * owner), the song appears on their shelf, Undo in the toast. The share link
 * above stays the hero for people not yet in any song with you.
 */
const AddYourPeople = ({ songId, songTitle, myUserId }: AddYourPeopleProps) => {
  const { people } = useKnownPeople(myUserId, songId);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  if (people.length === 0) return null;

  const handleAdd = async (userId: string, firstName: string) => {
    if (busy.has(userId) || added.has(userId)) return;
    setBusy((prev) => new Set(prev).add(userId));
    try {
      await addMember(songId, userId);
      setAdded((prev) => new Set(prev).add(userId));
      toast(`${firstName} is in — “${songTitle}” is on their shelf now.`, {
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () => {
            void removeMember(songId, userId).then(() => {
              setAdded((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
              });
            }).catch(() => toast.error(`Couldn't remove ${firstName} — try again.`));
          },
        },
      });
    } catch {
      toast.error(`Couldn't add ${firstName} — check your connection and try again.`);
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--cog-muted)", fontFamily: "var(--font-body)", marginBottom: 4 }}>
        Your people
      </p>
      <p style={{ fontSize: 12, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", margin: "0 0 8px" }}>
        Already writing with you elsewhere — one tap opens this song for them too.
      </p>
      {people.map((person) => {
        const isAdded = added.has(person.userId);
        const isBusy = busy.has(person.userId);
        return (
          <div
            key={person.userId}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--cog-border)" }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 34, height: 34, borderRadius: "50%", backgroundColor: person.avatarColor,
                color: "#FFF", fontSize: 11, fontWeight: 700, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {person.initials}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--cog-charcoal)", fontFamily: "var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {person.name}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
                {person.songCount} {person.songCount === 1 ? "song" : "songs"} together
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleAdd(person.userId, person.firstName)}
              disabled={isBusy || isAdded}
              aria-label={isAdded ? `${person.firstName} is in this song` : `Add ${person.firstName} to this song`}
              className="cog-press"
              style={{
                minHeight: 36, minWidth: 72, padding: "0 12px", borderRadius: 12,
                cursor: isAdded ? "default" : "pointer",
                border: isAdded ? "1px solid rgba(83,171,139,0.4)" : "1.5px solid var(--cog-gold)",
                backgroundColor: isAdded ? "rgba(83,171,139,0.10)" : "transparent",
                color: isAdded ? "#53AB8B" : "var(--cog-gold)",
                fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              {isAdded
                ? <><Check size={14} strokeWidth={2.2} /> In</>
                : <><Plus size={14} strokeWidth={2.2} /> {isBusy ? "Adding…" : "Add"}</>}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default AddYourPeople;
