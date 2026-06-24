import { describe, it, expect } from "vitest";
import {
  createDoc,
  addSection,
  renameSection,
  reorderSection,
  removeSection,
  addLine,
  editLineText,
  setChordAnchor,
  removeChordAnchor,
  setKey,
  setCapo,
  restoreOriginalKey,
} from "@/lib/chords/sheetState";
import { parseChordToken } from "@/lib/chords/sheet";

const C = parseChordToken("C", "C")!;
const G = parseChordToken("G", "C")!;

describe("createDoc", () => {
  it("seeds originalKey from key and starts empty", () => {
    const doc = createDoc({ songId: "s1", key: "C" });
    expect(doc.songId).toBe("s1");
    expect(doc.key).toBe("C");
    expect(doc.originalKey).toBe("C");
    expect(doc.mode).toBe("major");
    expect(doc.sections).toEqual([]);
  });
});

describe("sections — add / rename / reorder / remove emit contract events", () => {
  it("addSection appends and emits section_added with position", () => {
    const doc = createDoc({ songId: "s1", key: "C" });
    const { doc: d2, event } = addSection(doc, { id: "v1", label: "Verse 1" });
    expect(d2.sections.map((s) => s.label)).toEqual(["Verse 1"]);
    expect(event).toMatchObject({
      type: "section_added",
      entity: { type: "section", id: "v1", sectionLabel: "Verse 1" },
      payload: { sectionId: "v1", label: "Verse 1", position: 0 },
    });
    // immutability
    expect(doc.sections).toEqual([]);
  });

  it("renameSection emits from/to", () => {
    let doc = createDoc({ songId: "s1", key: "C" });
    doc = addSection(doc, { id: "v1", label: "Verse 1" }).doc;
    const { doc: d2, event } = renameSection(doc, "v1", "Intro");
    expect(d2.sections[0].label).toBe("Intro");
    expect(event).toMatchObject({ type: "section_renamed", payload: { sectionId: "v1", from: "Verse 1", to: "Intro" } });
  });

  it("reorderSection moves and emits from/to indices", () => {
    let doc = createDoc({ songId: "s1", key: "C" });
    doc = addSection(doc, { id: "a", label: "Verse 1" }).doc;
    doc = addSection(doc, { id: "b", label: "Chorus" }).doc;
    const { doc: d2, event } = reorderSection(doc, "b", 0);
    expect(d2.sections.map((s) => s.id)).toEqual(["b", "a"]);
    expect(event).toMatchObject({ type: "section_reordered", payload: { sectionId: "b", from: 1, to: 0 } });
  });

  it("removeSection emits label", () => {
    let doc = createDoc({ songId: "s1", key: "C" });
    doc = addSection(doc, { id: "a", label: "Verse 1" }).doc;
    const { doc: d2, event } = removeSection(doc, "a");
    expect(d2.sections).toEqual([]);
    expect(event).toMatchObject({ type: "section_removed", payload: { sectionId: "a", label: "Verse 1" } });
  });
});

describe("lyric editing — anchors follow the syllable, emits lyric_edited", () => {
  it("editLineText shifts anchors and reports before/after", () => {
    let doc = createDoc({ songId: "s1", key: "C" });
    doc = addSection(doc, { id: "v1", label: "Verse 1" }).doc;
    doc = addLine(doc, "v1", { id: "l1", text: "Hello world" }).doc;
    doc = setChordAnchor(doc, "v1", "l1", C, 0).doc;
    doc = setChordAnchor(doc, "v1", "l1", G, 6).doc;

    // Prepend "Oh " -> anchors shift right by 3.
    const { doc: d2, event } = editLineText(doc, "v1", "l1", {
      start: 0,
      deleteCount: 0,
      insertCount: 3,
      newText: "Oh Hello world",
    });
    const line = d2.sections[0].lines[0];
    expect(line.text).toBe("Oh Hello world");
    expect(line.anchors.map((a) => a.at)).toEqual([3, 9]);
    expect(event).toMatchObject({
      type: "lyric_edited",
      payload: { sectionId: "v1", lineId: "l1", lineIndex: 0, before: "Hello world", after: "Oh Hello world" },
    });
  });
});

describe("chords — set / remove emit chords_changed with rendered anchors", () => {
  it("setChordAnchor renders letters in the current key", () => {
    let doc = createDoc({ songId: "s1", key: "C" });
    doc = addSection(doc, { id: "v1", label: "Verse 1" }).doc;
    doc = addLine(doc, "v1", { id: "l1", text: "Hello world" }).doc;
    const { doc: d2, event } = setChordAnchor(doc, "v1", "l1", G, 6);
    expect(d2.sections[0].lines[0].anchors).toHaveLength(1);
    expect(event).toMatchObject({
      type: "chords_changed",
      payload: { sectionId: "v1", lineId: "l1", anchors: [{ chord: "G", at: 6 }] },
    });
  });

  it("setChordAnchor replaces an anchor already at that column", () => {
    let doc = createDoc({ songId: "s1", key: "C" });
    doc = addSection(doc, { id: "v1", label: "Verse 1" }).doc;
    doc = addLine(doc, "v1", { id: "l1", text: "Hello world" }).doc;
    doc = setChordAnchor(doc, "v1", "l1", C, 0).doc;
    doc = setChordAnchor(doc, "v1", "l1", G, 0).doc; // replace at col 0
    const line = doc.sections[0].lines[0];
    expect(line.anchors).toHaveLength(1);
  });

  it("removeChordAnchor drops the anchor at a column", () => {
    let doc = createDoc({ songId: "s1", key: "C" });
    doc = addSection(doc, { id: "v1", label: "Verse 1" }).doc;
    doc = addLine(doc, "v1", { id: "l1", text: "Hello world" }).doc;
    doc = setChordAnchor(doc, "v1", "l1", C, 0).doc;
    const { doc: d2 } = removeChordAnchor(doc, "v1", "l1", 0);
    expect(d2.sections[0].lines[0].anchors).toEqual([]);
  });
});

describe("transpose — non-destructive, anchors unchanged, only render key moves", () => {
  it("setKey changes key, preserves originalKey, emits key_changed", () => {
    let doc = createDoc({ songId: "s1", key: "G" });
    doc = addSection(doc, { id: "v1", label: "Verse 1" }).doc;
    doc = addLine(doc, "v1", { id: "l1", text: "Amazing grace" }).doc;
    const gChord = parseChordToken("G", "G")!;
    doc = setChordAnchor(doc, "v1", "l1", gChord, 0).doc;

    const { doc: d2, event } = setKey(doc, "A");
    expect(d2.key).toBe("A");
    expect(d2.originalKey).toBe("G");
    // The stored NumberChord is untouched (key-independent).
    expect(d2.sections[0].lines[0].anchors[0].chord).toEqual(gChord);
    expect(event).toMatchObject({
      type: "key_changed",
      payload: { fromKey: "G", toKey: "A", nonDestructive: true },
    });
  });

  it("setCapo emits key_changed with capo, key unchanged", () => {
    const doc = createDoc({ songId: "s1", key: "G" });
    const { doc: d2, event } = setCapo(doc, 2);
    expect(d2.capo).toBe(2);
    expect(d2.key).toBe("G");
    expect(event).toMatchObject({ type: "key_changed", payload: { toKey: "G", capo: 2, nonDestructive: true } });
  });

  it("restoreOriginalKey returns to the original", () => {
    let doc = createDoc({ songId: "s1", key: "G" });
    doc = setKey(doc, "C").doc;
    const { doc: d2, event } = restoreOriginalKey(doc);
    expect(d2.key).toBe("G");
    expect(event).toMatchObject({ type: "key_changed", payload: { fromKey: "C", toKey: "G" } });
  });
});

describe("missing targets are safe no-ops", () => {
  it("editing a missing line returns the doc unchanged with no event", () => {
    const doc = createDoc({ songId: "s1", key: "C" });
    const { doc: d2, event } = editLineText(doc, "nope", "nope", {
      start: 0,
      deleteCount: 0,
      insertCount: 1,
      newText: "x",
    });
    expect(d2).toBe(doc);
    expect(event).toBeNull();
  });
});
