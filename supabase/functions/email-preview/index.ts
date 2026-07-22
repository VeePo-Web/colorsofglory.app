// Dev-only email preview surface. Renders any registered template as HTML
// so we can proof brand + copy without triggering a real send.
//
// Access is gated by EMAIL_PREVIEW_TOKEN — pass as ?token=... or in the
// X-Preview-Token header. No PII is required or accepted.
//
// GET /                      → index of every template
// GET /?template=welcome     → renders the template with its previewData
// GET /?template=welcome&data={"firstName":"Sam"}   → renders with custom data

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getTemplate, listTemplates } from "../_shared/email-registry.ts";

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("EMAIL_PREVIEW_TOKEN");
  if (!expected) return json({ error: "preview_disabled" }, 503);

  const url = new URL(req.url);
  const provided = url.searchParams.get("token") ?? req.headers.get("x-preview-token") ?? "";
  if (provided !== expected) return json({ error: "unauthorized" }, 401);

  const templateName = url.searchParams.get("template");
  if (!templateName) {
    const rows = listTemplates()
      .map(({ name, entry }) => {
        const href = `?token=${encodeURIComponent(expected)}&template=${encodeURIComponent(name)}`;
        return `<tr>
          <td style="padding:10px 14px;font-family:'SF Mono',Menlo,monospace;font-size:13px;color:#1C1A17;">${name}</td>
          <td style="padding:10px 14px;font-family:-apple-system,sans-serif;font-size:13px;color:#6B6459;">${entry.displayName}</td>
          <td style="padding:10px 14px;font-family:-apple-system,sans-serif;font-size:12px;color:#B8953A;text-transform:uppercase;letter-spacing:.08em;">${entry.category}</td>
          <td style="padding:10px 14px;"><a href="${href}" style="color:#B8953A;text-decoration:none;">Preview →</a></td>
        </tr>`;
      })
      .join("");
    return html(`<!doctype html><html><head><meta charset="utf-8"><title>COG email templates</title></head>
<body style="margin:0;padding:40px 24px;background:#F5F0E8;font-family:-apple-system,sans-serif;">
  <div style="max-width:820px;margin:0 auto;background:#FAF7F2;border:1px solid rgba(28,26,23,.10);border-radius:16px;padding:28px;">
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;color:#1C1A17;">Colors of Glory · email templates</h1>
    <p style="margin:0 0 20px;color:#6B6459;">Every template renders through the shared shell. Click to preview.</p>
    <table style="border-collapse:collapse;width:100%;">${rows}</table>
  </div>
</body></html>`);
  }

  const template = getTemplate(templateName);
  if (!template) return json({ error: "unknown_template" }, 404);

  const dataParam = url.searchParams.get("data");
  let data: Record<string, unknown> = template.previewData;
  if (dataParam) {
    try {
      data = { ...template.previewData, ...(JSON.parse(dataParam) as Record<string, unknown>) };
    } catch {
      return json({ error: "bad_data_json" }, 400);
    }
  }

  try {
    const rendered = template.render(data);
    // Show a small dev banner above the rendered email so no one mistakes
    // it for a live inbox view.
    const banner = `<div style="position:sticky;top:0;background:#1C1A17;color:#F5F0E8;padding:8px 16px;font:12px/1.4 -apple-system,sans-serif;">
      <strong>${templateName}</strong> · ${template.category} · subject: ${rendered.subject}
    </div>`;
    return html(`${banner}${rendered.html}`);
  } catch (e) {
    return json({ error: "render_failed", detail: String(e) }, 400);
  }
});