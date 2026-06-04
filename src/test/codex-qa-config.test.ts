import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const importQaConfig = () =>
  import(pathToFileURL(join(process.cwd(), "scripts", "codex-qa-config.mjs")).href);

describe("Codex QA gate configuration", () => {
  it("covers the core app routes and the 390px mobile render routes", async () => {
    const config = await importQaConfig();

    const qaPaths = config.qaRoutes.map((route: { path: string }) => route.path);
    const mobilePaths = config.mobileRenderRoutes.map((route: { path: string }) => route.path);

    expect(qaPaths).toEqual(
      expect.arrayContaining([
        "/",
        "/auth/login",
        "/auth/verify",
        "/onboarding/intent",
        "/onboarding/start-song",
        "/songs/1",
        "/songs/1/capture",
        "/songs/1/voice-added",
        "/songs/1/lyrics",
        "/songs/1/voice",
        "/songs/1/notes",
        "/songs/1/people",
        "/songs/1/activity",
        "/songs/1/credits",
        "/settings",
        "/settings/storage",
        "/settings/referral",
        "/upgrade",
        "/not-a-real-song-room",
      ]),
    );

    expect(mobilePaths).toEqual(
      expect.arrayContaining([
        "/",
        "/auth/login",
        "/onboarding/start-song",
        "/songs/1",
        "/songs/1/capture",
        "/songs/1/voice-added",
        "/settings",
        "/upgrade",
        "/not-a-real-song-room",
      ]),
    );
  });

  it("matches old-brand residue without exposing literal old-brand terms to source scans", async () => {
    const config = await importQaConfig();

    expect(config.findForbiddenBrandHits(`old ${"fly" + "4me"} headline`)).toEqual([
      "fly" + "4me",
    ]);
    expect(config.findForbiddenBrandHits(`Legacy ${"Fly" + "4MEdia"} footer`)).toEqual([
      "Fly" + "4MEdia",
    ]);
    expect(config.findForbiddenBrandHits("Colors of Glory song room")).toEqual([]);
  });
});
