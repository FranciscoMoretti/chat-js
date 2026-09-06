import { createStore } from "zustand/vanilla";
import type { AppModelId } from "@/lib/ai/app-models";
import type { ConversationViewController } from "./view-store";

/** A panel action retains the message it was opened from, even after navigation. */
export function createArtifactOrigin(
  view: ConversationViewController,
  messageId: string,
  selectedModelId: AppModelId | undefined,
  isReadonly = false
) {
  const store = createStore<{ runId?: string }>(() => ({}));
  const selectionVersion = view.store.getState().selectionVersion;
  const sendMessage: ConversationViewController["sendMessage"] = async (
    message,
    request
  ) => {
    const run = await view.startRun({
      message,
      request,
      from: messageId,
      follow: view.store.getState().selectionVersion === selectionVersion,
    });
    store.setState({ runId: run.id });
    await run.finished;
  };
  const getRun = () => {
    const { runId } = store.getState();
    return runId
      ? view.thread.getRun(runId)
      : view.thread.getRunForMessage(messageId);
  };
  const stop = () => {
    const run = getRun();
    return run ? view.thread.stopRun(run.id) : Promise.resolve();
  };
  return {
    view,
    store,
    messageId,
    selectedModelId,
    isReadonly,
    sendMessage,
    getRun,
    stop,
  };
}
export type ArtifactOrigin = ReturnType<typeof createArtifactOrigin>;
