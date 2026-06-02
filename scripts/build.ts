import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const appRoot = resolve(dirname(Bun.fileURLToPath(import.meta.url)), "..");
const distDirectory = resolve(appRoot, "dist");

await rm(distDirectory, { recursive: true, force: true });

const nodeEnv = Bun.env.NODE_ENV ?? "production";
const serverResult = await Bun.build({
  define: {
    "process.env.NODE_ENV": JSON.stringify(nodeEnv),
  },
  entrypoints: [resolve(appRoot, "src/production-entry.ts")],
  minify: nodeEnv === "production",
  naming: {
    entry: "server.[ext]",
  },
  outdir: distDirectory,
  packages: "external",
  sourcemap: "none",
  splitting: false,
  target: "bun",
});

if (!serverResult.success) {
  for (const log of serverResult.logs) {
    console.error(log);
  }

  process.exit(1);
}
