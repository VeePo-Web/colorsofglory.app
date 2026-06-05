import type { CanvasEdge, CanvasNode } from "@/lib/canvas/canvasTypes";

interface CanvasConnectionLayerProps {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
}

const centerOf = (node: CanvasNode) => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

const CanvasConnectionLayer = ({ edges, nodes }: CanvasConnectionLayerProps) => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0"
      width="1200"
      height="1100"
      viewBox="0 0 1200 1100"
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      {edges.map((edge) => {
        const from = nodesById.get(edge.fromNodeId);
        const to = nodesById.get(edge.toNodeId);
        if (!from || !to) return null;
        const start = centerOf(from);
        const end = centerOf(to);
        const midY = (start.y + end.y) / 2;
        const path = `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;

        return (
          <path
            key={edge.id}
            d={path}
            fill="none"
            stroke={edge.relationType === "review" ? "rgba(184,149,58,0.35)" : "rgba(28,26,23,0.16)"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

export default CanvasConnectionLayer;
