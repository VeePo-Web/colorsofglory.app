import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isCurrentUserAdmin } from "@/integrations/cog/admin";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin()
      .then((ok) => !cancelled && setState(ok ? "ok" : "deny"))
      .catch(() => !cancelled && setState("deny"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cog-cream)] text-sm text-[var(--cog-warm-gray)]">
        Checking access…
      </div>
    );
  }
  if (state === "deny") return <Navigate to="/" replace />;
  return <>{children}</>;
}