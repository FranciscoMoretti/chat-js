import type { TraceCapturePolicy } from "eve/instrumentation/otel";

// EVE derives retention 0 from omitted input/output capture. Preserve EVE's
// default policy for every other principal, including registered users.
export const guestTracePolicy: TraceCapturePolicy = ({ principalType }) =>
  principalType === "guest"
    ? { emit: true, recordInputs: false, recordOutputs: false }
    : true;
