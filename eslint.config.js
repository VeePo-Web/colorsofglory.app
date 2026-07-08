import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// ─── A2 TYPE-CONTRACT ENFORCEMENT (docs/TYPE-CONTRACT.md) ────────────────────
// One shape per concept, one import site. COG domain TYPES have a single public
// home: the '@/types' barrel. Feature code imports them from '@/types' — never
// reaching into a data-access module (src/integrations/cog/*) or the generated
// Supabase file for a type. FUNCTIONS still import freely from '@/integrations/
// cog/*'; only the barrel-owned TYPE NAMES are blocked per module below.
//
// The generated 'src/integrations/supabase/types' file is the ROOT of the type
// system; only the type layer (src/types/**), the data-access seams
// (src/integrations/**, src/lib/voice/**), and the contract tests (src/test/**)
// may DERIVE from it. Those dirs are re-allowed in a later override block.
const cogTypePaths = [
  {
    name: "@/integrations/cog/songs",
    importNames: [
      "Song",
      "SongCard",
      "SongDetail",
      "SongActivityRow",
      "SongNotificationPrefs",
      "SongStatus",
      "SongMemberRole",
      "SongInvite",
      "InvitePreview",
      "CogErrorCode",
    ],
  },
  {
    name: "@/integrations/cog/billing",
    importNames: [
      "Subscription",
      "StorageAddon",
      "PlanId",
      "PlanKey",
      "BillingStatus",
      "PlanTier",
      "PricingCard",
    ],
  },
  { name: "@/integrations/cog/canvas", importNames: ["CanvasCard", "CommitTakeResult"] },
  { name: "@/integrations/cog/capture", importNames: ["IdeaCapture"] },
  {
    name: "@/integrations/cog/activity",
    importNames: ["SongActivityKind", "ActivityDigestRow", "RecapDigest"],
  },
  { name: "@/integrations/cog/memory", importNames: ["LoadedMemory", "VaultExportOutcome"] },
  {
    name: "@/integrations/cog/memos",
    importNames: ["VoiceMemo", "VoiceMemoTranscript", "MemoLifecycle"],
  },
  { name: "@/integrations/cog/members", importNames: ["SongMember", "SongMemberRole"] },
  { name: "@/integrations/cog/notes", importNames: ["SongNote", "NoteActivityKind"] },
  { name: "@/integrations/cog/storage", importNames: ["StorageUsage"] },
  { name: "@/integrations/cog/takes", importNames: ["Take"] },
  {
    name: "@/integrations/cog/versions",
    importNames: [
      "SongVersion",
      "VersionKind",
      "SnapshotSection",
      "SongSnapshotV1",
      "SnapshotSummary",
      "VersionActivityKind",
      "RestoreResult",
    ],
  },
  {
    name: "@/integrations/cog/transcript",
    importNames: ["TranscriptBlock", "TranscriptPayload", "TranscriptStatus", "TakeTranscriptRow"],
  },
].map((p) => ({
  ...p,
  message:
    "Import COG domain TYPES from '@/types' (the canonical barrel), not from the data-access module. Functions still import from '@/integrations/cog/*'. See docs/TYPE-CONTRACT.md.",
}));

const generatedTypesPath = {
  name: "@/integrations/supabase/types",
  message:
    "Import domain types from '@/types', not the generated Supabase file. Deriving from Database/Enums/Constants is reserved for src/types/**, the data-access seams, and contract tests. See docs/TYPE-CONTRACT.md.",
};

// Rule value applied to feature code: block barrel-owned cog type names + the
// whole generated Supabase types module.
const domainTypeRestriction = [
  "error",
  { paths: [...cogTypePaths, generatedTypesPath] },
];

// Rule value applied to the sanctioned derivation homes: same cog type-name
// block, but the generated Supabase file stays importable (they derive from it).
const derivationDirRestriction = ["error", { paths: cogTypePaths }];

export default tseslint.config(
  { ignores: ["dist", "supabase/functions/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-restricted-imports": domainTypeRestriction,
    },
  },
  {
    // Sanctioned derivation homes: the type layer, data-access seams, and the
    // contract tests MAY import from the generated Supabase file.
    files: [
      "src/types/**/*.{ts,tsx}",
      "src/integrations/**/*.{ts,tsx}",
      "src/lib/voice/**/*.{ts,tsx}",
      "src/test/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": derivationDirRestriction,
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
