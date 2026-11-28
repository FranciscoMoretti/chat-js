import { creationHandler } from "@/chatjs/generated/installed-creation";
import { finishCurrentCreation } from "./creation-storage";
import type { CreationHandler } from "./creation-contract";

/** All sends and retries pass the exact saved request to the installed handler. */
export const resolveCreationRequest: CreationHandler["resolve"] = async (
  storage,
  ownerId,
  operation,
  scope
) => {
  const binding = await creationHandler.resolve(
    storage,
    ownerId,
    operation,
    scope
  );
  finishCurrentCreation(storage, ownerId, operation.operationId, scope);
  return binding;
};
