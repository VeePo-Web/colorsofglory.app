import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "authed" | "anon";

const Fallback = () => (
  <div className="relative min-h-screen" style={{ backgroundColor: "#FAFAF6" }}>
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        background:
          "radial-gradient(ellipse 55% 40% at 50% 90%, rgba(184,149,58,0.14) 0%, transparent 70%)",
      }}
    />
    <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-8">
      <p
        className="mb-6 text-center text-xs font-medium uppercase"
        style={{ color: "#A09689", letterSpacing: "0.24em" }}
      >
        Colors of Glory
      </p>
      <div className="space-y-3" aria-label="Loading">
        <div className="h-5 w-32 rounded-full" style={{ backgroundColor: "rgba(184,149,58,0.12)" }} />
        <div className="h-12 rounded-2xl" style={{ backgroundColor: "#FAF7F2" }} />
        <div className="h-12 rounded-2xl" style={{ backgroundColor: "#FAF7F2" }} />
      </div>
    </div>
  </div>
);

/**
 * TEMP — AUTH WALL DISABLED FOR PREVIEW TESTING.
 * The PasswordGate still protects the preview; this lets us walk the full
 * songwriting golden path on mobile without a seeded account. RLS remains the
 * real trust boundary on the backend.
 * 🔒 RE-ENABLE BEFORE LAUNCH: set BYPASS_AUTH = false.
 */
const BYPASS_AUTH = true;

/**
 * Lightweight client-side gate. RLS is the real trust boundary; this just
 * keeps anonymous users from staring at empty screens.
 */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<Status>(BYPASS_AUTH ? "authed" : "loading");
  const location = useLocation();

  useEffect(() => {
    if (BYPASS_AUTH) return;
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setStatus(session?.user ? "authed" : "anon");
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setStatus(data.session?.user ? "authed" : "anon");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") return <Fallback />;
  if (status === "anon") {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
};

export default RequireAuth;