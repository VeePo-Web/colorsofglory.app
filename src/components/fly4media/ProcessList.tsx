import { useReveal, useRevealStagger } from "./useReveal";

const STEPS = [
  { n: "01", title: "Discovery", desc: "The first call isn't a sales call. I'm listening for the thing under the brief — the reason you actually picked up the phone." },
  { n: "02", title: "Creative Direction", desc: "Before anything flies, you see the film on paper. Storyboards, shot lists, references. Nothing leaves the ground until you've nodded." },
  { n: "03", title: "Production", desc: "Cinema-grade and patient. I'd rather lose a day to weather than hand you a shot we both know is just fine." },
  { n: "04", title: "Delivery", desc: "Master files, channel-ready cuts, and the version your team will actually use on Monday. The job isn't done until the room goes quiet when it plays." },
];

export default function ProcessList() {
  const headRef = useReveal<HTMLDivElement>();
  const listRef = useRevealStagger<HTMLUListElement>();
  return (
    <section className="bg-background py-section">
      <div className="container-x">
        <div ref={headRef} className="reveal grid grid-cols-1 lg:grid-cols-12 gap-y-10 mb-16 lg:mb-24">
          <p className="lg:col-span-3 t-eyebrow text-muted-foreground">
            Process
          </p>
          <h2 className="lg:col-span-9 t-headline-1 wrap-editorial">
            Four steps.
            <br />
            Nothing wasted.
          </h2>
        </div>

        <ul ref={listRef} className="border-t border-border">
          {STEPS.map((s) => (
            <Row key={s.n} {...s} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Row({ n, title, desc }: { n: string; title: string; desc: string }) {
  const ref = useReveal<HTMLLIElement>();
  return (
    <li
      ref={ref}
      className="reveal relative border-b border-border py-10 lg:py-14 grid grid-cols-12 gap-6 items-baseline group overflow-hidden"
    >
      {/* Ghost number — Aristide Benoist technique */}
      <span
        className="absolute right-0 top-1/2 -translate-y-1/2 t-display-1 font-bold leading-none text-foreground/[0.03] select-none pointer-events-none tabular-nums"
        aria-hidden
      >
        {n}
      </span>

      <span className="col-span-2 lg:col-span-1 t-micro text-muted-foreground">
        {n}
      </span>
      <h3 className="col-span-10 lg:col-span-4 t-headline-2 transition-transform duration-300 ease-out group-hover:translate-x-1">
        {title}
      </h3>
      <p className="col-span-12 lg:col-span-7 t-body text-muted-foreground leading-relaxed">
        {desc}
      </p>
    </li>
  );
}
