import type { UIMessage } from "ai";

import {
  ROOT_PARENT_ID,
  ABSENT_MESSAGE,
  assertLeaf,
  assertParentUnchanged,
  assertParentExistsAndAcyclic,
  validateMessagePath,
} from "./message-tree-guards";
import { readMessageTreeIndexes } from "./message-tree-readers";
import type { SnapshotInput, TreeStorageReader } from "./message-tree-readers";
import type { MessageTreeSnapshot } from "./types";

const EMPTY_CHILD_COUNT = 0;
const SIBLING_INSERTION_START = 0;
const LAST_PATH_INDEX = -1;

const clone = <TValue>(value: TValue): TValue => structuredClone(value);

class MessageTree<TMessage extends UIMessage = UIMessage> {
  readonly #childrenByParentId = new Map<string | null, string[]>();
  readonly #messagesById = new Map<string, TMessage>();
  readonly #parentById = new Map<string, string | null>();
  #cursorId: string | null = ROOT_PARENT_ID;

  public constructor(
    options: Readonly<{
      messages?: readonly TMessage[];
      snapshot?: SnapshotInput<TMessage>;
    }> = {}
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
    return message ? clone(message) : ABSENT_MESSAGE;
  }

  public getParentId(messageId: string): string | null | undefined {
    return this.#parentById.get(messageId);
  }

  public getParent(messageId: string): TMessage | undefined {
    const parentId = this.#parentById.get(messageId);
    return typeof parentId === "string" && parentId !== ""
      ? this.getMessage(parentId)
      : ABSENT_MESSAGE;
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
    return this.getChildren(this.#parentById.get(messageId) ?? ROOT_PARENT_ID);
  }

  public getLeaves(messageId: string | null = ROOT_PARENT_ID): TMessage[] {
    const leaves: TMessage[] = [];

    for (const id of this.walkDescendantIds(messageId)) {
      const children = this.#childrenByParentId.get(id) ?? [];
      if (children.length === EMPTY_CHILD_COUNT) {
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
      currentId = this.#parentById.get(currentId) ?? ROOT_PARENT_ID;
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

    for (const messageId of this.walkDescendantIds(ROOT_PARENT_ID)) {
      const message = this.#messagesById.get(messageId);
      if (message) {
        nodes.push({
          message: clone(message),
          parentId: this.#parentById.get(messageId) ?? ROOT_PARENT_ID,
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
    return readMessageTreeIndexes({
      childrenByParentId: this.#childrenByParentId,
      messagesById: this.#messagesById,
      parentById: this.#parentById,
      readRootIds: (): string[] =>
        this.#childrenByParentId.get(ROOT_PARENT_ID) ?? [],
    });
  }

  public setCursor(messageId: string | null): void {
    if (messageId !== ROOT_PARENT_ID && !this.#messagesById.has(messageId)) {
      throw new Error(`Unknown message ${messageId}`);
    }
    this.#cursorId = messageId;
  }

  public setCursorToParentOf(messageId: string): void {
    if (!this.#messagesById.has(messageId)) {
      throw new Error(`Unknown message ${messageId}`);
    }
    this.setCursor(this.#parentById.get(messageId) ?? ROOT_PARENT_ID);
  }

  public upsertMessage(
    message: Readonly<TMessage>,
    parentId: string | null,
    options: Readonly<{ index?: number }> = {}
  ): void {
    assertParentExistsAndAcyclic(message, parentId, {
      hasMessage: (id: string): boolean => this.#messagesById.has(id),
      parentById: this.#parentById,
    });
    assertParentUnchanged(message, parentId, this.#parentById);

    this.#messagesById.set(message.id, clone(message));
    this.#parentById.set(message.id, parentId);
    const children = this.#childrenByParentId.get(parentId) ?? [];
    if (!children.includes(message.id)) {
      const index = Math.min(options.index ?? children.length, children.length);
      this.#childrenByParentId.set(parentId, [
        ...children.slice(SIBLING_INSERTION_START, index),
        message.id,
        ...children.slice(index),
      ]);
    }
  }

  public removeLeaf(messageId: string): void {
    if (!this.#messagesById.has(messageId)) {
      return;
    }
    assertLeaf(messageId, this.#childrenByParentId.get(messageId) ?? []);
    const parentId = this.#parentById.get(messageId) ?? ROOT_PARENT_ID;
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

  public setPath(messages: readonly Readonly<TMessage>[]): void {
    this.updatePath(messages);
    this.#cursorId = messages.at(LAST_PATH_INDEX)?.id ?? ROOT_PARENT_ID;
  }

  public updatePath(messages: readonly Readonly<TMessage>[]): void {
    this.validatePath(messages, true);
    let parentId: string | null = ROOT_PARENT_ID;
    for (const message of messages) {
      this.upsertMessage(message, parentId);
      parentId = message.id;
    }
  }

  public restore(snapshot: SnapshotInput<TMessage>): void {
    const restored = new MessageTree<TMessage>();
    for (const { message, parentId } of snapshot.nodes) {
      if (restored.has(message.id)) {
        throw new Error(`Duplicate message id ${message.id} in snapshot`);
      }
      restored.upsertMessage(message, parentId);
    }
    restored.setCursor(snapshot.cursorId);

    this.restoreFrom({
      childrenByParentId: restored.#childrenByParentId,
      cursorId: restored.#cursorId,
      messagesById: restored.#messagesById,
      parentById: restored.#parentById,
    });
  }

  public clear(): void {
    this.#childrenByParentId.clear();
    this.#messagesById.clear();
    this.#parentById.clear();
    this.#cursorId = ROOT_PARENT_ID;
  }

  private *walkDescendantIds(parentId: string | null): Generator<string> {
    for (const childId of this.#childrenByParentId.get(parentId) ?? []) {
      yield childId;
      yield* this.walkDescendantIds(childId);
    }
  }

  private validatePath(
    messages: readonly Readonly<TMessage>[],
    validateExistingParents = false
  ): void {
    validateMessagePath(messages, this.#parentById, validateExistingParents);
  }

  private restoreFrom(restored: TreeStorageReader<TMessage>): void {
    this.clear();
    for (const [id, message] of restored.messagesById) {
      this.#messagesById.set(id, message);
    }
    for (const [id, parentId] of restored.parentById) {
      this.#parentById.set(id, parentId);
    }
    for (const [id, children] of restored.childrenByParentId) {
      this.#childrenByParentId.set(id, children);
    }
    this.#cursorId = restored.cursorId;
  }
}

export { MessageTree };
