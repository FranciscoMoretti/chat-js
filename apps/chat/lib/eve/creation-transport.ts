import { eveRequest } from "./server";

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

/** Record the failing boundary without logging bearer tokens, signed URLs or message bodies. */
export const requestEveCreation = async (
  stage: "lookup" | "dispatch",
  ...args: Parameters<typeof eveRequest>
) => {
  try {
    return await eveRequest(...args);
  } catch {
    throw new EveCreationTransportError(stage);
  }
};
