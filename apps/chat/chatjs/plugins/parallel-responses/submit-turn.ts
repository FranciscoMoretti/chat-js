import { submitTurn as submitSingleTurn } from "@/lib/eve/single-turn";
import type { TurnDestinations } from "@/lib/eve/single-turn";

export const submitTurn = async (
  modelIds: readonly string[],
  destinations: TurnDestinations
): Promise<void> => {
  if (modelIds.length > 1) {
    await destinations.forkFromHere(modelIds);
    return;
  }
  await submitSingleTurn(modelIds, destinations);
};
