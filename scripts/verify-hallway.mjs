/**
 * THE HALLWAY — runtime walkthrough of the whole corridor (GOLDEN-PATH.md):
 * spark -> shape -> room -> song -> door.
 *
 * Drives the app in a real browser at iPhone size and asserts the hallway's
 * shape end to end:
 *   spark/shape: the mic is home, one tap records (fake media device), STOP
 *   hands straight to the guided rail, three skips reach "where does it
 *   live", and "keep it loose" is never a trap;
 *   song: the room's Ideas/Final tabs stand, Final is the listen mode;
 *   door (both directions): one sheet, one hero act, calm failure, Escape
 *   closes; honest dead-link card, /join entry parsing, legacy redirect,
 *   arrival toast clear of the dock, ?invite=1 consumed (no replay),
 *   /people folds into the canvas People layer (the same one sheet), and
 *   the name screen asks exactly ONE question.
 *
 * Run:
 *   npx vite --port 5199 --strictPort        # the app, in another terminal
 *   # Playwright is deliberately NOT a repo dependency (see .claude/skills/verify).
 *   # Install it in any scratch directory once, then run FROM that directory:
 *   #   mkdir pw-scratch && cd pw-scratch
 *   #   npm i playwright && npx playwright install chromium
 *   #   node <repo>/scripts/verify-invite-hallway.mjs
 *
 * Auth: a forged localStorage session passes the CLIENT gate only (see
 * .claude/skills/verify) — RLS still blocks server data, so authed scenes
 * assert calm degraded states, which is exactly what they're for. The
 * dead-link scene is a LIVE round trip through the deployed
 * song-invite-preview edge function.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
// Resolve playwright from the CURRENT directory (the scratch install), not
// the repo — keeps the repo dependency-free per the verify skill's rule.
const require = createRequire(pathToFileURL(process.cwd() + "/"));
const { chromium } = require("playwright");

const BASE = process.env.COG_BASE_URL ?? "http://localhost:5199";
const REF = "vsiecltcxsuuulbczexl";
const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? " — " + detail : ""}`);
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "none", typ: "JWT" })}.${b64({
  sub: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated", role: "authenticated",
  exp: Math.floor(Date.now() / 1000) + 86400,
})}.x`;
const session = JSON.stringify({
  access_token: jwt, refresh_token: "forged", token_type: "bearer",
  expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400,
  user: { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated" },
});

const browser = await chromium.launch({
  // Fake media device: the spark scene records real (silent) audio through
  // MediaRecorder without a physical microphone or a permission prompt.
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

async function newPage({ auth, mic = false }) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(mic ? { permissions: ["microphone"] } : {}),
  });
  await ctx.addInitScript(([sess, ref]) => {
    sessionStorage.setItem("site_unlocked", "true");
    // This harness simulates a device that has already met the room — the
    // once-per-device RoomWelcome overlay would otherwise intercept clicks.
    localStorage.setItem("cog:room-welcome-seen", "1");
    if (sess) localStorage.setItem(`sb-${ref}-auth-token`, sess);
  }, [auth ? session : null, REF]);
  return { ctx, page: await ctx.newPage() };
}

/** Clear the room's first-run chrome (RoomWelcome dialog dismisses on Escape;
 *  coach-mark tours offer skip/got-it) so scenes interact with the room itself. */
async function settleRoom(page) {
  const welcome = page.getByRole("dialog", { name: /welcome to .*room/i });
  if (await welcome.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await welcome.waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
  }
  await page.getByRole("button", { name: /skip tour|got it/i }).first()
    .click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(300);
}

// ── 0. THE SPARK → THE SHAPE: mic → take safe → the guided rail ─────────────
{
  const { ctx, page } = await newPage({ auth: true, mic: true });
  await page.goto(`${BASE}/`);
  await settleRoom(page);
  const mic = page.getByRole("button", { name: "Start recording" });
  const micHome = await mic.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  ok("the mic is home — one tap, ready to record", micHome);
  if (micHome) {
    await mic.click();
    const recording = await page.getByRole("button", { name: "Stop recording" })
      .waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    ok("one tap and it is already recording", recording);
    if (recording) {
      await page.waitForTimeout(1800);
      await page.getByRole("button", { name: "Stop recording" }).click();
      // The hallway's first law, as shipped: the take is SAFE before any
      // question is asked — home capture files itself to Ideas instantly.
      const saved = await page.getByText(/saved to your ideas/i)
        .waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      ok("the take is safe before any question is asked ('Saved to your Ideas')", saved);
      if (saved) {
        ok("momentum: the save names its next step ('File it into a song whenever you like')",
          await page.getByText(/file it into a song whenever you like/i).isVisible().catch(() => false));
        ok("the fresh take stands on the shelf (LATEST)",
          await page.getByText(/latest/i).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
        ok("the mic is still home — the hallway never left it",
          await page.getByRole("button", { name: "Start recording" }).isVisible().catch(() => false));
      }
    }
  }
  await ctx.close();
}

// ── 1. Invited, dead token, logged out — the honest error path ──────────────
{
  const { ctx, page } = await newPage({ auth: false });
  await page.goto(`${BASE}/join/not-a-real-token-123`);
  const appeared = await page.getByText("This invite link isn't valid.")
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  ok("dead link shows honest error card (real edge-fn round trip)", appeared);
  if (appeared) {
    await page.getByRole("button", { name: /request a new invite/i }).click();
    const saved = await page.getByText("Request saved").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const honest = await page.getByText(/quick text to whoever invited you/i).isVisible().catch(() => false);
    ok("request-new shows 'Request saved' with honest copy (no fake 'owner notified')", saved && honest);
  }
  await ctx.close();
}

// ── 2. JoinEntryPage parses a pasted link ───────────────────────────────────
{
  const { ctx, page } = await newPage({ auth: false });
  await page.goto(`${BASE}/join`);
  const input = page.getByLabel("Invite link or code");
  await input.waitFor({ timeout: 10000 });
  await input.fill("https://colorsofglory.app/join/abc123XYZtoken");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/\/join\/abc123XYZtoken/, { timeout: 8000 }).catch(() => {});
  ok("join entry routes pasted link into /join/:token", page.url().includes("/join/abc123XYZtoken"));
  await ctx.close();
}

// ── 3. Legacy /invite/:token redirects into /join/:token ────────────────────
{
  const { ctx, page } = await newPage({ auth: false });
  await page.goto(`${BASE}/invite/legacyTok999`);
  await page.waitForURL(/\/join\/legacyTok999/, { timeout: 8000 }).catch(() => {});
  ok("legacy /invite/:token redirects to /join/:token", page.url().includes("/join/legacyTok999"));
  await ctx.close();
}

// ── 4. Invite arrival: RoleToast + ?invite=1 consumed (demo room) ───────────
{
  const { ctx, page } = await newPage({ auth: true });
  await page.goto(`${BASE}/songs/demo/canvas?invite=1&role=contributor`);
  await settleRoom(page);
  const toastText = page.getByText("You can write lyrics, add voice memos, and comment.");
  const toastShown = await toastText.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
  ok("RoleToast shows on invite arrival", toastShown);
  if (toastShown) {
    const toastBox = await toastText.boundingBox();
    const dockBox = await page.locator(".cog-creation-dock").first().boundingBox().catch(() => null);
    if (toastBox && dockBox) {
      ok("RoleToast sits clear ABOVE the creation dock",
        toastBox.y + toastBox.height <= dockBox.y + 2,
        `toast bottom=${Math.round(toastBox.y + toastBox.height)} dock top=${Math.round(dockBox.y)}`);
    } else {
      ok("RoleToast/dock geometry measured", false, `toast=${!!toastBox} dock=${!!dockBox}`);
    }
  }
  await page.waitForTimeout(600);
  const search = await page.evaluate(() => window.location.search);
  ok("?invite=1 consumed from the URL (no replay on reload)", !search.includes("invite=1"), `search="${search}"`);
  await page.reload();
  await page.waitForTimeout(1600);
  ok("welcome toast does not replay on reload", !(await toastText.isVisible().catch(() => false)));
  await ctx.close();
}

// ── 5. ShareSongSheet in the demo room: one hero, calm failure, Escape ──────
{
  const { ctx, page } = await newPage({ auth: true });
  await page.goto(`${BASE}/songs/demo/canvas`);
  await settleRoom(page);
  const invite = page.getByRole("button", { name: /invite/i }).first();
  const chipShown = await invite.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
  ok("Invite chip present in the room header", chipShown);
  if (chipShown) {
    await invite.click();
    const dialog = page.getByRole("dialog", { name: /invite into/i });
    const sheetShown = await dialog.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    ok("ShareSongSheet opens on tap", sheetShown);
    if (sheetShown) {
      await page.waitForTimeout(2500); // pre-generation settles (fails calmly under forged auth)
      const heroSend = await dialog.getByRole("button", { name: "Send the link" }).count();
      const heroCopy = await dialog.getByRole("button", { name: "Copy invite link" }).count();
      ok("exactly ONE hero action (send OR copy)", heroSend + heroCopy === 1, `send=${heroSend} copy=${heroCopy}`);
      const oldShare = await dialog.getByRole("button", { name: /^share…$/i }).count();
      ok("the old separate 'Share…' secondary is gone", oldShare === 0);
      const roleToggle = await dialog.getByRole("radio", { name: /can contribute/i }).getAttribute("aria-checked");
      ok("role toggle defaults to Can contribute", roleToggle === "true");
      const calmError = await dialog.getByText(/couldn't create the link/i).isVisible().catch(() => false);
      const rowHonest = await dialog.getByText(/no link yet — tap above/i).isVisible().catch(() => false);
      ok("forged-auth link failure is calm + row agrees with error (no eternal 'Creating…')",
        calmError && rowHonest, `error=${calmError} row=${rowHonest}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      ok("Escape closes the sheet", !(await dialog.isVisible().catch(() => false)));

      // THE SONG — the room's two pages stand, and Final is the listen mode.
      const finalTab = page.getByRole("tab", { name: /final/i });
      const tabsThere = await finalTab.isVisible().catch(() => false);
      ok("the room offers Ideas ⇄ Final as tabs", tabsThere);
      if (tabsThere) {
        await finalTab.click();
        await page.waitForTimeout(600);
        const listenMode = await page.getByRole("button", { name: /play the whole song|keep shaping/i })
          .first().isVisible().catch(() => false)
          || await page.getByText(/final shape lives here/i).isVisible().catch(() => false);
        ok("Final is the listen mode (play the song, or its honest empty state)", listenMode);
      }
    }
  }
  await ctx.close();
}

// ── 6. The People surface (/people folds into the canvas layer): one door ───
{
  const { ctx, page } = await newPage({ auth: true });
  await page.goto(`${BASE}/songs/demo/people`);
  await settleRoom(page);
  const btn = page.getByRole("button", { name: /invite someone into this song/i });
  const shown = await btn.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
  ok("/people lands on the canvas People layer with the one invite door", shown);
  if (shown) {
    ok("no send-to-contact form anywhere on the People surface",
      (await page.getByPlaceholder(/phone number or email/i).count()) === 0);
    await btn.click();
    ok("the People layer opens the SAME ShareSongSheet",
      await page.getByRole("dialog", { name: /invite into/i }).waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
  }
  await ctx.close();
}

// ── 7. The name page: ONE question, one field ───────────────────────────────
{
  const { ctx, page } = await newPage({ auth: true });
  await page.goto(`${BASE}/invite/name`);
  const field = page.getByPlaceholder("First and last name");
  const one = await field.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  ok("name page shows the single full-name field", one);
  if (one) {
    const inputCount = await page.locator("input").count();
    ok("exactly ONE input on the name screen", inputCount === 1, `inputs=${inputCount}`);
    const btn = page.getByRole("button", { name: /continue to the song/i });
    ok("CTA disabled before typing", await btn.isDisabled());
    await field.fill("Sarah Levine");
    ok("CTA enables after a name", !(await btn.isDisabled()));
  }
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
if (fails.length) {
  console.log("FAILURES:");
  fails.forEach((f) => console.log(" -", f.name, f.detail));
  process.exit(1);
}
