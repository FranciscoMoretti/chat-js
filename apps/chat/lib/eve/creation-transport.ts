import { eveRequest } from "./server";

const HTTP_STATUS_ABSENT = 0;

class EveCreationTransportError extends Error {
  public readonly stage: "lookup" | "dispatch";
  public readonly status?: number;
  public constructor(stage: "lookup" | "dispatch", status?: number) {
    super(
      `Native creation ${stage} failed${typeof status === "number" && status !== HTTP_STATUS_ABSENT && !Number.isNaN(status) ? ` (HTTP ${status})` : " before receiving a response"}.`
    );
    this.name = "EveCreationTransportError";
    this.stage = stage;
    this.status = status;
  }
}

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

export { EveCreationTransportError, requestEveCreation };
