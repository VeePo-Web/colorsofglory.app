import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  BRAND,
  bodyText,
  ctaButton,
  displayHeading,
  emailFooter,
  emailHeader,
  emailWrapper,
  metaBlock,
  quoteBlock,
  spacer,
} from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  project?: unknown;
  services?: unknown;
}

function asString(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

function buildInternalEmail(
  name: string,
  email: string,
  phone: string,
  project: string,
  services: string[],
): string {
  const rows: { label: string; value: string; href?: string }[] = [
    { label: "Email", value: email, href: `mailto:${email}` },
  ];
  if (phone) {
    rows.push({ label: "Phone", value: phone, href: `tel:${phone}` });
  }
  if (services.length > 0) {
    rows.push({ label: "Interested in", value: services.join(", ") });
  }
  rows.push({ label: "Source", value: "fly4me.ca · contact modal" });

  const content = [
    emailHeader("New enquiry"),
    displayHeading(`${name} wants to start a project.`),
    bodyText(
      "A new enquiry just landed through the site. Details below — reply directly to this email and you'll land in their inbox.",
    ),
    metaBlock(rows),
    quoteBlock("Project", project),
    spacer(8),
    emailFooter(),
  ].join("");

  return emailWrapper(content, `New enquiry from ${name}`);
}

function buildSubmitterEmail(name: string): string {
  const fname = firstName(name);
  const content = [
    emailHeader("Thanks for reaching out"),
    displayHeading(`Your note landed with us, ${fname}.`),
    bodyText(
      "I read every enquiry personally — usually within one business day. If your project has a deadline or a sensitivity to it, mention it in your reply and I'll prioritise.",
    ),
    bodyText(
      "If we're slow to respond, we're probably out waiting on light or weather somewhere in the Rockies. We'll be back at a screen soon. In the meantime, here's some recent work to sit with.",
    ),
    ctaButton("See recent work", BRAND.workUrl),
    spacer(16),
    bodyText("— Toby Rennick, Founder · Fly4MEdia"),
    emailFooter(),
  ].join("");

  return emailWrapper(
    content,
    "Toby will reply personally within one business day.",
  );
}

async function sendViaResend(
  resendKey: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[send-contact] resend ${label} failed`, res.status, text);
    throw new Error(`Resend ${label} failed: ${res.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Payload;

    const name = asString(body.name, 100);
    const email = asString(body.email, 255);
    const phone = asString(body.phone, 30);
    const project = asString(body.project, 2000);
    const services = Array.isArray(body.services)
      ? (body.services as unknown[]).filter((s) => typeof s === "string").slice(0, 9) as string[]
      : [];

    if (!name || !email || !project || !isEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: insertError } = await supabase
      .from("contact_submissions")
      .insert({
        name,
        email,
        phone: phone || null,
        project,
        services: services.length > 0 ? services : null,
      });

    if (insertError) {
      console.error("[send-contact] insert failed", insertError);
    }

    if (resendKey) {
      const sender = "Fly4MEdia <onboarding@resend.dev>";

      const internalHtml = buildInternalEmail(name, email, phone, project, services);
      const submitterHtml = buildSubmitterEmail(name);

      // Send internal notifications as SEPARATE requests per recipient.
      // Resend rejects the entire send (403) if any single recipient is
      // outside the verified domain — so batching toby + parker together
      // means parker also misses the email. Splitting isolates failures.
      const internalRecipients = ["tobyrennick@gmail.com", "parker@veepo.ca"];

      const sends = internalRecipients.map((to) =>
        sendViaResend(
          resendKey,
          {
            from: sender,
            to: [to],
            reply_to: email,
            subject: `New enquiry — ${name}`,
            html: internalHtml,
          },
          `internal:${to}`,
        ),
      );

      sends.push(
        sendViaResend(
          resendKey,
          {
            from: sender,
            to: [email],
            reply_to: "tobyrennick@gmail.com",
            subject: "We've got your note — Fly4MEdia",
            html: submitterHtml,
          },
          "submitter",
        ),
      );

      const results = await Promise.allSettled(sends);
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const label = i < internalRecipients.length
            ? `internal:${internalRecipients[i]}`
            : "submitter";
          console.error(`[send-contact] email ${label} rejected`, r.reason);
        }
      });
    } else {
      console.warn("[send-contact] RESEND_API_KEY missing, skipping email");
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-contact] error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
