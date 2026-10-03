import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import { AbstractThread, Thread } from "../src";
import type { ThreadState } from "../src";
import { useThread } from "../src/react";
import type { UseThreadHelpers } from "../src/react";
import { MemoryThreadState } from "../src/thread-state";

declare const messageId: string;

const useCompatibilityCheck = () => {
  const thread = useThread();
  const chatCompatible: UseChatHelpers<UIMessage> = thread;

  void chatCompatible.messages;
  void chatCompatible.sendMessage({ text: "hello" });
  chatCompatible.setMessages((messages) => messages);

  thread.tree.setCursor(messageId);
  thread.tree.setCursor(null);
  thread.tree.getPath(messageId);
  thread.tree.getChildren(null);
  thread.tree.getSiblings(messageId);
  void thread.tree.stopAll();
  void thread.tree.activeRuns;
  void thread.tree.runs;
  void thread.tree.status;
  thread.tree.setActiveRun(messageId);
  thread.tree.getRunForMessage(messageId);
  thread.tree.getSnapshot();
  void thread.tree.startRun({ from: messageId, message: { text: "branch" } });

  // oxlint-disable-next-line typescript/no-unnecessary-type-arguments -- Verify the hook result remains assignable to the explicitly parameterized public helper type.
  const explicitHelpers: UseThreadHelpers<UIMessage> = thread;
  return explicitHelpers;
};

class StateBackedThread extends AbstractThread {
  public constructor(threadState: ThreadState) {
    super({ state: threadState });
  }
}

const useExternalThreadCheck = () => {
  const thread = new Thread();
  const defaultThread = useThread({ thread });
  const state = new MemoryThreadState();

  const stateBackedThread = useThread({
    thread: new StateBackedThread(state),
  });
  return { defaultThread, stateBackedThread };
};

const useInvalidOwnershipChecks = () => {
  const state = new MemoryThreadState();
  // @ts-expect-error Thread uses its own memory-backed state.
  void new Thread({ state });
  // @ts-expect-error useThread accepts a thread, not a chat projection.
  useThread({ chat: new Thread() });
};

void useCompatibilityCheck;
void useExternalThreadCheck;
void useInvalidOwnershipChecks;
