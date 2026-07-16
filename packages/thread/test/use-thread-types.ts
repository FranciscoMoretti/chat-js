import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { type UseThreadHelpers, useThread } from "../src/react";
import { ThreadChat } from "../src/thread-chat";

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

function useExternalChatCheck() {
	const chat = new ThreadChat<UIMessage>();
	return useThread({ chat });
}

void useCompatibilityCheck;
void useExternalChatCheck;
