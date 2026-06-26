import { useCallback, useEffect, useRef } from "react";

/**
 * Invisible Cloudflare Turnstile CAPTCHA — the app-side half of the bypass-proof
 * anti-abuse floor (an attacker can call signInWithOtp directly with the anon key;
 * the Supabase dashboard CAPTCHA only stops that if the client sends a token).
 *
 * Fully gated by VITE_TURNSTILE_SITE_KEY:
 *   - key ABSENT  → getToken() resolves undefined; NOTHING renders; behavior is
 *     byte-for-byte unchanged from today. (Safe to ship before the key exists.)
 *   - key PRESENT → an invisible managed widget auto-solves; getToken() hands the
 *     send flow a fresh single-use token, then resets to pre-fetch the next one.
 *
 * No npm dependency — loads Cloudflare's official script on demand. Frontend only;
 * the public site key is provisioned by whoever owns the Supabase/Cloudflare config.
 */

const SITE_KEY = (import.meta.env as Record<string, string | undefined>).VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile_script_failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const resolverRef = useRef<((t: string) => void) | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          size: "invisible",
          callback: (token: string) => {
            tokenRef.current = token;
            resolverRef.current?.(token);
            resolverRef.current = null;
          },
          "error-callback": () => {
            resolverRef.current?.("");
            resolverRef.current = null;
          },
        });
      })
      .catch(() => {
        /* script blocked/offline → getToken falls through to undefined (fail-open;
           the dashboard CAPTCHA + Allowed Countries + rate limit remain the floor). */
      });
    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, []);

  /** Resolve a single-use token, or undefined when CAPTCHA isn't configured. */
  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    if (!window.turnstile || widgetIdRef.current == null) return undefined;
    if (tokenRef.current) {
      const t = tokenRef.current;
      tokenRef.current = null;
      window.turnstile.reset(widgetIdRef.current); // pre-fetch the next token
      return t || undefined;
    }
    // Token not solved yet — wait for the callback (cap the wait so a stuck widget
    // never hangs login; fail-open to undefined).
    const t = await new Promise<string>((resolve) => {
      resolverRef.current = resolve;
      window.setTimeout(() => {
        if (resolverRef.current) {
          resolverRef.current = null;
          resolve("");
        }
      }, 8000);
    });
    return t || undefined;
  }, []);

  return { containerRef, getToken, enabled: Boolean(SITE_KEY) };
}
