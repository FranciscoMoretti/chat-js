import type { InstrumentationRegistration } from "@/lib/installation-contracts";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { getLangfuseEnvironment } from "./credentials";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
