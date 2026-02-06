import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/adapters/nextjs.ts",
    "src/adapters/express.ts",
    "src/adapters/hono.ts",
    "src/adapters/node.ts",
    "src/adapters/fastify.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  outDir: "dist",
  external: ["next", "next/server", "express", "hono", "fastify"],
});
