import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import BrandedSkeleton from "@/components/shell/BrandedSkeleton";

/**
 * Lightweight client-side gate. RLS is the real trust boundary; this just keeps
 * anonymous users from staring at empty screens.
 *
 * Auth state comes from the single app-wide subscription in AuthContext — this
 * component no longer opens its own onAuthStateChange (that duplicate caused the
 * anon↔authed flash) and ships no bypass flag. While auth is still resolving it
 * renders the calm shared skeleton and waits; it never guesses.
 *
 * Deep-link resume: on the anon bounce it stashes the full attempted path
 * (pathname + search, so ?layer= survives) in sessionStorage["cog:return-to"].
 * routeAfterAuth() consumes it after login — this survives the phone-OTP page
 * hop, which drops React Router's location.state. state.from is still passed for
 * any consumer that prefers it.
 */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <BrandedSkeleton />;

  if (status === "anon") {
    const returnTo = `${location.pathname}${location.search}`;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("cog:return-to", returnTo);
      } catch {
        /* storage disabled — fall back to state.from below */
      }
    }
    return <Navigate to="/auth/login" replace state={{ from: returnTo }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
