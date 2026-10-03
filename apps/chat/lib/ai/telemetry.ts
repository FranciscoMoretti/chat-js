import { LegacyOpenTelemetry } from "@ai-sdk/otel";

// Preserve the existing Langfuse span format and opt-in call coverage.
export const chatTelemetry = new LegacyOpenTelemetry();
