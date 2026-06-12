import { dirname, resolve } from "node:path";
import {
  WAKE_UP_CRON_SCHEDULE,
  WAKE_UP_CRON_TITLE,
} from "../src/wake-up-cron.constants";

const appRoot = resolve(dirname(Bun.fileURLToPath(import.meta.url)), "..");
const cronEntrypoint = resolve(appRoot, "dist/wake-up-cron.js");

function requireEnv(name: "WAKE_UP_SECRET" | "WAKE_UP_URL") {
  if (!Bun.env[name]?.trim()) {
    throw new Error(`${name} must be set before installing the wake-up cron`);
  }
}

requireEnv("WAKE_UP_URL");
requireEnv("WAKE_UP_SECRET");

if (!(await Bun.file(cronEntrypoint).exists())) {
  throw new Error(`Build the project before installing the cron: ${cronEntrypoint}`);
}

await Bun.cron(cronEntrypoint, WAKE_UP_CRON_SCHEDULE, WAKE_UP_CRON_TITLE);

const nextRun = Bun.cron.parse(WAKE_UP_CRON_SCHEDULE);
console.log(
  `Installed ${WAKE_UP_CRON_TITLE} (${WAKE_UP_CRON_SCHEDULE}) for ${cronEntrypoint}.`,
);

if (nextRun) {
  console.log(`Next UTC run according to Bun's parser: ${nextRun.toISOString()}`);
}
