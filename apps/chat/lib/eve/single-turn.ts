/** Both destinations are bound to the branch selected in the conversation. */
export interface TurnDestinations {
  sendToSession: (modelId: string) => Promise<void>;
  forkFromHere: (modelIds: readonly string[]) => Promise<void>;
}

export const submitTurn = async (
  modelIds: readonly string[],
  destinations: TurnDestinations
): Promise<void> => {
  await destinations.sendToSession(modelIds[0]);
};
