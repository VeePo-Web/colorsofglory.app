import { useEffect, useMemo, useRef, useState } from "react";

interface VideoSource {
  src: string;
  type: string;
  /** Optional media query — evaluated in JS at mount, NOT emitted as a DOM `media` attribute */
  media?: string;
}

interface Props {
  image: string;
  alt: string;
  /** Single src (legacy) — use `sources` for multi-format / responsive */
  videoSrc?: string;
  sources?: VideoSource[];
  /** Optional second clip — first clip plays once, then this takes over and loops */
  nextSources?: VideoSource[];
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}

/**
 * Pick the supported sources for the current viewport.
 * We intentionally do this in JS instead of using <source media="..."> because
 * iOS Safari has a long-standing bug where a non-matching `media` on the first
 * <source> can leave the element with no decoded media (stuck on the poster).
 */
function pickSourcesForViewport(all: VideoSource[]): VideoSource[] {
  if (typeof window === "undefined") return all.filter((s) => !s.media);
  const matched = all.filter((s) => !s.media || window.matchMedia(s.media).matches);
  // If at least one matches a media query, prefer those; otherwise fall back to the un-scoped sources.
  const scoped = matched.filter((s) => s.media);
  if (scoped.length > 0) {
    // Put scoped (e.g. mobile-tuned) first, then unscoped as fallback formats.
    const unscoped = all.filter((s) => !s.media);
    return [...scoped, ...unscoped];
  }
  return all.filter((s) => !s.media);
}

/**
 * Cinematic hero media layer.
 * - Poster paints first (acts as LCP), first video fades in on `loadeddata`/`canplay`/`playing`
 * - When `nextSources` is provided, BOTH videos are mounted simultaneously.
 *   The second clip preloads lazily while the first is playing, then we
 *   cross-fade between them on `ended` — no poster flash, no gap.
 * - Pauses when offscreen (battery/GPU)
 * - Honors prefers-reduced-motion + Save-Data
 */
export default function HeroMedia({
  image,
  alt,
  videoSrc,
  sources,
  nextSources,
  className = "",
  priority = false,
  width = 1920,
  height = 1080,
}: Props) {
  const firstRef = useRef<HTMLVideoElement>(null);
  const nextRef = useRef<HTMLVideoElement>(null);
  const [firstReady, setFirstReady] = useState(false);
  const [nextReady, setNextReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [phase, setPhase] = useState<"first" | "next">("first");
  const [nextPreloadAuto, setNextPreloadAuto] = useState(false);

  const firstSourcesRaw: VideoSource[] = useMemo(
    () =>
      sources && sources.length > 0
        ? sources
        : videoSrc
          ? [{ src: videoSrc, type: "video/mp4" }]
          : [],
    [sources, videoSrc],
  );

  const firstSources = useMemo(() => pickSourcesForViewport(firstSourcesRaw), [firstSourcesRaw]);
  const nextSourcesPicked = useMemo(
    () => (nextSources ? pickSourcesForViewport(nextSources) : []),
    [nextSources],
  );

  const hasSequence = nextSourcesPicked.length > 0;

  // Respect reduced motion + save-data
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const saveData = conn?.saveData === true;
    const slow = conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g";
    if (reduce || saveData || slow) setEnabled(false);
  }, []);

  // Imperative autoplay kick — iOS sometimes ignores the autoPlay attribute
  // silently. Calling .play() with muted+playsInline is what iOS actually honors.
  useEffect(() => {
    if (!enabled) return;
    const v = firstRef.current;
    if (!v) return;
    // If the element is already past HAVE_CURRENT_DATA, flip ready immediately
    // (covers the case where loadeddata fired before React attached the handler).
    if (v.readyState >= 2) setFirstReady(true);
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [enabled, firstSources]);

  // Pause when offscreen
  useEffect(() => {
    if (!enabled) return;
    const active = phase === "next" ? nextRef.current : firstRef.current;
    const inactive = phase === "next" ? firstRef.current : nextRef.current;
    if (inactive) inactive.pause();
    if (!active) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) active.play().catch(() => {});
        else active.pause();
      },
      { threshold: 0.05 },
    );
    io.observe(active);
    return () => io.disconnect();
  }, [enabled, phase]);

  // Promote the next clip's preload to "auto" once the first clip is ~halfway
  // through, so the cross-fade stays seamless without competing for bandwidth
  // during the initial hero paint.
  useEffect(() => {
    if (!enabled || !hasSequence) return;
    const v = firstRef.current;
    if (!v) return;
    const onTime = () => {
      if (!v.duration || isNaN(v.duration)) return;
      if (v.currentTime / v.duration >= 0.5) {
        setNextPreloadAuto(true);
        v.removeEventListener("timeupdate", onTime);
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [enabled, hasSequence]);

  const handleFirstEnded = () => {
    if (!hasSequence) return;
    const v = nextRef.current;
    if (v) v.play().catch(() => {});
    setPhase("next");
  };

  const markFirstReady = () => setFirstReady(true);
  const markNextReady = () => setNextReady(true);

  const showFirst = enabled && firstSources.length > 0;
  const showNext = enabled && hasSequence;

  return (
    <>
      <img
        src={image}
        alt={alt}
        width={width}
        height={height}
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`absolute inset-0 w-full h-full object-cover ${className}`}
        style={{ transform: "translateZ(0)" }}
      />

      {/* First clip — visible until it ends */}
      {showFirst && (
        <video
          ref={firstRef}
          poster={image}
          autoPlay
          muted
          loop={!hasSequence}
          playsInline
          preload="auto"
          disableRemotePlayback
          disablePictureInPicture
          aria-hidden="true"
          onLoadedData={markFirstReady}
          onCanPlay={markFirstReady}
          onPlaying={markFirstReady}
          onEnded={handleFirstEnded}
          className={`absolute inset-0 w-full h-full object-cover ${className}`}
          style={{
            opacity: firstReady && phase === "first" ? 1 : 0,
            transition: "opacity 800ms cubic-bezier(0.22, 1, 0.36, 1)",
            transform: "translateZ(0)",
            willChange: "opacity",
            zIndex: 1,
          }}
        >
          {firstSources.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      )}

      {/* Second clip — preloads silently behind the first, then cross-fades up */}
      {showNext && (
        <video
          ref={nextRef}
          poster={image}
          muted
          loop
          playsInline
          preload={nextPreloadAuto ? "auto" : "metadata"}
          disableRemotePlayback
          disablePictureInPicture
          aria-hidden="true"
          onLoadedData={markNextReady}
          onCanPlay={markNextReady}
          onPlaying={markNextReady}
          className={`absolute inset-0 w-full h-full object-cover ${className}`}
          style={{
            opacity: phase === "next" && nextReady ? 1 : 0,
            transition: "opacity 1000ms cubic-bezier(0.22, 1, 0.36, 1)",
            transform: "translateZ(0)",
            willChange: "opacity",
            zIndex: 2,
          }}
        >
          {nextSourcesPicked.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      )}
    </>
  );
}
