import { afterEach, describe, expect, test } from "bun:test";

Bun.env.POSTHOG_API_KEY ??= "test-posthog-key";

const { handleAnalyticsRequest, runAnalyticsServer } = await import("./server");

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

function createWakeUpRequest(options: {
  method?: string;
  secret?: string;
} = {}) {
  return new Request("http://analytics.test/internal/wake-up", {
    headers: options.secret
      ? {
          Authorization: `Bearer ${options.secret}`,
        }
      : undefined,
    method: options.method ?? "GET",
  });
}

afterEach(() => {
  restoreWakeUpEnv();
});

describe("wake-up endpoint", () => {
  test("returns 204 for a valid bearer token", async () => {
    Bun.env.WAKE_UP_SECRET = "wake-up-secret";

    const response = await handleAnalyticsRequest(
      createWakeUpRequest({ secret: "wake-up-secret" }),
    );

    expect(response.status).toBe(204);
  });

  test("allows HEAD requests with a valid bearer token", async () => {
    Bun.env.WAKE_UP_SECRET = "wake-up-secret";

    const response = await handleAnalyticsRequest(
      createWakeUpRequest({ method: "HEAD", secret: "wake-up-secret" }),
    );

    expect(response.status).toBe(204);
  });

  test("returns 401 when the bearer token is missing", async () => {
    Bun.env.WAKE_UP_SECRET = "wake-up-secret";

    const response = await handleAnalyticsRequest(createWakeUpRequest());

    expect(response.status).toBe(401);
  });

  test("returns 401 when the bearer token is invalid", async () => {
    Bun.env.WAKE_UP_SECRET = "wake-up-secret";

    const response = await handleAnalyticsRequest(
      createWakeUpRequest({ secret: "wrong-secret" }),
    );

    expect(response.status).toBe(401);
  });

  test("returns 405 for unsupported methods", async () => {
    Bun.env.WAKE_UP_SECRET = "wake-up-secret";

    const response = await handleAnalyticsRequest(
      createWakeUpRequest({ method: "POST", secret: "wake-up-secret" }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
  });

  test("returns 404 for unknown paths", async () => {
    const response = await handleAnalyticsRequest(
      new Request("http://analytics.test/unknown"),
    );

    expect(response.status).toBe(404);
  });

  test("requires WAKE_UP_SECRET before starting in production", () => {
    delete Bun.env.WAKE_UP_SECRET;

    expect(() => runAnalyticsServer({ mode: "production" })).toThrow(
      "WAKE_UP_SECRET must be set in production",
    );
  });

  test("requires WAKE_UP_URL before starting the production wake-up cron", () => {
    Bun.env.WAKE_UP_SECRET = "wake-up-secret";
    delete Bun.env.WAKE_UP_URL;

    expect(() => runAnalyticsServer({ mode: "production" })).toThrow(
      "WAKE_UP_URL must be set for the wake-up cron job",
    );
  });
});
