import { z } from "zod";

import { eveRequest } from "./server";

const SEED_CREATION_TIMEOUT_MS = 30_000;
const MINIMUM_SESSION_IDENTIFIER_LENGTH = 1;

/**
 * Sends a trusted copy request after the database owner has committed its dispatch fence.
 * @param {string} ownerId Owner authorized to create the native session.
 * @param {string} operationId Stable seed identity whose dispatch is fenced by the application journal.
 * @param {string} modelId Model selected in the accepted copy intent.
 * @returns {Promise<string>} The validated native session ID from a successful response; unresolved replies throw.
 */
export const createNativeEveCopy = async (
  ownerId: string,
  operationId: string,
  modelId: string
): Promise<string> => {
  const result = await eveRequest(
    ownerId,
    "/eve/chat/v1/session",
    {
      body: JSON.stringify({ operationId, seed: true }),
      method: "POST",
      signal: AbortSignal.timeout(SEED_CREATION_TIMEOUT_MS),
    },
    modelId
  );
  if (!result.ok) {
    throw new Error("Native copy creation is unresolved.");
  }
  return z
    .object({
      sessionId: z.string().min(MINIMUM_SESSION_IDENTIFIER_LENGTH),
    })
    .parse(await result.json()).sessionId;
};
