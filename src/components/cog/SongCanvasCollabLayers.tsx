import { ElementType, ReactNode } from "react";
import { Activity as ActivityIcon, Users } from "lucide-react";

interface Collaborator {
  initials: string;
  name: string;
  role: string;
  color: string;
}

interface ActivityItem {
  id: string;
  actor: string;
  summary: string;
  context: string;
  color: string;
}

interface SongCanvasCollabLayersProps {
  activeLayer: string;
}

const COLLABORATORS: Collaborator[] = [
  { initials: "PK", name: "Parker", role: "Owner", color: "#B8953A" },
  { initials: "SM", name: "Sarah M.", role: "Contributor", color: "#53AB8B" },
  { initials: "CR", name: "Caleb R.", role: "Reviewer", color: "#8070C4" },
];

const ACTIVITY: ActivityItem[] = [
  {
    id: "activity-1",
    actor: "Sarah",
    summary: "added a chorus memo",
    context: "Voice - 1:14 - pending listen",
    color: "#53AB8B",
  },
  {
    id: "activity-2",
    actor: "Caleb",
    summary: "suggested Am instead of Em",
    context: "Chords - Verse 1 - review",
    color: "#8070C4",
  },
  {
    id: "activity-3",
    actor: "Parker",
    summary: "moved the chorus into Final",
    context: "Ideas Tree -> Final Tree",
    color: "#B8953A",
  },
];

const SongCanvasCollabLayers = ({ activeLayer }: SongCanvasCollabLayersProps) => (
  <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
    <PeopleRoomCard active={activeLayer === "people" || activeLayer === "room"} />
    <ActivityRoomCard />
  </section>
);

interface RoomCardProps {
  active?: boolean;
  children: ReactNode;
  id?: string;
}

const RoomCard = ({ active = false, children, id }: RoomCardProps) => (
  <section
    id={id}
    className="rounded-[22px] p-4 transition-colors duration-150"
    style={{
      backgroundColor: "rgba(250,247,242,0.90)",
      border: active ? "1.5px solid var(--cog-border-gold)" : "1px solid rgba(28,26,23,0.08)",
      boxShadow: active ? "0 14px 34px rgba(184,149,58,0.14)" : "0 8px 22px rgba(28,26,23,0.06)",
    }}
  >
    {children}
  </section>
);

const RoomHeading = ({ icon: Icon, eyebrow, title }: { icon: ElementType; eyebrow: string; title: string }) => (
  <div className="mb-3 flex items-start justify-between gap-3">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--cog-muted)" }}>
        {eyebrow}
      </p>
      <h2 className="text-xl font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
    </div>
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "var(--cog-gold-alt)" }}
      aria-hidden
    >
      <Icon size={18} strokeWidth={1.7} />
    </span>
  </div>
);

const PeopleRoomCard = ({ active }: { active: boolean }) => (
  <RoomCard id="layer-people" active={active}>
    <RoomHeading icon={Users} eyebrow="Collaboration" title="In this room" />
    <div className="grid gap-2 sm:grid-cols-3">
      {COLLABORATORS.map((person) => (
        <article
          key={person.name}
          className="flex items-center gap-3 rounded-2xl p-3"
          style={{ backgroundColor: "rgba(250,247,242,0.72)", border: "1px solid rgba(28,26,23,0.08)" }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: `${person.color}22`, color: person.color }}
          >
            {person.initials}
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
              {person.name}
            </p>
            <p className="text-xs" style={{ color: "var(--cog-muted)" }}>
              {person.role}
            </p>
          </div>
        </article>
      ))}
    </div>
  </RoomCard>
);

const ActivityRoomCard = () => (
  <RoomCard>
    <RoomHeading icon={ActivityIcon} eyebrow="Remember changes" title="What changed" />
    <div className="space-y-2">
      {ACTIVITY.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl p-3"
          style={{
            backgroundColor: "rgba(250,247,242,0.72)",
            border: "1px solid rgba(28,26,23,0.08)",
            borderLeft: `3px solid ${item.color}`,
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
            {item.actor} {item.summary}
          </p>
          <p className="text-xs" style={{ color: "var(--cog-muted)" }}>
            {item.context}
          </p>
        </article>
      ))}
    </div>
  </RoomCard>
);

export default SongCanvasCollabLayers;
