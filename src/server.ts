import { PostHog } from "posthog-node";
import {
  trackingRedirections,
  type TrackingPath,
} from "./tracking-redirections.ts";

export type AnalyticsServerMode = "development" | "production";

type AnalyticsCapture = (event: Parameters<PostHog["capture"]>[0]) => void;

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com" as Env["POSTHOG_HOST"];

function readBunEnv(): Env {
  return {
    POSTHOG_API_KEY: Bun.env.POSTHOG_API_KEY ?? "",
    POSTHOG_HOST: DEFAULT_POSTHOG_HOST,
  };
}

function resolveEnv(env?: Env): Env {
  return env ?? readBunEnv();
}

function createPostHogClient(env: Env) {
  return new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST,
  });
}

let defaultClient: PostHog | undefined;

function getDefaultClient(env: Env) {
  if (!env.POSTHOG_API_KEY) {
    throw new Error("POSTHOG_API_KEY must be set");
  }

  defaultClient ??= createPostHogClient(env);
  return defaultClient;
}

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

export async function handleAnalyticsRequest(
  request: Request,
  options: {
    capture?: AnalyticsCapture;
    env?: Env;
  } = {},
) {
  const env = resolveEnv(options.env);
  const url = new URL(request.url);

  if (!trackingRedirections.has(url.pathname as TrackingPath)) {
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

  const { redirectingUrl, event, linkId } = trackingRedirections.get(
    url.pathname as TrackingPath,
  )!;

  const capture =
    options.capture ??
    ((capturedEvent) => {
      getDefaultClient(env).capture(capturedEvent);
    });

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
}): AnalyticsServerLifecycle {
  if (options.mode === "development" && Bun.env.NODE_ENV === "production") {
    throw new Error(
      "runAnalyticsServer: development mode must not run with NODE_ENV=production",
    );
  }

  const env = readBunEnv();

  const server = Bun.serve({
    port: getPort(),
    fetch: (request) => handleAnalyticsRequest(request, { env }),
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
