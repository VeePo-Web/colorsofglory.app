import { supabase } from "@/integrations/supabase/client";

export interface StorageUsage {
  bytesUsed: number;
  bytesLimit: number;
}

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