import { useCallback, useRef, useState } from "react";
import { audioCache } from "@/lib/voice/audioCache";

export interface AudioPlayerState {
  isPlaying: boolean;
  progress: number; // 0–1
  currentMemoId: string | null;
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    progress: 0,
    currentMemoId: null,
  });

  const releaseObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const loadAndPlay = useCallback((url: string, memoId: string) => {
    releaseObjectUrl();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio();
    audio.src = url;
    audio.ontimeupdate = () => {
      const pct = audio.currentTime / (audio.duration || 1);
      setState((s) => ({ ...s, progress: pct }));
    };
    audio.onended = () => {
      setState((s) => ({ ...s, isPlaying: false, progress: 0 }));
    };
    audio.onerror = () => {
      setState((s) => ({ ...s, isPlaying: false }));
    };
    audioRef.current = audio;

    audio.play().then(() => {
      setState({ isPlaying: true, progress: 0, currentMemoId: memoId });
    }).catch(() => {
      setState((s) => ({ ...s, isPlaying: false }));
    });
  }, []);

  const play = useCallback(async (memoId: string, signedUrl: string) => {
    // Check IndexedDB cache first
    const cached = await audioCache.get(memoId);

    if (cached) {
      const url = URL.createObjectURL(cached);
      objectUrlRef.current = url;
      loadAndPlay(url, memoId);
    } else {
      // Stream immediately while caching in background
      loadAndPlay(signedUrl, memoId);
      audioCache.prefetch(memoId, signedUrl); // fire-and-forget
    }
  }, [loadAndPlay]);

  /** Play from a local Blob (post-recording review) */
  const playBlob = useCallback((blob: Blob, memoId = "preview") => {
    releaseObjectUrl();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    loadAndPlay(url, memoId);
  }, [loadAndPlay]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState({ isPlaying: false, progress: 0, currentMemoId: null });
  }, []);

  const seek = useCallback((pct: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = (audioRef.current.duration || 0) * pct;
  }, []);

  return { state, play, playBlob, pause, stop, seek };
}
