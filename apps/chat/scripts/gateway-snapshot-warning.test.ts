import { expect, test } from "vitest";

import { formatGatewaySnapshotWarning } from "./environment-validation-report";

test("reports which gateway produced a stale generated model snapshot", () => {
  expect(formatGatewaySnapshotWarning("openai", "vercel")).toBe(
    'models.generated.ts was built for "openai" but config uses "vercel". Run `bun fetch:models` to update the fallback snapshot.'
  );
});
