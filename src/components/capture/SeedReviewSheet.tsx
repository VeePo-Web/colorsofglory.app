import { toast } from "sonner";
import VoiceReviewSheet from "@/components/voice/VoiceReviewSheet";
import { saveSeedIdea, type SeedIdeaRecord } from "@/lib/voice/seedIdeaApi";
import type { RecordingResult } from "@/hooks/useVoiceRecorder";

interface SeedReviewSheetProps {
  recording: RecordingResult;
  defaultName: string;
  onSaved: (record: SeedIdeaRecord) => void;
  onDiscard: () => void;
}

/**
 * SeedReviewSheet — thin wrapper around the proven VoiceReviewSheet for ideas
 * captured outside any song. There's no song yet, so there's no section to
 * pick — the recording is filed as "Unfiled" and lands on the Seed Ideas
 * shelf, waiting for the songwriter to give it a home.
 */
const SeedReviewSheet = ({ recording, defaultName, onSaved, onDiscard }: SeedReviewSheetProps) => {
  const handleSave = async ({ name }: { name: string; section: string; transcribe: boolean }) => {
    try {
      const record = await saveSeedIdea({
        blob: recording.blob,
        mimeType: recording.mimeType,
        durationMs: recording.durationMs,
        title: name,
      });
      onSaved(record);
    } catch {
      toast.error("Couldn't save that recording — give it another moment and try again.");
    }
  };

  return (
    <VoiceReviewSheet
      recording={recording}
      defaultName={defaultName}
      section="Unfiled"
      destinationNote="Saved to your Ideas — file it into a song whenever you like."
      onSave={handleSave}
      onDiscard={onDiscard}
    />
  );
};

export default SeedReviewSheet;
