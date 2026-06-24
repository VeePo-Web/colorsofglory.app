import { useEffect } from "react";
import { Check } from "lucide-react";

export interface SongRoomSaveMoment {
  id: string;
  title: string;
  destination: string;
  detail?: string;
}

interface SongRoomSaveToastProps {
  moment: SongRoomSaveMoment | null;
  onDone: () => void;
  durationMs?: number;
}

const SongRoomSaveToast = ({
  moment,
  onDone,
  durationMs = 2400,
}: SongRoomSaveToastProps) => {
  useEffect(() => {
    if (!moment) return undefined;
    const timeout = window.setTimeout(onDone, durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, moment, onDone]);

  if (!moment) return null;

  return (
    <div className="cog-save-toast" role="status" aria-live="polite">
      <div className="cog-save-toast-icon" aria-hidden="true">
        <Check size={17} strokeWidth={2.6} />
      </div>
      <div className="min-w-0">
        <p className="cog-save-toast-title">Saved to {moment.destination}</p>
        <p className="cog-save-toast-detail">
          {moment.detail ? `${moment.detail} / ` : ""}
          {moment.title}
        </p>
      </div>
    </div>
  );
};

export default SongRoomSaveToast;
