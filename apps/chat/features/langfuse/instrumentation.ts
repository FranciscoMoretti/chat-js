import type { InstrumentationRegistration } from "@/lib/installation-contracts";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

import { getLangfuseEnvironment } from "./langfuse-env";

export const register: InstrumentationRegistration = async ({
  appPrefix,
  runtime,
}) => {
  // Browser fixtures deliberately omit optional service credentials and exports.
  if (runtime !== "nodejs" || isPlaywrightTestEnvironment()) {
    return;
  }
  const environment = getLangfuseEnvironment();
  const [{ registerOTel }, { LangfuseExporter }] = await Promise.all([
    import("@vercel/otel"),
    import("langfuse-vercel"),
  ]);
  registerOTel({
    serviceName: appPrefix,
    traceExporter: new LangfuseExporter(environment),
  });
};
