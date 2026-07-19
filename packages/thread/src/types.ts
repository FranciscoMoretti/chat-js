import type {
	AbstractChat,
	ChatInit,
	ChatRequestOptions,
	ChatStatus,
	UIMessage,
} from "ai";

export type ThreadRun = {
	error: Error | undefined;
	id: string;
	status: ChatStatus;
};

export type ThreadRunHandle = {
	readonly finished: Promise<void>;
	readonly id: string;
	getSnapshot: () => ThreadRun | undefined;
	stop: () => Promise<void>;
};

export type TreeSendOptions = ChatRequestOptions & {
	tree?: {
		follow?: boolean;
		from?: string | null;
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

export type MessageTreeNode<TMessage extends UIMessage = UIMessage> = {
	message: TMessage;
	parentId: string | null;
};

export type MessageTreeSnapshot<TMessage extends UIMessage = UIMessage> = {
	cursorId: string | null;
	nodes: MessageTreeNode<TMessage>[];
	version: 1;
};

export type ThreadStateSnapshot<TMessage extends UIMessage = UIMessage> =
	MessageTreeSnapshot<TMessage> & {
		activeRuns: ThreadRun[];
		childrenByParentId: Record<string, string[]>;
		error: Error | undefined;
		/** Free-form diagnostic description of the latest state transition. */
		lastEvent: string;
		messages: TMessage[];
		messagesById: Record<string, TMessage>;
		parentById: Record<string, string | null>;
		rootIds: string[];
		runs: ThreadRun[];
		status: ChatStatus;
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
