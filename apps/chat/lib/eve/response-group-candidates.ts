import { v5 as uuidv5 } from "uuid";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveResponseGroupCandidates); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/**
 * Stable before account/group persistence, including repeated selections of one model.
 * @param {string} operationId Creation operation's UUID namespace shared by all candidate identities.
 * @param {readonly string[]} modelIds Ordered model selections; duplicate models keep distinct positional identities.
 * @returns {{ modelId: string; operationId: string }[]} Candidates in selection order with reproducible operation UUIDs for persistence and retries.
 */
export const eveResponseGroupCandidates = (
  operationId: string,
  modelIds: readonly string[]
): { modelId: string; operationId: string }[] =>
  modelIds.map((modelId, index) => ({
    modelId,
    operationId: uuidv5(`chatjs:eve:response-candidate:${index}`, operationId),
  }));
/* oxlint-enable import/prefer-default-export, import/no-named-export */
