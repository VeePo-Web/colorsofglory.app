/**
 * R58 — Mobile keyboard geometry for the lyric sheet.
 *
 * The core act of this product is typing one line into a verse on a 390px
 * phone. Every prior round improved what happens around that act; nothing
 * has ever measured the keyboard. On iOS Safari the visual viewport shrinks
 * without a resize event, `100vh` keeps its pre-keyboard value, and the caret
 * ends up under the keyboard the moment a section grows past a few lines.
 *
 * This module is the single source of truth for that geometry. It exposes
 * the keyboard inset as a CSS variable so layout stays declarative:
 *
 *     --cog-kb: 0px            (keyboard closed)
 *     --cog-kb: 336px          (keyboard open)
 *
 * No component should read `window.innerHeight`, listen to `resize`, or call
 * `scrollIntoView` on a textarea again.
 */

const CSS_VAR = "--cog-kb";
/** Below this the change is browser chrome (URL bar), not a keyboard. */
const KEYBOARD_MIN_PX = 120;
/** Breathing room kept between the caret line and the keyboard. */
export const CARET_MARGIN_PX = 24;

export type KeyboardState = {
  /** Pixels of viewport hidden by the keyboard. 0 when closed. */
  inset: number;
  open: boolean;
  /** Usable height above the keyboard. */
  viewportHeight: number;
};

type Listener = (state: KeyboardState) => void;

const listeners = new Set<Listener>();
let state: KeyboardState = { inset: 0, open: false, viewportHeight: 0 };
let started = false;

function measure(): KeyboardState {
  if (typeof window === "undefined") return state;
  const vv = window.visualViewport;
  const layoutHeight = window.innerHeight;
  const visualHeight = vv ? vv.height + vv.offsetTop : layoutHeight;
  const raw = Math.max(0, Math.round(layoutHeight - visualHeight));
  const inset = raw >= KEYBOARD_MIN_PX ? raw : 0;
  return { inset, open: inset > 0, viewportHeight: Math.round(visualHeight) };
}

function apply(next: KeyboardState): void {
  if (next.inset === state.inset && next.viewportHeight === state.viewportHeight) return;
  state = next;
  document.documentElement.style.setProperty(CSS_VAR, `${next.inset}px`);
  document.documentElement.classList.toggle("cog-kb-open", next.open);
  listeners.forEach((fn) => fn(next));
}

export function getKeyboardState(): KeyboardState {
  return state;
}

export function subscribeKeyboard(fn: Listener): () => void {
  fn(state);
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Start tracking. Call once at app mount; returns a cleanup fn.
 * Safe on desktop — the inset simply stays 0.
 */
export function startKeyboardTracking(): () => void {
  if (typeof window === "undefined" || started) return () => {};
  started = true;
  const vv = window.visualViewport;
  const onChange = () => apply(measure());

  vv?.addEventListener("resize", onChange);
  vv?.addEventListener("scroll", onChange);
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("focusin", onChange);
  window.addEventListener("focusout", onChange);
  onChange();

  return () => {
    started = false;
    vv?.removeEventListener("resize", onChange);
    vv?.removeEventListener("scroll", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("focusin", onChange);
    window.removeEventListener("focusout", onChange);
    document.documentElement.style.setProperty(CSS_VAR, "0px");
    document.documentElement.classList.remove("cog-kb-open");
  };
}

// ---------- Caret ----------

/**
 * Pixel offset of the caret line from the top of a textarea, computed with a
 * mirror element (textareas expose no caret geometry). Cheap enough to run on
 * every keystroke; the mirror is reused.
 */
let mirror: HTMLDivElement | null = null;

const MIRRORED_PROPS = [
  "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
  "lineHeight", "textTransform", "textIndent", "whiteSpace", "wordSpacing",
  "wordBreak", "overflowWrap",
] as const;

export function caretOffsetTop(el: HTMLTextAreaElement): number {
  if (typeof document === "undefined") return 0;
  if (!mirror) {
    mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    mirror.style.position = "absolute";
    mirror.style.top = "-9999px";
    mirror.style.left = "-9999px";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    document.body.appendChild(mirror);
  }
  const cs = window.getComputedStyle(el);
  for (const prop of MIRRORED_PROPS) {
    mirror.style[prop as never] = cs[prop as never];
  }
  const value = el.value.slice(0, el.selectionStart ?? 0);
  mirror.textContent = value;
  const marker = document.createElement("span");
  marker.textContent = el.value.slice(el.selectionStart ?? 0, (el.selectionStart ?? 0) + 1) || ".";
  mirror.appendChild(marker);
  const top = marker.offsetTop;
  mirror.textContent = "";
  return top;
}

/**
 * Keep the caret line comfortably above the keyboard.
 *
 * Scrolls the nearest scroll container by the smallest amount that works —
 * never centres, never jumps, never fires when the caret is already visible.
 * Returns the number of pixels scrolled (0 = nothing moved, the good case).
 */
export function keepCaretVisible(
  el: HTMLTextAreaElement,
  opts: { container?: HTMLElement | null; margin?: number; behavior?: ScrollBehavior } = {},
): number {
  if (typeof window === "undefined") return 0;
  const container = opts.container ?? findScrollParent(el);
  if (!container) return 0;
  const margin = opts.margin ?? CARET_MARGIN_PX;

  const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 20;
  const caretTopInPage = el.getBoundingClientRect().top + caretOffsetTop(el);
  const caretBottom = caretTopInPage + lineHeight;

  const bounds = container.getBoundingClientRect();
  const visibleTop = Math.max(bounds.top, 0) + margin;
  const visibleBottom = Math.min(bounds.bottom, state.viewportHeight || window.innerHeight) - margin;

  let delta = 0;
  if (caretBottom > visibleBottom) delta = caretBottom - visibleBottom;
  else if (caretTopInPage < visibleTop) delta = caretTopInPage - visibleTop;
  if (delta === 0) return 0;

  container.scrollBy({ top: delta, behavior: opts.behavior ?? "auto" });
  return delta;
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const oy = window.getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}

/**
 * Move focus to another textarea without the keyboard ever dismissing.
 * (Blur-then-focus across a tick closes and reopens the iOS keyboard, which
 * reads as a full-screen flicker. Focusing directly keeps it up.)
 */
export function moveCaretTo(
  next: HTMLTextAreaElement | null,
  where: "start" | "end" = "end",
): void {
  if (!next) return;
  next.focus({ preventScroll: true });
  const pos = where === "start" ? 0 : next.value.length;
  try {
    next.setSelectionRange(pos, pos);
  } catch {
    /* not a text input */
  }
  keepCaretVisible(next);
}
