import { PostHog } from "posthog-node";
import {
  ensureWakeUpCronIsConfigured,
  startWakeUpCron,
  type WakeUpCronLifecycle,
} from "./wake-up-cron";

export type AnalyticsServerMode = "development" | "production";

type AnalyticsCapture = (event: Parameters<PostHog["capture"]>[0]) => void;

console.log("runtime", process.versions.bun);

const client = new PostHog(
  Bun.env.POSTHOG_API_KEY!,
  {
    host: "https://eu.i.posthog.com",
  },
);

export type AnalyticsServerLifecycle = {
  close: () => Promise<void>;
  server: Bun.Server<undefined>;
};

const DEFAULT_PORT = 3003;
const WAKE_UP_PATH = "/internal/wake-up";
const WAKE_UP_ALLOWED_METHODS = "GET, HEAD";
const textEncoder = new TextEncoder();

function getPort() {
  const parsedPort = Number(Bun.env.PORT ?? DEFAULT_PORT);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid PORT value: ${Bun.env.PORT}`);
  }

  return parsedPort;
}

function ensureWakeUpSecretIsConfigured(mode: AnalyticsServerMode) {
  if (mode === "production" && !Bun.env.WAKE_UP_SECRET?.trim()) {
    throw new Error("WAKE_UP_SECRET must be set in production");
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/.exec(authorization);
  return match?.[1] ?? null;
}

async function sha256(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", textEncoder.encode(value)),
  );
}

function fixedTimeEqual(left: Uint8Array, right: Uint8Array) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return mismatch === 0;
}

async function isAuthorizedWakeUpRequest(request: Request) {
  const expectedSecret = Bun.env.WAKE_UP_SECRET;
  const providedSecret = getBearerToken(request);

  if (!expectedSecret || !providedSecret) {
    return false;
  }

  const [expectedDigest, providedDigest] = await Promise.all([
    sha256(expectedSecret),
    sha256(providedSecret),
  ]);

  return fixedTimeEqual(expectedDigest, providedDigest);
}

async function handleWakeUpRequest(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      headers: {
        Allow: WAKE_UP_ALLOWED_METHODS,
      },
      status: 405,
    });
  }

  if (!(await isAuthorizedWakeUpRequest(request))) {
    return new Response(null, { status: 401 });
  }

  return new Response(null, { status: 204 });
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

export async function handleAnalyticsRequest(
  request: Request,
  options: {
    capture?: AnalyticsCapture;
  } = {},
) {
  const url = new URL(request.url);

  if (url.pathname === WAKE_UP_PATH) {
    return handleWakeUpRequest(request);
  }

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

  const capture = options.capture ?? ((capturedEvent) => client.capture(capturedEvent));

  capture({
    event: "dither_booth_ticket_scanned",
    properties: {
      event,
      linkId,
    },
  });

  return Response.redirect(redirectingUrl, 302);
}

export function runAnalyticsServer(options: {
  mode: AnalyticsServerMode;
  wakeUpCron?: boolean;
}): AnalyticsServerLifecycle {
  if (options.mode === "development" && Bun.env.NODE_ENV === "production") {
    throw new Error(
      "runAnalyticsServer: development mode must not run with NODE_ENV=production",
    );
  }

  ensureWakeUpSecretIsConfigured(options.mode);

  const shouldStartWakeUpCron =
    options.wakeUpCron ?? options.mode === "production";
  let wakeUpCron: WakeUpCronLifecycle | undefined;

  if (shouldStartWakeUpCron) {
    ensureWakeUpCronIsConfigured();
  }

  const server = Bun.serve({
    port: getPort(),
    fetch: (request) => handleAnalyticsRequest(request),
  });

  if (shouldStartWakeUpCron) {
    wakeUpCron = startWakeUpCron();
  }

  console.log(
    `dither_booth_analytics server started on ${server.url.toString()}`,
  );

  let closePromise: Promise<void> | undefined;

  const close = () => {
    closePromise ??= Promise.resolve().then(() => {
      wakeUpCron?.close();
      server.stop(true);
    });

    return closePromise;
  };

  return {
    close,
    server,
  };
}
