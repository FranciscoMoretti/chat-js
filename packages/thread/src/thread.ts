import type { UIMessage } from "ai";
import { AbstractThread } from "./abstract-thread";
import { MemoryThreadState } from "./thread-state";
import type { ThreadInit } from "./types";

export class Thread<
	TMessage extends UIMessage = UIMessage,
> extends AbstractThread<TMessage> {
	constructor({
		initialTree,
		messages,
		...options
	}: ThreadInit<TMessage> = {}) {
		super({
			...options,
			state: new MemoryThreadState({ initialTree, messages }),
		});
	}
}

export function createThread<TMessage extends UIMessage = UIMessage>(
	options: ThreadInit<TMessage> = {},
) {
	return new Thread(options);
}
