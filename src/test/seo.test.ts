import { describe, expect, it } from "vitest";
import { areaPages, getAreaBySlug, getNearbyAreas } from "@/data/seoAreas";
import { buildBreadcrumbSchema, buildCanonicalUrl } from "@/lib/seo";

describe("local SEO area data", () => {
  it("contains the first 10 priority local SEO pages", () => {
    expect(areaPages).toHaveLength(10);
    expect(areaPages.map((area) => area.slug)).toContain("canmore");
    expect(areaPages.map((area) => area.slug)).toContain("springbank");
  });

  it("finds an area by slug", () => {
    expect(getAreaBySlug("bearspaw")?.name).toBe("Bearspaw");
  });

  it("returns nearby areas without including the current area", () => {
    const nearby = getNearbyAreas("cochrane").map((area) => area.slug);

    expect(nearby).not.toContain("cochrane");
    expect(nearby.length).toBeGreaterThan(0);
  });
});

describe("SEO helpers", () => {
  it("builds canonical URLs from clean paths", () => {
    expect(buildCanonicalUrl("/areas-we-serve/canmore")).toBe(
      "https://fly4me.ca/areas-we-serve/canmore",
    );
  });

  it("builds breadcrumb schema for area pages", () => {
    const schema = buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Areas We Serve", path: "/areas-we-serve" },
      { name: "Canmore", path: "/areas-we-serve/canmore" },
    ]);

    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement).toHaveLength(3);
  });
});
