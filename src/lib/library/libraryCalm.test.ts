import { describe, it, expect } from "vitest";
import {
  showLibraryTabs,
  showLibraryControls,
  showAlbumsShelf,
  continueMoment,
  CONTROLS_THRESHOLD,
} from "./libraryCalm";

describe("libraryCalm — every library surface earns its place", () => {
  it("a solo writer sees no tabs; they return the moment invited or archived songs exist", () => {
    expect(showLibraryTabs({ Invited: 0, Archived: 0 })).toBe(false);
    expect(showLibraryTabs({ Invited: 1, Archived: 0 })).toBe(true);
    expect(showLibraryTabs({ Invited: 0, Archived: 1 })).toBe(true);
  });

  it("search/sort/view appear only once the active list outgrows a glance", () => {
    expect(showLibraryControls(CONTROLS_THRESHOLD - 1)).toBe(false);
    expect(showLibraryControls(CONTROLS_THRESHOLD)).toBe(true);
    expect(showLibraryControls(0)).toBe(false);
  });

  it("the albums shelf shows once albums exist, or once the library is big enough to need filing", () => {
    expect(showAlbumsShelf(0, 3)).toBe(false); // no premature homework
    expect(showAlbumsShelf(1, 3)).toBe(true); // real albums always show
    expect(showAlbumsShelf(0, CONTROLS_THRESHOLD)).toBe(true); // big library invites filing
  });

  it("exactly ONE continue moment: practice outranks last-touched song; neither → none", () => {
    expect(continueMoment(true, true)).toBe("practice");
    expect(continueMoment(false, true)).toBe("song");
    expect(continueMoment(true, false)).toBe("practice");
    expect(continueMoment(false, false)).toBeNull();
  });
});
