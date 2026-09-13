import { registerOTel } from "@vercel/otel";
import { LangfuseExporter } from "langfuse-vercel";

import { config } from "@/lib/config";

export async function register() {
  registerOTel({
    serviceName: config.appPrefix,
    traceExporter: new LangfuseExporter(),
  });
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLocalEveGuestCleanup } =
      await import("./lib/eve/local-guest-cleanup-scheduler");
    startLocalEveGuestCleanup();
  }
}
