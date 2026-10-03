import type { Sandbox } from "@vercel/sandbox";

import type { createModuleLogger } from "@/lib/logger";

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const supportedExecutionLanguages = ["python", "javascript"] as const;
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type SupportedExecutionLanguage =
  (typeof supportedExecutionLanguages)[number];
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export interface CodeExecutionResult {
  chart: string | { base64: string; format: string } | Record<string, unknown>;
  message: string;
}
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export interface CodeExecutionContext {
  code: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
  sandbox: Sandbox;
}
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
