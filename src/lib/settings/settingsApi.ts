import { supabase } from "@/integrations/supabase/client";

// ─── Settings API (G2) ──────────────────────────────────────────────────────
// Thin seams the settings screens need that cog/auth.ts doesn't expose yet.
// Same precedent as lib/invite/inviteApi.ts (which writes profiles directly).
// Filed with A3 in docs/SETTINGS-CONTRACT.md to fold into the data layer.

export type ProfilePatch = {
  display_name?: string;
  avatar_color?: string;
};

/** Update the signed-in user's own profile row (display name / avatar color). */
export async function updateMyProfile(patch: ProfilePatch): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to update your profile.");
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw new Error("We couldn't save that just now. Please try again.");
}

/**
 * Revoke every session for this account — this device and all others.
 * The lost/shared-device path: after this, every device must sign in again.
 */
export async function signOutEverywhere(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw new Error("We couldn't sign out everywhere. Please try again.");
}

/**
 * Permanently delete the account via the `account-delete` edge function
 * (server-side: auth user + owned songs + storage — Lovable's side of the
 * contract). The caller confirms carefully before ever reaching this.
 */
export async function requestAccountDeletion(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("account-delete", { body: {} });
  if (error) {
    throw new Error(
      "We couldn't complete the deletion just now. Nothing was removed — please try again or contact support.",
    );
  }
  const err = (data as { error?: string } | null)?.error;
  if (err) {
    throw new Error(
      "We couldn't complete the deletion just now. Nothing was removed — please try again or contact support.",
    );
  }
  // Best-effort local sign-out; the server has already revoked the account.
  await supabase.auth.signOut().catch(() => {});
}
