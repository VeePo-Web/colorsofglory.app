import { useReveal } from "./useReveal";
import ctaBg from "@/assets/cta-background.jpg";
import dividerImg from "@/assets/divider-mountain-pass.jpg";

/* ─── Types ─────────────────────────────────────────── */
interface Inclusion {
  item: string;
  value: string;
}

interface Tier {
  name: string;
  tagline: string;
  inclusions: Inclusion[];
  totalValue: string;
  price: string;
  priceNote?: string;
  signature?: boolean;
  cta: string;
}

interface Category {
  id: string;
  label: string;
  fromPrice: string;
  eyebrow: string;
  headline: string;
  subline: string;
  buyerIdentity: string;
  quote: { text: string; attribution: string };
  tiers: [Tier, Tier, Tier];
}

/* ─── Data ───────────────────────────────────────────── */
const CATEGORIES: Category[] = [
  {
    id: "real-estate",
    label: "Real Estate",
    fromPrice: "from $600",
    eyebrow: "Real Estate & Property",
    headline: "The listing that sells\nbefore the open house.",
    subline:
      "Most drone footage gets scrolled past in two seconds. The listings that stop thumbs — and close faster — were filmed, not photographed.",
    buyerIdentity:
      "You're a realtor or property owner who knows that the right footage closes listings faster and at higher ask. You've seen bad drone video hurt a sale and you're not doing that.",
    quote: {
      text: "We had the listing live Thursday. By Saturday we had 34 showings booked and two offers above ask. I credit the footage.",
      attribution: "Sarah K., Realtor · Calgary, AB",
    },
    tiers: [
      {
        name: "Essential",
        tagline: "Your listing live before the open house — with footage that stops the scroll.",
        inclusions: [
          { item: "One shoot session on site (up to 90 minutes)", value: "—" },
          { item: "60–90 sec cinematic aerial video, 4K, colour graded", value: "$420" },
          { item: "Licensed music — cleared for MLS, YouTube, Instagram, and social", value: "$80" },
          { item: "10 aerial photographs, colour corrected and horizon-levelled, MLS-ready", value: "$220" },
          { item: "Delivered via private download link within 48 hours of shoot", value: "—" },
          
        ],
        totalValue: "$720",
        price: "$600",
        cta: "Book Essential — $600",
      },
      {
        name: "Elevated",
        tagline: "The full property story — aerial, ground, and every platform it needs to live on.",
        inclusions: [
          { item: "One shoot session on site (up to 2.5 hours)", value: "—" },
          { item: "90 sec cinematic aerial video, 4K, colour graded with licensed music", value: "$420" },
          { item: "60 sec ground walkthrough video — interior or exterior, same cinematic grade", value: "$350" },
          { item: "20 photographs: 12 aerial + 8 ground-level, all MLS-ready", value: "$400" },
          { item: "30 sec vertical cut for Instagram Reels and TikTok", value: "$180" },
          { item: "All formats (MP4, MOV, JPG) via download link within 48 hours", value: "—" },
        ],
        totalValue: "$1,350",
        price: "$1,100",
        cta: "Book Elevated — $1,100",
      },
      {
        name: "Signature",
        tagline: "A full production day. The listing that becomes the benchmark for the neighbourhood.",
        inclusions: [
          { item: "Half-day production block on site (up to 4 hours)", value: "$900" },
          { item: "Full cinematic aerial sequence — multiple passes, multiple angles, 4K", value: "—" },
          { item: "Ground walkthrough — interior and exterior covered in one session", value: "—" },
          { item: "25 photographs: aerial + ground, full gallery edit, all colour graded", value: "$500" },
          { item: "Three edited cuts: 90 sec showcase, 30 sec social, 15 sec story format", value: "$480" },
          { item: "Golden-hour or sunset shoot window — scheduled for optimal light", value: "—" },
          { item: "Music licensed for all platforms including YouTube broadcast", value: "$120" },
          { item: "Same-week delivery — all files in one organised download folder", value: "—" },
        ],
        totalValue: "$2,000+",
        price: "$2,200",
        priceNote: "Full-day production available — contact for scope",
        signature: true,
        cta: "Book Signature — $2,200",
      },
    ],
  },
  {
    id: "wedding-venues",
    label: "Wedding Venues",
    fromPrice: "from $800",
    eyebrow: "Wedding Venues & Event Spaces",
    headline: "The film that fills\nyour calendar.",
    subline:
      "Couples book venues from a feeling, not a floorplan. One great film runs two to three booking seasons — and pays for itself on the first inquiry it converts.",
    buyerIdentity:
      "You own or manage a venue and your current photos don't do the space justice. You need footage that makes couples stop looking at alternatives the moment they press play.",
    quote: {
      text: "We went from 4–5 serious venue inquiries a month to over 20 within the first two months of putting the film on our website and WeddingWire listing.",
      attribution: "Natalie R., Venue Owner · Canmore, AB",
    },
    tiers: [
      {
        name: "Essential",
        tagline: "The video that makes couples stop scrolling and start inquiring.",
        inclusions: [
          { item: "One shoot session (up to 2 hours, scheduled for best natural light)", value: "—" },
          { item: "90 sec venue showcase video — aerial approach, grounds, ceremony and reception spaces, 4K, colour graded", value: "$520" },
          { item: "Licensed ambient music — cleared for web, WeddingWire, The Knot, and YouTube", value: "$80" },
          { item: "15 photographs: aerial grounds + key interior spaces, brand-ready", value: "$300" },
          { item: "30 sec vertical cut for Instagram Reels (couples search on mobile)", value: "$120" },
          { item: "Web-optimised MP4 + full-resolution master — delivered within 5 business days", value: "—" },
        ],
        totalValue: "$1,020",
        price: "$800",
        cta: "Book Essential — $800",
      },
      {
        name: "Elevated",
        tagline: "Every space that makes couples say yes — captured in a single film.",
        inclusions: [
          { item: "One shoot session (up to 3.5 hours, golden-hour window included)", value: "—" },
          { item: "2 min full venue film: aerial arrival, grounds, ceremony space, reception space, detail moments — 4K, colour graded", value: "$900" },
          { item: "30 sec social cut for Instagram feed and paid ad campaigns", value: "$180" },
          { item: "15 sec story cut for Instagram Stories and TikTok", value: "$120" },
          { item: "25 photographs — aerial, exterior grounds, interior key spaces, all colour graded", value: "$500" },
          { item: "All platform usage rights: website, directories, social, paid ads", value: "—" },
          { item: "All formats delivered within 5 business days", value: "—" },
        ],
        totalValue: "$1,700",
        price: "$1,600",
        cta: "Book Elevated — $1,600",
      },
      {
        name: "Signature",
        tagline: "The film that books your venue before the competition knows a date is available.",
        inclusions: [
          { item: "Full production day (up to 6 hours — light-window optimised scheduling)", value: "$1,800" },
          { item: "Complete venue cinematic: aerial arrival, full grounds, ceremony space, reception space, catering presentation, detail moments", value: "—" },
          { item: "Three deliverable cuts: 3 min full film, 60 sec highlight, 30 sec social", value: "$480" },
          { item: "40 photographs — full property coverage, gallery-ready for all directories", value: "$800" },
          { item: "Premium sync music licence — broadcast and paid ad clearance included", value: "$200" },
          { item: "All vertical formats for Instagram, TikTok, and Stories", value: "—" },
          { item: "Priority delivery — all files in one branded folder within 3 business days", value: "—" },
        ],
        totalValue: "$3,280+",
        price: "$3,200",
        priceNote: "Off-season rates available — contact for availability",
        signature: true,
        cta: "Book Signature — $3,200",
      },
    ],
  },
  {
    id: "agriculture",
    label: "Agriculture",
    fromPrice: "from $700",
    eyebrow: "Agriculture & Rural Property",
    headline: "Scale that no ground\nphoto has ever shown.",
    subline:
      "Alberta farms and acreages have a story that begins from 300 feet up. Whether you're selling land, marketing an operation, or documenting for insurance — this is the view that changes how people understand what you have.",
    buyerIdentity:
      "You own or manage a farm, acreage, or rural property and need to communicate scale, quality, and character to buyers, partners, or insurers. Ground photography has never done it justice.",
    quote: {
      text: "We'd been trying to sell the property for eight months with standard photos. Had the drone footage done on a Tuesday. Accepted an offer the following Sunday.",
      attribution: "Dale M., Farm Owner · Foothills County, AB",
    },
    tiers: [
      {
        name: "Essential",
        tagline: "The scale, the boundaries, and the character — in one 90-second pass.",
        inclusions: [
          { item: "One shoot session (up to 90 minutes, full property coverage)", value: "—" },
          { item: "90 sec aerial property overview — full perimeter, key structures, field layout, access roads, 4K, colour graded", value: "$450" },
          { item: "15 aerial photographs — boundary lines, infrastructure, field-of-view shots for MLS or private listing", value: "$300" },
          { item: "Geotagged high-resolution aerial still for boundary reference", value: "—" },
          { item: "Delivered via download link within 48 hours", value: "—" },
          
        ],
        totalValue: "$750",
        price: "$700",
        cta: "Book Essential — $700",
      },
      {
        name: "Elevated",
        tagline: "The operation, the land, and the story behind both — documented completely.",
        inclusions: [
          { item: "One shoot session (up to 3 hours, multi-area coverage)", value: "—" },
          { item: "2 min property or agri-business overview film, 4K, colour graded with licensed music", value: "$800" },
          { item: "25 photographs: structures, fields, seasonal features, boundaries, access roads — all colour graded", value: "$500" },
          { item: "Annotated aerial still (high-res TIFF) for boundary and infrastructure reference — suitable for insurance or planning documentation", value: "$150" },
          { item: "30 sec vertical cut for business social profiles", value: "$120" },
          { item: "Delivered within 5 business days, all formats", value: "—" },
        ],
        totalValue: "$1,570",
        price: "$1,400",
        cta: "Book Elevated — $1,400",
      },
      {
        name: "Signature",
        tagline: "The complete visual record of land that took decades to build.",
        inclusions: [
          { item: "Half-day production (up to 4 hours, multi-area or multi-structure)", value: "$1,200" },
          { item: "Full farm or agri-business brand film (2–3 min), 4K, cinematic grade with licensed music", value: "—" },
          { item: "40 photographs — complete property library, all colour graded", value: "$800" },
          { item: "Three cuts: full film, 60 sec highlight, vertical social", value: "$360" },
          { item: "Seasonal return option — spring seeding or fall harvest, priority scheduling for existing clients, quoted separately", value: "—" },
          { item: "All usage rights: property listings, business profiles, grant applications, insurance documentation", value: "—" },
          { item: "Priority delivery — all files within 3 business days", value: "—" },
        ],
        totalValue: "$2,360+",
        price: "$2,800",
        priceNote: "Multi-season documentation packages available on request",
        signature: true,
        cta: "Book Signature — $2,800",
      },
    ],
  },
  {
    id: "construction",
    label: "Construction",
    fromPrice: "from $750",
    eyebrow: "Construction & Development",
    headline: "Every milestone,\nfrom the angle that\nshows the whole picture.",
    subline:
      "Progress reports that investors actually watch. Documentation that holds up in planning submissions. A continuous visual record from ground-break to ribbon-cutting — with the same operator on every visit.",
    buyerIdentity:
      "You're a developer, project manager, or construction firm that needs regular aerial documentation. You're tired of re-briefing a new operator every time. You need someone who knows the site.",
    quote: {
      text: "We use Toby on every project now. He knows what our investors need to see, shows up when he says he will, and the footage is always ready before our monthly reporting deadline.",
      attribution: "Marcus T., Project Director · Calgary Development Group",
    },
    tiers: [
      {
        name: "Essential",
        tagline: "Every site visit documented — ready for your reporting cycle, not ours.",
        inclusions: [
          { item: "Single site visit (up to 90 minutes)", value: "—" },
          { item: "20 aerial photographs — dated, geotagged, full site coverage", value: "$400" },
          { item: "Suitable for progress reports, investor updates, planning submissions, and insurance documentation", value: "—" },
          { item: "Raw files + colour-corrected set both delivered", value: "—" },
          { item: "Priority 24-hour delivery for active construction timelines", value: "—" },
          
        ],
        totalValue: "$900",
        price: "$750",
        cta: "Book Essential — $750",
      },
      {
        name: "Elevated",
        tagline: "Progress documentation that investors watch, share, and forward to partners.",
        inclusions: [
          { item: "Single site visit (up to 3 hours, multi-angle and multi-elevation coverage)", value: "—" },
          { item: "90 sec cinematic progress film, 4K, colour graded — a film stakeholders will watch start to finish", value: "$700" },
          { item: "30 geotagged photographs — full site coverage, all phases visible, all dated for record-keeping", value: "$600" },
          { item: "Before/after edit prepared if prior footage from the same project exists", value: "—" },
          { item: "30 sec stakeholder social cut for LinkedIn and investor communications", value: "$120" },
          { item: "48-hour delivery — structured to fit monthly reporting cycles", value: "—" },
        ],
        totalValue: "$1,420",
        price: "$1,500",
        cta: "Book Elevated — $1,500",
      },
      {
        name: "Signature",
        tagline: "One operator. One project. A complete visual record from slab to sale.",
        inclusions: [
          { item: "Monthly documentation retainer — minimum 3-month commitment, 1 site visit per month", value: "$2,700/qtr" },
          { item: "Each visit: cinematic update film, 30 geotagged photographs, milestone edit added to cumulative project record", value: "—" },
          { item: "Quarterly investor-ready highlight reel (3–5 min) for board and stakeholder presentations", value: "$600" },
          { item: "Dedicated operator (Toby Rennick) — same eyes on the project every visit, no re-briefing", value: "—" },
          { item: "All files archived by date in a shared folder accessible throughout the project", value: "—" },
          { item: "Priority same-week delivery after every visit", value: "—" },
        ],
        totalValue: "$3,300+/quarter",
        price: "$3,500/quarter",
        priceNote: "Per-quarter retainer — contact to align with project timeline",
        signature: true,
        cta: "Start the retainer conversation",
      },
    ],
  },
  {
    id: "tourism",
    label: "Tourism",
    fromPrice: "from $1,800",
    eyebrow: "Tourism & Destination",
    headline: "The footage that makes\nthem look up flights.",
    subline:
      "One great destination film runs two to three seasons and pays for itself on the first booking it generates. The difference between footage that documents a place and footage that sells it is not equipment — it's intent.",
    buyerIdentity:
      "You're a tourism board, lodge owner, or destination marketer who needs footage that converts views into bookings. You've had beautiful footage shot before and nobody watched it. This is different.",
    quote: {
      text: "The film went up in March. By May we'd had three international media pickups and our summer bookings were 40 percent ahead of the same period last year.",
      attribution: "Jennifer A., Marketing Director · Banff Area Tourism",
    },
    tiers: [
      {
        name: "Essential",
        tagline: "The 90-second film that makes them stop planning and start booking.",
        inclusions: [
          { item: "One shoot session (up to 3 hours, location-dependent)", value: "—" },
          { item: "90 sec destination reel — cinematic aerial, 4K, colour graded with licensed music", value: "$1,100" },
          { item: "15 photographs — all print-resolution and web-ready", value: "$300" },
          { item: "30 sec social cut for paid advertising on Meta and Google", value: "$180" },
          { item: "Raw selects included — full resolution, all formats", value: "$300" },
          { item: "5-business-day delivery", value: "—" },
        ],
        totalValue: "$1,880",
        price: "$1,800",
        cta: "Book Essential — $1,800",
      },
      {
        name: "Elevated",
        tagline: "Two locations. Multiple formats. One campaign that runs all season.",
        inclusions: [
          { item: "Full shoot day (up to 6 hours, up to 2 locations)", value: "$2,200" },
          { item: "2 min destination feature film — cinematic, story-arc structured, 4K, colour graded, premium licensed music", value: "$600" },
          { item: "30 sec social cut for paid advertising on Meta and Google", value: "$200" },
          { item: "25 photographs across both locations — print and web resolution", value: "$500" },
          { item: "Campaign brief consultation (30 min) before shoot day", value: "$300" },
          { item: "All raw selects + all edited deliverables", value: "—" },
          { item: "5-business-day delivery, all formats", value: "—" },
        ],
        totalValue: "$3,800",
        price: "$3,600",
        cta: "Book Elevated — $3,600",
      },
      {
        name: "Signature",
        tagline: "The definitive film for a destination that deserves to be discovered.",
        inclusions: [
          { item: "Multi-day production — schedule, locations, and scope by brief", value: "—" },
          { item: "Full creative direction: shot list, location scouting, light-window scheduling for peak seasonal conditions", value: "—" },
          { item: "Multiple deliverable cuts for all platforms and broadcast", value: "—" },
          { item: "Complete photograph library across all locations and shoot days", value: "—" },
          { item: "Premium music licensing — broadcast, streaming, and paid ad clearance", value: "—" },
          { item: "Dedicated project management from brief to final delivery", value: "—" },
        ],
        totalValue: "Scoped by brief",
        price: "By proposal",
        priceNote: "Multi-day and multi-location — contact for a tailored brief",
        signature: true,
        cta: "Start the conversation",
      },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    fromPrice: "from $1,400",
    eyebrow: "Commercial & Brand",
    headline: "The aerial shot your\nbrand deck has been missing.",
    subline:
      "Commercial footage that holds up in the brand presentation, the broadcast slot, and the trade show screen. One shoot. Footage that works everywhere it needs to.",
    buyerIdentity:
      "You're a marketing or creative director who needs aerial footage that's on-brand, not just visually impressive. You've briefed production teams before and know the difference between a deliverable and a finished asset.",
    quote: {
      text: "We briefed Toby the same way we'd brief any creative director. He came back with footage that went straight into the campaign without a single revision request.",
      attribution: "Chris B., Creative Director · Calgary Brand Agency",
    },
    tiers: [
      {
        name: "Essential",
        tagline: "One location. One reel. Ready for your brand deck by end of week.",
        inclusions: [
          { item: "One location, half-day shoot (up to 3 hours on site)", value: "—" },
          { item: "90 sec brand highlight reel, 4K, colour graded to brand palette", value: "$900" },
          { item: "Raw selects package — full resolution, all formats, yours to use", value: "$300" },
          { item: "5-business-day delivery", value: "—" },
        ],
        totalValue: "$1,200",
        price: "$1,400",
        cta: "Book Essential — $1,400",
      },
      {
        name: "Elevated",
        tagline: "Multi-location. Multiple cuts. One campaign that works everywhere it runs.",
        inclusions: [
          { item: "Full shoot day (up to 2 locations, up to 6 hours)", value: "$1,800" },
          { item: "Two campaign cuts: 90 sec long-form + 30 sec social", value: "$600" },
          { item: "Vertical format for paid social and story ads", value: "$200" },
          { item: "Brand brief consultation (30 min) — we align on look and feel before we shoot", value: "$200" },
          { item: "All raw selects + all colour-graded deliverables", value: "—" },
          { item: "5-business-day delivery, all formats", value: "—" },
        ],
        totalValue: "$2,800",
        price: "$2,800",
        cta: "Book Elevated — $2,800",
      },
      {
        name: "Signature",
        tagline: "Full creative direction. The campaign from first conversation to final frame.",
        inclusions: [
          { item: "Pre-production: shot list, location scout, creative brief session with Toby", value: "$500" },
          { item: "Full production day — unlimited locations, full coverage", value: "$2,400" },
          { item: "Three deliverable formats: broadcast master, 30 sec social, 15 sec story", value: "$900" },
          { item: "Creative direction on the day from Toby — not a camera operator, a director", value: "$600" },
          { item: "Music licensed for all platforms including broadcast and paid media", value: "$120" },
          { item: "Priority 3-day delivery — all files in one organised project folder", value: "—" },
        ],
        totalValue: "$4,520",
        price: "From $5,500",
        priceNote: "Complex productions scoped individually — contact for quote",
        signature: true,
        cta: "Book Signature",
      },
    ],
  },
];

/* ─── Standard tier card (Essential / Elevated) ──────── */
function TierCard({
  tier,
  onContact,
}: {
  tier: Tier;
  onContact: () => void;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="reveal flex flex-col h-full bg-background border-r border-b border-border last:border-r-0"
    >
      {/* Header */}
      <div className="px-8 pt-10 pb-8 border-b border-border">
        <p className="t-eyebrow text-muted-foreground mb-3">{tier.name}</p>
        <p className="t-body text-foreground/70 leading-snug max-w-[28ch]">
          {tier.tagline}
        </p>
      </div>

      {/* Inclusions */}
      <div className="px-8 pt-8 flex-1">
        <p className="t-micro text-muted-foreground mb-5">What&rsquo;s included</p>
        <ul className="space-y-4">
          {tier.inclusions.map((inc, i) => (
            <li key={i} className="flex items-start justify-between gap-4">
              <span className="t-body text-foreground/80 flex-1 leading-snug">
                {inc.item}
              </span>
              {inc.value !== "—" && (
                <span className="t-micro text-muted-foreground tabular-nums shrink-0 pt-0.5">
                  {inc.value}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Price */}
      <div className="px-8 pt-8 pb-3 mt-8 border-t border-border">
        <p className="t-micro text-muted-foreground mb-1">
          Stated value {tier.totalValue}
        </p>
        <p className="t-display-2 leading-none tracking-[-0.035em]">
          {tier.price}
        </p>
        {tier.priceNote && (
          <p className="t-micro text-muted-foreground mt-1">{tier.priceNote}</p>
        )}
      </div>

      {/* CTA */}
      <div className="px-8 pb-10 pt-6">
        <button
          onClick={onContact}
          data-cursor="hover"
          className="group w-full inline-flex items-center justify-between gap-3 px-6 py-4 bg-foreground text-background text-sm font-medium tracking-[0.005em] hover:bg-foreground/90 transition-colors duration-200"
        >
          <span>{tier.cta}</span>
          <span className="link-arrow">↗</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Signature tier — full-width cinematic band ────── */
function SignatureBand({
  tier,
  onContact,
}: {
  tier: Tier;
  onContact: () => void;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="reveal relative overflow-hidden bg-foreground text-background border-t border-background/10"
    >
      {/* Aerial texture */}
      <img
        src={ctaBg}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        width={1920}
        height={1080}
        className="absolute inset-0 w-full h-full object-cover opacity-[0.06] pointer-events-none select-none"
      />

      {/* Ghost "Signature" — Benoist spatial text */}
      <span
        className="hidden lg:block absolute -right-8 top-1/2 -translate-y-1/2 t-display-0 text-background leading-none opacity-[0.03] select-none pointer-events-none"
        aria-hidden
      >
        Signature
      </span>

      <div className="relative container-x py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16 items-center">

        {/* Left — tier identity + value stack */}
        <div className="md:col-span-5">
          <p className="t-eyebrow text-background/40 mb-4">{tier.name}</p>
          <p className="t-lede text-background/70 mb-10 max-w-[32ch] leading-snug">
            {tier.tagline}
          </p>
          <p className="t-micro text-background/35 mb-5">What&rsquo;s included</p>
          <ul className="space-y-4">
            {tier.inclusions.map((inc, i) => (
              <li key={i} className="flex items-start justify-between gap-6">
                <span className="t-body text-background/75 flex-1 leading-snug">
                  {inc.item}
                </span>
                {inc.value !== "—" && (
                  <span className="t-micro text-background/30 tabular-nums shrink-0 pt-0.5">
                    {inc.value}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="t-micro text-background/30 mt-6">
            Stated value {tier.totalValue}
          </p>
        </div>

        {/* Right — price + CTA */}
        <div className="md:col-span-7 flex flex-col items-start md:items-end gap-8">
          <div className="text-left md:text-right">
            <p className="t-display-1 leading-none tracking-[-0.04em] text-background">
              {tier.price}
            </p>
            {tier.priceNote && (
              <p className="t-micro text-background/35 mt-3 max-w-[28ch] md:ml-auto">
                {tier.priceNote}
              </p>
            )}
          </div>
          <button
            onClick={onContact}
            data-cursor="hover"
            data-magnetic
            className="btn-light group"
          >
            <span>{tier.cta}</span>
            <span className="link-arrow">↗</span>
          </button>
          <p className="t-micro text-background/30 max-w-[30ch] text-left md:text-right leading-relaxed">
            Includes the reshoot guarantee — if the footage doesn&rsquo;t match
            the brief, we come back. No invoice. No argument.
          </p>
        </div>

      </div>
    </div>
  );
}

/* ─── Cinematic divider between Real Estate and Wedding Venues ── */
function PricingDivider() {
  return (
    <section
      className="relative w-full h-[38vh] md:h-[52vh] overflow-hidden bg-[#0a0a0a]"
      aria-label="Aerial still — Canadian Rockies"
    >
      <img
        src={dividerImg}
        alt="Aerial view of a mountain pass in the Canadian Rockies, Alberta"
        loading="lazy"
        decoding="async"
        width={1920}
        height={1080}
        className="absolute inset-0 w-full h-full object-cover motion-safe:animate-kenburns"
      />
      <div
        className="absolute inset-x-0 top-0 h-32 md:h-44 bg-gradient-to-b from-background via-background/40 to-transparent pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-32 md:h-44 bg-gradient-to-t from-background via-background/40 to-transparent pointer-events-none"
        aria-hidden
      />
      <div className="absolute bottom-8 md:bottom-10 inset-x-0 container-x flex items-center gap-4">
        <div className="w-8 h-px bg-background/40 shrink-0" />
        <span className="t-micro text-background/50 tracking-[0.14em]">
          Banff National Park&nbsp;·&nbsp;Alberta, Canada
        </span>
      </div>
    </section>
  );
}

/* ─── Category section ───────────────────────────────── */
function CategorySection({
  category,
  onContact,
  showDivider,
}: {
  category: Category;
  onContact: () => void;
  showDivider: boolean;
}) {
  const headRef = useReveal<HTMLDivElement>();
  const [tier0, tier1, tier2] = category.tiers;

  return (
    <>
      <section id={category.id} className="pt-section border-t border-border">
        <div className="container-x">

          {/* Category header — 7/5 asymmetric */}
          <div ref={headRef} className="reveal mb-10 md:mb-14">
            <p className="t-eyebrow text-muted-foreground mb-5">
              {category.eyebrow}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-end">
              <h2 className="md:col-span-7 t-display-2 wrap-editorial wrap-editorial-mobile-off whitespace-pre-line">
                {category.headline}
              </h2>
              <p className="md:col-span-5 t-lede text-muted-foreground max-w-[44ch]">
                {category.subline}
              </p>
            </div>
          </div>

          {/* Buyer identity — italic left-border rule */}
          <div className="mb-10 border-l-2 border-foreground/15 pl-6">
            <p className="t-body text-muted-foreground max-w-[52ch] leading-relaxed italic">
              {category.buyerIdentity}
            </p>
          </div>

          {/* Social proof quote */}
          <figure className="mb-10">
            <blockquote>
              <p className="t-lede text-foreground/80 max-w-[52ch] leading-relaxed">
                &ldquo;{category.quote.text}&rdquo;
              </p>
            </blockquote>
            <figcaption className="t-micro text-muted-foreground mt-3">
              — {category.quote.attribution}
            </figcaption>
          </figure>

          {/* Essential + Elevated — equal-choice 2-col */}
          <div className="grid grid-cols-1 md:grid-cols-2 border border-border">
            <TierCard tier={tier0} onContact={onContact} />
            <TierCard tier={tier1} onContact={onContact} />
          </div>
        </div>

        {/* Signature — full-width dark band */}
        <div className="mt-px">
          <SignatureBand tier={tier2} onContact={onContact} />
        </div>

        {/* Footnote + which-tier helper */}
        <div className="container-x">
          <div className="mt-8 flex flex-col sm:flex-row items-start gap-2">
            <span className="t-micro text-muted-foreground">
              Not sure which package?
            </span>
            <button
              onClick={onContact}
              className="t-micro text-foreground underline underline-offset-4 hover:no-underline transition-all duration-200"
            >
              Book a free 15-minute call — we&rsquo;ll work it out together ↗
            </button>
          </div>
          <p className="t-micro text-muted-foreground mt-3 pb-section">
            Stated values reflect standard market rates for individual services.
            Every package is delivered by Toby personally — one operator, end to end.
          </p>
        </div>
      </section>

      {showDivider && <PricingDivider />}
    </>
  );
}

/* ─── Sticky category nav ────────────────────────────── */
function CategoryNav() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="sticky top-16 md:top-20 z-40 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="container-x">
        <nav aria-label="Pricing categories" className="flex gap-6 md:gap-10 py-4 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollTo(cat.id)}
              data-cursor="hover"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <span className="t-eyebrow">{cat.label}</span>
              <span className="t-micro text-muted-foreground/60 ml-1.5 hidden lg:inline">{cat.fromPrice}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ─── Export ─────────────────────────────────────────── */
export default function PricingPackages({
  onContact,
}: {
  onContact: () => void;
}) {
  return (
    <>
      <CategoryNav />
      {CATEGORIES.map((cat, i) => (
        <CategorySection
          key={cat.id}
          category={cat}
          onContact={onContact}
          showDivider={i === 0}
        />
      ))}
    </>
  );
}
