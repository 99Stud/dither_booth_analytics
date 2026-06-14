# dither_booth_links

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

To run the Cloudflare Worker locally:

```bash
bun run dev:worker
```

To deploy the Cloudflare Worker:

```bash
bun run deploy:worker
```

To run tests:

```bash
bun test
```

The server listens on `PORT` when set, or `3003` by default.

## Environment

- `POSTHOG_API_KEY`: required for tracking events.
- `PORT`: optional server port. Defaults to `3003`.

## Routes

`GET /track/nexus-2026/*` redirects known tracking links and records the scan in PostHog.
