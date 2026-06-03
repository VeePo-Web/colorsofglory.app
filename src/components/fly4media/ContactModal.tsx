import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLocation } from "react-router-dom";
import { X, Check, Pencil } from "lucide-react";
import { z } from "zod";
import heroImage from "@/assets/cs-canmore-hero.jpg";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  initialServices?: string[];
}

/* ---------- Service taxonomy ---------- */

interface ServiceGroup {
  label: string;
  items: string[];
}

const SERVICE_GROUPS: ServiceGroup[] = [
  { label: "Film & Story", items: ["Aerial Cinematography", "FPV Production", "Tourism Film"] },
  { label: "Brand & Campaign", items: ["Commercial Campaign", "Social Campaign", "Creative Direction"] },
  { label: "Property & Industry", items: ["Real Estate", "Industrial"] },
];

const NOT_SURE = "Not sure yet — let's talk";

const ASSURANCES = [
  "Toby replies within 1 business day, every time.",
  "No agency. No middlemen. One operator.",
  "Cochrane, AB — shooting Alberta and beyond.",
  "“Looked like a film. Moved like a sales tool.” — Joe, Cochrane",
];

const DRAFT_KEY = "f4m:contact:draft";
const RATE_KEY = "f4m:contact:lastSent";
const RATE_MS = 60_000;

function servicesForRoute(pathname: string): string[] {
  if (pathname.startsWith("/work/")) return [];
  return [];
}

/* ---------- Validation ---------- */

const phoneRe = /^[+()\d][()\d\s\-.]{5,}$/;

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Add your name")
    .max(80, "Keep it under 80 characters"),
  email: z
    .string()
    .trim()
    .email("Double-check that email")
    .max(255),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || phoneRe.test(v), "Phone looks off"),
  project: z
    .string()
    .trim()
    .min(10, "A sentence or two helps Toby reply well")
    .max(1000, "Keep it under 1000 characters"),
  services: z.array(z.string()).max(12).default([]),
});

type FieldKey = "name" | "email" | "services" | "project" | "phone";
const STEP_ORDER: FieldKey[] = ["name", "email", "services", "project", "phone"];

/* ---------- Analytics ---------- */

function track(stage: string, detail: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("f4m:contact", { detail: { stage, ...detail } }));
}

/* ---------- ICS download ---------- */

function nextBusinessDay(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function downloadDiscoveryICS(name: string) {
  const start = nextBusinessDay();
  const end = new Date(start.getTime() + 20 * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fly4MEdia//Contact//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@fly4me.ca`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    "SUMMARY:Fly4MEdia — Discovery call",
    `DESCRIPTION:20-minute discovery call with Toby Rennick. He will confirm the exact time in his reply.`,
    "ORGANIZER;CN=Toby Rennick:mailto:tobyrennick@gmail.com",
    name ? `ATTENDEE;CN=${name}:mailto:invitee@placeholder` : "",
    "LOCATION:Phone — Toby will call 403 818 9686",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fly4media-discovery.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================ */
/* Component                                                    */
/* ============================================================ */

export default function ContactModal({ open, onClose, initialServices = [] }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [project, setProject] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [activeStep, setActiveStep] = useState<FieldKey>("name");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [shakeKey, setShakeKey] = useState<FieldKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [emailOk, setEmailOk] = useState(false);
  const [assurance] = useState(() => ASSURANCES[Math.floor(Math.random() * ASSURANCES.length)]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRefs = useRef<Partial<Record<FieldKey, HTMLInputElement | HTMLTextAreaElement>>>({});
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const firstName = useMemo(() => name.trim().split(/\s+/)[0] || "", [name]);

  /* Reset scroll to top whenever the modal opens */
  useEffect(() => {
    if (!open) return;
    const reset = () => scrollRef.current?.scrollTo({ top: 0, left: 0 });
    reset();
    const f = requestAnimationFrame(reset);
    const t = setTimeout(reset, 360);
    return () => {
      cancelAnimationFrame(f);
      clearTimeout(t);
    };
  }, [open]);

  /* Focus trap + scroll lock + open analytics */
  const sheetOpenRef = useRef(sheetOpen);
  sheetOpenRef.current = sheetOpen;
  useEffect(() => {
    if (!open) return;
    track("open");
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // While the services sheet is open, let it own the Escape key.
      if (sheetOpenRef.current) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      inputRefs.current.name?.focus({ preventScroll: true });
      scrollRef.current?.scrollTo({ top: 0, left: 0 });
    }, 320);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
      track("close");
    };
  }, [open, onClose]);

  /* Seed services + restore draft on open; reset on close. */
  useEffect(() => {
    if (open) {
      const seeded = initialServices.length > 0 ? initialServices : servicesForRoute(location.pathname);
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw) as Partial<{
            name: string; email: string; phone: string; project: string; services: string[];
          }>;
          setName(d.name ?? "");
          setEmail(d.email ?? "");
          setPhone(d.phone ?? "");
          setProject(d.project ?? "");
          setServices(d.services ?? seeded);
          // start on first incomplete step
          const order: Array<[FieldKey, boolean]> = [
            ["name", !!(d.name && d.name.trim().length > 1)],
            ["email", !!(d.email && /\S+@\S+\.\S+/.test(d.email))],
            ["services", (d.services ?? seeded).length > 0],
            ["project", !!(d.project && d.project.trim().length >= 10)],
            ["phone", true],
          ];
          const next = order.find(([, ok]) => !ok)?.[0] ?? "phone";
          setActiveStep(next);
          if (d.email && /\S+@\S+\.\S+/.test(d.email)) setEmailOk(true);
        } else {
          setServices(seeded);
        }
      } catch {
        setServices(seeded);
      }
      return;
    }
    const t = setTimeout(() => {
      setStatus("idle");
      setErrors({});
      setEmailOk(false);
      setActiveStep("name");
      setSheetOpen(false);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Persist draft (debounced) */
  useEffect(() => {
    if (!open || status === "sent") return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ name, email, phone, project, services }),
        );
      } catch {
        /* noop */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, status, name, email, phone, project, services]);


  /* visualViewport — push sticky CTA above iOS keyboard */
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    onResize();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
      setKeyboardOffset(0);
    };
  }, [open]);

  /* Promote active step's input → focused */
  useEffect(() => {
    if (!open || status === "sent") return;
    const el = inputRefs.current[activeStep];
    if (!el) return;
    const t = setTimeout(() => el.focus({ preventScroll: false }), 60);
    return () => clearTimeout(t);
  }, [activeStep, open, status]);

  /* Field validity */
  const validity = useMemo(() => {
    return {
      name: name.trim().length > 1 && name.trim().length <= 80,
      email: /^\S+@\S+\.\S+$/.test(email.trim()) && email.trim().length <= 255,
      services: true, // optional
      project: project.trim().length >= 10 && project.trim().length <= 1000,
      phone: !phone.trim() || phoneRe.test(phone.trim()),
    } as Record<FieldKey, boolean>;
  }, [name, email, project, phone]);

  const readyToSend = validity.name && validity.email && validity.project && validity.phone;

  /* ---------- Field helpers ---------- */

  const setActive = useCallback((k: FieldKey) => {
    setActiveStep(k);
    track("field_focus", { field: k });
  }, []);

  const advanceFrom = useCallback(
    (k: FieldKey) => {
      if (!validity[k]) {
        setErrors((e) => ({ ...e, [k]: humanError(k) }));
        setShakeKey(k);
        setTimeout(() => setShakeKey(null), 260);
        return;
      }
      setErrors((e) => ({ ...e, [k]: undefined }));
      const idx = STEP_ORDER.indexOf(k);
      const next = STEP_ORDER[idx + 1];
      if (next) setActive(next);
    },
    [validity, setActive],
  );

  /* Paste sniff on name field — split if user dumps "Jane jane@x.com 403..." */
  const onNamePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData("text").trim();
    const emailMatch = txt.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
    const phoneMatch = txt.match(/(\+?\d[\d\s().-]{6,}\d)/);
    if (emailMatch && (phoneMatch || txt.length > 30)) {
      e.preventDefault();
      let rest = txt;
      if (emailMatch) {
        setEmail(emailMatch[0]);
        rest = rest.replace(emailMatch[0], "");
      }
      if (phoneMatch) {
        setPhone(phoneMatch[0].trim());
        rest = rest.replace(phoneMatch[0], "");
      }
      setName(rest.replace(/[,;|]/g, " ").replace(/\s+/g, " ").trim());
    }
  };

  /* ---------- Submit ---------- */

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (status === "sending") return;

    // Honeypot: silently succeed without sending.
    if (honeypot) {
      setStatus("sent");
      return;
    }

    // Rate limit
    try {
      const last = Number(localStorage.getItem(RATE_KEY) || 0);
      if (Date.now() - last < RATE_MS) {
        setErrors((er) => ({ ...er, project: "Just a moment — already sending." }));
        return;
      }
    } catch { /* noop */ }

    const parsed = contactSchema.safeParse({
      name, email, phone, project, services,
    });
    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      let firstBad: FieldKey | null = null;
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldKey;
        if (!next[key]) next[key] = issue.message;
        if (!firstBad) firstBad = key;
      }
      setErrors(next);
      if (firstBad) {
        setActive(firstBad);
        setShakeKey(firstBad);
        setTimeout(() => setShakeKey(null), 260);
      }
      return;
    }

    track("submit_attempt");
    setStatus("sending");

    const payload = {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? "",
      project: parsed.data.project.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " "),
      services: parsed.data.services,
    };

    const send = () => supabase.functions.invoke("send-contact", { body: payload });

    try {
      let { data, error } = await send();
      if (error || (data && (data as { error?: string }).error)) {
        // single retry, 1s
        await new Promise((r) => setTimeout(r, 1000));
        const retry = await send();
        data = retry.data;
        error = retry.error;
      }
      if (error || (data && (data as { error?: string }).error)) {
        throw error ?? new Error("Submission failed");
      }
      try { localStorage.setItem(RATE_KEY, String(Date.now())); } catch { /* noop */ }
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
      setStatus("sent");
      track("submit_success");
    } catch {
      setStatus("error");
      track("submit_error");
    }
  };

  const toggleService = useCallback((s: string) => {
    setServices((prev) => {
      let next: string[];
      if (prev.includes(s)) {
        next = prev.filter((x) => x !== s);
      } else if (s === NOT_SURE) {
        next = [NOT_SURE];
      } else {
        next = [...prev.filter((x) => x !== NOT_SURE), s];
      }
      track("services_changed", { count: next.length });
      return next;
    });
  }, []);

  if (!open) return null;




  /* ---------- Render helpers ---------- */

  const summary = (k: FieldKey, value: string, placeholder: string) => (
    <button
      type="button"
      onClick={() => setActive(k)}
      className="group flex w-full items-baseline justify-between gap-4 py-2.5 text-left border-b border-border/50 hover:border-foreground/40 transition-colors duration-200"
    >
      <span className="t-micro text-muted-foreground/70 shrink-0 w-16">{labelFor(k)}</span>
      <span className="t-meta flex-1 truncate text-foreground">
        {value || <span className="text-muted-foreground/50">{placeholder}</span>}
      </span>
      <Pencil className="size-3 text-muted-foreground/40 group-hover:text-foreground transition-colors duration-200 shrink-0" strokeWidth={1.5} />
    </button>
  );

  const isActive = (k: FieldKey) => activeStep === k;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-title"
    >
      {/* Backdrop */}
      <button
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-md animate-modal-overlay-in cursor-default"
      />

      {/* Modal panel */}
      <div ref={scrollRef} className="relative h-full w-full overflow-y-auto animate-modal-panel-in"
        style={{ scrollPaddingBottom: "50vh" }}
      >
        <div className="min-h-full grid grid-cols-1 lg:grid-cols-2">

          {/* ── LEFT — Brand panel ───────────────────────────────── */}
          <aside className="relative isolate overflow-hidden bg-foreground text-background h-[16vh] min-h-[120px] max-h-[180px] sm:min-h-[140px] lg:h-auto lg:min-h-screen lg:max-h-none">
            <img
              src={heroImage}
              alt=""
              aria-hidden="true"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-55 motion-safe:animate-kenburns"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.50) 40%, rgba(10,10,10,0.18) 75%, transparent 100%)",
              }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
                backgroundSize: "3px 3px",
              }}
            />

            {/* Mobile micro strap */}
            <div className="lg:hidden relative h-full flex items-end justify-between p-5">
              <span className="t-eyebrow text-background/55">Fly4MEdia</span>
              <span className="t-micro text-background/45 tracking-[0.18em]">
                51.0890° N · 114.4750° W
              </span>
            </div>

            {/* Desktop full panel */}
            <div className="hidden lg:flex relative h-full flex-col justify-between p-6 sm:p-8 lg:p-16 xl:p-20 lg:min-h-screen">
              <div className="flex items-center gap-3">
                <span className="t-eyebrow text-background/50">Fly4MEdia</span>
              </div>

              <div className="max-w-md mt-auto">
                <p className="t-eyebrow text-background/50 mb-3 lg:mb-8">
                  A private consultation
                </p>
                <h2
                  id="contact-title"
                  className="t-display-2 text-background max-w-[14ch]"
                >
                  Let&rsquo;s create something worth looking up at.
                </h2>
                <p className="t-lede mt-8 text-background/60 max-w-sm">
                  Fly4MEdia partners with brands, creators, tourism campaigns,
                  and studios to craft visually immersive aerial storytelling.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 t-meta text-background/50 border-t border-background/15 pt-6">
                <a href="mailto:tobyrennick@gmail.com" className="hover:text-background transition-colors duration-200">tobyrennick@gmail.com</a>
                <a href="tel:+14038189686" className="hover:text-background transition-colors duration-200">403&nbsp;818&nbsp;9686</a>
                <span>Alberta, Canada</span>
              </div>
            </div>
          </aside>

          {/* ── RIGHT — Form panel ───────────────────────────────── */}
          <section className="relative bg-background text-foreground flex items-start">

            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 lg:top-8 lg:right-8 p-2.5 min-h-11 min-w-11 text-muted-foreground hover:text-foreground transition-colors duration-200 z-10"
            >
              <X className="size-5" strokeWidth={1.25} />
            </button>

            <div
              className="w-full max-w-xl mx-auto px-6 sm:px-8 lg:px-16 xl:px-20 py-6 sm:py-10 lg:py-14"
              style={{ paddingBottom: `calc(${keyboardOffset}px + 9rem)` }}
            >

              {status === "sent" ? (
                <SuccessState firstName={firstName} name={name} onClose={onClose} />
              ) : (
                <>
                  {/* Mobile-tight heading */}
                  <h3
                    id="contact-title"
                    className="t-headline-3 lg:t-headline-2 mb-6 lg:mb-10 max-w-[22ch] animate-fade-up"
                    style={{ animationDelay: "0ms" }}
                  >
                    <span className="lg:hidden">What do you want seen differently?</span>
                    <span className="hidden lg:inline">
                      Tell us what deserves<br />a new perspective.
                    </span>
                  </h3>

                  <form ref={formRef} onSubmit={submit} className="space-y-1 lg:space-y-8" noValidate>

                    {/* Honeypot — visually hidden */}
                    <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
                      <label htmlFor="company_website">Company website</label>
                      <input
                        id="company_website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>

                    {/* MOBILE: conversation rhythm. DESKTOP: classic stack. */}
                    <div className="lg:hidden space-y-3">
                      {/* Completed summaries above active */}
                      {STEP_ORDER.map((k) => {
                        if (k === activeStep) return null;
                        if (!hasValue(k, { name, email, phone, project, services })) return null;
                        return (
                          <div key={`s-${k}`} className="motion-safe:animate-fade-up">
                            {summary(
                              k,
                              displayValue(k, { name, email, phone, project, services }),
                              placeholderFor(k),
                            )}
                          </div>
                        );
                      })}

                      {/* Active field */}
                      <div
                        key={`active-${activeStep}`}
                        className={`pt-3 ${shakeKey === activeStep ? "field-error" : ""}`}
                      >
                        <ActiveField
                          step={activeStep}
                          value={readActive(activeStep, { name, email, phone, project, services })}
                          onChange={(v) => writeActive(activeStep, v, { setName, setEmail, setPhone, setProject })}
                          error={errors[activeStep]}
                          emailOk={emailOk && activeStep === "email"}
                          onBlur={() => {
                            if (activeStep === "email" && validity.email) setEmailOk(true);
                          }}
                          onEnter={() => advanceFrom(activeStep)}
                          onSkip={() => {
                            // services + phone can be skipped
                            const idx = STEP_ORDER.indexOf(activeStep);
                            const next = STEP_ORDER[idx + 1];
                            if (next) setActive(next);
                          }}
                          onOpenSheet={() => setSheetOpen(true)}
                          services={services}
                          inputRefs={inputRefs}
                          onPaste={activeStep === "name" ? onNamePaste : undefined}
                        />
                      </div>

                      {/* Upcoming steps — quiet hint */}
                      <div className="pt-4 space-y-1">
                        {STEP_ORDER.map((k) => {
                          if (k === activeStep) return null;
                          if (hasValue(k, { name, email, phone, project, services })) return null;
                          return (
                            <button
                              key={`u-${k}`}
                              type="button"
                              onClick={() => setActive(k)}
                              className="block w-full text-left t-micro text-muted-foreground/50 hover:text-foreground transition-colors duration-200 py-1.5"
                            >
                              {labelFor(k)}{k === "phone" ? " (optional)" : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DESKTOP: full stacked form */}
                    <div className="hidden lg:block space-y-8">
                      <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
                        <Field
                          ref={(el) => { if (el) inputRefs.current.name = el; }}
                          label="Name"
                          value={name}
                          onChange={setName}
                          required
                          autoComplete="name"
                          autoCapitalize="words"
                          error={errors.name}
                        />
                      </div>

                      <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
                        <Field
                          ref={(el) => { if (el) inputRefs.current.email = el; }}
                          label="Email"
                          value={email}
                          onChange={setEmail}
                          required
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          error={errors.email}
                          hint={emailOk ? "Looks right ✓" : "Never shared. Never spammed."}
                          onBlur={() => { if (validity.email) setEmailOk(true); }}
                        />
                      </div>

                      <div className="animate-fade-up" style={{ animationDelay: "180ms" }}>
                        <p className="t-micro text-muted-foreground mb-3 sm:mb-4 block">
                          What are you working on?
                        </p>
                        <div className="space-y-5">
                          {SERVICE_GROUPS.map((group) => (
                            <div key={group.label}>
                              <p className="t-eyebrow text-muted-foreground/60 mb-2">{group.label}</p>
                              <div className="flex flex-wrap gap-2">
                                {group.items.map((s) => (
                                  <Chip key={s} label={s} active={services.includes(s)} onClick={() => toggleService(s)} />
                                ))}
                              </div>
                            </div>
                          ))}
                          <div className="pt-1">
                            <Chip label={NOT_SURE} active={services.includes(NOT_SURE)} onClick={() => toggleService(NOT_SURE)} />
                          </div>
                        </div>
                      </div>

                      <div className="animate-fade-up" style={{ animationDelay: "240ms" }}>
                        <Field
                          ref={(el) => { if (el) inputRefs.current.project = el; }}
                          label="Project"
                          placeholder="A few sentences is plenty — Toby will ask the rest on a 20-minute call."
                          value={project}
                          onChange={setProject}
                          required
                          multiline
                          autoCapitalize="sentences"
                          error={errors.project}
                        />
                      </div>

                      <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
                        <Field
                          ref={(el) => { if (el) inputRefs.current.phone = el; }}
                          label="Phone"
                          labelSuffix="optional"
                          value={phone}
                          onChange={setPhone}
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          error={errors.phone}
                        />
                      </div>

                      {status === "error" && (
                        <p className="t-meta text-destructive">
                          Something went wrong. Try again, or text Toby at{" "}
                          <a href="sms:+14038189686" className="underline underline-offset-4">
                            403&nbsp;818&nbsp;9686
                          </a>
                          .
                        </p>
                      )}

                      <div className="pt-2 animate-fade-up" style={{ animationDelay: "330ms" }}>
                        <p className="t-meta text-muted-foreground mb-4">
                          Toby replies within 1 business day, every time.
                        </p>
                        <button
                          type="submit"
                          disabled={status === "sending"}
                          data-cursor="hover"
                          data-magnetic
                          className="btn-primary group w-full sm:w-auto disabled:opacity-60"
                        >
                          <span>{status === "sending" ? "Sending" : "Begin the conversation"}</span>
                          {status === "sending" ? <SendingBar /> : <span className="link-arrow">↗</span>}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Mobile fallback contact strip */}
                  <div className="lg:hidden mt-8 pt-5 border-t border-border t-meta text-muted-foreground space-y-1">
                    <a href="mailto:tobyrennick@gmail.com" className="block hover:text-foreground transition-colors duration-200">tobyrennick@gmail.com</a>
                    <a href="tel:+14038189686" className="block hover:text-foreground transition-colors duration-200">403&nbsp;818&nbsp;9686</a>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Services bottom sheet (mobile) ───────── */}
      {sheetOpen && (
        <ServicesSheet
          selected={services}
          onToggle={toggleService}
          onClose={(didConfirm) => {
            setSheetOpen(false);
            if (didConfirm && activeStep === "services") {
              const idx = STEP_ORDER.indexOf("services");
              const next = STEP_ORDER[idx + 1];
              if (next) setActive(next);
            }
          }}
        />
      )}

      {/* ── Sticky mobile CTA — appears once form is ready ───── */}
      {status !== "sent" && !sheetOpen && (
        <StickyCTA
          status={status}
          ready={readyToSend}
          assurance={assurance}
          keyboardOffset={keyboardOffset}
          error={status === "error"}
          onSubmit={() => submit()}
        />
      )}

    </div>
  );
}

/* ============================================================ */
/* Sub-components                                               */
/* ============================================================ */

function StickyCTA({
  status, ready, assurance, keyboardOffset, error, onSubmit,
}: {
  status: "idle" | "sending" | "sent" | "error";
  ready: boolean;
  assurance: string;
  keyboardOffset: number;
  error: boolean;
  onSubmit: () => void;
}) {
  const visible = ready || error;
  return (
    <div
      aria-hidden={!visible}
      className={`
        lg:hidden fixed inset-x-0 z-[110]
        bg-background/92 backdrop-blur-md border-t border-border
        px-5 pt-2.5 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}
      `}
      style={{
        bottom: keyboardOffset,
        paddingBottom: keyboardOffset > 0 ? "0.75rem" : "calc(env(safe-area-inset-bottom) + 0.75rem)",
      }}
    >
      {error ? (
        <p className="t-micro text-destructive mb-2 text-center">
          Network hiccup.{" "}
          <a href="sms:+14038189686" className="underline underline-offset-4">Text Toby instead →</a>
        </p>
      ) : (
        <p className="t-micro text-muted-foreground mb-2 text-center truncate">{assurance}</p>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={status === "sending"}
        className="btn-primary group w-full disabled:opacity-60 min-h-12 relative overflow-hidden"
      >
        <span>
          {status === "sending" ? "Sending" : error ? "Try again" : "Send brief"}
        </span>
        {status === "sending" ? <SendingBar /> : <span className="link-arrow">↗</span>}
      </button>
    </div>
  );
}

function SendingBar() {
  return (
    <span aria-hidden="true" className="absolute left-0 bottom-0 h-px w-full overflow-hidden">
      <span className="block h-full w-1/3 bg-background/90 animate-sending-bar" />
    </span>
  );
}

const Chip = React.memo(function Chip({
  label, active, onClick, pill = false,
}: { label: string; active: boolean; onClick: () => void; pill?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={active ? { willChange: "transform" } : undefined}
      className={`
        t-micro shrink-0 whitespace-nowrap px-3.5 py-2.5 min-h-11 border touch-manipulation
        transition-[background-color,border-color,color,transform] duration-200
        ${pill ? "rounded-full" : ""}
        ${active
          ? "border-foreground bg-foreground text-background motion-safe:animate-chip-pop"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
        }
      `}
    >
      {label}
    </button>
  );
});

function ServicesSheet({
  selected, onToggle, onClose,
}: { selected: string[]; onToggle: (s: string) => void; onClose: (didConfirm: boolean) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = "f4m-services-title";

  // Focus management + Escape capture (must beat outer modal's Escape handler).
  // Install listener once via ref so parent re-renders don't re-bind it.
  useEffect(() => {
    const t = setTimeout(() => closeBtnRef.current?.focus(), 50);

    const firstSel = panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    firstSel?.scrollIntoView({ block: "center" });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current(false);
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);


  return (
    <div
      className="lg:hidden fixed inset-0 z-[120]"
      role="dialog"
      aria-labelledby={titleId}
    >
      <button
        aria-label="Close services"
        tabIndex={-1}
        onClick={() => onClose(false)}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-md animate-modal-overlay-in cursor-default"
      />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 bg-background rounded-t-2xl overflow-y-auto animate-modal-panel-in max-h-[92vh] [max-height:92svh]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 7.5rem)" }}
      >
        <div className="sticky top-0 z-10 bg-background border-b border-border/60 px-6 py-5 flex items-center justify-between">
          <h3 id={titleId} className="t-headline-3">Pick what fits</h3>
          <button
            ref={closeBtnRef}
            onClick={() => onClose(false)}
            aria-label="Close"
            className="p-3 -mr-2 min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" strokeWidth={1.25} />
          </button>
        </div>
        <div className="px-6 py-6 space-y-5">
          {SERVICE_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="t-eyebrow text-muted-foreground/60 mb-2">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((s) => (
                  <Chip key={s} label={s} active={selected.includes(s)} onClick={() => onToggle(s)} pill />
                ))}
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-border/60">
            <Chip label={NOT_SURE} active={selected.includes(NOT_SURE)} onClick={() => onToggle(NOT_SURE)} pill />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 z-10 h-3 bg-gradient-to-t from-background to-transparent"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
        />
        <div
          className="fixed inset-x-0 bottom-0 z-10 bg-background border-t border-border px-5 py-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <button
            type="button"
            onClick={() => onClose(true)}
            className="btn-primary group w-full min-h-12"
          >
            <span>{selected.length === 0 ? "Skip for now" : `${selected.length} selected · done`}</span>
            <span className="link-arrow">↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}


function ActiveField({
  step, value, onChange, error, onEnter, onBlur, onSkip, onOpenSheet, services, inputRefs, onPaste, emailOk,
}: {
  step: FieldKey;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  emailOk?: boolean;
  onEnter: () => void;
  onBlur?: () => void;
  onSkip: () => void;
  onOpenSheet: () => void;
  services: string[];
  inputRefs: React.MutableRefObject<Partial<Record<FieldKey, HTMLInputElement | HTMLTextAreaElement>>>;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  const label = labelFor(step);

  if (step === "services") {
    return (
      <div className="space-y-3">
        <p className="t-eyebrow text-muted-foreground/70">{label}</p>
        <button
          type="button"
          onClick={onOpenSheet}
          className="w-full text-left t-headline-3 leading-tight pb-3 border-b border-foreground"
        >
          {services.length === 0
            ? <span className="text-muted-foreground/50">Pick what fits →</span>
            : <span>{services.length === 1 ? services[0] : `${services.length} selected`}</span>}
        </button>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onSkip} className="t-micro text-muted-foreground hover:text-foreground transition-colors">
            Skip
          </button>
          <button type="button" onClick={onEnter} className="t-micro text-foreground underline underline-offset-4">
            Continue
          </button>
        </div>
      </div>
    );
  }

  const common = {
    onBlur,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    value,
    "aria-invalid": !!error,
    "aria-describedby": error ? `err-${step}` : undefined,
    className:
      "w-full bg-transparent outline-none pb-3 border-b border-foreground t-headline-3 leading-tight placeholder:text-muted-foreground/40",
  };

  return (
    <div className="space-y-2">
      <p className="t-eyebrow text-muted-foreground/70 flex items-center justify-between">
        <span>{label}{step === "phone" ? " (optional)" : ""}</span>
        {emailOk && <span className="text-foreground/70 inline-flex items-center gap-1"><Check className="size-3" strokeWidth={2} /> looks right</span>}
      </p>
      {step === "project" ? (
        <textarea
          ref={(el) => { if (el) inputRefs.current.project = el; }}
          {...common}
          rows={4}
          placeholder="A few sentences is plenty."
          enterKeyHint="send"
          autoCapitalize="sentences"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
        />
      ) : (
        <input
          ref={(el) => { if (el) inputRefs.current[step] = el; }}
          {...(common as React.InputHTMLAttributes<HTMLInputElement>)}
          type={step === "email" ? "email" : step === "phone" ? "tel" : "text"}
          inputMode={step === "email" ? "email" : step === "phone" ? "tel" : "text"}
          autoComplete={
            step === "name" ? "name" :
            step === "email" ? "email" :
            step === "phone" ? "tel" : undefined
          }
          autoCapitalize={step === "name" ? "words" : "off"}
          enterKeyHint={step === "phone" ? "send" : "next"}
          placeholder={placeholderFor(step)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
        />
      )}
      {error && (
        <p id={`err-${step}`} className="t-micro text-destructive">{error}</p>
      )}
      {step !== "name" && step !== "email" && step !== "project" && (
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onSkip} className="t-micro text-muted-foreground hover:text-foreground transition-colors">
            Skip
          </button>
          <button type="button" onClick={onEnter} className="t-micro text-foreground underline underline-offset-4">
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

function SuccessState({
  firstName, name, onClose,
}: { firstName: string; name: string; onClose: () => void }) {
  return (
    <div className="space-y-7 animate-fade-up">
      <p className="t-headline-2">In motion{firstName ? `, ${firstName}` : ""}.</p>

      <ol className="border-t border-border/60">
        {[
          { n: "01", action: "Brief received", timing: "just now", done: true },
          { n: "02", action: "Toby replies", timing: "within 1 business day" },
          { n: "03", action: "20-min discovery call", timing: "booked in the reply" },
        ].map((step) => (
          <li
            key={step.n}
            className="flex items-baseline gap-5 sm:gap-8 py-4 border-b border-border/60"
          >
            <span className="t-eyebrow text-muted-foreground/60 shrink-0 w-6">{step.n}</span>
            <span className="t-body flex-1">
              {step.action}
              {step.done && (
                <span className="ml-2 inline-flex items-center gap-1 t-micro text-foreground/70">
                  <Check className="size-3" strokeWidth={2} /> done
                </span>
              )}
            </span>
            <span className="t-meta text-muted-foreground shrink-0 text-right">{step.timing}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-2 pt-2">
        <button
          type="button"
          onClick={() => downloadDiscoveryICS(name)}
          className="btn-primary group w-full min-h-12"
        >
          <span>Add to calendar</span>
          <span className="link-arrow">↗</span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`sms:+14038189686${typeof window !== "undefined" && /iPhone|iPad|Mac/i.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(`Hi Toby — ${firstName || "just"} sent a brief through fly4me.ca.`)}`}
            className="text-center t-micro py-3 min-h-11 border border-border hover:border-foreground transition-colors duration-200"
          >
            Text Toby
          </a>
          <a
            href="mailto:tobyrennick@gmail.com"
            className="text-center t-micro py-3 min-h-11 border border-border hover:border-foreground transition-colors duration-200"
          >
            Email Toby
          </a>
        </div>
      </div>

      <button
        onClick={onClose}
        className="t-eyebrow text-muted-foreground hover:text-foreground transition-colors duration-200"
      >
        Close ↗
      </button>
    </div>
  );
}

/* ---------- Static helpers ---------- */

function labelFor(k: FieldKey) {
  return { name: "Name", email: "Email", services: "Working on", project: "Project", phone: "Phone" }[k];
}
function placeholderFor(k: FieldKey) {
  return {
    name: "Your name",
    email: "you@domain.com",
    services: "Pick what fits",
    project: "A few sentences is plenty.",
    phone: "Optional",
  }[k];
}
function humanError(k: FieldKey) {
  return {
    name: "Add your name",
    email: "Double-check that email",
    services: "",
    project: "A sentence or two helps Toby reply well",
    phone: "Phone looks off",
  }[k];
}
function hasValue(
  k: FieldKey,
  v: { name: string; email: string; phone: string; project: string; services: string[] },
) {
  if (k === "services") return v.services.length > 0;
  return ((v as unknown as Record<string, string>)[k] || "").trim().length > 0;
}
function displayValue(
  k: FieldKey,
  v: { name: string; email: string; phone: string; project: string; services: string[] },
) {
  if (k === "services") return v.services.length === 1 ? v.services[0] : `${v.services.length} selected`;
  if (k === "project") return v.project.replace(/\s+/g, " ").slice(0, 60) + (v.project.length > 60 ? "…" : "");
  return ((v as unknown as Record<string, string>)[k] || "").trim();
}
function readActive(
  k: FieldKey,
  v: { name: string; email: string; phone: string; project: string; services: string[] },
) {
  if (k === "services") return "";
  return (v as unknown as Record<string, string>)[k] || "";
}
function writeActive(
  k: FieldKey,
  v: string,
  setters: {
    setName: (s: string) => void;
    setEmail: (s: string) => void;
    setPhone: (s: string) => void;
    setProject: (s: string) => void;
  },
) {
  if (k === "name") setters.setName(v);
  else if (k === "email") setters.setEmail(v);
  else if (k === "phone") setters.setPhone(v);
  else if (k === "project") setters.setProject(v);
}

/* ---------- Desktop Field (unchanged shape) ---------- */

interface FieldProps {
  label: string;
  labelSuffix?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  autoComplete?: string;
  autoCapitalize?: string;
  inputMode?: "text" | "email" | "tel" | "search" | "url" | "numeric" | "decimal" | "none";
  hint?: string;
  error?: string;
  onBlur?: () => void;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, labelSuffix, value, onChange, type = "text", required, multiline, placeholder, autoComplete, autoCapitalize, inputMode, hint, error, onBlur },
  ref,
) {
  const id = `f-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={`field group relative ${error ? "field-error" : ""}`}>
      <label
        htmlFor={id}
        className="field-label flex items-baseline gap-1.5 t-micro text-muted-foreground mb-2 lg:mb-3"
      >
        {label}
        {labelSuffix && (
          <span className="text-muted-foreground/50 normal-case">{labelSuffix}</span>
        )}
      </label>
      <div className="relative">
        {multiline ? (
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            required={required}
            rows={4}
            placeholder={placeholder}
            autoCapitalize={autoCapitalize}
            aria-invalid={!!error}
            className="t-lede w-full bg-transparent outline-none pb-3 border-b border-border resize-none placeholder:text-muted-foreground/40"
          />
        ) : (
          <input
            ref={ref}
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            required={required}
            placeholder={placeholder}
            autoComplete={autoComplete}
            autoCapitalize={autoCapitalize}
            inputMode={inputMode}
            aria-invalid={!!error}
            className="t-lede w-full bg-transparent outline-none pb-3 border-b border-border placeholder:text-muted-foreground/40"
          />
        )}
        <span className="field-underline" aria-hidden="true" />
      </div>
      {error ? (
        <p className="t-micro text-destructive mt-2">{error}</p>
      ) : hint ? (
        <p className="t-micro text-muted-foreground/60 mt-2">{hint}</p>
      ) : null}
    </div>
  );
});
