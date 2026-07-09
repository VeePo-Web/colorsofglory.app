import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";
import BackHeader from "@/components/cog/BackHeader";
import BottomNav from "@/components/cog/BottomNav";
import CogBrand from "@/components/cog/CogBrand";
import SettingsToggle from "@/components/settings/SettingsToggle";
import {
  getNotificationPrefs,
  listMySongs,
  upsertNotificationPrefs,
  type SongCard,
} from "@/integrations/cog/songs";

type PrefKey = "notify_on_join" | "notify_on_contribution" | "push_enabled";

type SongPrefs = Record<PrefKey, boolean>;

// No stored row means the calm default: told about people, not pinged for
// every edit; push stays off until the user turns it on.
const DEFAULT_PREFS: SongPrefs = {
  notify_on_join: true,
  notify_on_contribution: true,
  push_enabled: false,
};

const TOGGLES: Array<{ key: PrefKey; label: string; description: string }> = [
  { key: "notify_on_join", label: "Someone joins", description: "When a collaborator accepts an invite to this song." },
  { key: "notify_on_contribution", label: "New contributions", description: "When a collaborator adds lyrics, a memo, or an idea." },
  { key: "push_enabled", label: "Push notifications", description: "Deliver these to your device, not just the activity feed." },
];

type LoadState = "loading" | "ready" | "error";

/**
 * Notifications (G2 Step 3) — quiet, honest control over what each song is
 * allowed to tell you. Prefs are per-song (song_notification_prefs); toggles
 * write optimistically and revert on failure.
 */
const NotificationsPage = () => {
  const [state, setState] = useState<LoadState>("loading");
  const [songs, setSongs] = useState<SongCard[]>([]);
  const [prefs, setPrefs] = useState<Record<string, SongPrefs>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mySongs = await listMySongs();
        const loaded = await Promise.all(
          mySongs.map(async (song) => {
            try {
              const row = await getNotificationPrefs(song.id);
              return [song.id, row ? {
                notify_on_join: row.notify_on_join,
                notify_on_contribution: row.notify_on_contribution,
                push_enabled: row.push_enabled,
              } : DEFAULT_PREFS] as const;
            } catch {
              return [song.id, DEFAULT_PREFS] as const;
            }
          }),
        );
        if (!mounted) return;
        setSongs(mySongs);
        setPrefs(Object.fromEntries(loaded));
        setState("ready");
      } catch {
        if (!mounted) return;
        setState("error");
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleToggle = async (songId: string, key: PrefKey, next: boolean) => {
    const prior = prefs[songId] ?? DEFAULT_PREFS;
    setPrefs((current) => ({ ...current, [songId]: { ...prior, [key]: next } }));
    setError(null);
    try {
      await upsertNotificationPrefs(songId, { [key]: next });
    } catch {
      // Revert — the switch never lies about what's saved.
      setPrefs((current) => ({ ...current, [songId]: prior }));
      setError("That change didn't save. Please try again.");
    }
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream)" }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 48% at 50% 86%, rgba(184,149,58,0.13) 0%, transparent 64%)",
        }}
      />

      <BackHeader label="Settings" to="/settings" />

      <main
        className="relative mx-auto flex w-full flex-col px-6 pb-36 pt-2"
        style={{ maxWidth: "var(--max-w-app)" }}
      >
        <div className="mb-6 flex justify-center">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="mb-2 text-3xl font-semibold"
          style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.1 }}
        >
          Notifications
        </h1>
        <p className="mb-8 text-base leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
          Choose what each song is allowed to tell you. Everything still lands
          calmly in the song's activity feed.
        </p>

        {error && (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: "rgba(224,84,64,0.08)", color: "#E05440", border: "1px solid rgba(224,84,64,0.20)" }}
            role="alert"
          >
            {error}
          </div>
        )}

        {state === "loading" && (
          <div className="space-y-4" aria-label="Loading notification settings">
            <div className="rounded-2xl" style={{ height: 150, backgroundColor: "rgba(28,26,23,0.05)" }} />
            <div className="rounded-2xl" style={{ height: 150, backgroundColor: "rgba(28,26,23,0.05)" }} />
          </div>
        )}

        {state === "error" && (
          <div
            className="rounded-2xl p-5 text-center"
            style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
          >
            <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
              We couldn't load your notification settings just now. Pull back and
              try again in a moment — nothing has changed.
            </p>
          </div>
        )}

        {state === "ready" && songs.length === 0 && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
          >
            <Music2 size={22} strokeWidth={1.6} className="mx-auto mb-3" style={{ color: "var(--cog-gold)" }} />
            <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
              When you have a song, you'll choose here what it can tell you.
            </p>
          </div>
        )}

        {state === "ready" && songs.map((song) => {
          const songPrefs = prefs[song.id] ?? DEFAULT_PREFS;
          return (
            <section
              key={song.id}
              className="mb-4 rounded-2xl px-5 py-4"
              style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
              aria-label={`Notifications for ${song.title}`}
            >
              <div className="mb-1 flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="inline-block rounded-full flex-shrink-0"
                  style={{ width: 10, height: 10, backgroundColor: song.cover_color ?? "var(--cog-gold)" }}
                />
                <h2
                  className="truncate text-lg font-semibold"
                  style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                >
                  {song.title}
                </h2>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--cog-border)" }}>
                {TOGGLES.map((toggle) => (
                  <SettingsToggle
                    key={toggle.key}
                    label={toggle.label}
                    description={toggle.description}
                    checked={songPrefs[toggle.key]}
                    onChange={(next) => { void handleToggle(song.id, toggle.key, next); }}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <BottomNav active="settings" />
    </div>
  );
};

export default NotificationsPage;
