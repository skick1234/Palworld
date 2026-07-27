import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const root = import.meta.dirname;

export default defineConfig(({ mode }) => ({
  plugins: [solid({ hot: mode !== "test" })],
  build: {
    outDir: resolve(root, "site/build"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      input: {
        landing: resolve(root, "apps/landing/src/main.tsx"),
        legal: resolve(root, "apps/legal/src/main.tsx"),
        pallaw: resolve(root, "apps/pallaw/src/main.tsx"),
        palops: resolve(root, "apps/palops/src/main.tsx")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (asset) => asset.names.some((name) => name.endsWith(".css")) ? "pallaw.css" : "assets/[name]-[hash][extname]"
      }
    }
  }
}));
