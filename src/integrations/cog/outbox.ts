/**
 * Durable canvas write outbox.
 *
 * The songwriting room is local-first: a card appears on the board the instant
 * it is created. Before this module, a failed network write meant the idea
 * lived only in device memory and silently vanished on reload. The outbox
 * makes that impossible:
 *
 *   1. Every canvas write is stamped with a stable `client_key` and persisted
 *      to localStorage BEFORE the network call.
 *   2. The write is attempted immediately. On failure it stays queued.
 *   3. The queue is drained on an interval, on `online`, and on tab focus,
 *      with exponential backoff per entry.
 *   4. The server-side RPC is idempotent on (song_id, client_key), so a retry
 *      after an ambiguous failure can never create a duplicate card.
 *
 * UI layers can subscribe to `subscribeOutbox` to render a calm sync
 * indicator ("saving…" / "all saved" / "offline — will save").
 */
import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";
import type { CanvasCard } from "./canvas";

const STORAGE_KEY = "cog.canvas.outbox.v1";
const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 1_500;
const DRAIN_INTERVAL_MS = 5_000;

export type OutboxOp = "create_card";

export type OutboxEntry = {
  client_key: string;
  op: OutboxOp;
  song_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  next_attempt_at: number;
  last_error?: string;
  created_at: number;
};

export type OutboxStatus = {
  pending: number;
  failing: number;
  online: boolean;
  draining: boolean;
};

type Listener = (status: OutboxStatus) => void;

const listeners = new Set<Listener>();
let draining = false;
let timer: ReturnType<typeof setInterval> | null = null;

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read(): OutboxEntry[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: OutboxEntry[]): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota — the in-flight attempt still runs */
  }
  emit();
}

function isOnline(): boolean {
  return !hasWindow() || window.navigator.onLine !== false;
}

function status(): OutboxStatus {
  const entries = read();
  return {
    pending: entries.length,
    failing: entries.filter((e) => e.attempts >= 3).length,
    online: isOnline(),
    draining,
  };
}

function emit(): void {
  const s = status();
  listeners.forEach((fn) => {
    try {
      fn(s);
    } catch {
      /* a broken subscriber must never break sync */
    }
  });
}

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  fn(status());
  return () => listeners.delete(fn);
}

export function getOutboxStatus(): OutboxStatus {
  return status();
}

export function newClientKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function enqueue(entry: OutboxEntry): void {
  const entries = read();
  if (entries.some((e) => e.client_key === entry.client_key)) return;
  entries.push(entry);
  write(entries);
}

function dequeue(client_key: string): void {
  write(read().filter((e) => e.client_key !== client_key));
}

function reschedule(client_key: string, message: string): void {
  const entries = read();
  const found = entries.find((e) => e.client_key === client_key);
  if (!found) return;
  found.attempts += 1;
  found.last_error = message;
  found.next_attempt_at = Date.now() + BASE_BACKOFF_MS * 2 ** Math.min(found.attempts, 6);
  write(entries);
}

/** Non-retryable server verdicts — retrying only burns quota and confuses the writer. */
function isPermanent(message: string): boolean {
  return /forbidden|not_a_member|client_key_required|quota|not found|violates/i.test(message);
}

async function send(entry: OutboxEntry): Promise<CanvasCard> {
  const { data, error } = await (supabase as any).rpc("canvas_upsert_card_idempotent", {
    _song_id: entry.song_id,
    _client_key: entry.client_key,
    ...entry.payload,
  });
  if (error) throw toCogError(error);
  return data as CanvasCard;
}

export type QueueCardInput = {
  song_id: string;
  kind: CanvasCard["kind"];
  body: string;
  label?: string | null;
  section_kind?: string | null;
  section_label?: string | null;
  tree_kind?: "ideas" | "final";
  x?: number | null;
  y?: number | null;
  parent_card_id?: string | null;
  take_id?: string | null;
  /** Pass an existing key to make a user retry collapse onto the same card. */
  client_key?: string;
};

/**
 * Persist a card creation durably, then attempt it once.
 *
 * Resolves with the server card on success. On a transient failure it resolves
 * with `null` (the entry stays queued and will retry) rather than throwing —
 * the caller's optimistic card stays on the board, which is the whole point.
 * Permanent failures throw so the UI can explain them.
 */
export async function queueCreateCard(input: QueueCardInput): Promise<CanvasCard | null> {
  const { song_id, client_key, ...rest } = input;
  const key = client_key ?? newClientKey();
  const payload: Record<string, unknown> = {
    _kind: rest.kind,
    _body: rest.body,
    _label: rest.label ?? null,
    _section_kind: rest.section_kind ?? null,
    _section_label: rest.section_label ?? null,
    _tree_kind: rest.tree_kind ?? "ideas",
    _x: rest.x ?? null,
    _y: rest.y ?? null,
    _parent_card_id: rest.parent_card_id ?? null,
    _take_id: rest.take_id ?? null,
  };

  const entry: OutboxEntry = {
    client_key: key,
    op: "create_card",
    song_id,
    payload,
    attempts: 0,
    next_attempt_at: 0,
    created_at: Date.now(),
  };
  enqueue(entry);

  try {
    const card = await send(entry);
    dequeue(key);
    return card;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isPermanent(message)) {
      dequeue(key);
      throw err;
    }
    reschedule(key, message);
    return null;
  }
}

/** Drain everything due. Safe to call often; re-entrant calls are ignored. */
export async function flushOutbox(): Promise<number> {
  if (draining || !isOnline()) return 0;
  const due = read().filter((e) => e.next_attempt_at <= Date.now());
  if (due.length === 0) return 0;

  draining = true;
  emit();
  let sent = 0;
  try {
    for (const entry of due) {
      try {
        await send(entry);
        dequeue(entry.client_key);
        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isPermanent(message) || entry.attempts + 1 >= MAX_ATTEMPTS) {
          dequeue(entry.client_key);
        } else {
          reschedule(entry.client_key, message);
        }
      }
    }
  } finally {
    draining = false;
    emit();
  }
  return sent;
}

/** Start background draining. Idempotent; returns a teardown function. */
export function startOutbox(): () => void {
  if (!hasWindow()) return () => {};
  const kick = () => void flushOutbox();
  if (timer === null) timer = setInterval(kick, DRAIN_INTERVAL_MS);
  window.addEventListener("online", kick);
  window.addEventListener("focus", kick);
  kick();
  return () => {
    window.removeEventListener("online", kick);
    window.removeEventListener("focus", kick);
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}
