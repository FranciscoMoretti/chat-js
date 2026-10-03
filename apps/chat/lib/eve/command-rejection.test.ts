import { ClientError } from "eve/client";
import { expect, it } from "vitest";

import { isEveCommandRejection, rejectEveCommand } from "./command-rejection";

/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls  --
 * no-magic-numbers (#517): it("recognizes an explicit local refusal without treating a failed connection as reje uses 402, 502, 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("recognizes an explicit local refusal without treating a failed connection as reje sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/max-nested-calls (#568): it("recognizes an explicit local refusal without treating a failed connection as reje keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
it("recognizes an explicit local refusal without treating a failed connection as rejection", async () => {
  const response = rejectEveCommand("Insufficient credits", 402);
  const error = new ClientError(response.status, await response.text());
  expect(isEveCommandRejection(error)).toBe(true);
  expect(error.message).toBe("Insufficient credits");
  expect(
    isEveCommandRejection(
      new ClientError(402, '{"error":"Insufficient credits"}')
    )
  ).toBe(false);
  expect(
    isEveCommandRejection(
      new ClientError(502, '{"error":"Connection interrupted"}')
    )
  ).toBe(false);
  expect(
    isEveCommandRejection(
      new ClientError(
        503,
        JSON.stringify({ code: "usage_reconciliation_busy", error: "Busy" })
      )
    )
  ).toBe(true);
  expect(isEveCommandRejection(new Error("Network request failed"))).toBe(
    false
  );
});
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls */
