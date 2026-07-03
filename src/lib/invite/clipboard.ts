/**
 * Clipboard helper for invite links.
 *
 * navigator.clipboard.writeText is the happy path, but iOS Safari rejects it
 * outside a fresh user gesture and older/embedded browsers lack it entirely.
 * The hidden-textarea + execCommand path still works in those contexts, so we
 * fall through to it before reporting failure — the caller only ever shows
 * "Copied" when the text actually landed on the clipboard.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path below.
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
