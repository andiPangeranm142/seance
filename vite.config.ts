import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base so the built app works on GitHub Pages project sites
// (/<repo>/) and on any other static host without rebuilding.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
});
