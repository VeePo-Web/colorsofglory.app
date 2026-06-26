import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";
import { supabase } from "@/integrations/supabase/client";
import { updatePassword, AuthError } from "@/integrations/cog/auth";

const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setInvalid(false);
      }
    });

    // Hash-based recovery links typically arrive with an existing session
    // and fire PASSWORD_RECOVERY. If we don't see one within ~1.5s, treat
    // as invalid.
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) setReady(true);
    });
    timer = window.setTimeout(() => {
      if (!mounted) return;
      setReady((r) => {
        if (!r) setInvalid(true);
        return r;
      });
    }, 1500);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Focus the new-password field the moment the recovery session is confirmed —
  // the input is disabled until then, so autoFocus alone would never land.
  useEffect(() => {
    if (ready) pwRef.current?.focus();
  }, [ready]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Password too short");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      toast("Password updated");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Couldn't update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingShell>
      <div className="flex flex-1 flex-col pt-12 pb-10">
        <div className="mb-8 flex justify-center">
          <CogBrand variant="stacked" size="md" />
        </div>

        <h1
          className="text-center text-[1.75rem] leading-tight"
          style={{
            fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)",
            color: "#1C1A17",
            fontWeight: 600,
          }}
        >
          Set a new password
        </h1>
        <p
          className="mt-2 text-center text-[0.9375rem]"
          style={{ color: "#6B6459" }}
        >
          Pick something you'll remember — at least 8 characters.
        </p>

        {invalid && !ready ? (
          <div className="mt-10 flex flex-col items-center gap-4">
            <p className="text-center text-[0.9375rem]" style={{ color: "#9B2E2E" }}>
              This reset link is invalid or has expired.
            </p>
            <GoldButton onClick={() => navigate("/auth/login", { replace: true })}>
              Back to sign in
            </GoldButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
            <div
              className="flex items-center gap-3 rounded-2xl px-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
            >
              <Lock size={18} style={{ color: "#A09689" }} />
              <input
                ref={pwRef}
                type="password"
                autoComplete="new-password"
                enterKeyHint="next"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!ready}
                className="flex-1 bg-transparent text-[1rem] outline-none"
                style={{ color: "#1C1A17" }}
              />
            </div>
            <div
              className="flex items-center gap-3 rounded-2xl px-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
            >
              <Lock size={18} style={{ color: "#A09689" }} />
              <input
                type="password"
                autoComplete="new-password"
                enterKeyHint="go"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!ready}
                className="flex-1 bg-transparent text-[1rem] outline-none"
                style={{ color: "#1C1A17" }}
              />
            </div>

            {error && (
              <p role="alert" className="text-center text-[0.875rem]" style={{ color: "#9B2E2E" }}>
                {error}
              </p>
            )}

            <div className="mt-2">
              <GoldButton
                type="submit"
                disabled={!ready}
                loading={submitting}
                loadingText="Updating…"
              >
                Update password
              </GoldButton>
            </div>
          </form>
        )}
      </div>
    </OnboardingShell>
  );
};

export default ResetPasswordPage;