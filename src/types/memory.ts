// Personal memory graph domain types (Feature 33 · Zettelkasten).
//
// The memory graph shapes remain declared in src/lib/memory/memoryTypes.ts —
// their canonical home — and are re-exported through the barrel so there is a
// single import site (@/types). `LoadedMemory` / `VaultExportOutcome` are the
// data-layer result shapes, declared here.
import type { MemoryGraph, MemoryRawBundle } from "@/lib/memory/memoryTypes";

export type {
  MemoryClusterType,
  MemorySong,
  MemorySection,
  MemoryNote,
  MemoryIdea,
  MemoryPerson,
  MemoryVoiceMemo,
  MemoryLyric,
  MemoryRawBundle,
  MemoryCluster,
  MemoryStats,
  MemoryGraph,
  RelatedSong,
  SongMemory,
} from "@/lib/memory/memoryTypes";

export interface LoadedMemory {
  graph: MemoryGraph;
  bundle: MemoryRawBundle;
}

export type VaultExportOutcome = "shared" | "downloaded" | "cancelled";
