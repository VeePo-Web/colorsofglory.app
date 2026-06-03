import { useReveal } from "./useReveal";

const ITEMS = [
  "Cinema-grade aerial drone systems",
  "FPV platforms — for the shot a crane can't get to",
  "Stabilised ground & gimbal workflows",
  "Weather-judged shoots — patience over volume",
  "End-to-end delivery — graded, scored, platform-ready",
  "Alberta-rooted. On a plane when the brief calls for it.",
];

export default function Capabilities() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="bg-foreground text-background py-section">
      <div ref={ref} className="reveal container-x grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        <div className="lg:col-span-4">
          <p className="t-eyebrow text-background/50 mb-6 lg:mb-8">
            Capabilities
          </p>
          <h2 className="t-headline-1 max-w-md">
            Built for the projects you can&rsquo;t afford to look ordinary.
          </h2>
        </div>
        <ul className="lg:col-span-8 lg:pl-10 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {ITEMS.map((item, i) => (
            <li
              key={item}
              className="flex items-baseline gap-4 border-t border-background/15 pt-5 t-body"
            >
              <span className="t-micro text-background/50 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-pretty">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
