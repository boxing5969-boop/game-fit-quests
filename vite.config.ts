import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Re-compress PNG/JPG/SVG at build time. Format is preserved so
    // existing imports keep working; browsers just download smaller
    // bytes. Character sprites typically shrink 40–60%.
    ViteImageOptimizer({
      png: { quality: 80, compressionLevel: 9 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
      webp: { quality: 80 },
      svg: {
        multipass: true,
        plugins: [
          { name: "preset-default", params: { overrides: { removeViewBox: false } } } as any,
        ],
      },
      // Skip tiny files — not worth the CPU
      includePublic: false,
      logStats: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Only split packages that are truly standalone from the React
    // runtime graph. Splitting React / Radix / hook-form / query
    // across chunks breaks Radix at runtime because @radix-ui code
    // executes before React resolves in its own chunk (observed
    // symptom: "Cannot read properties of undefined (reading
    // 'forwardRef')"). Everything React-adjacent stays in Vite's
    // default vendor chunk and ships together.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase") || id.includes("@lovable.dev")) return "supabase";
          if (id.includes("html5-qrcode") || id.includes("qrcode")) return "qr";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
        },
      },
    },
    // 64-Q: dynamic-only chunk(qr/charts) 는 modulepreload 에서 제외 →
    //   회원이 QR 체크인 / 관리자 차트 진입 전엔 다운로드 안 함.
    //   supabase / 일반 lazy route chunk 는 preload 유지 (실제 곧 필요).
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter(
          (d) => !d.includes("/qr-") && !d.includes("/charts-"),
        );
      },
    },
    // Vendor bundle will be larger without aggressive splitting, but
    // correctness > caching.
    chunkSizeWarningLimit: 1200,
  },
}));
