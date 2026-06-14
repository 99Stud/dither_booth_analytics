import trackingRedirectionsJson from "./tracking-redirections.json";
import type {
  TrackingPath,
  TrackingRedirect,
  TrackingRedirectionsConfig,
} from "./tracking-redirections.types.ts";

const trackingRedirectionsConfig =
  trackingRedirectionsJson satisfies TrackingRedirectionsConfig;

export const trackingRedirections = new Map<TrackingPath, TrackingRedirect>(
  Object.entries(trackingRedirectionsConfig) as Array<
    [TrackingPath, TrackingRedirect]
  >,
);

export type { TrackingPath, TrackingRedirect, TrackingRedirectionsConfig };
