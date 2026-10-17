import { createHash } from "node:crypto";

const OPERATION_DIGEST_LENGTH = 32;

/** Adapts eve 0.80.1's internal create-token format for positive-only lookup. */
export const eveCreateOperationToken = (
  auth: {
    readonly authenticator: string;
    readonly issuer?: string;
    readonly principalType: string;
    readonly principalId: string;
  },
  operationId: string,
  seed: boolean
): string =>
  `eve:op:${createHash("sha256")
    .update(
      JSON.stringify([
        seed ? "eve:seed-session:v1" : "eve:create-session:v1",
        auth.authenticator,
        auth.issuer ?? null,
        auth.principalType,
        auth.principalId,
        operationId,
      ])
    )
    .digest("hex")
    .slice(0, OPERATION_DIGEST_LENGTH)}`;
