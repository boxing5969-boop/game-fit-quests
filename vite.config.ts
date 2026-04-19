import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Split node_modules into stable vendor chunks so app-code redeploys
    // don't invalidate the (large) framework cache on returning users.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("@supabase") || id.includes("@lovable.dev")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("react-router")) return "react-router";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("html5-qrcode") || id.includes("qrcode")) return "qr";
          if (id.includes("embla-carousel")) return "carousel";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("/zod/")) return "forms";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler/") ||
            id.includes("react/jsx-runtime")
          ) return "react-core";
          return "vendor";
        },
      },
    },
    // 2 MB is fine once vendors are split — keep the warning honest.
    chunkSizeWarningLimit: 700,
  },
}));
