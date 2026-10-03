import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { AbstractThread, Thread } from "../src";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { ThreadState } from "../src";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { useThread } from "../src/react";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { UseThreadHelpers } from "../src/react";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { MemoryThreadState } from "../src/thread-state";
/* oxlint-enable import/no-relative-parent-imports */

declare const messageId: string;

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
class StateBackedThread extends AbstractThread {
  public constructor(threadState: ThreadState) {
    super({ state: threadState });
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
const useExternalThreadCheck = () => {
  const thread = new Thread();
  const defaultThread = useThread({ thread });
  const state = new MemoryThreadState();

  const stateBackedThread = useThread({
    thread: new StateBackedThread(state),
  });
  return { defaultThread, stateBackedThread };
};
/* oxlint-enable typescript/explicit-function-return-type */

const useInvalidOwnershipChecks = (): void => {
  const state = new MemoryThreadState();
  // @ts-expect-error Thread uses its own memory-backed state.
  void new Thread({ state });
  // @ts-expect-error useThread accepts a thread, not a chat projection.
  useThread({ chat: new Thread() });
};

void useCompatibilityCheck;
void useExternalThreadCheck;
void useInvalidOwnershipChecks;
