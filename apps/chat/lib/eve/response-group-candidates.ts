import { v5 as uuidv5 } from "uuid";

/** Stable before account/group persistence, including repeated selections of one model. */
export const eveResponseGroupCandidates = (
  operationId: string,
  modelIds: string[]
) =>
  modelIds.map((modelId, index) => ({
    modelId,
    operationId: uuidv5(`chatjs:eve:response-candidate:${index}`, operationId),
  }));
