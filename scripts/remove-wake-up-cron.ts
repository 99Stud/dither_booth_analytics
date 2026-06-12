import { WAKE_UP_CRON_TITLE } from "../src/wake-up-cron.constants";

await Bun.cron.remove(WAKE_UP_CRON_TITLE);

console.log(`Removed ${WAKE_UP_CRON_TITLE} if it was installed.`);
