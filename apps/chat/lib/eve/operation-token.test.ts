import { expect, it } from "vitest";
// Deliberately check the installed candidate's internal implementation: this is not a public API.
import { deriveOperationContinuationToken } from "../../node_modules/eve/dist/src/eve-channel/request.js";
import { eveCreateOperationToken } from "./operation-token";

it.each([false, true])(
  "matches the installed candidate token contract (seed=%s)",
  async (seed) => {
    const auth = {
      authenticator: "chatjs-gateway",
      issuer: "chatjs",
      principalType: "user",
      principalId: "owner",
      attributes: {},
    };
    expect(eveCreateOperationToken(auth, "operation", seed)).toBe(
      await deriveOperationContinuationToken({
        auth,
        operationId: "operation",
        ...(seed ? { kind: "seed" } : {}),
      })
    );
    expect(
      eveCreateOperationToken(
        { ...auth, principalId: "foreign" },
        "operation",
        seed
      )
    ).not.toBe(eveCreateOperationToken(auth, "operation", seed));
  }
);
