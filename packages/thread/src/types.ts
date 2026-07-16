import type {
	AbstractChat,
	ChatInit,
	ChatRequestOptions,
	ChatStatus,
	UIMessage,
} from "ai";

export type ThreadRun = {
	assistantMessageId: string;
	error: Error | undefined;
	follow: boolean;
	id: string;
	originCursorId: string | null;
	parentMessageId: string | null;
	status: ChatStatus;
	userMessageId: string;
};

export type ThreadRunHandle = {
	readonly assistantMessageId: string;
	readonly finished: Promise<void>;
	readonly id: string;
	getSnapshot: () => ThreadRun | undefined;
	stop: () => Promise<void>;
};

export type TreeSendOptions = ChatRequestOptions & {
	tree?: {
		follow?: boolean;
		from?: string | null;
		[key: string]: unknown;
	};
};

export type SendMessageInput<TMessage extends UIMessage> = Parameters<
	AbstractChat<TMessage>["sendMessage"]
>[0];

export type ThreadStartRunOptions<TMessage extends UIMessage = UIMessage> = {
	follow?: boolean;
	from?: string | null;
	message?: SendMessageInput<TMessage>;
	request?: TreeSendOptions;
};

export type ThreadConcurrency = {
	maxActiveRuns?: number;
	maxActiveRunsPerMessage?: number;
};

export type ThreadEvent =
	| { cursorId: string | null; type: "cursor-changed" }
	| { run: ThreadRun; type: "run-started" | "run-updated" }
	| {
			run: ThreadRun;
			type: "run-aborted" | "run-completed" | "run-failed";
	  };

export type MessageTreeSnapshot<TMessage extends UIMessage = UIMessage> = {
	childrenByParentId: Record<string, string[]>;
	cursorId: string | null;
	messagesById: Record<string, TMessage>;
	parentById: Record<string, string | null>;
	rootIds: string[];
	version: 1;
};

export type ThreadStateSnapshot<TMessage extends UIMessage = UIMessage> =
	MessageTreeSnapshot<TMessage> & {
		error: Error | undefined;
		lastEvent: string;
		messages: TMessage[];
		status: ChatStatus;
		activeRuns: ThreadRun[];
		runs: ThreadRun[];
		storeVersion: number;
		treeStatus: ChatStatus;
	};

export type ThreadChatOptions<TMessage extends UIMessage = UIMessage> = Omit<
	ChatInit<TMessage>,
	"messages"
> & {
	concurrency?: ThreadConcurrency;
	initialTree?: MessageTreeSnapshot<TMessage>;
	messages?: TMessage[];
	onThreadEvent?: (event: ThreadEvent) => void;
};

export type ThreadRunSpec = {
	assistantMessageId: string;
	follow: boolean;
	originCursorId: string | null;
	parentMessageId: string | null;
	runId: string;
	userMessageId: string;
};
