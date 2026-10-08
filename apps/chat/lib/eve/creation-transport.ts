import { eveRequest } from "./server";

/* oxlint-disable typescript/strict-boolean-expressions -- typescript/strict-boolean-expressions (#610): EveCreationTransportError intentionally keeps the existing falsy-value behavior of status; distinguishing empty, zero, and absent states requires a domain behavior decision. */
class EveCreationTransportError extends Error {
  public readonly stage: "lookup" | "dispatch";
  public readonly status?: number;
  public constructor(stage: "lookup" | "dispatch", status?: number) {
    super(
      // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      `Native creation ${stage} failed${status ? ` (HTTP ${status})` : " before receiving a response"}.`
    );
    this.name = "EveCreationTransportError";
    this.stage = stage;
    this.status = status;
  }
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve requestEveCreation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */

/**
 * Record the failing boundary without logging credentials or message bodies.
 * @param {"lookup" | "dispatch"} stage Boundary reported when the native request fails.
 * @param {Parameters<typeof eveRequest>} args Owner, native path, request options and optional model/tool header inputs forwarded unchanged.
 * @returns {Promise<Response>} Native response; transport failures throw EveCreationTransportError for the specified stage.
 */
const requestEveCreation = async (
  stage: "lookup" | "dispatch",

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original native RequestInit/fetch tuple; readonly header tuples are rejected by the native request receiver.
  ...args: Readonly<Parameters<typeof eveRequest>>
): Promise<Response> => {
  try {
    return await eveRequest(...args);
  } catch {
    throw new EveCreationTransportError(stage);
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveCreationTransportError, requestEveCreation); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */

export { EveCreationTransportError, requestEveCreation };
/* oxlint-enable import/no-named-export */
