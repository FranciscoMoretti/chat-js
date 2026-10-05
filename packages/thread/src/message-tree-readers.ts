import type { UIMessage } from "ai";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { MessageTreeSnapshot } from "./types";
/* oxlint-enable sort-imports */

type SnapshotInput<TMessage extends UIMessage> = Readonly<
  Omit<MessageTreeSnapshot<TMessage>, "nodes">
> & {
  readonly nodes: readonly Readonly<{
    message: TMessage;
    parentId: string | null;
  }>[];
};

type TreeStorageReader<TMessage extends UIMessage> = Readonly<{
  messagesById: Readonly<Pick<Map<string, TMessage>, typeof Symbol.iterator>>;
  parentById: Readonly<
    Pick<Map<string, string | null>, typeof Symbol.iterator>
  >;
  childrenByParentId: Readonly<
    Pick<Map<string | null, string[]>, typeof Symbol.iterator>
  >;
  cursorId: string | null;
}>;

const PARENT_ID_INDEX = 0;
const clone = <TValue>(value: TValue): TValue => structuredClone(value);

const readMessageTreeIndexes = <TMessage extends UIMessage>({
  childrenByParentId,
  messagesById,
  parentById,
  readRootIds,
}: Readonly<{
  childrenByParentId: Readonly<Pick<Map<string | null, string[]>, "entries">>;
  messagesById: Readonly<Pick<Map<string, TMessage>, "entries">>;
  parentById: Readonly<Pick<Map<string, string | null>, "entries">>;
  readRootIds: () => readonly string[];
}>): {
  childrenByParentId: Record<string, string[]>;
  messagesById: Record<string, TMessage>;
  parentById: Record<string, string | null>;
  rootIds: string[];
} => ({
  childrenByParentId: Object.fromEntries(
    [...childrenByParentId.entries()]
      .filter(
        (
          entry: readonly [string | null, readonly string[]]
        ): entry is [string, string[]] => entry[PARENT_ID_INDEX] !== null
      )
      .map(([id, children]: readonly [string, readonly string[]]) => [
        id,
        [...children],
      ])
  ),
  messagesById: Object.fromEntries(
    Array.from(
      messagesById.entries(),
      ([id, message]: readonly [string, Readonly<TMessage>]) => [
        id,
        clone(message),
      ]
    )
  ),
  parentById: Object.fromEntries(parentById.entries()),
  rootIds: [...readRootIds()],
});

export { readMessageTreeIndexes };
export type { SnapshotInput, TreeStorageReader };
