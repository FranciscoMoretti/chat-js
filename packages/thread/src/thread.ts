import type { UIMessage } from "ai";
import { AbstractThread } from "./abstract-thread";
import { MemoryThreadState } from "./thread-state";
import type { ThreadInit, ThreadState } from "./types";

function resolveThreadState<TMessage extends UIMessage>(
	options: ThreadInit<TMessage>,
): ThreadState<TMessage> {
	if ("state" in options && options.state) {
		return options.state;
	}

	return new MemoryThreadState({
		initialTree: options.initialTree,
		messages: options.messages,
	});
}

export class Thread<
	TMessage extends UIMessage = UIMessage,
> extends AbstractThread<TMessage> {
	constructor(options: ThreadInit<TMessage> = {}) {
		super({
			...options,
			state: resolveThreadState(options),
		});
	}
}

export function createThread<TMessage extends UIMessage = UIMessage>(
	options: ThreadInit<TMessage> = {},
) {
	return new Thread(options);
}
