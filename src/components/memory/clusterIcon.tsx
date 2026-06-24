import { BookOpen, Tag, Users } from "lucide-react";
import type { MemoryClusterType } from "@/lib/memory/memoryTypes";

/** Small semantic icon per cluster type — no decorative clutter. */
export function ClusterIcon({ type, size = 16 }: { type: MemoryClusterType; size?: number }) {
  if (type === "scripture") return <BookOpen size={size} strokeWidth={1.8} />;
  if (type === "person") return <Users size={size} strokeWidth={1.8} />;
  return <Tag size={size} strokeWidth={1.8} />;
}

export const CLUSTER_NOUN: Record<MemoryClusterType, string> = {
  theme: "Theme",
  scripture: "Scripture",
  person: "Person",
};
