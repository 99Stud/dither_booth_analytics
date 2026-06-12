import { WAKE_UP_TIMEOUT_MS } from "./wake-up-cron.constants";

function getRequiredEnv(name: "WAKE_UP_SECRET" | "WAKE_UP_URL") {
  const value = Bun.env[name];

  if (!value?.trim()) {
    throw new Error(`${name} must be set for the wake-up cron job`);
  }

  return value;
}

export async function sendWakeUpRequest(fetchFn: typeof fetch = fetch) {
  const response = await fetchFn(getRequiredEnv("WAKE_UP_URL"), {
    headers: {
      Authorization: `Bearer ${getRequiredEnv("WAKE_UP_SECRET")}`,
      "User-Agent": "dither-booth-analytics-wake-up-cron",
    },
    method: "GET",
    signal: AbortSignal.timeout(WAKE_UP_TIMEOUT_MS),
  });

  if (response.status < 200 || response.status >= 400) {
    throw new Error(`Wake-up request failed with status ${response.status}`);
  }
}

export default {
  async scheduled(controller: Bun.CronController) {
    await sendWakeUpRequest();
    console.log(
      `wake-up cron completed for ${new Date(controller.scheduledTime).toISOString()}`,
    );
  },
};
