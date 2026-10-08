import type { InstrumentationRegistration } from "@/lib/installation-contracts";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

import { getLangfuseEnvironment } from "./credentials";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (register); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve register's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
