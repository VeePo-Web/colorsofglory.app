/**
 * THE ORGANIZATION HALLWAY — runtime walkthrough (Lane C · C1–C6).
 *
 * Drives the library in a real browser at iPhone size and asserts the
 * Drive-standard shape end to end:
 *   C1  one + New door (Song / Album, always the same two rows)
 *   C2  the cover tells everything (color · faces · the gold dot · who/when)
 *   C3  the face row works INSIDE an album, chips telling the album's truth
 *   C4  the true breadcrumb + rename where the name lives
 *   C5  drop a song on a cover and it files (fine pointer)
 *   C6  ONE shelf — invited songs live with owned; "Shared with me" is a
 *       lens beside the faces, never a door
 *
 * Run:
 *   npx vite --port 5199 --strictPort        # the app, in another terminal
 *   # Playwright is deliberately NOT a repo dependency (see .claude/skills/verify).
 *   # Install once in any scratch dir, then run FROM that directory:
 *   #   npm i playwright && npx playwright install chromium
 *   #   node <repo>/scripts/verify-organize.mjs
 *
 * Auth: forged localStorage session (client gate only); song/member/profile
 * reads are network-mocked so the shelf renders a real band deterministically.
 * Albums live in localStorage — a fresh context starts with a clean shelf.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(pathToFileURL(process.cwd() + "/"));
const { chromium } = require("playwright");

const BASE = process.env.COG_BASE_URL ?? "http://localhost:5199";
const SHOTS = (process.env.COG_SHOTS_DIR ?? process.cwd() + "/film") + "/";
const REF = "vsiecltcxsuuulbczexl";
const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? " — " + detail : ""}`);
};

const ME = "11111111-1111-4111-8111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: ME, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 })}.x`;
const session = JSON.stringify({
  access_token: jwt, refresh_token: "f", token_type: "bearer",
  expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400,
  user: { id: ME, aud: "authenticated", role: "authenticated" },
});

const now = Date.now();
const iso = (daysAgo) => new Date(now - daysAgo * 86400e3).toISOString();
const song = (id, title, mine, memos, collab, daysAgo) => ({
  id, title, cover_color: null, status: "active",
  last_activity_at: iso(daysAgo), created_at: iso(daysAgo + 30),
  my_role: mine ? "owner" : "collaborator",
  voice_memo_count: memos, collaborator_count: collab,
});
const SONGS = [
  song("s1", "Grace in the Waiting", true, 12, 3, 0),
  song("s2", "Morning Mercy", true, 5, 2, 2),
  song("s3", "Psalm Twenty-Three", false, 8, 3, 1),
  song("s4", "Quiet Fire", true, 3, 1, 5),
];
const MEMBERS = [
  { song_id: "s1", user_id: ME, role: "owner" },
  { song_id: "s1", user_id: "u-sarah", role: "collaborator" },
  { song_id: "s1", user_id: "u-caleb", role: "collaborator" },
  { song_id: "s2", user_id: ME, role: "owner" },
  { song_id: "s2", user_id: "u-sarah", role: "collaborator" },
  { song_id: "s3", user_id: ME, role: "collaborator" },
  { song_id: "s3", user_id: "u-sarah", role: "collaborator" },
  { song_id: "s3", user_id: "u-parker", role: "owner" },
  { song_id: "s4", user_id: ME, role: "owner" },
];
const PROFILES = [
  { user_id: "u-sarah", display_name: "Sarah Levine", first_name: "Sarah", avatar_color: "#C26A95" },
  { user_id: "u-caleb", display_name: "Caleb Brooks", first_name: "Caleb", avatar_color: "#4D8FD2" },
  { user_id: "u-parker", display_name: "Parker Hayes", first_name: "Parker", avatar_color: "#8070C4" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([sess, ref]) => {
  sessionStorage.setItem("site_unlocked", "true");
  localStorage.setItem("cog:room-welcome-seen", "1");
  localStorage.setItem("cog:tour_catalog_seen", "1");
  localStorage.setItem(`sb-${ref}-auth-token`, sess);
}, [session, REF]);

await ctx.route("**/auth/v1/user", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: ME, aud: "authenticated", role: "authenticated" }) }));
await ctx.route("**/rest/v1/rpc/list_my_songs", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SONGS) }));
await ctx.route("**/rest/v1/rpc/song_catalog_board", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    songs: [
      { id: "s1", unseen_count: 3, last_event: { kind: "voice_memo_added", actor_name: "Sarah Levine", created_at: iso(0) } },
      { id: "s2", unseen_count: 0, last_event: { kind: "invite_accepted", actor_name: "Caleb Brooks", created_at: iso(2) } },
      { id: "s3", unseen_count: 0, last_event: null },
      { id: "s4", unseen_count: 0, last_event: null },
    ],
    owned_count: 3, total_unseen: 3,
  }) }));
await ctx.route("**/rest/v1/song_members*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MEMBERS) }));
await ctx.route("**/rest/v1/profiles*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PROFILES) }));

const page = await ctx.newPage();
await page.goto(`${BASE}/songs`);
await page.getByRole("button", { name: /got it|skip tour/i }).first().click({ timeout: 4000 }).catch(() => {});

// ── C6 first truth: ONE shelf, no tabs, invited beside owned ────────────────
ok("no tabs — nothing archived, so the header is just 'Your songs'",
  await page.getByRole("heading", { name: "Your songs" }).waitFor({ timeout: 15000 }).then(() => true).catch(() => false) &&
  !(await page.getByRole("button", { name: "Songs" }).isVisible().catch(() => false)));
ok("the invited song lives on the SAME shelf as owned ones",
  await page.getByText("Psalm Twenty-Three").isVisible().catch(() => false));

// ── C1: the one + New door ──────────────────────────────────────────────────
const fab = page.getByRole("button", { name: "New — start a song or album" });
ok("ONE gold + New (its label tells the whole truth)", await fab.isVisible().catch(() => false));
ok("no scattered 'New album' button anywhere on the browse surface",
  (await page.getByRole("button", { name: "New album" }).count()) === 0);
await fab.click();
const songRow = page.getByRole("button", { name: "Song — a room for one song" });
const albumRow = page.getByRole("button", { name: "Album — a folder of songs" });
ok("the door opens on the same two rows, each with its teaching line",
  await songRow.waitFor({ timeout: 5000 }).then(() => true).catch(() => false) &&
  (await albumRow.count()) === 1);
await page.screenshot({ path: `${SHOTS}c1-new-door.png` });

// ── C2: make "Worship EP", sage, two songs ──────────────────────────────────
await albumRow.click();
const nameInput = page.getByRole("textbox", { name: "Album name" });
ok("Album asks ONE thing — a name", await nameInput.waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
await nameInput.fill("Worship EP");
await page.getByRole("button", { name: "Color: Sage" }).click();
await page.getByRole("checkbox", { name: "Add Grace in the Waiting" }).click();
await page.getByRole("checkbox", { name: "Add Morning Mercy" }).click();
await page.screenshot({ path: `${SHOTS}c2-color-beat.png` });
await page.getByRole("button", { name: "Create album" }).click();

// ── C4: you arrive INSIDE, under a true breadcrumb ──────────────────────────
const crumbs = page.getByRole("navigation", { name: "Where you are" });
ok("creating lands you inside, breadcrumb reads All songs / Worship EP",
  await crumbs.waitFor({ timeout: 5000 }).then(() => true).catch(() => false) &&
  /All songs\s*\/\s*Worship EP/.test((await crumbs.textContent()) ?? ""));

// ── C3: the face row INSIDE the album, chips telling ITS truth ──────────────
ok("in-album chips carry the ALBUM's counts (Sarah — 2, Caleb — 1)",
  await page.getByRole("button", { name: /^Sarah — 2 songs/ }).isVisible().catch(() => false) &&
  await page.getByRole("button", { name: /^Caleb — 1 song/ }).isVisible().catch(() => false));
await page.getByRole("button", { name: /^Caleb — 1 song/ }).click();
ok("the scoped honest line: songs with Caleb ON THIS ALBUM",
  await page.getByText(/Songs with Caleb/).waitFor({ timeout: 5000 }).then(() => true).catch(() => false) &&
  await page.getByText(/1 song on this album/).isVisible().catch(() => false) &&
  !(await page.getByText("Morning Mercy").isVisible().catch(() => false)));
await page.getByRole("button", { name: "Everyone" }).click();
await page.screenshot({ path: `${SHOTS}c3-inside-album.png` });

// ── C4: rename where the name lives ─────────────────────────────────────────
await page.getByRole("button", { name: /tap to rename/ }).click();
const rename = page.getByRole("textbox", { name: "Album name" });
await rename.fill("Advent Set");
await rename.press("Enter");
ok("tap the title, type, Enter — the breadcrumb already says Advent Set",
  /Advent Set/.test((await crumbs.textContent()) ?? ""));

// ── Walk home; the cover tells everything (C2) ──────────────────────────────
await page.getByRole("button", { name: "Back to all songs" }).click();
const cover = page.getByRole("button", { name: /^Show album Advent Set/ });
ok("the cover speaks its whole truth (songs, faces, what's new) in ONE label",
  await cover.waitFor({ timeout: 5000 }).then(() => true).catch(() => false) &&
  /2 songs, with Sarah Levine, Caleb Brooks, 3 new since you were here/.test(
    (await cover.getAttribute("aria-label")) ?? ""));
ok("the cover's sub-line says who touched it last",
  await page.getByText(/^Sarah · /).first().isVisible().catch(() => false));
await page.screenshot({ path: `${SHOTS}c4-organized-shelf.png` });

// ── C5: drop a song on the cover, and it files ──────────────────────────────
ok("song cards are draggable on a fine pointer",
  (await page.locator('button[draggable="true"]').count()) >= 4);
await page.evaluate(() => {
  const dt = new DataTransfer();
  const card = [...document.querySelectorAll('button[draggable="true"]')]
    .find((b) => b.textContent?.includes("Quiet Fire"));
  const cover = [...document.querySelectorAll("button")]
    .find((b) => (b.getAttribute("aria-label") ?? "").startsWith("Show album Advent Set"));
  if (!card || !cover) throw new Error("drag actors missing");
  card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
  cover.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  cover.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
});
ok("the drop files it — toast says so, with Undo standing by",
  await page.getByText(/Added .Quiet Fire. to Advent Set/).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
ok("the cover's count moved the moment it landed",
  /3 songs/.test((await cover.getAttribute("aria-label")) ?? ""));

// ── C6: the provenance lens ─────────────────────────────────────────────────
// Assert on the CARDS (role + "Open …" label), never raw text — the drop
// toast above still says “Quiet Fire” and a text locator would catch it.
const sharedChip = page.getByRole("button", { name: /^Shared with me — 1 song/ });
ok("'Shared with me' is a quiet chip at the end of the face row",
  await sharedChip.isVisible().catch(() => false));
await sharedChip.click();
ok("the lens narrows the same room with an honest header",
  await page.getByText("Shared with you").waitFor({ timeout: 5000 }).then(() => true).catch(() => false) &&
  await page.getByRole("button", { name: /^Open Psalm Twenty-Three/ }).isVisible().catch(() => false) &&
  !(await page.getByRole("button", { name: /^Open Quiet Fire/ }).isVisible().catch(() => false)));
await page.screenshot({ path: `${SHOTS}c5-shared-lens.png` });
await page.getByRole("button", { name: "Everyone" }).click();
ok("Everyone brings the whole shelf back",
  await page.getByRole("button", { name: /^Open Quiet Fire/ }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
if (fails.length) process.exit(1);
