import { beforeEach, describe, expect, it } from "vitest";
import {
  currentUserIdSync,
  loadMemorySnapshot,
  saveMemorySnapshot,
} from "@/lib/memory/localCache";
import type { MemoryRawBundle } from "@/lib/memory/memoryTypes";

// Minimal localStorage stub for the node test environment.
function installLocalStorage() {
  const store = new Map<string, string>();
  const stub = {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as Record<string, unknown>).localStorage = stub;
  return stub;
}

function signIn(userId: string) {
  localStorage.setItem("sb-testref-auth-token", JSON.stringify({ user: { id: userId } }));
}

function bundle(userId: string): MemoryRawBundle {
  return {
    userId,
    songs: [
      { id: "s1", title: "Grace in the Waiting", coverColor: null, status: "draft", keySignature: "G", tempoBpm: 72, tags: ["grace"], createdAt: "2026-06-01T00:00:00Z", lastActivityAt: null },
    ],
    sections: [],
    notes: [],
    ideas: [],
    people: [],
    voiceMemos: [],
    lyrics: [],
  };
}

beforeEach(() => {
  installLocalStorage();
});

describe("currentUserIdSync", () => {
  it("reads the signed-in user id from the supabase auth token", () => {
    signIn("me");
    expect(currentUserIdSync()).toBe("me");
  });

  it("returns null when signed out or the token is malformed", () => {
    expect(currentUserIdSync()).toBeNull();
    localStorage.setItem("sb-testref-auth-token", "{not json");
    expect(currentUserIdSync()).toBeNull();
  });
});

describe("memory snapshot", () => {
  it("round-trips: save then load rebuilds the full graph for the same user", () => {
    signIn("me");
    saveMemorySnapshot(bundle("me"));
    const loaded = loadMemorySnapshot();
    expect(loaded).toBeTruthy();
    expect(loaded!.bundle.userId).toBe("me");
    expect(loaded!.graph.stats.songCount).toBe(1);
    expect(loaded!.graph.songs[0].title).toBe("Grace in the Waiting");
  });

  it("NEVER serves another user's snapshot (privacy by construction)", () => {
    signIn("me");
    saveMemorySnapshot(bundle("me"));
    signIn("someone-else");
    expect(loadMemorySnapshot()).toBeUndefined();
  });

  it("returns undefined when signed out, on corrupt data, or when empty", () => {
    expect(loadMemorySnapshot()).toBeUndefined(); // nothing saved
    signIn("me");
    saveMemorySnapshot(bundle("me"));
    localStorage.setItem("cog:memory:snapshot", "{corrupt");
    expect(loadMemorySnapshot()).toBeUndefined();
  });

  it("skips oversized bundles instead of blowing the quota", () => {
    signIn("me");
    const big = bundle("me");
    big.lyrics = [{ songId: "s1", sectionId: "sec1", text: "x".repeat(3_000_000) }];
    saveMemorySnapshot(big);
    expect(loadMemorySnapshot()).toBeUndefined();
  });

  it("ignores a bundle with no userId", () => {
    signIn("me");
    saveMemorySnapshot(bundle(""));
    expect(loadMemorySnapshot()).toBeUndefined();
  });
});
