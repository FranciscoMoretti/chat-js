import { LegacyOpenTelemetry } from "@ai-sdk/otel";

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named chatTelemetry API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): chatTelemetry remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
// Preserve the existing Langfuse span format and opt-in call coverage.
export const chatTelemetry = new LegacyOpenTelemetry();
/* oxlint-enable import/no-named-export, import/prefer-default-export */
