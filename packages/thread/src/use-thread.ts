import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatRequestOptions, UIMessage } from "ai";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Thread } from "./thread";
import type {
	MessageTreeSnapshot,
	ThreadInit,
	ThreadRun,
	ThreadRunHandle,
	ThreadStartRunOptions,
	ThreadStateSnapshot,
	TreeSendOptions,
} from "./types";

type ThreadHookOptions = {
	experimental_throttle?: number;
	resume?: boolean;
};

type ThreadCallbacks<TMessage extends UIMessage> = Pick<
	ThreadInit<TMessage>,
	"onData" | "onError" | "onFinish" | "onToolCall" | "sendAutomaticallyWhen"
>;

type ExternalThreadOptions<TMessage extends UIMessage> = ThreadHookOptions & {
	thread: Thread<TMessage>;
};

export type UseThreadOptions<TMessage extends UIMessage = UIMessage> =
	| ExternalThreadOptions<TMessage>
	| (ThreadHookOptions &
			ThreadInit<TMessage> & {
				thread?: never;
			});

function hasSuppliedThread<TMessage extends UIMessage>(
	options: UseThreadOptions<TMessage>,
): options is ExternalThreadOptions<TMessage> {
	return "thread" in options && options.thread !== undefined;
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
	resumeRun: (runId: string, options?: ChatRequestOptions) => Promise<void>;
	rootIds: string[];
	runs: ThreadRun[];
	setCursor: (messageId: string | null) => void;
	setCursorToParentOf: (messageId: string) => void;
	startRun: (
		options?: ThreadStartRunOptions<TMessage>,
	) => Promise<ThreadRunHandle>;
	status: ReturnType<Thread<TMessage>["getSnapshot"]>["treeStatus"];
	stopAll: () => Promise<void>;
	stopRun: (runId: string) => Promise<void>;
	stopRunForMessage: (messageId: string) => Promise<void>;
};

export type UseThreadHelpers<TMessage extends UIMessage = UIMessage> =
	UseChatHelpers<TMessage> & {
		sendMessage: (
			message?: Parameters<UseChatHelpers<TMessage>["sendMessage"]>[0],
			options?: TreeSendOptions,
		) => Promise<void>;
		tree: TreeHelpers<TMessage>;
	};

function useThreadSnapshot<TMessage extends UIMessage>(
	thread: Thread<TMessage>,
	throttleWaitMs?: number,
) {
	const stateRef = useRef({
		thread,
		snapshot: thread.getSnapshot(),
	});
	if (stateRef.current.thread !== thread) {
		stateRef.current = {
			thread,
			snapshot: thread.getSnapshot(),
		};
	}

	const subscribe = useCallback(
		(listener: () => void) => {
			stateRef.current.snapshot = thread.getSnapshot();
			const publish = () => {
				stateRef.current.snapshot = thread.getSnapshot();
				listener();
			};
			if (!throttleWaitMs) return thread.subscribe(publish);

			let lastCall = 0;
			let timeout: ReturnType<typeof setTimeout> | undefined;
			const notify = () => {
				const elapsed = Date.now() - lastCall;
				if (elapsed >= throttleWaitMs) {
					lastCall = Date.now();
					publish();
					return;
				}
				if (timeout) return;
				timeout = setTimeout(() => {
					timeout = undefined;
					lastCall = Date.now();
					publish();
				}, throttleWaitMs - elapsed);
			};

			const unsubscribe = thread.subscribe(notify);
			return () => {
				unsubscribe();
				if (timeout) clearTimeout(timeout);
			};
		},
		[thread, throttleWaitMs],
	);
	const getSnapshot = useCallback(() => stateRef.current.snapshot, []);

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useThreadField<
	TMessage extends UIMessage,
	TKey extends keyof ThreadStateSnapshot<TMessage>,
>(thread: Thread<TMessage>, key: TKey) {
	const subscribe = useCallback(
		(listener: () => void) => thread.subscribe(listener),
		[thread],
	);
	const getSnapshot = useCallback(
		() => thread.getSnapshot()[key],
		[thread, key],
	);
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useThread<TMessage extends UIMessage = UIMessage>(
	options: UseThreadOptions<TMessage> = {},
): UseThreadHelpers<TMessage> {
	const hasExternalThread = hasSuppliedThread(options);
	const callbacksRef = useRef<ThreadCallbacks<TMessage>>(
		hasExternalThread
			? {}
			: {
					onData: options.onData,
					onError: options.onError,
					onFinish: options.onFinish,
					onToolCall: options.onToolCall,
					sendAutomaticallyWhen: options.sendAutomaticallyWhen,
				},
	);

	if (!hasExternalThread) {
		callbacksRef.current = {
			onData: options.onData,
			onError: options.onError,
			onFinish: options.onFinish,
			onToolCall: options.onToolCall,
			sendAutomaticallyWhen: options.sendAutomaticallyWhen,
		};
	}

	const threadOptions: ThreadInit<TMessage> | undefined = hasExternalThread
		? undefined
		: {
				...options,
				onData: (dataPart) => callbacksRef.current.onData?.(dataPart),
				onError: (error) => callbacksRef.current.onError?.(error),
				onFinish: (event) => callbacksRef.current.onFinish?.(event),
				onToolCall: (event) => callbacksRef.current.onToolCall?.(event),
				sendAutomaticallyWhen: (event) =>
					callbacksRef.current.sendAutomaticallyWhen?.(event) ?? false,
			};

	const threadRef = useRef<Thread<TMessage> | null>(null);
	let thread = threadRef.current;
	if (
		thread === null ||
		(hasExternalThread && options.thread !== thread) ||
		(!hasExternalThread && options.id !== undefined && thread.id !== options.id)
	) {
		thread = hasExternalThread ? options.thread : new Thread(threadOptions);
		threadRef.current = thread;
	}

	const snapshot = useThreadSnapshot(thread, options.experimental_throttle);
	const status = useThreadField(thread, "status");
	const error = useThreadField(thread, "error");
	const treeStatus = useThreadField(thread, "treeStatus");

	useEffect(() => {
		if (options.resume) threadRef.current?.resumeStream();
	}, [options.resume]);

	const setMessages = useCallback<UseChatHelpers<TMessage>["setMessages"]>(
		(messages) => threadRef.current?.setMessages(messages),
		[],
	);

	return {
		addToolApprovalResponse: thread.addToolApprovalResponse,
		addToolOutput: thread.addToolOutput,
		addToolResult: thread.addToolResult,
		clearError: thread.clearError,
		error,
		id: thread.id,
		messages: snapshot.messages,
		regenerate: thread.regenerate,
		resumeStream: thread.resumeStream,
		sendMessage: thread.sendMessage,
		setMessages,
		status,
		stop: thread.stop,
		tree: {
			activeRuns: snapshot.activeRuns,
			childrenByParentId: snapshot.childrenByParentId,
			cursorId: snapshot.cursorId,
			getChildren: (messageId) => thread.getChildren(messageId),
			getLeaves: (messageId) => thread.getLeaves(messageId),
			getMessage: (messageId) => thread.getMessage(messageId),
			getParent: (messageId) => thread.getParent(messageId),
			getPath: (messageId) => thread.getPath(messageId),
			getRun: (runId) => thread.getRun(runId),
			getRunForMessage: (messageId) => thread.getRunForMessage(messageId),
			getSiblings: (messageId) => thread.getSiblings(messageId),
			getSnapshot: () => thread.getTreeSnapshot(),
			messagesById: snapshot.messagesById,
			parentById: snapshot.parentById,
			resumeRun: (runId, requestOptions) =>
				thread.resumeRun(runId, requestOptions),
			rootIds: snapshot.rootIds,
			runs: snapshot.runs,
			setCursor: (messageId) => thread.setCursor(messageId),
			setCursorToParentOf: (messageId) => thread.setCursorToParentOf(messageId),
			startRun: (runOptions) => thread.startRun(runOptions),
			status: treeStatus,
			stopAll: () => thread.stopAll(),
			stopRun: (runId) => thread.stopRun(runId),
			stopRunForMessage: (messageId) => thread.stopRunForMessage(messageId),
		},
	};
}
