import { v5 as uuidv5 } from "uuid";

/**
 * Stable before account/group persistence, including repeated selections of one model.
 * @param operationId Creation operation's UUID namespace shared by all candidate identities.
 * @param modelIds Ordered model selections; duplicate models keep distinct positional identities.
 * @returns Candidates in selection order with reproducible operation UUIDs for persistence and retries.
 */
export const eveResponseGroupCandidates = (
  operationId: string,
  modelIds: readonly string[]
): { modelId: string; operationId: string }[] =>
  modelIds.map((modelId, index) => ({
    modelId,
    operationId: uuidv5(`chatjs:eve:response-candidate:${index}`, operationId),
  }));
