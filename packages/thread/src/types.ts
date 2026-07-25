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

export type ThreadStartRunOptions<TMessage extends UIMessage = UIMessage> = {
	follow?: boolean;
	from?: string | null;
	message?: Parameters<AbstractChat<TMessage>["sendMessage"]>[0];
	request?: ChatRequestOptions;
};

export type ThreadConcurrency = {
	maxActiveRuns?: number;
	maxActiveRunsPerMessage?: number;
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
		messages: TMessage[];
		messagesById: Record<string, TMessage>;
		parentById: Record<string, string | null>;
		rootIds: string[];
		runs: ThreadRun[];
		status: ChatStatus;
		treeStatus: ChatStatus;
	};

export interface ThreadState<TMessage extends UIMessage = UIMessage> {
	getSnapshot: () => ThreadStateSnapshot<TMessage>;
	subscribe: (listener: () => void) => () => void;
	update: (
		updater: (
			snapshot: ThreadStateSnapshot<TMessage>,
		) => ThreadStateSnapshot<TMessage>,
	) => void;
}

type ThreadInitialState<TMessage extends UIMessage> =
	| { initialTree: MessageTreeSnapshot<TMessage>; messages?: never }
	| { initialTree?: never; messages?: TMessage[] };

export type AbstractThreadInit<TMessage extends UIMessage = UIMessage> = Omit<
	ChatInit<TMessage>,
	"messages"
> & {
	concurrency?: ThreadConcurrency;
	state: ThreadState<TMessage>;
};

export type ThreadInit<TMessage extends UIMessage = UIMessage> = Omit<
	ChatInit<TMessage>,
	"messages"
> & {
	concurrency?: ThreadConcurrency;
} & (
		| {
				initialTree?: never;
				messages?: never;
				state: ThreadState<TMessage>;
		  }
		| ({
				state?: never;
		  } & ThreadInitialState<TMessage>)
	);
