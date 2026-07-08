/**
 * Preview-gate unlock state. PasswordGate writes the flag on a correct
 * passphrase; App reads it once at mount. Session-scoped by design — closing
 * the tab re-locks the preview.
 */
const KEY = "site_unlocked";

export function isPreviewUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setPreviewUnlocked(): void {
  try {
    sessionStorage.setItem(KEY, "true");
  } catch {
    /* storage may be unavailable (private mode) — the in-memory state still unlocks */
  }
}
