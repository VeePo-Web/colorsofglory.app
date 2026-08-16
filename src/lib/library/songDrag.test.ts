import { afterEach, describe, expect, it, vi } from "vitest";
import { SONG_DRAG_TYPE, songDragProps, dragHasSong, readDraggedSong } from "./songDrag";

const setPointer = (fine: boolean) => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: fine && q === "(pointer: fine)" }) as MediaQueryList);
};

afterEach(() => vi.unstubAllGlobals());

describe("songDrag — Drive's filing gesture, gated by capability", () => {
  it("on a fine pointer: draggable, advertising an additive copy with the song id", () => {
    setPointer(true);
    const props = songDragProps("s1");
    expect(props.draggable).toBe(true);
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    props.onDragStart?.({ dataTransfer } as never);
    expect(dataTransfer.setData).toHaveBeenCalledWith(SONG_DRAG_TYPE, "s1");
    expect(dataTransfer.effectAllowed).toBe("copy");
  });

  it("on touch: EMPTY props — the DOM carries no drag attribute at all", () => {
    setPointer(false);
    expect(songDragProps("s1")).toEqual({});
  });

  it("targets only light up for songs — foreign drags (files, text) are ignored", () => {
    expect(dragHasSong({ dataTransfer: { types: [SONG_DRAG_TYPE] } })).toBe(true);
    expect(dragHasSong({ dataTransfer: { types: ["Files", "text/plain"] } })).toBe(false);
  });

  it("reads the dropped song id; a foreign drop reads as null, never an empty file", () => {
    expect(readDraggedSong({ dataTransfer: { getData: (t) => (t === SONG_DRAG_TYPE ? "s9" : "") } })).toBe("s9");
    expect(readDraggedSong({ dataTransfer: { getData: () => "" } })).toBeNull();
  });
});
