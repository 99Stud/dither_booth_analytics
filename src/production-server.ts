import { runAnalyticsServer } from "./server";

const analyticsServer = runAnalyticsServer({ mode: "production" });

async function shutdown() {
  try {
    await analyticsServer.close();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
