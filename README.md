# dither_booth_analytics

To install dependencies:

```bash
bun install
```

To run in development:

```bash
bun run dev
```

To build for production:

```bash
bun run build
```

To start the production build:

```bash
bun run start
```

To run tests:

```bash
bun test
```

The server listens on `PORT` when set, or `3003` by default.

## Environment

- `POSTHOG_API_KEY`: required for tracking events.
- `PORT`: optional server port. Defaults to `3003`.
- `WAKE_UP_SECRET`: required in production for the wake-up endpoint and in-process cron caller.
- `WAKE_UP_URL`: required by the in-process cron caller. Use the full URL to `/internal/wake-up`, for example `https://analytics.example.com/internal/wake-up`.

## Routes

`GET /track/nexus-2026/*` redirects known tracking links and records the scan in PostHog.

`GET /internal/wake-up` and `HEAD /internal/wake-up` return `204` when called with:

```http
Authorization: Bearer <WAKE_UP_SECRET>
```

Missing or invalid wake-up credentials return `401`. Unsupported methods return `405`.

## Wake-Up Cron

The wake-up cron runs in the same process as the production server. Build and
start the production server with `WAKE_UP_URL` and `WAKE_UP_SECRET` configured:

```bash
bun run build
bun run start
```

The scheduler starts with the server, sends an authenticated wake-up request
every 10 minutes, and stops during server shutdown. It keeps a reachable service
warm, but it does not replace process supervision for starting or restarting the
analytics server.