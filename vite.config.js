import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { realpathSync } from "node:fs";

export default defineConfig({
  // Keep Vite's root and resolved input paths on the same physical path when
  // the project is opened through a Windows junction or desktop alias.
  root: realpathSync(process.cwd()),
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-motion": ["framer-motion"],
          "vendor-react": ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/webhook": "http://127.0.0.1:8787",
    },
  },
});
