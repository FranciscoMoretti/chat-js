import { eveRequest } from "./server";

const HTTP_STATUS_ABSENT = 0;

class EveCreationTransportError extends Error {
  public readonly stage: "lookup" | "dispatch";
  public readonly status?: number;
  public constructor(stage: "lookup" | "dispatch", status?: number) {
    super(
      // oxlint-disable-next-line no-ternary -- Native status is optional; zero, NaN and absence retain the same error wording.
      `Native creation ${stage} failed${typeof status === "number" && status !== HTTP_STATUS_ABSENT && !Number.isNaN(status) ? ` (HTTP ${status})` : " before receiving a response"}.`
    );
    this.name = "EveCreationTransportError";
    this.stage = stage;
    this.status = status;
  }
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve requestEveCreation's awaited sequencing and rejected-Promise behavior. */

/**
 * Record the failing boundary without logging credentials or message bodies.
 * @param {"lookup" | "dispatch"} stage Boundary reported when the native request fails.
 * @param {Parameters<typeof eveRequest>} args Owner, native path, request options and optional model/tool header inputs forwarded unchanged.
 * @returns {Promise<Response>} Native response; transport failures throw EveCreationTransportError for the specified stage.
 */
const requestEveCreation = async (
  stage: "lookup" | "dispatch",

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the native eveRequest tuple without copying; its RequestInit carries Next.js mutable next.tags through to fetch.
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

export { EveCreationTransportError, requestEveCreation };
/* oxlint-enable import/no-named-export */
