import { expect, it } from "vitest";
import { isEveCommandRejection, rejectEveCommand } from "./command-rejection";
import { ClientError } from "eve/client";

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
