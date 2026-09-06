import type {
  ThreadStartRunOptions,
  ThreadStateSnapshot,
} from "@chat-js/thread";
import type { ChatRequestOptions } from "ai";
import { createStore } from "zustand/vanilla";
import type { ChatMessage } from "@/lib/ai/types";
import type { ApplicationThread } from "@/lib/application-thread";

/** Selection belongs to a view; messages and execution remain in the Thread. */
export function createConversationView({
  id,
  thread,
  initialCursorId = thread.getSnapshot().cursorId,
}: {
  id: string;
  thread: ApplicationThread;
  initialCursorId?: string | null;
}) {
  const store = createStore<{
    cursorId: string | null;
    runId: string | null;
    selectionVersion: number;
    snapshot: ThreadStateSnapshot<ChatMessage>;
  }>(() => ({
    cursorId: initialCursorId,
    runId: null,
    selectionVersion: 0,
    snapshot: thread.getSnapshot(),
  }));
  let connections = 0;
  let unsubscribe: (() => void) | undefined;
  const sync = () => {
    const state = store.getState();
    const snapshot = thread.getSnapshot();
    let cursorId = state.cursorId;
    while (cursorId && !snapshot.messagesById[cursorId]) {
      cursorId = state.snapshot.parentById[cursorId] ?? null;
    }
    const message = state.runId
      ? thread.getMessageForRun(state.runId)
      : undefined;
    store.setState({ snapshot, cursorId: message?.id ?? cursorId });
  };
  const connect = () => {
    connections += 1;
    if (connections === 1) {
      unsubscribe = thread.subscribe(sync);
    }
    sync();
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      connections -= 1;
      if (connections > 0) {
        return;
      }
      store.setState((state) => ({
        selectionVersion: state.selectionVersion + 1,
      }));
      unsubscribe?.();
      unsubscribe = undefined;
    };
  };
  const select = (cursorId: string | null) => {
    if (cursorId && !thread.getMessage(cursorId)) {
      return;
    }
    store.setState((state) => ({
      cursorId,
      runId: null,
      selectionVersion: state.selectionVersion + 1,
    }));
  };
  const followRun = (runId: string) => {
    store.setState((state) => ({
      runId,
      selectionVersion: state.selectionVersion + 1,
    }));
    sync();
  };
  const startRun = async (options: ThreadStartRunOptions<ChatMessage> = {}) => {
    const origin = store.getState();
    const run = await thread.startRun({
      ...options,
      from: options.from === undefined ? origin.cursorId : options.from,
      follow: false,
    });
    if (
      connections > 0 &&
      options.follow !== false &&
      store.getState().selectionVersion === origin.selectionVersion
    ) {
      store.setState({ runId: run.id });
      sync();
    }
    return run;
  };
  const regenerate = async ({
    messageId,
    ...request
  }: ChatRequestOptions & { messageId?: string } = {}) => {
    const targetId = messageId ?? store.getState().cursorId;
    if (!targetId) {
      throw new Error("Select a message to retry");
    }
    const run = thread.regenerateRun({ messageId: targetId, request });
    followRun(run.id);
    await run.finished;
  };
  const getMessages = () => thread.getPath(store.getState().cursorId);
  const getRun = () => {
    const state = store.getState();
    if (state.runId) {
      return thread.getRun(state.runId);
    }
    return state.cursorId ? thread.getRunForMessage(state.cursorId) : undefined;
  };
  const stop = () => {
    const run = getRun();
    return run ? thread.stopRun(run.id) : Promise.resolve();
  };
  const sendMessage = async (
    message?: Parameters<ApplicationThread["sendMessage"]>[0],
    request?: ChatRequestOptions
  ) => {
    const run = await startRun({ message, request });
    await run.finished;
  };
  return {
    id,
    thread,
    store,
    connect,
    select,
    followRun,
    startRun,
    regenerate,
    getMessages,
    getRun,
    stop,
    sendMessage,
  };
}

export type ConversationViewController = ReturnType<
  typeof createConversationView
>;

export function getViewMessages(
  state: ReturnType<ConversationViewController["store"]["getState"]>
) {
  const messages: ChatMessage[] = [];
  let id = state.cursorId;
  while (id) {
    const message = state.snapshot.messagesById[id];
    if (!message) {
      break;
    }
    messages.push(message);
    id = state.snapshot.parentById[id] ?? null;
  }
  return messages.reverse();
}

// A retained runtime also retains each named view's selection across route unmounts.
// Weak keys let runtime eviction release these projections without a second lifetime owner.
const viewsByThread = new WeakMap<
  ApplicationThread,
  Map<string, ConversationViewController>
>();
export function getConversationView(
  options: Parameters<typeof createConversationView>[0]
) {
  let views = viewsByThread.get(options.thread);
  if (!views) {
    views = new Map();
    viewsByThread.set(options.thread, views);
  }
  let view = views.get(options.id);
  if (!view) {
    view = createConversationView(options);
    views.set(options.id, view);
  }
  return view;
}
