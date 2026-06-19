import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Archive, MoreHorizontal, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import {
  archiveMemo,
  friendlyMemoLabel,
  getPlaybackUrl,
  updateMemoNotes,
  updateMemoTitle,
  type BrainstormMemo,
} from "@/integrations/cog/brainstorm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BrainstormMemosPanelProps {
  loading: boolean;
  memos: BrainstormMemo[];
  setMemos: Dispatch<SetStateAction<BrainstormMemo[]>>;
  onRefresh: () => void | Promise<void>;
}

const BrainstormMemosPanel = ({ loading, memos, setMemos, onRefresh }: BrainstormMemosPanelProps) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const handlePlay = async (memo: BrainstormMemo) => {
    try {
      if (playingId === memo.id && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setPlayingId(null);
        return;
      }
      const url = await getPlaybackUrl(memo.id);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setPlayingId(null);
      await audioRef.current.play();
      setPlayingId(memo.id);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't play that memo");
    }
  };

  const handleArchive = async (memoId: string) => {
    try {
      await archiveMemo(memoId);
      setMemos((prev) => prev.filter((memo) => memo.id !== memoId));
      toast("Tucked away");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't archive");
    }
  };

  if (loading) return <SkeletonCard />;
  if (memos.length === 0) return <EmptyState />;

  return (
    <ul className="flex flex-col gap-3">
      {memos.map((memo) => (
        <MemoCard
          key={memo.id}
          memo={memo}
          isPlaying={playingId === memo.id}
          onPlay={() => handlePlay(memo)}
          onArchive={() => handleArchive(memo.id)}
          onRefresh={onRefresh}
        />
      ))}
    </ul>
  );
};

const EmptyState = () => (
  <div className="mx-auto mt-4 max-w-xs text-center">
    <p
      className="text-[1.125rem] leading-snug"
      style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)", color: "#1C1A17" }}
    >
      Hum the melody, speak the line.
    </p>
    <p className="mt-2 text-[0.875rem]" style={{ color: "#6B6459" }}>
      Every idea you capture lives here, side by side, ready when you come back.
    </p>
  </div>
);

const SkeletonCard = () => (
  <div className="space-y-3">
    {[0, 1].map((i) => (
      <div
        key={i}
        className="h-28 rounded-2xl"
        style={{ backgroundColor: "#FAF7F2", border: "1px solid rgba(28,26,23,0.08)" }}
      />
    ))}
  </div>
);

interface MemoCardProps {
  memo: BrainstormMemo;
  isPlaying: boolean;
  onPlay: () => void;
  onArchive: () => void;
  onRefresh: () => void | Promise<void>;
}

const MemoCard = ({ memo, isPlaying, onPlay, onArchive, onRefresh }: MemoCardProps) => {
  const [title, setTitle] = useState(memo.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [notes, setNotes] = useState(memo.notes ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  const notesTimer = useRef<number | null>(null);

  useEffect(() => {
    setTitle(memo.title ?? "");
    setNotes(memo.notes ?? "");
  }, [memo.id, memo.title, memo.notes]);

  const commitTitle = async () => {
    setEditingTitle(false);
    if ((title ?? "") === (memo.title ?? "")) return;
    try {
      await updateMemoTitle(memo.id, title.trim());
      await onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't rename");
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(async () => {
      try {
        await updateMemoNotes(memo.id, val);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1200);
      } catch (err) {
        console.error(err);
      }
    }, 600);
  };

  const peaks = (memo.waveform_peaks as number[] | null) ?? null;
  const friendly = friendlyMemoLabel(memo.created_at, memo.duration_ms);

  return (
    <li
      className="rounded-2xl p-4 transition-shadow"
      style={{
        backgroundColor: "#FAF7F2",
        border: "1px solid rgba(28,26,23,0.10)",
        boxShadow: isPlaying ? "0 8px 24px rgba(184,149,58,0.18)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ backgroundColor: "#B8953A", color: "#FFFFFF", boxShadow: "0 2px 8px rgba(184,149,58,0.35)" }}
        >
          {isPlaying ? <Pause size={18} fill="#FFFFFF" /> : <Play size={18} fill="#FFFFFF" />}
        </button>

        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setTitle(memo.title ?? "");
                  setEditingTitle(false);
                }
              }}
              placeholder="Name this idea"
              className="w-full bg-transparent text-[1rem] leading-tight outline-none"
              style={{
                fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)",
                color: "#1C1A17",
                fontWeight: 600,
                borderBottom: "1px solid rgba(184,149,58,0.45)",
              }}
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="block w-full truncate text-left text-[1rem] leading-tight"
              style={{
                fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)",
                color: title ? "#1C1A17" : "#A09689",
                fontWeight: 600,
              }}
            >
              {title || "Name this idea"}
            </button>
          )}
          <p className="mt-0.5 text-[0.75rem]" style={{ color: "#6B6459" }}>
            {friendly}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
            aria-label="More actions"
            style={{ color: "#6B6459" }}
          >
            <MoreHorizontal size={18} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => setEditingTitle(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive}>
              <Archive size={14} className="mr-2" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {peaks && peaks.length > 0 && (
        <div className="mt-3 flex h-8 items-center gap-[2px]">
          {peaks.map((peak, index) => (
            <span
              key={index}
              className="flex-1 rounded-full"
              style={{
                height: `${Math.max(8, Math.min(100, peak * 100))}%`,
                backgroundColor: isPlaying ? "#B8953A" : "rgba(184,149,58,0.5)",
                transition: "background-color 120ms ease",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative mt-3">
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Notes for this idea..."
          rows={notes ? Math.min(6, Math.max(2, notes.split("\n").length + 1)) : 2}
          className="w-full resize-none rounded-xl bg-white/60 p-3 text-[0.9375rem] outline-none transition"
          style={{
            color: "#1C1A17",
            border: "1px solid rgba(28,26,23,0.08)",
            fontFamily: "var(--font-body, Inter, system-ui, sans-serif)",
          }}
        />
        {savedFlash && (
          <span
            className="absolute right-3 top-3 text-[0.625rem] uppercase"
            style={{ color: "#B8953A", letterSpacing: "0.12em" }}
          >
            Saved
          </span>
        )}
      </div>
    </li>
  );
};

export default BrainstormMemosPanel;
