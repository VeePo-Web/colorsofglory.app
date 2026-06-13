import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const manualChunks = (id: string) => {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("react-dom") || id.includes("react-router") || /node_modules[\\/](react)[\\/]/.test(id)) {
    return "vendor-react";
  }
  if (id.includes("@supabase")) return "vendor-supabase";
  if (id.includes("@tanstack")) return "vendor-query";
  if (id.includes("framer-motion")) return "vendor-motion";
  if (id.includes("lucide-react")) return "vendor-icons";
  if (id.includes("@radix-ui") || id.includes("vaul") || id.includes("cmdk")) return "vendor-ui";
  return "vendor";
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
