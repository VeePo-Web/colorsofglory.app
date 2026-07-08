// ============================================================================
// @/types — the single canonical public surface for COG domain types.
// ============================================================================
// TYPE-CONTRACT LAW (see docs/TYPE-CONTRACT.md):
//   1. Generated src/integrations/supabase/types.ts is never hand-edited.
//   2. Every domain type DERIVES from Database (Tables<>/TablesInsert<>/Enums<>);
//      no forked enums or parallel interfaces.
//   3. Every feature file AND every cog function file imports domain types from
//      '@/types' ONLY.
//
// STEP 2 SCAFFOLD: per-domain files currently RE-EXPORT types from their existing
// homes in src/integrations/cog/* and src/lib/* so nothing breaks. Step 3
// relocates the actual declarations into these files. Each type name has a single
// home file to keep this barrel's star-exports collision-free.
// ============================================================================

export * from "./enums";
export * from "./song";
export * from "./section";
export * from "./lyrics";
export * from "./voice";
export * from "./member";
export * from "./role";
export * from "./invite";
export * from "./version";
export * from "./activity";
export * from "./note";
export * from "./canvas";
export * from "./capture";
export * from "./credit";
export * from "./memory";
export * from "./billing";
export * from "./error";
