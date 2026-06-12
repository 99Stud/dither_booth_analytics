import { afterEach, describe, expect, test } from "bun:test";
import {
  sendWakeUpRequest,
  startWakeUpCron,
} from "./wake-up-cron";
import { WAKE_UP_INTERVAL_MS } from "./wake-up-cron.constants";

const originalWakeUpSecret = Bun.env.WAKE_UP_SECRET;
const originalWakeUpUrl = Bun.env.WAKE_UP_URL;

function restoreWakeUpEnv() {
  if (originalWakeUpSecret === undefined) {
    delete Bun.env.WAKE_UP_SECRET;
  } else {
    Bun.env.WAKE_UP_SECRET = originalWakeUpSecret;
  }

  if (originalWakeUpUrl === undefined) {
    delete Bun.env.WAKE_UP_URL;
  } else {
    Bun.env.WAKE_UP_URL = originalWakeUpUrl;
  }
}

function configureWakeUpEnv() {
  Bun.env.WAKE_UP_SECRET = "wake-up-secret";
  Bun.env.WAKE_UP_URL = "https://analytics.test/internal/wake-up";
}

afterEach(() => {
  restoreWakeUpEnv();
});

describe("sendWakeUpRequest", () => {
  test("sends an authenticated wake-up request", async () => {
    configureWakeUpEnv();

    const fetchFn = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const headers = new Headers(init?.headers);

      expect(input).toBe("https://analytics.test/internal/wake-up");
      expect(init?.method).toBe("GET");
      expect(headers.get("Authorization")).toBe("Bearer wake-up-secret");
      expect(headers.get("User-Agent")).toBe(
        "dither-booth-analytics-wake-up-cron",
      );

      return new Response(null, { status: 204 });
    };

    await sendWakeUpRequest(fetchFn);
  });

  test("rejects failed wake-up responses", async () => {
    configureWakeUpEnv();

    const fetchFn = async () => new Response(null, { status: 500 });

    await expect(sendWakeUpRequest(fetchFn)).rejects.toThrow(
      "Wake-up request failed with status 500",
    );
  });
});

describe("startWakeUpCron", () => {
  test("schedules recurring wake-ups and stops future runs on close", () => {
    configureWakeUpEnv();

    const timer = {} as ReturnType<typeof setInterval>;
    let scheduledHandler: (() => void) | undefined;
    let scheduledInterval: number | undefined;
    let clearedTimer: unknown;
    let requests = 0;

    const lifecycle = startWakeUpCron({
      clearIntervalFn(timerToClear) {
        clearedTimer = timerToClear;
      },
      fetchFn: async () => {
        requests += 1;
        return new Response(null, { status: 204 });
      },
      logger: {
        error() {},
        log() {},
      },
      setIntervalFn(handler, timeout) {
        scheduledHandler = handler;
        scheduledInterval = timeout;
        return timer;
      },
    });

    expect(typeof scheduledHandler).toBe("function");
    expect(scheduledInterval).toBe(WAKE_UP_INTERVAL_MS);

    scheduledHandler?.();
    expect(requests).toBe(1);

    lifecycle.close();
    expect(clearedTimer).toBe(timer);

    scheduledHandler?.();
    expect(requests).toBe(1);
  });

  test("skips a run while the previous wake-up request is active", () => {
    configureWakeUpEnv();

    const timer = {} as ReturnType<typeof setInterval>;
    let scheduledHandler: (() => void) | undefined;
    let resolveFetch: (() => void) | undefined;
    let requests = 0;

    const lifecycle = startWakeUpCron({
      clearIntervalFn() {},
      fetchFn: async () => {
        requests += 1;
        await new Promise<void>((resolve) => {
          resolveFetch = resolve;
        });
        return new Response(null, { status: 204 });
      },
      logger: {
        error() {},
        log() {},
      },
      setIntervalFn(handler) {
        scheduledHandler = handler;
        return timer;
      },
    });

    scheduledHandler?.();
    scheduledHandler?.();

    expect(requests).toBe(1);

    lifecycle.close();
    resolveFetch?.();
  });
});
