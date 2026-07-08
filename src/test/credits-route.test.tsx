import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import CreditsPage from "@/pages/CreditsPage";

// E4 Step 1 regression guard. App.tsx keeps its routes inline, so the wiring
// is asserted at the source level — the same approach as design-guard.test.ts.
describe("route — /songs/:id/credits is the real Credits ledger (E4 Step 1)", () => {
  it("App.tsx wires the credits route to the guarded page, not the canvas redirect", () => {
    const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    const creditsRouteLine = appSource
      .split("\n")
      .find((line) => line.includes('path="/songs/:id/credits"'));

    expect(creditsRouteLine, "credits route missing from App.tsx").toBeDefined();
    expect(creditsRouteLine).toContain("<RequireAuth>");
    expect(creditsRouteLine).toContain("<CreditsPage />");
    expect(creditsRouteLine).not.toContain("CanvasLayerRedirect");
  });

  it("renders the contribution ledger at the credits path", async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter
          initialEntries={["/songs/s1/credits"]}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route path="/songs/:id/credits" element={<CreditsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Credits" })).toBeInTheDocument();
    expect(screen.getByText("Every contribution remembered.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy credits/i })).toBeInTheDocument();
  });
});
