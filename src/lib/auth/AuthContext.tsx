import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The single app-wide auth subscription. Every consumer (RequireAuth, role
 * hooks, headers) reads this context instead of opening its own
 * onAuthStateChange — duplicate subscriptions caused the anon↔authed flash.
 *
 * status: "loading" until the initial getSession resolves, then
 * "authed" | "anon" and kept live by the auth-state listener.
 */

export type AuthStatus = "loading" | "authed" | "anon";

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
}

const AuthContext = createContext<AuthState>({ status: "loading", user: null, session: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null, session: null });

  useEffect(() => {
    let mounted = true;

    const apply = (session: Session | null) => {
      if (!mounted) return;
      setState({
        status: session ? "authed" : "anon",
        user: session?.user ?? null,
        session,
      });
    };

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => apply(null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
