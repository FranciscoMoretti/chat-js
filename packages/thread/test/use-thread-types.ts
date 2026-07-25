import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { type UseThreadHelpers, useThread } from "../src/react";
import { Thread } from "../src/thread";
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
	return useThread({ thread });
}

function useInvalidOwnershipChecks() {
	const state = new MemoryThreadState<UIMessage>();
	// @ts-expect-error An external state already owns initial messages.
	new Thread({ messages: [], state });
	// @ts-expect-error useThread accepts a thread, not a chat projection.
	useThread({ chat: new Thread<UIMessage>() });
}

void useCompatibilityCheck;
void useExternalThreadCheck;
void useInvalidOwnershipChecks;
