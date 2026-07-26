import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const root = import.meta.dirname;

export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: resolve(root, "site/pallaw/build"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      input: resolve(root, "apps/pallaw/src/main.tsx"),
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (asset) => asset.names.some((name) => name.endsWith(".css")) ? "app.css" : "assets/[name]-[hash][extname]"
      }
    }
  }
});
