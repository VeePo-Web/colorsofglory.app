import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isCurrentUserAdmin } from "@/integrations/cog/admin";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin().then((ok) => {
      if (cancelled) return;
      setState(ok ? "ok" : "deny");
    });
    // Add noindex meta
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = "Admin · Colors of Glory";
    return () => {
      cancelled = true;
      meta.remove();
      document.title = prevTitle;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--cog-cream)]">
        <p className="text-sm text-[var(--cog-warm-gray)]">Checking access…</p>
      </div>
    );
  }
  if (state === "deny") return <Navigate to="/" replace />;
  return <>{children}</>;
}