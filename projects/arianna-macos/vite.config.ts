import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  esbuild: {
    target: "esnext",
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "esnext",
    minify: false,
    sourcemap: true,
  },
});