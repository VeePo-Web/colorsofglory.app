import type {
  AddIdeaInput,
  CanvasEdge,
  CanvasNode,
  CanvasPermissions,
  CanvasRole,
  IdeaCard,
  SongCanvasState,
} from "./canvasTypes";

const STORAGE_KEY = (songId: string) => `cog:feature04-canvas:${songId}`;

const now = () => new Date().toISOString();

export const getCanvasPermissions = (role: CanvasRole): CanvasPermissions => ({
  role,
  canCreate: role === "owner" || role === "contributor",
  canMove: role === "owner" || role === "contributor",
  canAddToFinal: role === "owner",
  canRecord: role === "owner" || role === "contributor",
});

const seedCards = (songId: string): Record<string, IdeaCard> => ({
  "card-sarah-chorus": {
    id: "card-sarah-chorus",
    songId,
    type: "voice",
    title: "Sarah Chorus Melody",
    preview: "A 0:42 voice memo with a lifted chorus melody.",
    body: "Sarah captured a chorus lift that keeps the ache in the first two notes.",
    contributorId: "sarah",
    contributorName: "Sarah",
    contributorColor: "#4F94D9",
    sourceType: "voice_memo",
    status: "shortlisted",
    createdAt: now(),
    updatedAt: now(),
  },
  "card-michael-verse": {
    id: "card-michael-verse",
    songId,
    type: "lyric",
    title: "Michael Verse Lyric",
    preview: "I waited in the quiet / You painted morning gold.",
    contributorId: "michael",
    contributorName: "Michael",
    contributorColor: "#53AB8B",
    sourceType: "manual",
    status: "raw",
    createdAt: now(),
    updatedAt: now(),
  },
  "card-kevin-piano": {
    id: "card-kevin-piano",
    songId,
    type: "chord",
    title: "Kevin Piano Memo",
    preview: "C - G - Am - F at 74 BPM. Let the bridge breathe.",
    contributorId: "kevin",
    contributorName: "Kevin",
    contributorColor: "#8070C4",
    sourceType: "voice_memo",
    status: "raw",
    createdAt: now(),
    updatedAt: now(),
  },
  "card-ava-bridge": {
    id: "card-ava-bridge",
    songId,
    type: "note",
    title: "Ava Bridge Harmony",
    preview: "Try a low harmony under the bridge before the final chorus.",
    contributorId: "ava",
    contributorName: "Ava",
    contributorColor: "#C76587",
    sourceType: "manual",
    status: "pending_review",
    createdAt: now(),
    updatedAt: now(),
  },
});

const seedNodes = (songId: string): CanvasNode[] => [
  {
    id: "root-song",
    songId,
    objectType: "root_song",
    objectId: songId,
    x: 520,
    y: 360,
    width: 180,
    height: 96,
    zone: "root",
  },
  {
    id: "node-sarah-chorus",
    songId,
    objectType: "idea_card",
    objectId: "card-sarah-chorus",
    x: 250,
    y: 220,
    width: 210,
    height: 132,
    zone: "ideas",
  },
  {
    id: "node-michael-verse",
    songId,
    objectType: "idea_card",
    objectId: "card-michael-verse",
    x: 760,
    y: 225,
    width: 210,
    height: 132,
    zone: "ideas",
  },
  {
    id: "node-kevin-piano",
    songId,
    objectType: "idea_card",
    objectId: "card-kevin-piano",
    x: 285,
    y: 540,
    width: 210,
    height: 132,
    zone: "ideas",
  },
  {
    id: "node-ava-bridge",
    songId,
    objectType: "idea_card",
    objectId: "card-ava-bridge",
    x: 735,
    y: 545,
    width: 210,
    height: 132,
    zone: "review",
  },
];

const seedEdges = (songId: string): CanvasEdge[] => [
  { id: "edge-sarah", songId, fromNodeId: "root-song", toNodeId: "node-sarah-chorus", relationType: "branch" },
  { id: "edge-michael", songId, fromNodeId: "root-song", toNodeId: "node-michael-verse", relationType: "branch" },
  { id: "edge-kevin", songId, fromNodeId: "root-song", toNodeId: "node-kevin-piano", relationType: "branch" },
  { id: "edge-ava", songId, fromNodeId: "root-song", toNodeId: "node-ava-bridge", relationType: "review" },
];

export const createInitialCanvasState = (
  songId: string,
  title: string,
  role: CanvasRole,
): SongCanvasState => {
  const stored = readStoredCanvas(songId);
  if (stored) {
    return {
      ...stored,
      song: { ...stored.song, title },
      permissions: getCanvasPermissions(role),
    };
  }

  return {
    songId,
    song: { id: songId, title, status: "active" },
    nodes: seedNodes(songId),
    edges: seedEdges(songId),
    cardsById: seedCards(songId),
    permissions: getCanvasPermissions(role),
    lastStatus: "Saved to this song.",
  };
};

export const addIdeaToCanvas = (state: SongCanvasState, input: AddIdeaInput): SongCanvasState => {
  const index = Object.keys(state.cardsById).length;
  const id = `card-${state.songId}-${Date.now()}`;
  const nodeId = `node-${id}`;
  const title = input.title.trim() || "New song idea";
  const createdAt = now();
  const card: IdeaCard = {
    id,
    songId: state.songId,
    type: input.type,
    title,
    preview: input.preview.trim() || "Saved to this song.",
    contributorId: "current-user",
    contributorName: "You",
    contributorColor: "#B8953A",
    sourceType: "manual",
    status: "raw",
    createdAt,
    updatedAt: createdAt,
  };
  const node: CanvasNode = {
    id: nodeId,
    songId: state.songId,
    objectType: "idea_card",
    objectId: id,
    x: 330 + (index % 3) * 230,
    y: 745 + Math.floor(index / 3) * 164,
    width: 210,
    height: 132,
    zone: "ideas",
  };
  const edge: CanvasEdge = {
    id: `edge-${id}`,
    songId: state.songId,
    fromNodeId: "root-song",
    toNodeId: nodeId,
    relationType: "branch",
  };

  const next = {
    ...state,
    nodes: [...state.nodes, node],
    edges: [...state.edges, edge],
    cardsById: { ...state.cardsById, [id]: card },
    lastStatus: "Saved to this song.",
  };
  persistCanvasState(next);
  return next;
};

export const moveNodeToZone = (
  state: SongCanvasState,
  nodeId: string,
  zone: CanvasNode["zone"],
): SongCanvasState => {
  const next = {
    ...state,
    nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, zone, x: node.x + 48, y: node.y + 36 } : node)),
    lastStatus: "Moved. Undo?",
  };
  persistCanvasState(next);
  return next;
};

export const persistCanvasState = (state: SongCanvasState) => {
  try {
    sessionStorage.setItem(STORAGE_KEY(state.songId), JSON.stringify(state));
  } catch {
    // Session storage is optional; Lovable will replace this with durable storage.
  }
};

const readStoredCanvas = (songId: string): SongCanvasState | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY(songId));
    return raw ? (JSON.parse(raw) as SongCanvasState) : null;
  } catch {
    return null;
  }
};
