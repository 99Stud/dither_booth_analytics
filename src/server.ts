export type AnalyticsServerMode = "development" | "production";
import { PostHog } from 'posthog-node'

console.log("runtime", process.versions.bun);

const client = new PostHog(
  'phc_sD3J3yLLySaExFjHgrmQ8Szk6TXVJnRT2yakxHbvpEvD',
  {
      host: 'https://eu.i.posthog.com'
  }
)

export type AnalyticsServerLifecycle = {
  close: () => Promise<void>;
  server: Bun.Server<undefined>;
};

const DEFAULT_PORT = 3003;

function getPort() {
  const parsedPort = Number(Bun.env.PORT ?? DEFAULT_PORT);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid PORT value: ${Bun.env.PORT}`);
  }

  return parsedPort;
}

const trackingRedirections = new Map<`/track/${string}/${string}`, {
  redirectingUrl: string;
  event: string;
  linkId: string;
}>([
  ["/track/nexus-2026/nexus-station-instagram", { redirectingUrl: "https://www.instagram.com/nexus_station", event: "nexus-2026", linkId: "nexus-station-instagram" }],
  ["/track/nexus-2026/99stud-instagram", { redirectingUrl: "https://www.instagram.com/99stud", event: "nexus-2026", linkId: "99stud-instagram" }],
  ["/track/nexus-2026/heirvey-instagram", { redirectingUrl: "https://www.instagram.com/heirvey", event: "nexus-2026", linkId: "heirvey-instagram" }]
]);

export function runAnalyticsServer(options: {
  mode: AnalyticsServerMode;
}): AnalyticsServerLifecycle {
  if (options.mode === "development" && Bun.env.NODE_ENV === "production") {
    throw new Error(
      "runAnalyticsServer: development mode must not run with NODE_ENV=production",
    );
  }

  const server = Bun.serve({
    port: getPort(),
    fetch(request) {
      const url = new URL(request.url);

      if (!trackingRedirections.has(url.pathname as `/track/${string}/${string}`)) {
        return new Response(null, { status: 404 });
      }

      if (request.method !== "GET") {
        return new Response(null, {
          headers: {
            Allow: "GET",
          },
          status: 405,
        });
      }

      const { redirectingUrl, event, linkId } = trackingRedirections.get(url.pathname as `/track/${string}/${string}`)!;

      client.capture({
        event: 'dither_booth_ticket_scanned',
        properties: {
          event,
          linkId,
        },
    })

      return Response.redirect(redirectingUrl, 302);
    },
  });

  console.log(
    `dither_booth_analytics server started on ${server.url.toString()}`,
  );

  let closePromise: Promise<void> | undefined;

  const close = () => {
    closePromise ??= Promise.resolve().then(() => {
      server.stop(true);
    });

    return closePromise;
  };

  return {
    close,
    server,
  };
}
