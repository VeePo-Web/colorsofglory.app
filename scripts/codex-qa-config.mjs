export const qaRoutes = [
  { path: "/", label: "Song catalog" },
  { path: "/auth/login", label: "Phone login" },
  { path: "/auth/verify", label: "Code verification" },
  { path: "/onboarding/intent", label: "First intent" },
  { path: "/onboarding/start-song", label: "Start first song" },
  { path: "/onboarding/founder-code", label: "Founder code" },
  { path: "/invite/sample-token", label: "Invite preview" },
  { path: "/songs/1", label: "Song workspace" },
  { path: "/songs/1/capture", label: "Capture first idea" },
  { path: "/songs/1/voice-added", label: "Voice memo added" },
  { path: "/songs/1/lyrics", label: "Lyrics editor" },
  { path: "/songs/1/voice", label: "Voice memos" },
  { path: "/songs/1/chords", label: "Chords" },
  { path: "/songs/1/notes", label: "Notes" },
  { path: "/songs/1/people", label: "People" },
  { path: "/songs/1/activity", label: "Activity" },
  { path: "/songs/1/credits", label: "Credits" },
  { path: "/settings", label: "Settings" },
  { path: "/settings/storage", label: "Storage settings" },
  { path: "/settings/referral", label: "Referral settings" },
  { path: "/upgrade", label: "Upgrade" },
  { path: "/not-a-real-song-room", label: "404 fallback" },
];

export const mobileRenderRoutes = [
  { path: "/", label: "Song catalog" },
  { path: "/auth/login", label: "Phone login" },
  { path: "/onboarding/start-song", label: "Start first song" },
  { path: "/songs/1", label: "Song workspace" },
  { path: "/songs/1/capture", label: "Capture first idea" },
  { path: "/songs/1/voice-added", label: "Voice memo added" },
  { path: "/songs/1/chords", label: "Chords" },
  { path: "/settings", label: "Settings" },
  { path: "/upgrade", label: "Upgrade" },
  { path: "/not-a-real-song-room", label: "404 fallback" },
];

export const sourceScanTargets = ["index.html", "public", "src"];

export const textFileExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
]);

const forbiddenBrandParts = [
  ["fly", "4me"],
  ["Fly", "4MEdia"],
  ["drone ", "photography"],
  ["areas", "-we-serve"],
];

export const forbiddenBrandTerms = forbiddenBrandParts.map((parts) => parts.join(""));

export const oldAssetFilenameParts = [
  ["veepo", "-logo"],
  ["hero", "-drone"],
  ["work", "-01"],
  ["work", "-02"],
  ["work", "-03"],
  ["work", "-04"],
  ["cs", "-canmore"],
  ["cs", "-lake"],
  ["cs", "-northern"],
  ["glass", "-parking"],
];

export const oldAssetFilenameTerms = oldAssetFilenameParts.map((parts) => parts.join(""));

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const accessibilitySourceChecks = [
  {
    file: "index.html",
    label: "HTML language is declared",
    pattern: /<html\s+lang="en"/i,
  },
  {
    file: "index.html",
    label: "Mobile viewport is declared",
    pattern: /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1\.0"/i,
  },
  {
    file: "index.html",
    label: "Canonical URL is declared",
    pattern: /<link\s+rel="canonical"\s+href="https:\/\/colorsofglory\.app\/"/i,
  },
  {
    file: "src/App.tsx",
    label: "Route fallback has a loading label",
    pattern: /aria-label="Loading page"/,
  },
  {
    file: "src/pages/NotFound.tsx",
    label: "404 page has a real heading",
    pattern: /<h1[\s\S]*This song room is not here\./,
  },
  {
    file: "src/pages/auth/PhoneLoginPage.tsx",
    label: "Phone field has an accessible name",
    pattern: /aria-label="Phone number"/,
  },
  {
    file: "src/pages/onboarding/StartFirstSongPage.tsx",
    label: "First-song form labels inputs",
    pattern: /htmlFor="song-title"[\s\S]*id="song-title"/,
  },
];

export const instantFeelSourceChecks = [
  {
    file: "src/App.tsx",
    label: "Routes are code-split with React.lazy",
    pattern: /const\s+\w+\s*=\s*lazy\(/,
  },
  {
    file: "src/App.tsx",
    label: "Suspense fallback is a skeleton instead of a spinner",
    pattern: /aria-label="Loading page"[\s\S]*rounded-2xl/,
  },
  {
    file: "src/pages/SongWorkspacePage.tsx",
    label: "Song workspace primary actions use stable touch targets",
    pattern: /className="[^"]*min-h-14[^"]*"/,
  },
  {
    file: "src/pages/SongCatalogPage.tsx",
    label: "Song catalog cards have stable minimum height",
    pattern: /minHeight:\s*"140px"/,
  },
];

export const placeholderRouteFiles = [
  "src/pages/LyricsEditorPage.tsx",
  "src/pages/VoiceMemosPage.tsx",
  "src/pages/NotesPage.tsx",
  "src/pages/PeoplePage.tsx",
  "src/pages/ActivityPage.tsx",
  "src/pages/CreditsPage.tsx",
  "src/pages/settings/StoragePage.tsx",
  "src/pages/settings/ReferralPage.tsx",
];

export function findForbiddenBrandHits(text) {
  return forbiddenBrandTerms.filter((term) => {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegex(term)}(?![a-z0-9])`, "i");
    return pattern.test(text);
  });
}

export function findOldAssetFilenameHits(path) {
  const normalized = path.toLowerCase().replaceAll("\\", "/");
  return oldAssetFilenameTerms.filter((term) => normalized.includes(term.toLowerCase()));
}
