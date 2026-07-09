import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import BackHeader from "@/components/cog/BackHeader";
import BottomNav from "@/components/cog/BottomNav";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import ConfirmSheet from "@/components/settings/ConfirmSheet";
import { updatePassword, AuthError } from "@/integrations/cog/auth";
import { requestAccountDeletion, signOutEverywhere } from "@/lib/settings/settingsApi";

const inputStyle: React.CSSProperties = {
  height: 52,
  backgroundColor: "rgba(255,255,255,0.7)",
  border: "1.5px solid var(--cog-border)",
  color: "var(--cog-charcoal)",
  fontFamily: "var(--font-body)",
};

/**
 * Privacy & Security (G2 Step 4) — change password, sign out everywhere,
 * and the one destructive action in the app: delete account, behind a
 * type-to-confirm, focus-trapped sheet. Reassuring and honest throughout.
 */
const PrivacyPage = () => {
  const navigate = useNavigate();

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sign out everywhere
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordNotice(null);
    if (newPassword.length < 8) {
      setPasswordError("Pick a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Those passwords don't match.");
      return;
    }
    setIsSavingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("Password updated. You stay signed in here.");
    } catch (err) {
      setPasswordError(
        err instanceof AuthError ? err.message : "We couldn't update the password. Please try again.",
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await signOutEverywhere();
      navigate("/auth/login", { replace: true });
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : "We couldn't sign out everywhere. Please try again.");
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await requestAccountDeletion();
      navigate("/auth/login", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "We couldn't complete the deletion. Nothing was removed.");
      setIsDeleting(false);
    }
  };

  const deleteArmed = deletePhrase.trim().toUpperCase() === "DELETE";

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
          Privacy &amp; Security
        </h1>
        <p className="mb-8 text-base leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
          Your songs are private rooms. These controls keep the keys in your hands.
        </p>

        {/* Change password */}
        <section
          className="mb-4 rounded-2xl p-5"
          style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
        >
          <div className="mb-4 flex items-start gap-3">
            <KeyRound size={20} strokeWidth={1.7} style={{ color: "var(--cog-gold)", flexShrink: 0 }} />
            <div>
              <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
                Change password
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
                At least 8 characters. You'll stay signed in on this device.
              </p>
            </div>
          </div>

          {passwordError && (
            <p role="alert" className="mb-3 text-sm" style={{ color: "#E05440" }}>{passwordError}</p>
          )}
          {passwordNotice && (
            <p role="status" className="mb-3 text-sm" style={{ color: "#3E8F71" }}>{passwordNotice}</p>
          )}

          <label htmlFor="new-password" className="sr-only">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="New password"
            className="mb-3 w-full rounded-xl px-4 text-base outline-none"
            style={inputStyle}
          />
          <label htmlFor="confirm-password" className="sr-only">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Confirm new password"
            className="mb-4 w-full rounded-xl px-4 text-base outline-none"
            style={inputStyle}
          />
          <GoldButton
            onClick={handleChangePassword}
            disabled={!newPassword || !confirmPassword}
            loading={isSavingPassword}
            loadingText="Updating..."
          >
            Update password
          </GoldButton>
        </section>

        {/* Sign out everywhere */}
        <section
          className="mb-4 rounded-2xl p-5"
          style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
        >
          <div className="mb-4 flex items-start gap-3">
            <LogOut size={20} strokeWidth={1.7} style={{ color: "var(--cog-gold)", flexShrink: 0 }} />
            <div>
              <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
                Sign out everywhere
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
                Lost a device, or signed in somewhere shared? This signs you out
                of every device — including this one.
              </p>
            </div>
          </div>
          {signOutError && (
            <p role="alert" className="mb-3 text-sm" style={{ color: "#E05440" }}>{signOutError}</p>
          )}
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full rounded-full text-sm font-semibold transition-all active:scale-[0.97]"
            style={{
              minHeight: 48,
              color: "var(--cog-charcoal)",
              backgroundColor: "transparent",
              border: "1.5px solid var(--cog-border)",
            }}
          >
            Sign out of all devices
          </button>
        </section>

        {/* Delete account */}
        <section
          className="mb-6 rounded-2xl p-5"
          style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid rgba(180,60,60,0.25)" }}
        >
          <div className="mb-4 flex items-start gap-3">
            <ShieldAlert size={20} strokeWidth={1.7} style={{ color: "#B43C3C", flexShrink: 0 }} />
            <div>
              <h2 className="mb-1 text-sm font-semibold" style={{ color: "#B43C3C" }}>
                Delete account
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
                Permanently deletes your account, your songs, and everything in
                them. This can't be undone, so we'll ask you to confirm carefully.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setDeletePhrase(""); setDeleteError(null); setShowDeleteConfirm(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all active:scale-[0.97]"
            style={{
              minHeight: 48,
              color: "#B43C3C",
              backgroundColor: "rgba(180,60,60,0.06)",
              border: "1.5px solid rgba(180,60,60,0.25)",
            }}
          >
            <Trash2 size={16} strokeWidth={1.8} />
            Delete my account
          </button>
        </section>

        {/* Policy links */}
        <p className="text-center text-sm" style={{ color: "var(--cog-warm-gray)" }}>
          <Link to="/terms" className="underline underline-offset-2">Terms of Service</Link>
          <span className="mx-2" aria-hidden="true">·</span>
          <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
        </p>
      </main>

      {showSignOutConfirm && (
        <ConfirmSheet ariaLabel="Sign out of all devices" onClose={() => !isSigningOut && setShowSignOutConfirm(false)}>
          <h2
            className="mb-2 text-center text-xl font-bold"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
          >
            Sign out everywhere?
          </h2>
          <p className="mb-5 text-center text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
            Every device gets signed out, including this one. Your songs stay
            exactly as they are — you'll just sign in again.
          </p>
          <div className="grid gap-2.5">
            <GoldButton onClick={handleSignOutEverywhere} loading={isSigningOut} loadingText="Signing out...">
              Sign out everywhere
            </GoldButton>
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(false)}
              disabled={isSigningOut}
              className="rounded-full text-sm font-semibold"
              style={{ minHeight: 44, color: "var(--cog-warm-gray)", border: "1.5px solid var(--cog-border)" }}
            >
              Not now
            </button>
          </div>
        </ConfirmSheet>
      )}

      {showDeleteConfirm && (
        <ConfirmSheet ariaLabel="Delete account" onClose={() => !isDeleting && setShowDeleteConfirm(false)}>
          <h2
            className="mb-2 text-center text-xl font-bold"
            style={{ color: "#B43C3C", fontFamily: "var(--font-display)" }}
          >
            Delete your account?
          </h2>
          <p className="mb-4 text-center text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
            This permanently deletes your account and your songs — lyrics, voice
            memos, versions, and credits. Collaborators lose access too. There is
            no undo.
          </p>
          <label
            htmlFor="delete-phrase"
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            Type DELETE to confirm
          </label>
          <input
            id="delete-phrase"
            type="text"
            value={deletePhrase}
            onChange={(e) => setDeletePhrase(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="DELETE"
            className="mb-3 w-full rounded-xl px-4 text-base outline-none"
            style={inputStyle}
          />
          {deleteError && (
            <p role="alert" className="mb-3 text-sm" style={{ color: "#E05440" }}>{deleteError}</p>
          )}
          <div className="grid gap-2.5">
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={!deleteArmed || isDeleting}
              className="rounded-full text-base font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ minHeight: 54, backgroundColor: "#B43C3C" }}
            >
              {isDeleting ? "Deleting..." : "Permanently delete my account"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="rounded-full text-sm font-semibold"
              style={{ minHeight: 44, color: "var(--cog-warm-gray)", border: "1.5px solid var(--cog-border)" }}
            >
              Keep my account
            </button>
          </div>
        </ConfirmSheet>
      )}

      <BottomNav active="settings" />
    </div>
  );
};

export default PrivacyPage;
