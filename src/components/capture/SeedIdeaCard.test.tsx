import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SeedIdeaCard from "./SeedIdeaCard";
import type { SeedIdeaRecord } from "@/lib/voice/seedIdeaApi";

// The card pulls in the seed API, the audio cache, and song creation — none of
// which this a11y test exercises. Mock them so the module graph stays light.
vi.mock("@/lib/voice/seedIdeaApi", () => ({
  claimSeedIdea: vi.fn(),
  deleteSeedIdea: vi.fn(),
  renameSeedIdea: vi.fn(),
}));
vi.mock("@/lib/voice/audioCache", () => ({ audioCache: { get: vi.fn() } }));
vi.mock("@/integrations/cog/songs", () => ({ createSong: vi.fn() }));

const idea: SeedIdeaRecord = {
  id: "seed-1",
  title: "Morning hum",
  durationMs: 8200,
  createdAt: new Date(0).toISOString(),
} as SeedIdeaRecord;

/**
 * The "file this idea" chooser is a real modal (aria-modal). It must behave like
 * one for keyboard/screen-reader users filing their very first idea: focus moves
 * INTO the dialog on open, and Escape closes it.
 */
describe("SeedIdeaCard — the filing dialog is keyboard-safe", () => {
  const open = () => {
    render(<SeedIdeaCard idea={idea} songs={[{ id: "s1", title: "New Song" }]} />);
    fireEvent.click(screen.getByRole("button", { name: /file into a song/i }));
    return screen.getByRole("dialog", { name: /choose a song for this idea/i });
  };

  it("moves focus into the dialog on open", async () => {
    const dialog = open();
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it("closes on Escape", async () => {
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /choose a song for this idea/i })).toBeNull(),
    );
  });
});
