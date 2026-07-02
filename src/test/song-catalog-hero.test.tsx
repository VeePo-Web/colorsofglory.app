import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

// Isolate the catalog hero under test: stub the data layer + heavy sub-trees so
// this exercises SongCatalogPage's own markup (the change under audit), not
// Supabase or unrelated components.
//
// Note on jsdom: its CSS parser (cssstyle) silently drops `var()` and `clamp()`
// from *typed* inline-style props (background-color, color, font-size). Those are
// valid CSS that real browsers honour — so this suite asserts on the token
// utility CLASSES (which survive serialization) and on the absence of the
// brand-drift hex values, not on stripped inline-style strings.
vi.mock("@/integrations/cog/songs", () => ({
  listMySongs: vi.fn().mockResolvedValue([
    { id: "1", title: "Grace in the Waiting", my_role: "owner", status: "active", voice_memo_count: 3, collaborator_count: 1, last_activity_at: null },
    { id: "2", title: "Hold On", my_role: "owner", status: "active", voice_memo_count: 1, collaborator_count: 2, last_activity_at: null },
  ]),
  createSong: vi.fn(),
}));
vi.mock("@/lib/pricing/pricingApi", () => ({ canCreateSong: vi.fn().mockResolvedValue(true) }));
vi.mock("@/components/cog/BottomNav", () => ({ default: () => <nav data-testid="bottomnav" /> }));
vi.mock("@/components/cog/CogBrand", () => ({ default: () => <div data-testid="cogbrand" /> }));
vi.mock("@/components/capture/SeedIdeasShelf", () => ({ default: () => <div data-testid="seedshelf" /> }));

import SongCatalogPage from "@/pages/SongCatalogPage";

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <SongCatalogPage />
    </MemoryRouter>,
  );

describe("SongCatalogPage — world-class hero (content-locked, token-precise)", () => {
  it("mounts cleanly and renders the hero copy verbatim — every word unchanged", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Your songs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Owned" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invited" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archived" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New song/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
  });

  it("carries the signature warm glow and has shed every brand-drift hex value", () => {
    const { container } = renderPage();
    expect(container.querySelector(".cog-glow")).not.toBeNull();
    const html = container.innerHTML;
    // the exact rogue values this audit consolidated must not reappear anywhere
    expect(html).not.toContain("#FAFAF6"); // rogue off-white -> --cog-cream
    expect(html).not.toContain("#B5935A"); // stray gold      -> --cog-gold
    expect(html).not.toContain("#1A1A1A"); // off-token black -> --cog-charcoal
    expect(html).not.toContain("#999");    // neutral grey    -> --cog-muted
  });

  it("uses a desktop-responsive container + grid (no longer a 430px phone column)", () => {
    const { container } = renderPage();
    const html = container.innerHTML;
    expect(html).toContain("max-w-[430px]"); // mobile floor preserved
    expect(html).toContain("md:max-w-3xl");
    expect(html).toContain("lg:max-w-5xl");   // desktop container steps
    expect(html).toContain("bg-[var(--cog-gold)]"); // FAB on the single canonical gold
  });

  it("renders the song grid (2->3->4 cols) with five-state hover + card tokens", async () => {
    const { container } = renderPage();
    // The most recent song appears twice by design: once in the
    // "Pick up where you left off" hero shelf, once in the grid.
    expect((await screen.findAllByText("Grace in the Waiting")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Hold On")).toBeInTheDocument();
    const html = container.innerHTML;
    // grid breaks out of the phone column on tablet/desktop
    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("lg:grid-cols-4");
    // cards expose a real desktop hover (lift + gold border + gold title), not
    // just active:scale — and carry canonical token utility classes
    expect(html).toContain("hover:-translate-y-1");
    expect(html).toContain("hover:border-[var(--cog-border-gold)]");
    expect(html).toContain("group-hover:text-[var(--cog-gold)]");
    expect(html).toContain("text-[var(--cog-charcoal)]");
  });
});
