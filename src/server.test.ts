import { describe, expect, test } from "bun:test";

Bun.env.POSTHOG_API_KEY ??= "test-posthog-key";

const { handleAnalyticsRequest } = await import("./server");

describe("handleAnalyticsRequest", () => {
  test("returns 404 for unknown paths", async () => {
    const response = await handleAnalyticsRequest(
      new Request("http://analytics.test/unknown"),
    );

    expect(response.status).toBe(404);
  });

  test("returns 405 for unsupported methods on tracking paths", async () => {
    const response = await handleAnalyticsRequest(
      new Request("http://analytics.test/track/nexus-2026/99stud-instagram", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });

  test("redirects known tracking links and captures the scan", async () => {
    const capturedEvents: Array<{
      event: string;
      properties: { event: string; linkId: string };
    }> = [];

    const response = await handleAnalyticsRequest(
      new Request("http://analytics.test/track/nexus-2026/99stud-instagram"),
      {
        capture: (event) => {
          capturedEvents.push(
            event as {
              event: string;
              properties: { event: string; linkId: string };
            },
          );
        },
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://www.instagram.com/99stud",
    );
    expect(capturedEvents).toEqual([
      {
        event: "dither_booth_ticket_scanned",
        properties: {
          event: "nexus-2026",
          linkId: "99stud-instagram",
        },
      },
    ]);
  });
});
