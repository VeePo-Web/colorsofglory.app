import { describe, it, expect } from "vitest";
import {
  ACCEPT_AUDIO,
  IMPORT_MAX_BYTES,
  IMPORT_REJECT_COPY,
  prepareImport,
  titleFromFileName,
  validateImportFile,
} from "./audioImport";
import { isStorageQuotaError } from "./captureOutbox";

const makeFile = (name: string, type: string, bytes = 16): File => {
  const f = new File([new Uint8Array(bytes)], name, { type });
  return f;
};

const makeSized = (name: string, type: string, size: number): File => {
  const f = makeFile(name, type, 4);
  Object.defineProperty(f, "size", { value: size });
  return f;
};

/**
 * LANE D · Phase D1 — the platform-truth contract, pinned.
 * The flagship file is an iPhone Voice Memos .m4a reported as audio/x-m4a
 * (or nothing at all); it must pass every gate and upload as audio/mp4.
 */
describe("ACCEPT_AUDIO — the iOS picker law (T1)", () => {
  it("leads with explicit extensions (un-grays audio in the iOS Files browser)", () => {
    expect(ACCEPT_AUDIO.startsWith(".m4a")).toBe(true);
  });
  it("keeps audio/* LAST for Android filtering — never bare, never first", () => {
    expect(ACCEPT_AUDIO.endsWith("audio/*")).toBe(true);
    expect(ACCEPT_AUDIO).not.toBe("audio/*");
  });
  it("never invites a format the server must refuse (the GarageBand sin)", () => {
    expect(ACCEPT_AUDIO).not.toMatch(/\.aac|\.flac|\.amr|\.3gp/);
  });
});

describe("validateImportFile — extension first, MIME second (T4)", () => {
  it("accepts the flagship file: .m4a reported as audio/x-m4a → audio/mp4", () => {
    const r = validateImportFile(makeFile("New Recording 3.m4a", "audio/x-m4a"));
    expect(r).toMatchObject({ ok: true, mimeType: "audio/mp4", title: "New Recording 3" });
  });
  it("accepts an .m4a with an EMPTY type (never borrows the recorder's mime)", () => {
    const r = validateImportFile(makeFile("hum.m4a", ""));
    expect(r).toMatchObject({ ok: true, mimeType: "audio/mp4" });
  });
  it("normalizes the wild's aliases to the server-allowed spelling", () => {
    expect(validateImportFile(makeFile("a.m4a", "audio/m4a"))).toMatchObject({ ok: true, mimeType: "audio/mp4" });
    expect(validateImportFile(makeFile("b.mp3", "audio/mp3"))).toMatchObject({ ok: true, mimeType: "audio/mpeg" });
    expect(validateImportFile(makeFile("c.wav", "audio/wave"))).toMatchObject({ ok: true, mimeType: "audio/wav" });
    expect(validateImportFile(makeFile("d.ogg", ""))).toMatchObject({ ok: true, mimeType: "audio/ogg" });
    expect(validateImportFile(makeFile("e.webm", "audio/webm"))).toMatchObject({ ok: true, mimeType: "audio/webm" });
  });
  it("redirects .qta kindly — the iOS 18.2 layered export browsers can't play", () => {
    const r = validateImportFile(makeFile("Layered idea.qta", ""));
    expect(r).toMatchObject({ ok: false, reason: "qta", message: IMPORT_REJECT_COPY.qta });
  });
  it("names real-but-unservable formats instead of letting them park silently", () => {
    expect(validateImportFile(makeFile("riff.flac", "audio/flac"))).toMatchObject({ ok: false, reason: "format" });
    expect(validateImportFile(makeFile("note.aac", "audio/aac"))).toMatchObject({ ok: false, reason: "format" });
  });
  it("rejects non-audio plainly", () => {
    expect(validateImportFile(makeFile("chart.pdf", "application/pdf"))).toMatchObject({
      ok: false,
      reason: "not-audio",
    });
  });
  it("catches the iCloud empty-file flake (T6)", () => {
    expect(validateImportFile(makeSized("cloud.m4a", "audio/x-m4a", 0))).toMatchObject({
      ok: false,
      reason: "empty-file",
    });
  });
  it("holds the ONE 50MB size truth (T9)", () => {
    expect(validateImportFile(makeSized("long.m4a", "audio/x-m4a", IMPORT_MAX_BYTES + 1))).toMatchObject({
      ok: false,
      reason: "too-big",
    });
    expect(validateImportFile(makeSized("fits.m4a", "audio/x-m4a", IMPORT_MAX_BYTES))).toMatchObject({ ok: true });
  });
});

describe("titleFromFileName — a suggestion, never an identifier (T3)", () => {
  it("strips only the extension and keeps the writer's words", () => {
    expect(titleFromFileName("New Recording 3.m4a")).toBe("New Recording 3");
    expect(titleFromFileName("Demo.v2.m4a")).toBe("Demo.v2");
    expect(titleFromFileName("🎵 sunday hum.m4a")).toBe("🎵 sunday hum");
  });
  it("returns null (caller defaults) when nothing survives", () => {
    expect(titleFromFileName(".m4a")).toBe(null);
    expect(titleFromFileName("   .mp3")).toBe(null);
  });
});

describe("prepareImport — safe duration, no double owners", () => {
  it("returns the normalized mime + title + measured duration", async () => {
    const r = await prepareImport(makeFile("bridge idea.m4a", "audio/x-m4a"), {
      measureDurationMs: async () => 4200,
    });
    expect(r).toMatchObject({ ok: true, mimeType: "audio/mp4", title: "bridge idea", durationMs: 4200 });
  });
  it("a duration reader that throws yields honest 0, never a failed import", async () => {
    const r = await prepareImport(makeFile("hum.m4a", ""), {
      measureDurationMs: async () => {
        throw new Error("metadata suspended");
      },
    });
    expect(r).toMatchObject({ ok: true, durationMs: 0 });
  });
  it("rejections short-circuit before any duration read", async () => {
    let called = 0;
    const r = await prepareImport(makeFile("layer.qta", ""), {
      measureDurationMs: async () => {
        called += 1;
        return 1;
      },
    });
    expect(r.ok).toBe(false);
    expect(called).toBe(0);
  });
});

describe("storage-full classification (B4) — retain, never burn", () => {
  it("recognizes the server's real 413 body as a quota error", () => {
    expect(isStorageQuotaError(new Error("Storage limit exceeded"))).toBe(true);
    expect(isStorageQuotaError({ code: "Storage limit exceeded" })).toBe(true);
  });
  it("still recognizes the normalized code and older slugs", () => {
    expect(isStorageQuotaError({ code: "QUOTA_EXCEEDED_STORAGE" })).toBe(true);
    expect(isStorageQuotaError(new Error("storage_limit_reached"))).toBe(true);
  });
  it("does not swallow unrelated failures", () => {
    expect(isStorageQuotaError(new Error("network timeout"))).toBe(false);
  });
});
