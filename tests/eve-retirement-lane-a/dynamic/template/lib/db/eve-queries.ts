/* oxlint-disable import/no-relative-parent-imports -- The disposable mapping substitute shares the fixture control store. */
import { readControl, record } from "../../proof/store";

const readEveSessionMapping = async ({
  sessionId,
}: Readonly<{ sessionId: string }>): Promise<{
  id: string;
  ownerId: string;
  state: string;
  sessionId: string;
}> => {
  const control = await readControl(sessionId);
  await record("scope", { ownerId: control.ownerId, sessionId });
  return { id: sessionId, ownerId: control.ownerId, sessionId, state: "bound" };
};
const bindAcceptedEveConversation = (): never => {
  throw new Error("Unexpected live binding operation");
};

export { readEveSessionMapping, bindAcceptedEveConversation };

/* oxlint-enable import/no-relative-parent-imports */
