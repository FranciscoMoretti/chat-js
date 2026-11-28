import { creationHandler as single } from "@/lib/eve/single-creation";
import type { CreationHandler } from "@/lib/eve/creation-contract";
import { eveResponseGroupInput } from "./response-group-input";
import { resolveModelGroup } from "./create-response-group";

export const creationHandler: CreationHandler = {
  parse(input) {
    return input !== null && typeof input === "object" && "modelIds" in input
      ? eveResponseGroupInput.parse(input)
      : single.parse(input);
  },
  prepare(input, modelIds, saved) {
    if (saved) {
      const comparison = "modelIds" in saved;
      if (comparison !== modelIds.length > 1) {
        throw new Error(
          comparison
            ? "Recover the saved comparison before starting another request."
            : "Recover the saved conversation before starting a comparison."
        );
      }
      return saved;
    }
    return modelIds.length > 1
      ? eveResponseGroupInput.parse({ ...input, modelIds })
      : single.prepare(input, modelIds);
  },
  async resolve(storage, ownerId, operation, scope) {
    return "modelIds" in operation
      ? await resolveModelGroup(storage, ownerId, operation, scope)
      : await single.resolve(storage, ownerId, operation, scope);
  },
};
