import { eveRequest } from "./server";

/* oxlint-disable import/group-exports, typescript/strict-boolean-expressions --
 * import/group-exports (#523): EveCreationTransportError stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/strict-boolean-expressions (#610): EveCreationTransportError intentionally keeps the existing falsy-value behavior of status; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export class EveCreationTransportError extends Error {
  public readonly stage: "lookup" | "dispatch";
  public readonly status?: number;
  public constructor(stage: "lookup" | "dispatch", status?: number) {
    super(
      `Native creation ${stage} failed${status ? ` (HTTP ${status})` : " before receiving a response"}.`
    );
    this.name = "EveCreationTransportError";
    this.stage = stage;
    this.status = status;
  }
}
/* oxlint-enable import/group-exports, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): requestEveCreation stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): requestEveCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): requestEveCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/prefer-readonly-parameter-types (#565): requestEveCreation accepts ...args: Parameters<typeof eveRequest>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Record the failing boundary without logging bearer tokens, signed URLs or message bodies. */
export const requestEveCreation = async (
  stage: "lookup" | "dispatch",
  ...args: Parameters<typeof eveRequest>
): Promise<Response> => {
  try {
    return await eveRequest(...args);
  } catch {
    throw new EveCreationTransportError(stage);
  }
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */
