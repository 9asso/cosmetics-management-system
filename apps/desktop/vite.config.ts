import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH ?? "/",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Demo images are shared with the store, just as they are under one origin in production.
    proxy: { '/products/catalog': 'http://127.0.0.1:3000' },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/recharts/') || id.includes('/victory-vendor/') || id.includes('/d3-')) return 'charts';
        },
      },
    },
  },
});
