import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { ThreadChat } from "./thread-chat";
import type {
	MessageTreeSnapshot,
	ThreadChatOptions,
	ThreadRun,
	ThreadRunHandle,
	ThreadStartRunOptions,
	TreeSendOptions,
} from "./types";

type ThreadHookOptions = {
	experimental_throttle?: number;
	resume?: boolean;
};

type ExternalThreadOptions<TMessage extends UIMessage> = ThreadHookOptions & {
	chat: ThreadChat<TMessage>;
};

export type UseThreadOptions<TMessage extends UIMessage = UIMessage> =
	| ExternalThreadOptions<TMessage>
	| (ThreadHookOptions &
			ThreadChatOptions<TMessage> & {
				chat?: never;
			});

function hasSuppliedChat<TMessage extends UIMessage>(
	options: UseThreadOptions<TMessage>,
): options is ExternalThreadOptions<TMessage> {
	return "chat" in options && options.chat !== undefined;
}

export type TreeHelpers<TMessage extends UIMessage = UIMessage> = {
	activeRuns: ThreadRun[];
	childrenByParentId: Record<string, string[]>;
	cursorId: string | null;
	getChildren: (messageId: string | null) => TMessage[];
	getLeaves: (messageId?: string | null) => TMessage[];
	getMessage: (messageId: string) => TMessage | undefined;
	getParent: (messageId: string) => TMessage | undefined;
	getPath: (messageId?: string | null) => TMessage[];
	getRun: (runId: string) => ThreadRun | undefined;
	getRunForMessage: (messageId: string) => ThreadRun | undefined;
	getSiblings: (messageId: string) => TMessage[];
	getSnapshot: () => MessageTreeSnapshot<TMessage>;
	messagesById: Record<string, TMessage>;
	parentById: Record<string, string | null>;
	resumeRun: (runId: string, options?: TreeSendOptions) => Promise<void>;
	rootIds: string[];
	runs: ThreadRun[];
	setCursor: (messageId: string | null) => void;
	setCursorToParentOf: (messageId: string) => void;
	startRun: (
		options?: ThreadStartRunOptions<TMessage>,
	) => Promise<ThreadRunHandle>;
	status: ReturnType<ThreadChat<TMessage>["getSnapshot"]>["treeStatus"];
	stopAll: () => Promise<void>;
	stopRun: (runId: string) => Promise<void>;
	stopRunForMessage: (messageId: string) => Promise<void>;
};

export type UseThreadHelpers<TMessage extends UIMessage = UIMessage> =
	UseChatHelpers<TMessage> & {
		lastEvent: string;
		sendMessage: (
			message?: Parameters<UseChatHelpers<TMessage>["sendMessage"]>[0],
			options?: TreeSendOptions,
		) => Promise<void>;
		tree: TreeHelpers<TMessage>;
	};

function useThreadChatSnapshot<TMessage extends UIMessage>(
	chat: ThreadChat<TMessage>,
	throttleWaitMs?: number,
) {
	const subscribe = useCallback(
		(listener: () => void) => {
			if (!throttleWaitMs) return chat.subscribe(listener);

			let lastCall = 0;
			let timeout: ReturnType<typeof setTimeout> | undefined;
			const notify = () => {
				const elapsed = Date.now() - lastCall;
				if (elapsed >= throttleWaitMs) {
					lastCall = Date.now();
					listener();
					return;
				}
				if (timeout) return;
				timeout = setTimeout(() => {
					timeout = undefined;
					lastCall = Date.now();
					listener();
				}, throttleWaitMs - elapsed);
			};

			const unsubscribe = chat.subscribe(notify);
			return () => {
				unsubscribe();
				if (timeout) clearTimeout(timeout);
			};
		},
		[chat, throttleWaitMs],
	);

	return useSyncExternalStore(subscribe, chat.getSnapshot, chat.getSnapshot);
}

export function useThread<TMessage extends UIMessage = UIMessage>(
	options: UseThreadOptions<TMessage> = {},
): UseThreadHelpers<TMessage> {
	const chatRef = useRef<ThreadChat<TMessage> | null>(null);
	const suppliedChat = hasSuppliedChat(options) ? options.chat : undefined;
	const chatOptions = hasSuppliedChat(options) ? undefined : options;
	if (suppliedChat) {
		chatRef.current = suppliedChat;
	} else if (
		!chatRef.current ||
		(chatOptions?.id !== undefined && chatRef.current.id !== chatOptions.id)
	) {
		chatRef.current = new ThreadChat(chatOptions);
	}

	const chat = chatRef.current;
	if (chatOptions) chat.updateOptions(chatOptions);
	const snapshot = useThreadChatSnapshot(chat, options.experimental_throttle);

	useEffect(() => {
		if (options.resume) chat.resumeStream();
	}, [options.resume, chat]);

	const setMessages = useCallback<UseChatHelpers<TMessage>["setMessages"]>(
		(messages) => chat.setMessages(messages),
		[chat],
	);

	return {
		addToolApprovalResponse: chat.addToolApprovalResponse,
		addToolOutput: chat.addToolOutput,
		addToolResult: chat.addToolResult,
		clearError: chat.clearError,
		error: snapshot.error,
		id: chat.id,
		lastEvent: snapshot.lastEvent,
		messages: snapshot.messages,
		regenerate: chat.regenerate,
		resumeStream: chat.resumeStream,
		sendMessage: chat.sendMessage,
		setMessages,
		status: snapshot.status,
		stop: chat.stop,
		tree: {
			activeRuns: snapshot.activeRuns,
			childrenByParentId: snapshot.childrenByParentId,
			cursorId: snapshot.cursorId,
			getChildren: (messageId) => chat.getChildren(messageId),
			getLeaves: (messageId) => chat.getLeaves(messageId),
			getMessage: (messageId) => chat.getMessage(messageId),
			getParent: (messageId) => chat.getParent(messageId),
			getPath: (messageId) => chat.getPath(messageId),
			getRun: (runId) => chat.getRun(runId),
			getRunForMessage: (messageId) => chat.getRunForMessage(messageId),
			getSiblings: (messageId) => chat.getSiblings(messageId),
			getSnapshot: () => chat.getTreeSnapshot(),
			messagesById: snapshot.messagesById,
			parentById: snapshot.parentById,
			resumeRun: (runId, requestOptions) =>
				chat.resumeRun(runId, requestOptions),
			rootIds: snapshot.rootIds,
			runs: snapshot.runs,
			setCursor: (messageId) => chat.setCursor(messageId),
			setCursorToParentOf: (messageId) => chat.setCursorToParentOf(messageId),
			startRun: (runOptions) => chat.startRun(runOptions),
			status: snapshot.treeStatus,
			stopAll: () => chat.stopAll(),
			stopRun: (runId) => chat.stopRun(runId),
			stopRunForMessage: (messageId) => chat.stopRunForMessage(messageId),
		},
	};
}
