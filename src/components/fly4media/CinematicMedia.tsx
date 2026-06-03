import { useEffect, useRef, useState } from "react";

export interface VideoSource {
  src: string;
  type: string;
  media?: string;
}

interface Props {
  /** Always required — acts as poster/LCP image and reduced-motion fallback */
  image: string;
  alt: string;
  /** When provided, video plays autoplay/muted/loop on visibility */
  sources?: VideoSource[];
  width?: number;
  height?: number;
  priority?: boolean;
  /** object-position override for art-directed crops */
  objectPosition?: string;
}

/**
 * Drop-in replacement for <img className="media-img" /> that upgrades to a
 * silent autoplay video when sources are provided. Plays only when visible.
 * Honors prefers-reduced-motion + Save-Data. Poster paints first as LCP.
 */
export default function CinematicMedia({
  image,
  alt,
  sources,
  width = 1280,
  height = 1600,
  priority = false,
  objectPosition,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const saveData = conn?.saveData === true;
    const slow = conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g";
    if (reduce || saveData || slow) setEnabled(false);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  const showVideo = enabled && sources && sources.length > 0;

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
        className="media-img absolute inset-0"
        style={{ objectPosition }}
      />
      {showVideo && (
        <video
          ref={videoRef}
          poster={image}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disableRemotePlayback
          disablePictureInPicture
          aria-hidden="true"
          onCanPlay={() => setReady(true)}
          className="media-img absolute inset-0"
          style={{
            opacity: ready ? 1 : 0,
            transition: "opacity 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            objectPosition,
            willChange: "opacity",
          }}
        >
          {sources!.map((s) => (
            <source key={s.src} src={s.src} type={s.type} media={s.media} />
          ))}
        </video>
      )}
    </>
  );
}
