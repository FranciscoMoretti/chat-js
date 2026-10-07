import { LegacyOpenTelemetry } from "@ai-sdk/otel";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (chatTelemetry); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
// Preserve the existing Langfuse span format and opt-in call coverage.
export const chatTelemetry = new LegacyOpenTelemetry();
/* oxlint-enable import/prefer-default-export, import/no-named-export */
