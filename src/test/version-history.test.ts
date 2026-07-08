/**
 * E3 · Version history — pure snapshot/lineage logic.
 *
 * Covers the codec + summary + original detection that the timeline, detail
 * sheet, and restore flow all lean on. The Supabase client is mocked so the
 * seam module loads hermetically; network behavior (RLS, triggers) is the
 * server's contract and is exercised in the live app, not here.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  findOriginalId,
  parseSnapshot,
  summarizeSnapshot,
  type SongSnapshotV1,
  type SongVersion,
} from "@/integrations/cog/versions";
import { versionHeadline } from "@/components/versions/VersionTimeline";

const snapshot: SongSnapshotV1 = {
  v: 1,
  song: { title: "Colors of Glory" },
  sections: [
    {
      id: "sec1",
      kind: "verse",
      label: "Verse 1",
      position: 0,
      lyrics: {
        content: {
          v: 1,
          lines: [
            { id: "l1", text: "Morning light", anchors: [{ chord: { degree: 1 }, at: 0 }] },
            { id: "l2", text: "over the water", anchors: [] },
          ],
        },
        plain_text: "Morning light\nover the water",
      },
    },
    {
      id: "sec2",
      kind: "chorus",
      label: null,
      position: 1,
      lyrics: {
        content: {
          v: 1,
          lines: [
            {
              id: "l3",
              text: "Glory, glory",
              anchors: [
                { chord: { degree: 4 }, at: 0 },
                { chord: { degree: 5 }, at: 7 },
              ],
            },
          ],
        },
        plain_text: "Glory, glory",
      },
    },
  ],
};

const version = (over: Partial<SongVersion>): SongVersion =>
  ({
    id: "v-id",
    song_id: "s1",
    version_number: 1,
    kind: "manual",
    label: null,
    description: null,
    snapshot: {},
    parent_version_id: null,
    created_by_user_id: "u1",
    created_at: "2026-07-07T00:00:00Z",
  ...over,
  }) as SongVersion;

describe("parseSnapshot", () => {
  it("round-trips a v1 snapshot and keeps sections ordered by position", () => {
    const parsed = parseSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed).not.toBeNull();
    expect(parsed?.song.title).toBe("Colors of Glory");
    expect(parsed?.sections.map((s) => s.id)).toEqual(["sec1", "sec2"]);
  });

  it("rejects unreadable payloads instead of throwing (calm fallback, never raw JSON)", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot("nope" as never)).toBeNull();
    expect(parseSnapshot({ v: 2 } as never)).toBeNull();
    expect(parseSnapshot({ v: 1, sections: "bad" } as never)).toBeNull();
    // a section without an id/position is a foreign shape
    expect(parseSnapshot({ v: 1, sections: [{ label: "x" }] } as never)).toBeNull();
  });

  it("treats a sectionless snapshot as a valid blank page", () => {
    const parsed = parseSnapshot({ v: 1, song: { title: null }, sections: [] } as never);
    expect(parsed?.sections).toEqual([]);
  });

  it("keeps sections without lyrics (a labeled-but-unwritten section)", () => {
    const parsed = parseSnapshot({
      v: 1,
      song: { title: null },
      sections: [{ id: "a", kind: "bridge", label: null, position: 0, lyrics: null }],
    } as never);
    expect(parsed?.sections[0].lyrics).toBeNull();
  });
});

describe("summarizeSnapshot", () => {
  it("counts sections, lines, and chord anchors", () => {
    const s = summarizeSnapshot(snapshot);
    expect(s.sectionCount).toBe(2);
    expect(s.lineCount).toBe(3);
    expect(s.chordCount).toBe(3);
    expect(s.sections.map((x) => x.label)).toEqual(["Verse 1", "Chorus"]);
    expect(s.isEmpty).toBe(false);
  });

  it("summarizes a blank snapshot as empty", () => {
    const s = summarizeSnapshot({ v: 1, song: { title: null }, sections: [] });
    expect(s.isEmpty).toBe(true);
    expect(s.sectionCount).toBe(0);
  });

  it("falls back to the kind title when a section has no label, and to zero chords for foreign content", () => {
    const s = summarizeSnapshot({
      v: 1,
      song: { title: null },
      sections: [
        {
          id: "a",
          kind: "pre_chorus",
          label: null,
          position: 0,
          lyrics: { content: { some: "foreign shape" }, plain_text: "one line\n\n" },
        },
      ],
    });
    expect(s.sections[0].label).toBe("Pre-Chorus");
    expect(s.lineCount).toBe(1);
    expect(s.chordCount).toBe(0);
  });
});

describe("findOriginalId — the Original is the first-ever version", () => {
  it("picks the lowest version_number regardless of list order", () => {
    const versions = [
      version({ id: "c", version_number: 3, parent_version_id: "b" }),
      version({ id: "a", version_number: 1 }),
      version({ id: "b", version_number: 2, parent_version_id: "a" }),
    ];
    expect(findOriginalId(versions)).toBe("a");
  });

  it("survives a nulled-out parent chain (FK ON DELETE SET NULL)", () => {
    const versions = [
      version({ id: "b", version_number: 2, parent_version_id: null }),
      version({ id: "a", version_number: 1, parent_version_id: null }),
    ];
    expect(findOriginalId(versions)).toBe("a");
  });

  it("returns null for an empty timeline", () => {
    expect(findOriginalId([])).toBeNull();
  });
});

describe("versionHeadline — calm card copy", () => {
  it("prefers the songwriter's label", () => {
    expect(versionHeadline(version({ label: "Before the bridge rewrite" }))).toBe(
      "Before the bridge rewrite",
    );
  });
  it("falls back per kind, never system-y", () => {
    expect(versionHeadline(version({ kind: "manual" }))).toBe("Saved version");
    expect(versionHeadline(version({ kind: "auto" }))).toBe("Auto snapshot");
    expect(versionHeadline(version({ kind: "restore_point" }))).toBe("Restored version");
  });
});
