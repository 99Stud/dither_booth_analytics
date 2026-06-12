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
- `WAKE_UP_SECRET`: required in production for the wake-up endpoint and cron caller.
- `WAKE_UP_URL`: required by the cron caller. Use the full URL to `/internal/wake-up`, for example `https://analytics.example.com/internal/wake-up`.

## Routes

`GET /track/nexus-2026/*` redirects known tracking links and records the scan in PostHog.

`GET /internal/wake-up` and `HEAD /internal/wake-up` return `204` when called with:

```http
Authorization: Bearer <WAKE_UP_SECRET>
```

Missing or invalid wake-up credentials return `401`. Unsupported methods return `405`.

## Wake-Up Cron

Build the production artifacts before installing the host-level cron job:

```bash
bun run build
```

Then make sure `WAKE_UP_URL` and `WAKE_UP_SECRET` are available to the scheduled job and register it:

```bash
bun run wake:install
```

This installs Bun's OS-level cron job named `dither-booth-analytics-wake-up` on the schedule `*/10 * * * *`. Re-running the command replaces the existing job with the same title instead of duplicating it.

To remove the job:

```bash
bun run wake:remove
```

The cron job sends an authenticated wake-up request every 10 minutes. It keeps a reachable service warm, but it does not replace process supervision for starting or restarting the analytics server.