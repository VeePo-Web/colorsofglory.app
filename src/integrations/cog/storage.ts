import { supabase } from "@/integrations/supabase/client";
import type { StorageUsage } from "@/types";

// `StorageUsage` moved to the @/types barrel (A2 Step 3); re-exported for existing
// deep imports until the Step 10 codemod repoints them.
export type { StorageUsage };

export async function getStorageUsage(): Promise<StorageUsage> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const [{ data: usage }, { data: limit }] = await Promise.all([
    supabase.from("storage_usage").select("bytes_used").eq("user_id", uid).maybeSingle(),
    supabase.rpc("effective_storage_limit", { _user_id: uid }),
  ]);

  return {
    bytesUsed: Number(usage?.bytes_used ?? 0),
    bytesLimit: Number(limit ?? 0),
  };
}