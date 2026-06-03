# Local SEO Areas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local SEO architecture for Fly4MEdia without redesigning the existing frontend.

**Architecture:** Add a typed SEO data layer for service areas, route-specific metadata/schema helpers, an Areas We Serve hub, dynamic area pages, sitemap/robots updates, and a minimal internal link from the footer. Existing homepage, services, work, pricing, and visual systems remain intact.

**Tech Stack:** Vite, React, React Router, TypeScript, Vitest, static XML assets.

---

### Task 1: SEO Data And Helpers

**Files:**
- Create: `src/data/seoAreas.ts`
- Create: `src/lib/seo.ts`
- Test: `src/test/seo.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { areaPages, getAreaBySlug, getNearbyAreas } from "@/data/seoAreas";
import { buildCanonicalUrl, buildBreadcrumbSchema } from "@/lib/seo";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/seo.test.ts`

Expected: fail because `src/data/seoAreas.ts` and `src/lib/seo.ts` do not exist yet.

- [ ] **Step 3: Implement data and helpers**

Create the static area records and helper functions used by the hub, area pages, sitemap, and schema.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/seo.test.ts`

Expected: pass.

### Task 2: Metadata, Schema, And Routes

**Files:**
- Create: `src/components/fly4media/SEO.tsx`
- Create: `src/pages/AreasWeServe.tsx`
- Create: `src/pages/AreaPage.tsx`
- Modify: `src/App.tsx`
- Modify: `index.html`

- [ ] **Step 1: Add route metadata component**

Add a component that updates title, description, canonical, Open Graph, Twitter metadata, and JSON-LD from route data.

- [ ] **Step 2: Add Areas hub and area page routes**

Add `/areas-we-serve` and `/areas-we-serve/:slug` routes using existing `PageShell`, typography, spacing, and CTA patterns.

- [ ] **Step 3: Update global fallback metadata**

Change the default canonical and social URL from the Lovable preview domain to `https://fly4me.ca`.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: build exits 0.

### Task 3: Crawlability Assets And Internal Link

**Files:**
- Modify: `public/robots.txt`
- Create: `public/sitemap.xml`
- Modify: `src/components/fly4media/Footer.tsx`

- [ ] **Step 1: Add sitemap URL to robots.txt**

Add `Sitemap: https://fly4me.ca/sitemap.xml`.

- [ ] **Step 2: Add sitemap.xml**

Include core routes, work routes, the Areas hub, and the first 10 local pages.

- [ ] **Step 3: Add one footer link**

Add `Areas We Serve` to the existing Studio footer list so the hub is internally linked without changing the header or homepage layout.

- [ ] **Step 4: Verify**

Run: `npm run build`, `npm run lint`, and `npm test -- src/test/seo.test.ts`.

Expected: all exit 0 or report only pre-existing lint issues.
