import { useState } from "react";
import { useReveal } from "./useReveal";

const FAQS = [
  {
    q: "I've never hired drone footage before. How do I know which package is right for me?",
    a: "Start with where the footage will live. MLS listing only — Essential covers everything you need. Multiple platforms including social and your website — Elevated gives you all the formats. A flagship asset you'll use for 12 months or more — Signature is the right investment. If you're still unsure, the best 15 minutes you can spend is a call before booking. We'll work out exactly what you need — and what you don't — before any money changes hands. Book a free call through the contact form.",
  },
  {
    q: "What's the actual difference between this and a $200 drone operator?",
    a: "A $200 operator delivers raw files from ungraded footage. You edit, colour correct, add music, and compress for platforms yourself — or you don't, and the footage sits unused. Every Fly4MEdia package delivers a finished asset: colour graded, music licensed, exported for every platform it needs to live on, and in your hands within 48 hours. The music licence matters too — unlicensed tracks get listing videos muted on YouTube and flagged on social. Every package includes music cleared for MLS, social, and web. The difference you're paying for is the gap between a hard drive of clips and a finished asset you can publish the day you receive it.",
  },
  {
    q: "What does the brief process actually involve?",
    a: "A 20-minute call or a written brief you send by email — whichever you prefer. We cover: the location, the feeling you want the footage to produce, where it will be used (MLS, Instagram, website, boardroom presentation), and any specific shots you have in mind. You don't need a production background. The brief is what makes the delivered footage match what you needed — and what makes the reshoot guarantee rarely apply.",
  },
  {
    q: "What happens if weather cancels the shoot?",
    a: "We reschedule, not refund. Your deposit holds your spot on the calendar, not a specific date. If conditions on the shoot day won't produce footage worth delivering — high winds, poor visibility, rain — we call it and reschedule at no cost. You're never charged for a shoot that didn't happen. Most bookings are weather-confirmed 48 hours in advance.",
  },
  {
    q: "Can I request a specific time of day — sunrise, golden hour, or sunset?",
    a: "Yes. Signature packages include a golden-hour or sunset window by default. Essential and Elevated packages can request preferred timing and we schedule around it where conditions allow. If you have a specific light condition in mind — overcast for even colour, sunrise for a particular sky — mention it in the brief. It usually doesn't add cost.",
  },
  {
    q: "Do you handle editing or is this raw footage?",
    a: "Everything is edited and delivered as a finished asset. You receive colour-graded video, licensed music embedded, exported for every platform you need. Elevated and Signature packages also include the raw selects so you have source material for future use. You receive a finished deliverable, not a hard drive full of clips.",
  },
  {
    q: "Can I upgrade my package after booking?",
    a: "Yes. If your scope expands — you want to add the ground walkthrough, more photographs, or a vertical cut — we re-quote before the shoot day. No surprise invoices. If it becomes clear on the day that something extra is worth capturing, we'll tell you before we shoot it.",
  },
  {
    q: "Do you travel outside Calgary and Alberta?",
    a: "Travel within Alberta is included in all packages — no fuel surcharges, no travel fees within the province. For projects outside Alberta, travel is quoted upfront as a flat line item before booking is confirmed. Current rate: $1.20 per km. It's in the add-ons section above. No surprises after the fact.",
  },
  {
    q: "How many projects do you take on per month?",
    a: "Intentionally limited. Toby operates alone — there's no crew of operators dispatched under a brand name. Keeping project volume controlled is how quality stays consistent. When the calendar fills, it fills. If you have a date-sensitive project — a listing going live in two weeks, a venue with a peak inquiry season — book early and lock the date.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-cursor="hover"
        className="w-full flex items-start justify-between gap-6 py-6 text-left group"
      >
        <span className="t-body font-medium group-hover:text-foreground transition-colors duration-200">
          {q}
        </span>
        <span
          className={`shrink-0 mt-0.5 text-muted-foreground transition-transform duration-300 ease-[var(--ease-out-soft)] ${
            open ? "rotate-45" : ""
          }`}
          aria-hidden
        >
          +
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-400 ease-[var(--ease-out-soft)] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="t-body text-muted-foreground leading-relaxed pb-6 max-w-[62ch]">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PricingFAQ() {
  const headRef = useReveal<HTMLDivElement>();
  const listRef = useReveal<HTMLDivElement>();

  return (
    <section className="py-section border-t border-border">
      <div className="container-x">
        <div ref={headRef} className="reveal mb-14 md:mb-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-5">
              <p className="t-eyebrow text-muted-foreground mb-5">
                Before you book
              </p>
              <h2 className="t-display-2 wrap-editorial wrap-editorial-mobile-off max-w-[14ch]">
                The questions
                <br />
                worth asking.
              </h2>
            </div>
            <p className="md:col-span-6 md:col-start-7 t-lede text-muted-foreground max-w-[44ch]">
              Real answers to the concerns that come up before every booking —
              not a list of reasons to hire us.
            </p>
          </div>
        </div>

        <div ref={listRef} className="reveal md:grid md:grid-cols-12">
          <div className="md:col-span-8 md:col-start-3">
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} {...faq} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
