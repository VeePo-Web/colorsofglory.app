import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Settings, Mic, Sparkles, Disc3, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import CogBrand from "@/components/cog/CogBrand";
import BottomNav from "@/components/cog/BottomNav";
import { useSwipeNav } from "@/lib/nav/useSwipeNav";
import { setNavDirection, useSpatialEntrance } from "@/lib/nav/navDirection";
import { preloadOnIdle } from "@/lib/nav/preloadOnIdle";
import SeedIdeasShelf from "@/components/capture/SeedIdeasShelf";
import LibraryControls from "@/components/library/LibraryControls";
import LibrarySongList from "@/components/library/LibrarySongList";
import AlbumsShelf from "@/components/library/AlbumsShelf";
import AlbumDetailHeader from "@/components/library/AlbumDetailHeader";
import AlbumSongOrderList from "@/components/library/AlbumSongOrderList";
import ContinueShelf from "@/components/library/ContinueShelf";
import EmptyLibraryHero from "@/components/library/EmptyLibraryHero";
import AlbumEditSheet from "@/components/library/AlbumEditSheet";
import SongActionsSheet from "@/components/library/SongActionsSheet";
import SelectionBar from "@/components/library/SelectionBar";
import BatchAlbumSheet from "@/components/library/BatchAlbumSheet";
import { loadLibraryPrefs, saveLibraryPrefs, type LibraryPrefs } from "@/lib/library/libraryPrefs";
import { listAlbums, createAlbum, updateAlbum, deleteAlbum, reorderAlbums, type SongAlbum } from "@/lib/library/albums";
import { loadPins, togglePin, MAX_PINS } from "@/lib/library/pins";
import { canCreateSong } from "@/lib/pricing/pricingApi";
import CoachMark from "@/components/onboarding/CoachMark";
import { useCoachMark } from "@/components/onboarding/useCoachMark";
import {
  listMySongs,
  createSong,
  archiveSong,
  unarchiveSong,
  type SongCard as SongRow,
} from "@/integrations/cog/songs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Tab = "Owned" | "Invited" | "Archived";

const EMPTY_COPY: Record<Tab, string> = {
  Owned: "No songs yet. Tap New song to start brainstorming.",
  Invited: "No invited songs yet. Songs shared with you will appear here.",
  Archived: "Archived songs stay safe and readable here.",
};

// Session-warm song list — returning to the catalog paints the last known
// list instantly (0ms perceived) while a background refresh reconciles.
let songsWarmCache: SongRow[] | null = null;

// Remember which album the songwriter was inside, so tapping a song → the
// whiteboard → back returns them to that album (working an EP song by song),
// not to "all songs". Survives the page remount that navigation causes.
let lastActiveAlbumId: string | null = null;

// Sentinel "smart group" — songs not yet placed in any album, so a growing
// body of work can be filed. Not a real album (no edit/reorder/membership).
const UNGROUPED = "__ungrouped__";

const SongCatalogPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("Owned");
  const [isCheckingCreate, setIsCheckingCreate] = useState(false);
  const [songs, setSongs] = useState<SongRow[]>(() => songsWarmCache ?? []);
  const [loading, setLoading] = useState(songsWarmCache === null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Library organization — view prefs persist so the catalog reopens the way
  // the songwriter left it (Apple Music remembers your Library view).
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => loadLibraryPrefs());
  const [query, setQuery] = useState("");
  const [albums, setAlbums] = useState<SongAlbum[]>(() => listAlbums());
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(lastActiveAlbumId);
  const [albumSheet, setAlbumSheet] = useState<{
    open: boolean;
    album: SongAlbum | null;
    initialSongIds?: string[];
  }>({ open: false, album: null });
  const [actionsSong, setActionsSong] = useState<SongRow | null>(null);
  const [pins, setPins] = useState<string[]>(() => loadPins());
  const pinnedIds = useMemo(() => new Set(pins), [pins]);

  // Batch select (Apple Photos): entered from a song's press-and-hold sheet.
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAlbumOpen, setBatchAlbumOpen] = useState(false);
  const [reorderingAlbum, setReorderingAlbum] = useState(false);

  const updatePrefs = (changes: Partial<LibraryPrefs>) =>
    setPrefs((prev) => {
      const next = { ...prev, ...changes };
      saveLibraryPrefs(next);
      return next;
    });

  // View cycle: comfortable grid → compact grid → list → back.
  const cycleView = () => {
    if (prefs.view === "grid" && prefs.density === 2) updatePrefs({ density: 3 });
    else if (prefs.view === "grid") updatePrefs({ view: "list" });
    else updatePrefs({ view: "grid", density: 2 });
  };

  useEffect(() => {
    (async () => {
      try {
        setSongs(await listMySongs());
      } catch {
        // A warm cache means stale-but-present beats an error wall.
        if (songsWarmCache === null) toast.error("Couldn't load your songs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep the warm cache current so the next visit paints instantly.
  useEffect(() => {
    if (!loading) songsWarmCache = songs;
  }, [songs, loading]);

  // Remember the focused album across navigations; drop the memory if that
  // album was since removed so we never restore into a ghost.
  useEffect(() => {
    if (activeAlbumId && activeAlbumId !== UNGROUPED && !albums.some((a) => a.id === activeAlbumId)) {
      setActiveAlbumId(null);
      return;
    }
    lastActiveAlbumId = activeAlbumId;
  }, [activeAlbumId, albums]);

  // The mic is one swipe to the right; opening a song is one tap away —
  // both chunks warm while the songwriter is browsing.
  useEffect(() => {
    preloadOnIdle(
      () => import("@/pages/CapturePage"),
      () => import("@/pages/BrainstormPage"),
    );
  }, []);

  const activeAlbum = albums.find((a) => a.id === activeAlbumId) ?? null;
  const viewingUngrouped = activeAlbumId === UNGROUPED;

  // Every song id that lives in at least one album.
  const groupedIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of albums) for (const id of a.songIds) s.add(id);
    return s;
  }, [albums]);

  const visibleSongs = useMemo(() => {
    let list = songs.filter((s) => {
      if (activeTab === "Owned") return s.my_role === "owner" && s.status !== "archived";
      if (activeTab === "Invited") return s.my_role !== "owner" && s.status !== "archived";
      return s.status === "archived";
    });
    if (activeTab === "Owned" && viewingUngrouped) {
      list = list.filter((s) => !groupedIds.has(s.id));
    } else if (activeTab === "Owned" && activeAlbum) {
      const inAlbum = new Set(activeAlbum.songIds);
      list = list.filter((s) => inAlbum.has(s.id));
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((s) => s.title.toLowerCase().includes(q));

    // Inside an album, the songwriter's own arrangement IS the order — an
    // album (a body of songs being written together, like an EP in progress)
    // keeps its tracklist order, not "most recently edited".
    if (activeTab === "Owned" && activeAlbum && !q) {
      const rank = new Map(activeAlbum.songIds.map((id, i) => [id, i]));
      return [...list].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }

    const time = (s: SongRow) => new Date(s.last_activity_at ?? s.created_at ?? 0).getTime() || 0;
    const sorted = [...list];
    if (prefs.sort === "alpha") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (prefs.sort === "ideas") sorted.sort((a, b) => b.voice_memo_count - a.voice_memo_count);
    else sorted.sort((a, b) => time(b) - time(a));
    // Pinned songs hold the top of Owned whatever the sort (Apple Notes).
    if (activeTab === "Owned" && !activeAlbum && pinnedIds.size > 0) {
      return [
        ...sorted.filter((s) => pinnedIds.has(s.id)),
        ...sorted.filter((s) => !pinnedIds.has(s.id)),
      ];
    }
    return sorted;
  }, [songs, activeTab, activeAlbum, viewingUngrouped, groupedIds, query, prefs.sort, pinnedIds]);

  // Rooms a captured idea can move into — the songwriter's own active rooms.
  const ownedSongs = songs.filter((s) => s.my_role === "owner" && s.status !== "archived");
  const fileableSongs = ownedSongs.map((s) => ({ id: s.id, title: s.title }));
  const ungroupedCount = ownedSongs.filter((s) => !groupedIds.has(s.id)).length;

  // Search reaches album names too (Apple Music scoped search) — surfaced as
  // tappable chips above the song results when the query matches.
  const albumMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return albums.filter((a) => a.name.toLowerCase().includes(q));
  }, [albums, query]);

  // "Pick up where you left off" — PV11: prioritize the last active song for
  // returning users. Hidden while searching, album-focused, or trivially small.
  const continueSong = useMemo(() => {
    if (activeTab !== "Owned" || query.trim() || activeAlbumId) return null;
    if (ownedSongs.length < 2) return null;
    const time = (s: SongRow) => new Date(s.last_activity_at ?? s.created_at ?? 0).getTime() || 0;
    return [...ownedSongs].sort((a, b) => time(b) - time(a))[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, activeTab, query, activeAlbumId]);

  const handleAlbumSave = (name: string, songIds: string[]) => {
    if (albumSheet.album) {
      setAlbums(updateAlbum(albumSheet.album.id, { name, songIds }));
    } else {
      const album = createAlbum(name, songIds);
      setAlbums(listAlbums());
      setActiveAlbumId(album.id);
    }
    setAlbumSheet({ open: false, album: null });
  };

  const handleAlbumDelete = (id: string) => {
    setAlbums(deleteAlbum(id));
    if (activeAlbumId === id) setActiveAlbumId(null);
    setAlbumSheet({ open: false, album: null });
    toast("Album removed — your songs are untouched");
  };

  const handleTogglePin = (songId: string) => {
    const result = togglePin(songId);
    setPins(result.pins);
    if (result.limited) toast(`You can pin up to ${MAX_PINS} songs`);
  };

  const toggleSongInAlbum = (albumId: string, songId: string) => {
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;
    const songIds = album.songIds.includes(songId)
      ? album.songIds.filter((id) => id !== songId)
      : [...album.songIds, songId];
    setAlbums(updateAlbum(albumId, { songIds }));
  };

  // Remove a song from the album you're inside — it stays in your library,
  // it just leaves this body of work. Reversible; never archives the song.
  const removeSongFromAlbum = (albumId: string, song: SongRow) => {
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;
    setAlbums(updateAlbum(albumId, { songIds: album.songIds.filter((id) => id !== song.id) }));
    toast(`Removed from ${album.name}`, {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => {
          const cur = listAlbums().find((a) => a.id === albumId);
          if (cur && !cur.songIds.includes(song.id)) {
            setAlbums(updateAlbum(albumId, { songIds: [...cur.songIds, song.id] }));
          }
        },
      },
    });
  };

  // Archive / restore — optimistic, always reversible, never a delete.
  const setSongStatus = async (song: SongRow, archived: boolean) => {
    setActionsSong(null);
    const prev = songs;
    const status = (archived ? "archived" : "active") as SongRow["status"];
    setSongs((s) => s.map((x) => (x.id === song.id ? { ...x, status } : x)));
    try {
      if (archived) {
        await archiveSong(song.id);
        toast("Song archived — it stays safe in the Archived tab", {
          duration: 6000,
          action: { label: "Undo", onClick: () => setSongStatus(song, false) },
        });
      } else {
        await unarchiveSong(song.id);
        toast("Song restored");
      }
    } catch {
      setSongs(prev);
      toast.error(archived ? "Couldn't archive that song" : "Couldn't restore that song");
    }
  };

  const tabCounts: Record<Tab, number> = {
    Owned: ownedSongs.length,
    Invited: songs.filter((s) => s.my_role !== "owner" && s.status !== "archived").length,
    Archived: songs.filter((s) => s.status === "archived").length,
  };

  // ── Batch select ────────────────────────────────────────────────────────
  const enterSelect = (seedId: string) => {
    setActionsSong(null);
    setSelectedIds(new Set([seedId]));
    setSelecting(true);
  };

  const exitSelect = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setBatchAlbumOpen(false);
  };

  const toggleSelect = (song: SongRow) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(song.id)) next.delete(song.id);
      else next.add(song.id);
      return next;
    });

  const allVisibleSelected =
    visibleSongs.length > 0 && visibleSongs.every((s) => selectedIds.has(s.id));

  const toggleSelectAll = () =>
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleSongs.map((s) => s.id)));

  const batchAddToAlbum = (albumId: string) => {
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;
    const merged = Array.from(new Set([...album.songIds, ...selectedIds]));
    setAlbums(updateAlbum(albumId, { songIds: merged }));
    setBatchAlbumOpen(false);
    toast(`Added ${selectedIds.size} to ${album.name}`);
    exitSelect();
  };

  // Archive/restore every selected song at once — optimistic, reversible.
  const batchSetStatus = async (archived: boolean) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const prev = songs;
    const status = (archived ? "archived" : "active") as SongRow["status"];
    setSongs((s) => s.map((x) => (selectedIds.has(x.id) ? { ...x, status } : x)));
    exitSelect();
    try {
      await Promise.all(ids.map((id) => (archived ? archiveSong(id) : unarchiveSong(id))));
      toast(
        archived
          ? `${ids.length} songs archived — safe in the Archived tab`
          : `${ids.length} songs restored`,
        archived
          ? {
              duration: 6000,
              action: {
                label: "Undo",
                onClick: () => {
                  setSongs((s) => s.map((x) => (ids.includes(x.id) ? { ...x, status: "active" as SongRow["status"] } : x)));
                  void Promise.all(ids.map((id) => unarchiveSong(id).catch(() => {})));
                },
              },
            }
          : undefined,
      );
    } catch {
      setSongs(prev);
      toast.error("Some songs couldn't be updated");
    }
  };

  const handleCreateSong = async () => {
    if (isCheckingCreate) return;
    setIsCheckingCreate(true);
    try {
      const allowed = await canCreateSong();
      if (allowed) {
        setNewTitle("");
        setDialogOpen(true);
      } else navigate("/upgrade?source=song_gate_free");
    } catch {
      setNewTitle("");
      setDialogOpen(true);
    } finally {
      setIsCheckingCreate(false);
    }
  };

  const submitCreate = async () => {
    const title = newTitle.trim() || "New song";
    setCreating(true);
    try {
      const { song } = await createSong({ title });
      // Writing a new song while inside an album → it joins that body of work.
      if (activeAlbum) {
        setAlbums(updateAlbum(activeAlbum.id, { songIds: [...activeAlbum.songIds, song.id] }));
      }
      setDialogOpen(false);
      setNavDirection("up");
      navigate(`/songs/${song.id}/brainstorm`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create that song");
    } finally {
      setCreating(false);
    }
  };

  // Spatial nav — Capture lives to the RIGHT of Songs. Swiping left pages
  // back to the mic; the raised BottomNav mic stays the visible contract.
  const pageRef = useRef<HTMLDivElement>(null);
  useSwipeNav(pageRef, {
    onSwipeLeft: () => {
      setNavDirection("right");
      navigate("/");
    },
    disabled: dialogOpen || albumSheet.open || actionsSong !== null,
  });
  const enterClass = useSpatialEntrance(useLocation().pathname);

  // Scroll restoration — coming back from a song must land exactly where
  // the songwriter left off (the list never "resets" under them).
  useLayoutEffect(() => {
    if (loading) return;
    const saved = Number(sessionStorage.getItem("cog:songs-scroll") ?? 0);
    if (saved > 0) window.scrollTo(0, saved);
  }, [loading]);
  useEffect(() => {
    return () => {
      sessionStorage.setItem("cog:songs-scroll", String(window.scrollY));
    };
  }, []);

  // First-run tour, beat 1 — arms once real songs are on screen. See
  // docs/onboarding/first-run-tour-plan.md; integration is ref + hook only.
  const catalogTourRef = useRef<HTMLDivElement>(null);
  const catalogTour = useCoachMark("tour_catalog_seen", !loading && visibleSongs.length > 0);

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream)" }}>
      {/* Signature warm radial glow — the brand's spiritual warmth, behind the catalog */}
      <div aria-hidden className="cog-glow pointer-events-none fixed inset-0 z-0" />

      {/* Swipe + entrance layer. The pinned chrome (glow above, BottomNav below)
          stays OUTSIDE this element so the 1:1 finger-drag never reparents a
          position:fixed child — otherwise the bottom nav jumps mid-swipe. */}
      <div ref={pageRef} className={`min-h-[100dvh] ${enterClass}`}>

      {/* ── DARK HEADER — matches reference image exactly ──────────────── */}
      <div
        className="sticky top-0 z-40"
        style={{
          backgroundColor: "var(--cog-charcoal)",
          boxShadow: "0 14px 34px -22px rgba(28,26,23,0.65)",
        }}
      >
        <div className="mx-auto w-full max-w-[430px] px-5 pt-14 pb-0 md:max-w-3xl lg:max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <CogBrand variant="horizontal" size="sm" theme="dark" />
            <div className="flex items-center">
              <button
                onClick={() => navigate("/memory")}
                className="flex items-center justify-center transition-all duration-150 active:scale-90"
                style={{ width: 44, height: 44, color: "rgba(255,255,255,0.50)" }}
                aria-label="Your memory"
              >
                <Sparkles size={19} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="flex items-center justify-center transition-all duration-150 active:scale-90"
                style={{ width: 44, height: 44, color: "rgba(255,255,255,0.50)" }}
                aria-label="Settings"
              >
                <Settings size={19} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <h1
            className="font-bold mb-5"
            style={{
              fontFamily: "var(--font-display)",
              color: "#FFFFFF",
              fontSize: "clamp(2rem, 1.7rem + 1.1vw, 2.75rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            }}
          >
            Your songs
          </h1>

          <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
            {(["Owned", "Invited", "Archived"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setActiveAlbumId(null);
                  setReorderingAlbum(false);
                }}
                className={`mr-6 pb-3 text-[0.9375rem] font-medium relative transition-colors duration-150 flex items-end justify-center gap-1.5 ${
                  activeTab === tab ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
                style={{ fontFamily: "var(--font-body)", minHeight: 44 }}
                aria-selected={activeTab === tab}
                aria-label={tab}
              >
                {tab}
                {!loading && tabCounts[tab] > 0 && (
                  <span
                    aria-hidden
                    className="text-[0.6875rem] font-semibold"
                    style={{ color: activeTab === tab ? "var(--cog-gold)" : "rgba(255,255,255,0.30)" }}
                  >
                    {tabCounts[tab]}
                  </span>
                )}
                {activeTab === tab && (
                  <span
                    className="absolute bottom-0 left-0 right-0 rounded-t-full"
                    style={{ height: 2, backgroundColor: "var(--cog-gold)" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── LIBRARY ────────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto w-full max-w-[430px] px-4 pt-4 pb-44 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
        <SeedIdeasShelf songs={fileableSongs} />

        {/* PV11 empty Owned state — an invitation, not controls over nothing */}
        {activeTab === "Owned" && !loading && ownedSongs.length === 0 ? (
          <EmptyLibraryHero onStart={handleCreateSong} checking={isCheckingCreate} />
        ) : (
        <>
        {/* Selection header — Apple Photos: count on the left, Select all + Done */}
        {selecting ? (
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={toggleSelectAll}
              className="text-[0.8125rem] font-semibold transition-transform duration-150 active:scale-95"
              style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)", minHeight: 44 }}
            >
              {allVisibleSelected ? "Deselect all" : "Select all"}
            </button>
            <span
              className="text-[0.9375rem] font-bold"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
              aria-live="polite"
            >
              {selectedIds.size} selected
            </span>
            <button
              onClick={exitSelect}
              className="text-[0.8125rem] font-semibold transition-transform duration-150 active:scale-95"
              style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)", minHeight: 44 }}
            >
              Done
            </button>
          </div>
        ) : reorderingAlbum ? null : (
          <LibraryControls
            query={query}
            onQueryChange={setQuery}
            sort={prefs.sort}
            onSortChange={(sort) => updatePrefs({ sort })}
            view={prefs.view}
            density={prefs.density}
            onViewCycle={cycleView}
          />
        )}

        {!selecting && continueSong && (
          <ContinueShelf
            song={continueSong}
            onOpen={() => { setNavDirection("up"); navigate(`/songs/${continueSong.id}/canvas`); }}
          />
        )}

        {/* Inside an album: the Apple Music playlist header keeps the title,
            cover and counts on screen and gives a one-tap way back. */}
        {!selecting && activeTab === "Owned" && activeAlbum ? (
          <AlbumDetailHeader
            album={activeAlbum}
            songs={ownedSongs.filter((s) => activeAlbum.songIds.includes(s.id))}
            onExit={() => {
              setActiveAlbumId(null);
              setReorderingAlbum(false);
            }}
            onEdit={() => setAlbumSheet({ open: true, album: activeAlbum })}
            onAddSongs={() => setAlbumSheet({ open: true, album: activeAlbum })}
            onPractice={() => {
              // Resolve songs in the album's own tracklist order, tagged with
              // titles so the player never re-fetches the song list.
              const byId = new Map(ownedSongs.map((s) => [s.id, s.title]));
              const songs = activeAlbum.songIds
                .filter((id) => byId.has(id))
                .map((id) => ({ id, title: byId.get(id) ?? "Untitled Song" }));
              setNavDirection("up");
              navigate(`/albums/${activeAlbum.id}/practice`, { state: { songs } });
            }}
            reordering={reorderingAlbum}
            onToggleReorder={() => setReorderingAlbum((v) => !v)}
          />
        ) : !selecting && activeTab === "Owned" && viewingUngrouped ? (
          /* Ungrouped smart group — songs not yet filed into any album */
          <div className="mb-4">
            <button
              onClick={() => setActiveAlbumId(null)}
              className="mb-2 flex items-center gap-1 transition-transform duration-150 active:scale-95"
              style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)", minHeight: 44 }}
              aria-label="Back to all songs"
            >
              <ChevronLeft size={18} strokeWidth={2.2} />
              <span className="text-[0.875rem] font-semibold">All songs</span>
            </button>
            <h2
              className="text-[1.375rem] font-bold leading-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
            >
              Ungrouped
            </h2>
            <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
              {ungroupedCount} {ungroupedCount === 1 ? "song" : "songs"} not in an album — press and
              hold a song to file it
            </p>
          </div>
        ) : (
          !selecting &&
          activeTab === "Owned" &&
          !loading &&
          ownedSongs.length > 0 && (
            <AlbumsShelf
              albums={albums}
              songs={ownedSongs}
              activeAlbumId={activeAlbumId}
              ungroupedCount={ungroupedCount}
              onSelect={setActiveAlbumId}
              onSelectUngrouped={() => setActiveAlbumId(UNGROUPED)}
              onNew={() => setAlbumSheet({ open: true, album: null })}
              onEdit={(album) => setAlbumSheet({ open: true, album })}
              onReorder={(orderedIds) => setAlbums(reorderAlbums(orderedIds))}
            />
          )
        )}

        {/* Search also reaches album names — "worship" finds the Worship EP */}
        {!selecting && !activeAlbum && activeTab === "Owned" && albumMatches.length > 0 && (
          <div className="mb-4">
            <p
              className="mb-2 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
              style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
            >
              Albums
            </p>
            <div className="flex flex-wrap gap-2">
              {albumMatches.map((album) => (
                <button
                  key={album.id}
                  onClick={() => {
                    setActiveAlbumId(album.id);
                    setQuery("");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 transition-transform duration-150 active:scale-95"
                  style={{
                    minHeight: 40,
                    backgroundColor: "var(--cog-gold-pale)",
                    color: "var(--cog-gold)",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                  }}
                  aria-label={`Open album ${album.name}, ${album.songIds.length} songs`}
                >
                  <Disc3 size={14} strokeWidth={1.9} />
                  {album.name}
                  <span style={{ color: "var(--cog-warm-gray)", fontWeight: 500 }}>
                    {album.songIds.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={catalogTourRef}>
        {reorderingAlbum && activeAlbum ? (
          <AlbumSongOrderList
            songs={visibleSongs}
            onReorder={(orderedIds) => setAlbums(updateAlbum(activeAlbum.id, { songIds: orderedIds }))}
          />
        ) : (
        <LibrarySongList
          songs={visibleSongs}
          view={prefs.view}
          density={prefs.density}
          onDensityChange={(density) => updatePrefs({ view: "grid", density })}
          sort={prefs.sort}
          query={query}
          loading={loading}
          emptyCopy={
            viewingUngrouped
              ? "Every song is filed into an album."
              : activeAlbum && activeTab === "Owned"
              ? "This album is empty. Tap “Add songs” above to fill it."
              : EMPTY_COPY[activeTab]
          }
          onOpen={(id) => { setNavDirection("up"); navigate(`/songs/${id}/canvas`); }}
          onSongActions={(song) => {
            // Organization actions are the owner's — invited songs stay tap-to-open only.
            if (song.my_role === "owner") setActionsSong(song);
          }}
          onSwipeArchive={activeAlbum ? undefined : (song) => setSongStatus(song, song.status !== "archived")}
          onSwipeRemoveFromAlbum={activeAlbum ? (song) => removeSongFromAlbum(activeAlbum.id, song) : undefined}
          pinnedIds={pinnedIds}
          monthSections={activeTab === "Archived"}
          onSearchMemory={() => navigate("/memory")}
          selecting={selecting}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
        )}
        </div>
        </>
        )}

        {catalogTour.visible && ownedSongs.length > 0 && (
          <CoachMark
            targetRef={catalogTourRef}
            lead="This is your song's room."
            body="Everything for it — lyrics, voice memos, people — lives inside. Tap to enter."
            onGotIt={catalogTour.gotIt}
            onSkip={catalogTour.skip}
          />
        )}
      </div>

      {/* "+ New song" FAB — gold pill, bottom-right so it clears the BottomNav's
          raised center capture mic (one action never sits on another). Hidden
          while batch-selecting so the selection bar owns the bottom zone. */}
      {!selecting && (
        <button
          onClick={handleCreateSong}
          disabled={isCheckingCreate}
          aria-busy={isCheckingCreate}
          className="fixed flex items-center justify-center gap-2 px-5 rounded-full font-semibold text-white bg-[var(--cog-gold)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--cog-gold-light)] active:scale-95 disabled:opacity-80"
          style={{
            bottom: 96,
            right: 16,
            minHeight: 48,
            boxShadow: "0 8px 22px -6px rgba(184,149,58,0.5)",
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
            zIndex: 450,
          }}
        >
          <Plus size={17} strokeWidth={2.5} />
          {isCheckingCreate ? "Checking..." : "New song"}
        </button>
      )}

      {selecting && (
        <SelectionBar
          count={selectedIds.size}
          archivedTab={activeTab === "Archived"}
          onAddToAlbum={() => setBatchAlbumOpen(true)}
          onArchive={() => batchSetStatus(true)}
          onRestore={() => batchSetStatus(false)}
        />
      )}

      {batchAlbumOpen && (
        <BatchAlbumSheet
          count={selectedIds.size}
          albums={albums}
          onPick={batchAddToAlbum}
          onNewAlbum={() => {
            setBatchAlbumOpen(false);
            setAlbumSheet({ open: true, album: null, initialSongIds: [...selectedIds] });
            exitSelect();
          }}
          onClose={() => setBatchAlbumOpen(false)}
        />
      )}

      </div>{/* /swipe + entrance layer */}

      <BottomNav active="songs" />

      {albumSheet.open && (
        <AlbumEditSheet
          album={albumSheet.album}
          songs={ownedSongs}
          initialSongIds={albumSheet.initialSongIds}
          onSave={handleAlbumSave}
          onDelete={handleAlbumDelete}
          onClose={() => setAlbumSheet({ open: false, album: null })}
        />
      )}

      {actionsSong && (
        <SongActionsSheet
          song={actionsSong}
          albums={albums}
          onToggleAlbum={(albumId) => toggleSongInAlbum(albumId, actionsSong.id)}
          onNewAlbum={() => {
            const songId = actionsSong.id;
            setActionsSong(null);
            setAlbumSheet({ open: true, album: null, initialSongIds: [songId] });
          }}
          onOpen={() => {
            const songId = actionsSong.id;
            setActionsSong(null);
            setNavDirection("up");
            navigate(`/songs/${songId}/canvas`);
          }}
          onQuickRoute={(surface) => {
            const songId = actionsSong.id;
            setActionsSong(null);
            setNavDirection("up");
            navigate(`/songs/${songId}/${surface}`);
          }}
          pinned={pinnedIds.has(actionsSong.id)}
          onTogglePin={() => handleTogglePin(actionsSong.id)}
          onSelectMode={() => enterSelect(actionsSong.id)}
          onArchive={() => setSongStatus(actionsSong, true)}
          onUnarchive={() => setSongStatus(actionsSong, false)}
          onClose={() => setActionsSong(null)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Name this song</DialogTitle>
            <DialogDescription>
              {activeAlbum
                ? `It'll join ${activeAlbum.name}. You can rename it any time.`
                : "You can rename it any time. Skip and we'll call it “New song”."}
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
            }}
            placeholder="e.g. Grace in the waiting"
            className="w-full rounded-xl border px-4 py-3 text-[1rem] outline-none"
            style={{ borderColor: "var(--cog-border)", color: "var(--cog-charcoal)" }}
          />
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="rounded-xl px-4 py-2 text-[0.9375rem]"
              style={{ color: "var(--cog-warm-gray)" }}
            >
              Cancel
            </button>
            <button
              onClick={submitCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[0.9375rem] font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--cog-gold)" }}
            >
              <Mic size={15} />
              {creating ? "Creating…" : "Start brainstorm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SongCatalogPage;
