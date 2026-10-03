import type { UIMessage } from "ai";

import type { MessageTreeSnapshot } from "./types";

const clone = <TValue>(value: TValue): TValue => structuredClone(value);

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- The public tree accepts SDK TMessage arrays/snapshots and clones them before indexing; a readonly reader view requires a separate public ownership audit in #622. */
class MessageTree<TMessage extends UIMessage = UIMessage> {
  readonly #childrenByParentId = new Map<string | null, string[]>();
  readonly #messagesById = new Map<string, TMessage>();
  readonly #parentById = new Map<string, string | null>();
  #cursorId: string | null = null;

  public constructor(
    options: {
      messages?: TMessage[];
      snapshot?: MessageTreeSnapshot<TMessage>;
    } = {}
  ) {
    if (options.snapshot) {
      this.restore(options.snapshot);
    } else if (options.messages) {
      this.setPath(options.messages);
    }
  }

  public get cursorId(): string | null {
    return this.#cursorId;
  }

  public has(messageId: string): boolean {
    return this.#messagesById.has(messageId);
  }

  public getMessage(messageId: string): TMessage | undefined {
    const message = this.#messagesById.get(messageId);
    return message ? clone(message) : undefined;
  }

  public getParentId(messageId: string): string | null | undefined {
    return this.#parentById.get(messageId);
  }

  public getParent(messageId: string): TMessage | undefined {
    const parentId = this.#parentById.get(messageId);
    return typeof parentId === "string" && parentId !== ""
      ? this.getMessage(parentId)
      : undefined;
  }

  public getChildren(messageId: string | null): TMessage[] {
    return (this.#childrenByParentId.get(messageId) ?? [])
      .map((id) => this.#messagesById.get(id))
      .filter((message): message is TMessage => Boolean(message))
      .map((message) => clone(message));
  }

  public getSiblings(messageId: string): TMessage[] {
    if (!this.#messagesById.has(messageId)) {
      return [];
    }
    return this.getChildren(this.#parentById.get(messageId) ?? null);
  }

  public getLeaves(messageId: string | null = null): TMessage[] {
    const leaves: TMessage[] = [];

    for (const id of this.walkDescendantIds(messageId)) {
      const children = this.#childrenByParentId.get(id) ?? [];
      if (children.length === 0) {
        const message = this.#messagesById.get(id);
        if (message) {
          leaves.push(clone(message));
        }
      }
    }

    return leaves;
  }

  public getPathIds(
    messageId: string | null | undefined = this.#cursorId
  ): string[] {
    if (!(typeof messageId === "string" && messageId !== "")) {
      return [];
    }
    const ids: string[] = [];
    let currentId: string | null = messageId;
    while (typeof currentId === "string" && currentId !== "") {
      if (!this.#messagesById.has(currentId)) {
        break;
      }
      ids.unshift(currentId);
      currentId = this.#parentById.get(currentId) ?? null;
    }
    return ids;
  }

  public getPath(
    messageId: string | null | undefined = this.#cursorId
  ): TMessage[] {
    return this.getPathIds(messageId)
      .map((id) => this.#messagesById.get(id))
      .filter((message): message is TMessage => Boolean(message))
      .map((message) => clone(message));
  }

  public getSnapshot(): MessageTreeSnapshot<TMessage> {
    const nodes: MessageTreeSnapshot<TMessage>["nodes"] = [];

    for (const messageId of this.walkDescendantIds(null)) {
      const message = this.#messagesById.get(messageId);
      if (message) {
        nodes.push({
          message: clone(message),
          parentId: this.#parentById.get(messageId) ?? null,
        });
      }
    }

    return {
      cursorId: this.#cursorId,
      nodes,
      version: 1,
    };
  }

  public getIndexes(): {
    childrenByParentId: Record<string, string[]>;
    messagesById: Record<string, TMessage>;
    parentById: Record<string, string | null>;
    rootIds: string[];
  } {
    return {
      childrenByParentId: Object.fromEntries(
        [...this.#childrenByParentId.entries()]
          .filter((entry): entry is [string, string[]] => entry[0] !== null)
          .map(([id, children]) => [id, [...children]])
      ),
      messagesById: Object.fromEntries(
        Array.from(this.#messagesById.entries(), ([id, message]) => [
          id,
          clone(message),
        ])
      ),
      parentById: Object.fromEntries(this.#parentById.entries()),
      rootIds: [...(this.#childrenByParentId.get(null) ?? [])],
    };
  }

  public setCursor(messageId: string | null): void {
    if (messageId !== null && !this.#messagesById.has(messageId)) {
      throw new Error(`Unknown message ${messageId}`);
    }
    this.#cursorId = messageId;
  }

  public setCursorToParentOf(messageId: string): void {
    if (!this.#messagesById.has(messageId)) {
      throw new Error(`Unknown message ${messageId}`);
    }
    this.setCursor(this.#parentById.get(messageId) ?? null);
  }

  public upsertMessage(
    message: TMessage,
    parentId: string | null,
    options: { index?: number } = {}
  ): void {
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
        `Cannot move message ${message.id} from ${existingParentId ?? "root"} to ${parentId ?? "root"}`
      );
    }

    this.#messagesById.set(message.id, clone(message));
    this.#parentById.set(message.id, parentId);
    const children = this.#childrenByParentId.get(parentId) ?? [];
    if (!children.includes(message.id)) {
      const index = Math.min(options.index ?? children.length, children.length);
      this.#childrenByParentId.set(parentId, [
        ...children.slice(0, index),
        message.id,
        ...children.slice(index),
      ]);
    }
  }

  public removeLeaf(messageId: string): void {
    if (!this.#messagesById.has(messageId)) {
      return;
    }
    const children = this.#childrenByParentId.get(messageId) ?? [];
    if (children.length > 0) {
      throw new Error(`Cannot remove non-leaf message ${messageId}`);
    }
    const parentId = this.#parentById.get(messageId) ?? null;
    this.#messagesById.delete(messageId);
    this.#parentById.delete(messageId);
    this.#childrenByParentId.delete(messageId);
    this.#childrenByParentId.set(
      parentId,
      (this.#childrenByParentId.get(parentId) ?? []).filter(
        (id): boolean => id !== messageId
      )
    );
    if (this.#cursorId === messageId) {
      this.#cursorId = parentId;
    }
  }

  public setPath(messages: TMessage[]): void {
    this.updatePath(messages);
    this.#cursorId = messages.at(-1)?.id ?? null;
  }

  public updatePath(messages: TMessage[]): void {
    this.validatePath(messages, true);
    let parentId: string | null = null;
    for (const message of messages) {
      this.upsertMessage(message, parentId);
      parentId = message.id;
    }
  }

  public restore(snapshot: MessageTreeSnapshot<TMessage>): void {
    const restored = new MessageTree<TMessage>();
    for (const { message, parentId } of snapshot.nodes) {
      if (restored.has(message.id)) {
        throw new Error(`Duplicate message id ${message.id} in snapshot`);
      }
      restored.upsertMessage(message, parentId);
    }
    restored.setCursor(snapshot.cursorId);

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

  public clear(): void {
    this.#childrenByParentId.clear();
    this.#messagesById.clear();
    this.#parentById.clear();
    this.#cursorId = null;
  }

  private *walkDescendantIds(parentId: string | null): Generator<string> {
    for (const childId of this.#childrenByParentId.get(parentId) ?? []) {
      yield childId;
      yield* this.walkDescendantIds(childId);
    }
  }

  private validatePath(
    messages: TMessage[],
    validateExistingParents = false
  ): void {
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
            `Cannot move message ${message.id} from ${existingParentId ?? "root"} to ${parentId ?? "root"}`
          );
        }
      }
      parentId = message.id;
    }
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */

export { MessageTree };
