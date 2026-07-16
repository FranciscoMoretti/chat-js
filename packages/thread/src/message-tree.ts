import type { UIMessage } from "ai";
import type { MessageTreeSnapshot } from "./types";

export const ROOT_PARENT_ID = "__root__";

function parentKey(parentId: string | null) {
	return parentId ?? ROOT_PARENT_ID;
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

export function getMessageText(message: UIMessage) {
	return message.parts
		.map((part) => (part.type === "text" ? part.text : ""))
		.join("");
}

export class MessageTree<TMessage extends UIMessage = UIMessage> {
	readonly #childrenByParentId = new Map<string, string[]>();
	readonly #messagesById = new Map<string, TMessage>();
	readonly #parentById = new Map<string, string | null>();
	#cursorId: string | null = null;

	constructor(
		options: {
			messages?: TMessage[];
			snapshot?: MessageTreeSnapshot<TMessage>;
		} = {},
	) {
		if (options.snapshot) {
			this.restore(options.snapshot);
		} else if (options.messages) {
			this.replacePath(options.messages);
		}
	}

	get cursorId() {
		return this.#cursorId;
	}

	has(messageId: string) {
		return this.#messagesById.has(messageId);
	}

	getMessage(messageId: string) {
		const message = this.#messagesById.get(messageId);
		return message ? clone(message) : undefined;
	}

	getParentId(messageId: string) {
		return this.#parentById.get(messageId);
	}

	getParent(messageId: string) {
		const parentId = this.#parentById.get(messageId);
		return parentId ? this.getMessage(parentId) : undefined;
	}

	getChildren(messageId: string | null) {
		return (this.#childrenByParentId.get(parentKey(messageId)) ?? [])
			.map((id) => this.#messagesById.get(id))
			.filter((message): message is TMessage => Boolean(message))
			.map(clone);
	}

	getSiblings(messageId: string) {
		if (!this.#messagesById.has(messageId)) {
			return [];
		}
		return this.getChildren(this.#parentById.get(messageId) ?? null);
	}

	getLeaves(messageId: string | null = null) {
		const leaves: TMessage[] = [];
		const visit = (id: string) => {
			const children = this.#childrenByParentId.get(parentKey(id)) ?? [];
			if (children.length === 0) {
				const message = this.#messagesById.get(id);
				if (message) {
					leaves.push(clone(message));
				}
				return;
			}
			for (const childId of children) {
				visit(childId);
			}
		};

		for (const childId of this.#childrenByParentId.get(parentKey(messageId)) ??
			[]) {
			visit(childId);
		}
		return leaves;
	}

	getPathIds(messageId: string | null | undefined = this.#cursorId) {
		if (!messageId) {
			return [];
		}
		const ids: string[] = [];
		let currentId: string | null = messageId;
		while (currentId) {
			if (!this.#messagesById.has(currentId)) {
				break;
			}
			ids.unshift(currentId);
			currentId = this.#parentById.get(currentId) ?? null;
		}
		return ids;
	}

	getPath(messageId: string | null | undefined = this.#cursorId) {
		return this.getPathIds(messageId)
			.map((id) => this.#messagesById.get(id))
			.filter((message): message is TMessage => Boolean(message))
			.map(clone);
	}

	getSnapshot(): MessageTreeSnapshot<TMessage> {
		return {
			childrenByParentId: Object.fromEntries(
				Array.from(this.#childrenByParentId.entries(), ([id, children]) => [
					id,
					[...children],
				]),
			),
			cursorId: this.#cursorId,
			messagesById: Object.fromEntries(
				Array.from(this.#messagesById.entries(), ([id, message]) => [
					id,
					clone(message),
				]),
			),
			parentById: Object.fromEntries(this.#parentById.entries()),
			rootIds: [...(this.#childrenByParentId.get(ROOT_PARENT_ID) ?? [])],
			version: 1,
		};
	}

	setCursor(messageId: string | null) {
		if (messageId !== null && !this.#messagesById.has(messageId)) {
			throw new Error(`Unknown message ${messageId}`);
		}
		this.#cursorId = messageId;
	}

	setCursorToParentOf(messageId: string) {
		if (!this.#messagesById.has(messageId)) {
			throw new Error(`Unknown message ${messageId}`);
		}
		this.setCursor(this.#parentById.get(messageId) ?? null);
	}

	upsertMessage(message: TMessage, parentId: string | null) {
		if (parentId !== null && !this.#messagesById.has(parentId)) {
			throw new Error(`Unknown parent message ${parentId}`);
		}
		let ancestorId = parentId;
		while (ancestorId !== null) {
			if (ancestorId === message.id) {
				throw new Error(`Cannot create a cycle involving ${message.id}`);
			}
			ancestorId = this.#parentById.get(ancestorId) ?? null;
		}

		const existingParentId = this.#parentById.get(message.id);
		if (existingParentId !== undefined && existingParentId !== parentId) {
			throw new Error(
				`Cannot move message ${message.id} from ${existingParentId ?? "root"} to ${parentId ?? "root"}`,
			);
		}

		this.#messagesById.set(message.id, clone(message));
		this.#parentById.set(message.id, parentId);
		const key = parentKey(parentId);
		const children = this.#childrenByParentId.get(key) ?? [];
		if (!children.includes(message.id)) {
			this.#childrenByParentId.set(key, [...children, message.id]);
		}
	}

	removeLeaf(messageId: string) {
		if (!this.#messagesById.has(messageId)) {
			return;
		}
		const children = this.#childrenByParentId.get(parentKey(messageId)) ?? [];
		if (children.length > 0) {
			throw new Error(`Cannot remove non-leaf message ${messageId}`);
		}
		const parentId = this.#parentById.get(messageId) ?? null;
		this.#messagesById.delete(messageId);
		this.#parentById.delete(messageId);
		this.#childrenByParentId.delete(parentKey(messageId));
		this.#childrenByParentId.set(
			parentKey(parentId),
			(this.#childrenByParentId.get(parentKey(parentId)) ?? []).filter(
				(id) => id !== messageId,
			),
		);
		if (this.#cursorId === messageId) {
			this.#cursorId = parentId;
		}
	}

	replacePath(messages: TMessage[]) {
		this.validatePath(messages);
		this.clear();
		let parentId: string | null = null;
		for (const message of messages) {
			this.upsertMessage(message, parentId);
			parentId = message.id;
		}
		this.#cursorId = messages.at(-1)?.id ?? null;
	}

	reconcilePath(messages: TMessage[], options: { moveCursor?: boolean } = {}) {
		this.validatePath(messages, true);
		let parentId: string | null = null;
		for (const message of messages) {
			this.upsertMessage(message, parentId);
			parentId = message.id;
		}
		if (options.moveCursor ?? true) {
			this.#cursorId = messages.at(-1)?.id ?? null;
		}
	}

	restore(snapshot: MessageTreeSnapshot<TMessage>) {
		const restored = new MessageTree<TMessage>();
		for (const id of Object.keys(snapshot.messagesById)) {
			const message = snapshot.messagesById[id];
			if (!message) {
				continue;
			}
			const parentId = snapshot.parentById[id];
			if (parentId === undefined) {
				throw new Error(`Missing parent for message ${id}`);
			}
			if (parentId !== null && !snapshot.messagesById[parentId]) {
				throw new Error(`Unknown parent message ${parentId}`);
			}
		}

		const visit = (id: string, ancestors: Set<string>) => {
			if (ancestors.has(id)) {
				throw new Error(`Cannot restore a cycle involving ${id}`);
			}
			const nextAncestors = new Set(ancestors).add(id);
			for (const childId of snapshot.childrenByParentId[id] ?? []) {
				visit(childId, nextAncestors);
			}
		};
		for (const rootId of snapshot.rootIds) {
			visit(rootId, new Set());
		}

		restored.#messagesById.clear();
		for (const [id, message] of Object.entries(snapshot.messagesById)) {
			restored.#messagesById.set(id, clone(message));
		}
		for (const [id, parentId] of Object.entries(snapshot.parentById)) {
			restored.#parentById.set(id, parentId);
		}
		for (const [id, children] of Object.entries(snapshot.childrenByParentId)) {
			restored.#childrenByParentId.set(id, [...children]);
		}
		if (
			snapshot.cursorId !== null &&
			!restored.#messagesById.has(snapshot.cursorId)
		) {
			throw new Error(`Unknown message ${snapshot.cursorId}`);
		}
		restored.#cursorId = snapshot.cursorId;

		this.clear();
		for (const [id, message] of restored.#messagesById) {
			this.#messagesById.set(id, message);
		}
		for (const [id, parentId] of restored.#parentById) {
			this.#parentById.set(id, parentId);
		}
		for (const [id, children] of restored.#childrenByParentId) {
			this.#childrenByParentId.set(id, children);
		}
		this.#cursorId = restored.#cursorId;
	}

	clear() {
		this.#childrenByParentId.clear();
		this.#messagesById.clear();
		this.#parentById.clear();
		this.#cursorId = null;
	}

	private validatePath(messages: TMessage[], validateExistingParents = false) {
		const ids = new Set<string>();
		let parentId: string | null = null;
		for (const message of messages) {
			if (ids.has(message.id)) {
				throw new Error(`Duplicate message id ${message.id} in path`);
			}
			ids.add(message.id);
			if (validateExistingParents) {
				const existingParentId = this.#parentById.get(message.id);
				if (existingParentId !== undefined && existingParentId !== parentId) {
					throw new Error(
						`Cannot move message ${message.id} from ${existingParentId ?? "root"} to ${parentId ?? "root"}`,
					);
				}
			}
			parentId = message.id;
		}
	}
}
