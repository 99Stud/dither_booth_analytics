import {
  WAKE_UP_INTERVAL_MS,
  WAKE_UP_TIMEOUT_MS,
} from "./wake-up-cron.constants";

function getRequiredEnv(name: "WAKE_UP_SECRET" | "WAKE_UP_URL") {
  const value = Bun.env[name];

  if (!value?.trim()) {
    throw new Error(`${name} must be set for the wake-up cron job`);
  }

  return value;
}

type WakeUpFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => Promise<Response>;

export function ensureWakeUpCronIsConfigured() {
  getRequiredEnv("WAKE_UP_URL");
  getRequiredEnv("WAKE_UP_SECRET");
}

export async function sendWakeUpRequest(fetchFn: WakeUpFetch = fetch) {
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

type WakeUpCronTimer = unknown;

export type WakeUpCronLifecycle = {
  close: () => void;
};

export type WakeUpCronOptions = {
  clearIntervalFn?: (timer: WakeUpCronTimer) => void;
  fetchFn?: WakeUpFetch;
  intervalMs?: number;
  logger?: Pick<Console, "error" | "log">;
  setIntervalFn?: (
    handler: () => void,
    timeout: number,
  ) => WakeUpCronTimer;
};

export function startWakeUpCron(
  options: WakeUpCronOptions = {},
): WakeUpCronLifecycle {
  ensureWakeUpCronIsConfigured();

  const fetchFn = options.fetchFn ?? fetch;
  const logger = options.logger ?? console;
  const setIntervalFn =
    options.setIntervalFn ??
    ((handler: () => void, timeout: number) => setInterval(handler, timeout));
  const clearIntervalFn =
    options.clearIntervalFn ??
    ((timer: WakeUpCronTimer) => {
      clearInterval(timer as Parameters<typeof clearInterval>[0]);
    });
  const intervalMs = options.intervalMs ?? WAKE_UP_INTERVAL_MS;

  let isClosed = false;
  let isRunning = false;

  const run = async () => {
    if (isClosed) {
      return;
    }

    if (isRunning) {
      logger.log(
        "wake-up cron skipped because the previous run is still active",
      );
      return;
    }

    isRunning = true;

    try {
      await sendWakeUpRequest(fetchFn);
      logger.log(`wake-up cron completed at ${new Date().toISOString()}`);
    } catch (error) {
      logger.error("wake-up cron failed", error);
    } finally {
      isRunning = false;
    }
  };

  const timer = setIntervalFn(() => {
    void run();
  }, intervalMs);

  return {
    close() {
      isClosed = true;
      clearIntervalFn(timer);
    },
  };
}
