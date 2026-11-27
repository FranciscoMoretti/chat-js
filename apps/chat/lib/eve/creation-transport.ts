import { eveRequest } from "./server";

const HTTP_STATUS_ABSENT = 0;

class EveCreationTransportError extends Error {
  public readonly status?: number;
  public constructor(status?: number) {
    super(
      `Native creation dispatch failed${typeof status === "number" && status !== HTTP_STATUS_ABSENT && !Number.isNaN(status) ? ` (HTTP ${status})` : " before receiving a response"}.`
    );
    this.name = "EveCreationTransportError";
    this.status = status;
  }
}

/**
 * Record the failing boundary without logging credentials or message bodies.
 * @param {Parameters<typeof eveRequest>} args Owner, native path, request options and optional model/tool header inputs forwarded unchanged.
 * @returns {Promise<Response>} Native response; transport failures throw EveCreationTransportError during dispatch.
 */
const requestEveCreation = async (
  ...args: Parameters<typeof eveRequest>
): Promise<Response> => {
  try {
    return await eveRequest(...args);
  } catch {
    throw new EveCreationTransportError();
  }
};

export { EveCreationTransportError, requestEveCreation };
