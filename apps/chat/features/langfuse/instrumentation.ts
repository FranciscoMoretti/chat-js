import type { InstrumentationRegistration } from "@/lib/installation-contracts";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getLangfuseEnvironment } from "./credentials";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve register's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

export const register: InstrumentationRegistration = async ({
  appPrefix,
  runtime,
}: Readonly<{ appPrefix: string; runtime: string | undefined }>) => {
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
/* oxlint-enable oxc/no-async-await */
