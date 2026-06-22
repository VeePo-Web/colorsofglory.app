import { describe, it, expect } from "vitest";
import {
  mapVersionRow,
  isMissingFunctionError,
  type SongVersionRow,
} from "./versions";

const baseRow: SongVersionRow = {
  id: "v1",
  song_id: "s1",
  version_number: 3,
  kind: "manual",
  label: "Bridge rewrite",
  description: "Reworked the bridge",
  created_by_user_id: "u1",
  created_at: "2026-06-20T10:00:00Z",
  parent_version_id: "v0",
};

describe("mapVersionRow", () => {
  it("maps snake_case row to camelCase UI shape", () => {
    expect(mapVersionRow(baseRow)).toEqual({
      id: "v1",
      songId: "s1",
      versionNumber: 3,
      kind: "manual",
      label: "Bridge rewrite",
      description: "Reworked the bridge",
      createdByUserId: "u1",
      createdAt: "2026-06-20T10:00:00Z",
      parentVersionId: "v0",
    });
  });

  it("preserves nullable label/description/parent", () => {
    const v = mapVersionRow({
      ...baseRow,
      label: null,
      description: null,
      parent_version_id: null,
    });
    expect(v.label).toBeNull();
    expect(v.description).toBeNull();
    expect(v.parentVersionId).toBeNull();
  });

  it("carries each version_kind through unchanged", () => {
    for (const kind of ["manual", "auto", "restore_point"] as const) {
      expect(mapVersionRow({ ...baseRow, kind }).kind).toBe(kind);
    }
  });
});

describe("isMissingFunctionError", () => {
  it("detects the RPC-not-deployed cases so the UI can degrade calmly", () => {
    expect(isMissingFunctionError({ code: "42883" })).toBe(true);
    expect(isMissingFunctionError({ code: "PGRST202" })).toBe(true);
    expect(
      isMissingFunctionError({ message: "function restore_song_version does not exist" }),
    ).toBe(true);
    expect(
      isMissingFunctionError({ message: "Could not find the function in the schema cache" }),
    ).toBe(true);
  });

  it("does not misclassify real failures as 'missing'", () => {
    expect(isMissingFunctionError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingFunctionError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingFunctionError(null)).toBe(false);
    expect(isMissingFunctionError(undefined)).toBe(false);
    expect(isMissingFunctionError({})).toBe(false);
  });
});
