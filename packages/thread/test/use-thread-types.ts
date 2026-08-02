import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { AbstractThread, Thread, type ThreadState } from "../src";
import { type UseThreadHelpers, useThread } from "../src/react";
import { MemoryThreadState } from "../src/thread-state";

declare const messageId: string;

function useCompatibilityCheck() {
	const thread = useThread();
	const chatCompatible: UseChatHelpers<UIMessage> = thread;

	chatCompatible.messages;
	chatCompatible.sendMessage({ text: "hello" });
	chatCompatible.setMessages((messages) => messages);

	thread.tree.setCursor(messageId);
	thread.tree.setCursor(null);
	thread.tree.getPath(messageId);
	thread.tree.getChildren(null);
	thread.tree.getSiblings(messageId);
	thread.tree.stopAll();
	thread.tree.activeRuns;
	thread.tree.runs;
	thread.tree.status;
	thread.tree.getRunForMessage(messageId);
	thread.tree.getSnapshot();
	thread.tree.startRun({ from: messageId, message: { text: "branch" } });

	const explicitHelpers: UseThreadHelpers<UIMessage> = thread;
	return explicitHelpers;
}

function useExternalThreadCheck() {
	const thread = new Thread<UIMessage>();
	const defaultThread = useThread({ thread });
	const state = new MemoryThreadState<UIMessage>();

	class StateBackedThread extends AbstractThread<UIMessage> {
		constructor(threadState: ThreadState<UIMessage>) {
			super({ state: threadState });
		}
	}

	const stateBackedThread = useThread({
		thread: new StateBackedThread(state),
	});
	return { defaultThread, stateBackedThread };
}

function useInvalidOwnershipChecks() {
	const state = new MemoryThreadState<UIMessage>();
	// @ts-expect-error Thread uses its own memory-backed state.
	new Thread({ state });
	// @ts-expect-error useThread accepts a thread, not a chat projection.
	useThread({ chat: new Thread<UIMessage>() });
}

void useCompatibilityCheck;
void useExternalThreadCheck;
void useInvalidOwnershipChecks;
