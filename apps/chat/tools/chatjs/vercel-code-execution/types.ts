import type { Sandbox } from "@vercel/sandbox";

import type { createModuleLogger } from "@/lib/logger";

export const supportedExecutionLanguages = ["python", "javascript"] as const;

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type SupportedExecutionLanguage =
  (typeof supportedExecutionLanguages)[number];
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export interface CodeExecutionResult {
  chart: string | { base64: string; format: string } | Record<string, unknown>;
  message: string;
}
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export interface CodeExecutionContext {
  code: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
  sandbox: Sandbox;
}
/* oxlint-enable import/group-exports */
