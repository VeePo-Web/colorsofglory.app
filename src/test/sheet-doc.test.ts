import { describe, it, expect } from "vitest";
import {
  addLine,
  addSection,
  createDoc,
  docFromChordPro,
  docToChordPro,
  editLineText,
  newSheetId,
  removeChordAnchor,
  removeSection,
  renameSection,
  reorderSection,
  setChordAnchor,
} from "@/lib/chords/sheetState";

const CHART = [
  "{start_of_verse: Verse 1}",
  "[C]Lord I [G]wait for [Am]You",
  "In the [F]stillness [C]I am [G]found",
  "{start_of_chorus: Chorus}",
  "[F]You are the [C]anchor [G]of my [Am]song",
].join("\n");

describe("SheetDoc spine", () => {
  it("round-trips ChordPro → doc → ChordPro losslessly at the anchor level", () => {
    const doc = docFromChordPro({ songId: "s1", key: "C" }, CHART);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0].label).toBe("Verse 1");
    expect(doc.sections[0].lines[0].anchors).toHaveLength(3);

    const out = docToChordPro(doc, "C");
    const doc2 = docFromChordPro({ songId: "s1", key: "C" }, out);
    expect(doc2.sections.map((s) => s.label)).toEqual(doc.sections.map((s) => s.label));
    doc.sections.forEach((s, si) =>
      s.lines.forEach((l, li) => {
        expect(doc2.sections[si].lines[li].text).toBe(l.text);
        expect(doc2.sections[si].lines[li].anchors).toEqual(l.anchors);
      }),
    );
  });

  it("mints stable, unique line/section ids", () => {
    const doc = docFromChordPro({ songId: "s1", key: "C" }, CHART);
    const ids = [
      ...doc.sections.map((s) => s.id),
      ...doc.sections.flatMap((s) => s.lines.map((l) => l.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a chord on its syllable across text edits (insert before the anchor)", () => {
    const doc = docFromChordPro({ songId: "s1", key: "C" }, CHART);
    const section = doc.sections[0];
    const line = section.lines[0]; // "Lord I wait for You"
    const waitAnchor = line.anchors[1];
    expect(line.text.slice(waitAnchor.at, waitAnchor.at + 4)).toBe("wait");

    // Insert "Oh " at the start — a splice edit like the editor commits.
    const after = "Oh " + line.text;
    const { doc: doc2 } = editLineText(doc, section.id, line.id, {
      start: 0,
      deleteCount: 0,
      insertCount: 3,
      newText: after,
    });
    const line2 = doc2.sections[0].lines[0];
    const moved = line2.anchors[1];
    expect(line2.text.slice(moved.at, moved.at + 4)).toBe("wait");
  });

  it("clamps (never orphans) an anchor whose span is deleted", () => {
    const doc = docFromChordPro({ songId: "s1", key: "C" }, CHART);
    const section = doc.sections[0];
    const line = section.lines[0];
    // Delete the word "wait " (anchor sits inside).
    const at = line.anchors[1].at;
    const after = line.text.slice(0, at) + line.text.slice(at + 5);
    const { doc: doc2 } = editLineText(doc, section.id, line.id, {
      start: at,
      deleteCount: 5,
      insertCount: 0,
      newText: after,
    });
    const line2 = doc2.sections[0].lines[0];
    expect(line2.anchors).toHaveLength(3); // still three chords — clamped, not dropped
    expect(line2.anchors.every((a) => a.at >= 0 && a.at <= line2.text.length)).toBe(true);
  });

  it("section ops: add / rename / reorder / remove flow through and emit events", () => {
    let doc = createDoc({ songId: "s1", key: "G" });
    const id = newSheetId();
    const added = addSection(doc, { id, label: "Bridge" });
    expect(added.event?.type).toBe("section_added");
    doc = added.doc;

    const id2 = newSheetId();
    doc = addSection(doc, { id: id2, label: "Chorus" }).doc;

    const renamed = renameSection(doc, id, "Bridge 1");
    expect(renamed.event?.type).toBe("section_renamed");
    doc = renamed.doc;

    const reordered = reorderSection(doc, id2, 0);
    expect(reordered.event?.type).toBe("section_reordered");
    expect(reordered.doc.sections[0].id).toBe(id2);

    const removed = removeSection(reordered.doc, id);
    expect(removed.event?.type).toBe("section_removed");
    expect(removed.doc.sections).toHaveLength(1);
  });

  it("chord ops set and remove anchors by line id, emitting chords_changed", () => {
    let doc = createDoc({ songId: "s1", key: "C" });
    const sid = newSheetId();
    doc = addSection(doc, { id: sid, label: "Verse 1" }).doc;
    const lid = newSheetId();
    doc = addLine(doc, sid, { id: lid, text: "Great is Thy faithfulness" }).doc;

    const set = setChordAnchor(doc, sid, lid, { degree: 1, quality: "maj" }, 9);
    expect(set.event?.type).toBe("chords_changed");
    expect(set.doc.sections[0].lines[0].anchors).toEqual([
      { chord: { degree: 1, quality: "maj" }, at: 9 },
    ]);

    const cleared = removeChordAnchor(set.doc, sid, lid, 9);
    expect(cleared.doc.sections[0].lines[0].anchors).toHaveLength(0);
  });

  it("transpose is render-only: serializing in a new key never moves anchors", () => {
    const doc = docFromChordPro({ songId: "s1", key: "C" }, CHART);
    const inD = docToChordPro(doc, "D");
    const docD = docFromChordPro({ songId: "s1", key: "D" }, inD);
    doc.sections.forEach((s, si) =>
      s.lines.forEach((l, li) => {
        expect(docD.sections[si].lines[li].anchors.map((a) => a.at)).toEqual(l.anchors.map((a) => a.at));
        expect(docD.sections[si].lines[li].anchors.map((a) => a.chord)).toEqual(l.anchors.map((a) => a.chord));
      }),
    );
  });
});
