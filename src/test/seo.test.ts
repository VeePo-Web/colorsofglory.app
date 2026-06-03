import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), "utf8");
const oldBrandPattern = new RegExp(
  ["fly" + "4me", "Fly" + "4MEdia", "drone " + "photography", "areas" + "-we-serve"].join("|"),
  "i",
);
const oldRoutePattern = new RegExp(
  ["fly" + "4me", "areas" + "-we-serve", "services", "pricing"].join("|"),
  "i",
);

describe("Colors of Glory public metadata", () => {
  it("uses Colors of Glory metadata in the document head", () => {
    const html = read("index.html");

    expect(html).toContain("Colors of Glory - Songwriting Collaboration App");
    expect(html).toContain("https://colorsofglory.app/");
    expect(html).toContain("Everything for this song stays connected here.");
    expect(html).not.toMatch(oldBrandPattern);
  });

  it("keeps robots and sitemap pointed at colorsofglory.app", () => {
    const robots = read("public/robots.txt");
    const sitemap = read("public/sitemap.xml");

    expect(robots).toContain("Sitemap: https://colorsofglory.app/sitemap.xml");
    expect(sitemap).toContain("https://colorsofglory.app/");
    expect(`${robots}\n${sitemap}`).not.toMatch(oldRoutePattern);
  });
});

describe("Colors of Glory route safety", () => {
  it("wires the first onboarding path routes", () => {
    const app = read("src/App.tsx");

    expect(app).toContain('path="/onboarding/intent"');
    expect(app).toContain('path="/onboarding/start-song"');
    expect(app).toContain('path="/songs/:id/capture"');
    expect(app).toContain('path="/songs/:id/voice-added"');
  });

  it("keeps the 404 page branded to Colors of Glory", () => {
    const notFound = read("src/pages/NotFound.tsx");

    expect(notFound).toContain("Colors of Glory");
    expect(notFound).toContain("This song room is not here.");
    expect(notFound).not.toMatch(new RegExp(["fly" + "4me", "Fly" + "4MEdia", "Browse work", "Services"].join("|"), "i"));
  });
});
