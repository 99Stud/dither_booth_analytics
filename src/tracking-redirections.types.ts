export type TrackingPath = `/track/${string}/${string}`;

export type TrackingRedirect = {
  redirectingUrl: string;
  event: string;
  linkId: string;
};

export type TrackingRedirectionsConfig = Record<TrackingPath, TrackingRedirect>;
