import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const appRoot = resolve(dirname(Bun.fileURLToPath(import.meta.url)), "..");
const distDirectory = resolve(appRoot, "dist");

await rm(distDirectory, { recursive: true, force: true });

const nodeEnv = Bun.env.NODE_ENV ?? "production";

function reportBuildFailure(result: Bun.BuildOutput) {
  if (result.success) {
    return;
  }

  for (const log of result.logs) {
    console.error(log);
  }

  process.exit(1);
}

const baseBuildOptions = {
  define: {
    "process.env.NODE_ENV": JSON.stringify(nodeEnv),
  },
  minify: nodeEnv === "production",
  outdir: distDirectory,
  packages: "external",
  sourcemap: "none",
  splitting: false,
  target: "bun",
} satisfies Omit<Bun.BuildConfig, "entrypoints" | "naming">;

const serverResult = await Bun.build({
  ...baseBuildOptions,
  entrypoints: [resolve(appRoot, "src/production-entry.ts")],
  naming: {
    entry: "server.[ext]",
  },
});

reportBuildFailure(serverResult);
