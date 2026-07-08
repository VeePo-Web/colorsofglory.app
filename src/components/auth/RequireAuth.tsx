import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";

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
 * Lightweight client-side gate. RLS is the real trust boundary; this just
 * keeps anonymous users from staring at empty screens.
 *
 * Auth state comes from the single app-wide subscription in AuthContext — this
 * component no longer opens its own onAuthStateChange (that duplicate caused the
 * anon↔authed flash) and no longer ships a bypass flag. While auth is still
 * resolving it renders the calm skeleton and waits; it never guesses.
 */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Fallback />;
  if (status === "anon") {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
};

export default RequireAuth;
