import { expect, it } from "vitest";
import { isEveCommandRejection, rejectEveCommand } from "./command-rejection";
import { ClientError } from "eve/client";

/* oxlint-disable oxc/no-async-await -- Await the Response body before constructing the native ClientError used by rejection classification. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("recognizes an explicit local refusal without treating a failed connection as reje uses 402, 502, 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
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
  const busyError = new ClientError(
    503,
    JSON.stringify({ code: "usage_reconciliation_busy", error: "Busy" })
  );
  expect(isEveCommandRejection(busyError)).toBe(true);
  expect(isEveCommandRejection(new Error("Network request failed"))).toBe(
    false
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
