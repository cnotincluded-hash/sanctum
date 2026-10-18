import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The website lives at https://cnotincluded-hash.github.io/sanctum/, so its files
// are served from /sanctum/. The desktop app serves them from its own root, so
// `npm run build:desktop` (used by the installer build) builds with "/" instead.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "desktop" ? "/" : "/sanctum/",
  // Keep the desktop dev window on a fixed address and Tauri's output on screen.
  clearScreen: false,
  server: { port: 5173, strictPort: true },
}));
