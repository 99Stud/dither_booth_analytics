import { PostHog } from "posthog-node";
import { handleAnalyticsRequest } from "./server";

function createPostHogClient(env: Env) {
  return new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const posthog = createPostHogClient(env);

    const response = await handleAnalyticsRequest(request, {
      env,
      capture: (event) => {
        posthog.capture(event);
      },
    });

    ctx.waitUntil(posthog.shutdown());

    return response;
  },
} satisfies ExportedHandler<Env>;
