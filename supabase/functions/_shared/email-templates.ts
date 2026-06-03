// Fly4MEdia branded email system
// Monochrome, editorial, restrained — mirrors the site (white bg, near-black type, Inter, oversized headings, hairline rules).
// All inline styles for max email-client compatibility.

export const BRAND = {
  name: "Fly4MEdia",
  wordmark: "FLY4MEDIA",
  slogan: "Perspective Changes Everything.",
  tagline: "A cinematic perspective studio · Alberta, Canada",
  email: "tobyrennick@gmail.com",
  phone: "403 818 9686",
  phoneTel: "+14038189686",
  website: "https://fly4me.ca",
  workUrl: "https://fly4me.ca/work",

  // Colours
  bg: "#ffffff",
  fg: "#0a0a0a",
  body: "#3a3a3a",
  muted: "#8a8a8a",
  border: "#ececec",
  borderStrong: "#0a0a0a",

  fontStack:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

export function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function nl2br(str: string): string {
  return escapeHtml(str).replace(/\n/g, "<br/>");
}

export function emailWrapper(content: string, preheader: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(BRAND.name)}</title>
<!--[if mso]>
<style type="text/css">
body, table, td, p, h1, h2 { font-family: Helvetica, Arial, sans-serif !important; }
</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;color:${BRAND.fg};">
<div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
${escapeHtml(preheader)}${"&nbsp;&zwnj;".repeat(40)}
</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BRAND.bg};">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:${BRAND.bg};">
${content}
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function emailHeader(eyebrow: string): string {
  return `
<tr><td style="padding:8px 40px 56px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td style="font-family:${BRAND.fontStack};font-size:11px;font-weight:500;letter-spacing:0.32em;text-transform:uppercase;color:${BRAND.fg};">
${escapeHtml(BRAND.wordmark)}
</td>
<td align="right" style="font-family:${BRAND.fontStack};font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.muted};">
${escapeHtml(eyebrow)}
</td>
</tr>
</table>
</td></tr>`;
}

export function displayHeading(text: string): string {
  return `
<tr><td style="padding:0 40px 28px;font-family:${BRAND.fontStack};font-size:32px;font-weight:500;letter-spacing:-0.02em;line-height:1.15;color:${BRAND.fg};">
${escapeHtml(text)}
</td></tr>`;
}

export function bodyText(text: string): string {
  return `
<tr><td style="padding:0 40px 20px;font-family:${BRAND.fontStack};font-size:15px;font-weight:400;line-height:1.65;color:${BRAND.body};">
${escapeHtml(text)}
</td></tr>`;
}

export function metaBlock(
  rows: { label: string; value: string; href?: string }[],
): string {
  if (rows.length === 0) return "";
  const inner = rows
    .map((r, i) => {
      const isLast = i === rows.length - 1;
      const valueHtml = r.href
        ? `<a href="${escapeHtml(r.href)}" style="color:${BRAND.fg};text-decoration:none;">${escapeHtml(r.value)}</a>`
        : escapeHtml(r.value);
      return `
<tr>
<td style="padding:18px 0;${isLast ? "" : `border-bottom:1px solid ${BRAND.border};`}font-family:${BRAND.fontStack};font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.muted};width:120px;vertical-align:middle;">
${escapeHtml(r.label)}
</td>
<td style="padding:18px 0;${isLast ? "" : `border-bottom:1px solid ${BRAND.border};`}font-family:${BRAND.fontStack};font-size:14px;font-weight:400;color:${BRAND.fg};vertical-align:middle;">
${valueHtml}
</td>
</tr>`;
    })
    .join("");
  return `
<tr><td style="padding:8px 40px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid ${BRAND.border};">
${inner}
</table>
</td></tr>`;
}

export function quoteBlock(label: string, text: string): string {
  return `
<tr><td style="padding:32px 40px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid ${BRAND.border};">
<tr><td style="padding:24px 0 12px;font-family:${BRAND.fontStack};font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.muted};">
${escapeHtml(label)}
</td></tr>
<tr><td style="padding:0 0 8px;font-family:${BRAND.fontStack};font-size:16px;font-weight:400;line-height:1.7;color:${BRAND.fg};">
${nl2br(text)}
</td></tr>
</table>
</td></tr>`;
}

export function ctaButton(label: string, href: string): string {
  return `
<tr><td style="padding:16px 40px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr><td style="border:1px solid ${BRAND.borderStrong};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:16px 28px;font-family:${BRAND.fontStack};font-size:11px;font-weight:500;letter-spacing:0.24em;text-transform:uppercase;color:${BRAND.fg};text-decoration:none;">
${escapeHtml(label)} &nbsp;&rarr;
</a>
</td></tr>
</table>
</td></tr>`;
}

export function spacer(px = 32): string {
  return `<tr><td style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</td></tr>`;
}

export function emailFooter(): string {
  const year = new Date().getFullYear();
  return `
<tr><td style="padding:64px 40px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid ${BRAND.border};">
<tr><td align="center" style="padding:48px 0 16px;font-family:${BRAND.fontStack};font-size:18px;font-weight:500;letter-spacing:-0.01em;line-height:1.3;color:${BRAND.fg};">
${escapeHtml(BRAND.slogan)}
</td></tr>
<tr><td align="center" style="padding:0 0 32px;font-family:${BRAND.fontStack};font-size:11px;font-weight:500;letter-spacing:0.24em;text-transform:uppercase;color:${BRAND.muted};">
${escapeHtml(BRAND.name)}
</td></tr>
<tr><td align="center" style="padding:0 0 8px;font-family:${BRAND.fontStack};font-size:12px;font-weight:400;line-height:1.7;color:${BRAND.muted};">
Alberta, Canada &nbsp;·&nbsp;
<a href="mailto:${escapeHtml(BRAND.email)}" style="color:${BRAND.muted};text-decoration:none;">${escapeHtml(BRAND.email)}</a>
&nbsp;·&nbsp;
<a href="tel:${escapeHtml(BRAND.phoneTel)}" style="color:${BRAND.muted};text-decoration:none;">${escapeHtml(BRAND.phone)}</a>
</td></tr>
<tr><td align="center" style="padding:0 0 8px;font-family:${BRAND.fontStack};font-size:11px;font-weight:400;color:${BRAND.muted};">
&copy; ${year} ${escapeHtml(BRAND.name)}
</td></tr>
</table>
</td></tr>`;
}
