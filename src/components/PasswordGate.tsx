import React, { useState } from "react";

interface PasswordGateProps {
  onUnlock: () => void;
}

const SITE_PASSWORD = "COLORSOFGLORYCOLORSOFGLORY";

const PasswordGate: React.FC<PasswordGateProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SITE_PASSWORD) {
      sessionStorage.setItem("site_unlocked", "true");
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--cog-cream)] flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 cog-glow" />
      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col items-center gap-6 w-full max-w-xs"
      >
        <p
          className="text-xs font-medium uppercase"
          style={{ color: "var(--cog-muted)", letterSpacing: "0.28em" }}
        >
          Colors of Glory
        </p>
        <h1
          className="text-center text-[var(--cog-charcoal)]"
          style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)", fontSize: "1.75rem", lineHeight: 1.2 }}
        >
          Private preview
        </h1>
        <label
          htmlFor="site-password"
          className="text-[var(--cog-warm-gray)] text-xs font-medium tracking-widest uppercase"
        >
          Password
        </label>
        <input
          id="site-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-11 px-4 rounded-[14px] bg-[var(--cog-cream-light)] border border-[color:var(--cog-border)] text-[var(--cog-charcoal)] placeholder:text-[var(--cog-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cog-border-gold)] text-center"
          placeholder="Enter password"
          autoFocus
          autoComplete="off"
        />
        <p className="text-xs text-[var(--cog-muted)] -mt-2">
          Hint: COG x2
        </p>
        {error && (
          <p className="text-sm" style={{ color: "#B23A3A" }}>
            Incorrect password
          </p>
        )}
        <button
          type="submit"
          className="w-full h-11 rounded-[14px] bg-[var(--cog-gold)] text-white font-semibold transition-transform active:scale-[0.97] hover:bg-[var(--cog-gold-light)]"
        >
          Enter
        </button>
      </form>
    </div>
  );
};

export default PasswordGate;