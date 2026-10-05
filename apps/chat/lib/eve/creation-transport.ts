import { eveRequest } from "./server";

/* oxlint-disable typescript/strict-boolean-expressions -- typescript/strict-boolean-expressions (#610): EveCreationTransportError intentionally keeps the existing falsy-value behavior of status; distinguishing empty, zero, and absent states requires a domain behavior decision. */
class EveCreationTransportError extends Error {
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve requestEveCreation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): requestEveCreation accepts ...args: Parameters<typeof eveRequest>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Record the failing boundary without logging credentials or message bodies.
 * @param {"lookup" | "dispatch"} stage Boundary reported when the native request fails.
 * @param {Parameters<typeof eveRequest>} args Owner, native path, request options and optional model/tool header inputs forwarded unchanged.
 * @returns {Promise<Response>} Native response; transport failures throw EveCreationTransportError for the specified stage.
 */
const requestEveCreation = async (
  stage: "lookup" | "dispatch",
  ...args: Parameters<typeof eveRequest>
): Promise<Response> => {
  try {
    return await eveRequest(...args);
  } catch {
    throw new EveCreationTransportError(stage);
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveCreationTransportError, requestEveCreation); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { EveCreationTransportError, requestEveCreation };
/* oxlint-enable import/no-named-export */
