import { defineConfig } from "vite";
import { builtinModules } from "module";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        "@modelcontextprotocol/sdk",
        "axios",
      ],
    },
    ssr: true,
    target: "node20",
    outDir: "dist",
  },
});
