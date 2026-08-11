import type { UIMessage } from "ai";
import { MessageTree } from "./message-tree";
import type {
	MessageTreeSnapshot,
	ThreadState,
	ThreadStateSnapshot,
} from "./types";

export function createThreadStateSnapshot<TMessage extends UIMessage>({
	initialTree,
	messages,
}: {
	initialTree?: MessageTreeSnapshot<TMessage>;
	messages?: TMessage[];
}): ThreadStateSnapshot<TMessage> {
	const tree = new MessageTree({ messages, snapshot: initialTree });

	return {
		...tree.getSnapshot(),
		...tree.getIndexes(),
		activeRuns: [],
		error: undefined,
		messages: tree.getPath(),
		runs: [],
		status: "ready",
		treeStatus: "ready",
	};
}

export class MemoryThreadState<TMessage extends UIMessage = UIMessage>
	implements ThreadState<TMessage>
{
	readonly #listeners = new Set<() => void>();
	#snapshot: ThreadStateSnapshot<TMessage>;

	constructor(
		options: {
			initialTree?: MessageTreeSnapshot<TMessage>;
			messages?: TMessage[];
		} = {},
	) {
		this.#snapshot = createThreadStateSnapshot(options);
	}

	getSnapshot = () => this.#snapshot;

	subscribe = (listener: () => void) => {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	};

	update: ThreadState<TMessage>["update"] = (updater) => {
		this.#snapshot = updater(this.#snapshot);
		for (const listener of this.#listeners) listener();
	};
}
