// oxlint-disable-next-line unicorn/no-null -- Serialized tree nodes and cursor use null for the root; undefined separately means a missing map entry.
const ROOT_PARENT_ID = null;
// oxlint-disable-next-line eslint/no-undefined -- Map.get returns undefined for an absent node; preserve that value separately from the serialized null root and IDs including empty strings.
const ABSENT_MESSAGE = undefined;

const EMPTY_CHILD_COUNT = 0;

type ParentReader = Readonly<Pick<Map<string, string | null>, "get">>;

const assertParentUnchanged = (
  message: Readonly<{ id: string }>,
  parentId: string | null,
  parentById: ParentReader
): void => {
  const existingParentId = parentById.get(message.id);
  if (existingParentId !== ABSENT_MESSAGE && existingParentId !== parentId) {
    throw new Error(
      `Cannot move message ${message.id} from ${existingParentId ?? "root"} to ${parentId ?? "root"}`
    );
  }
};

const assertParentExistsAndAcyclic = (
  message: Readonly<{ id: string }>,
  parentId: string | null,
  readers: Readonly<{
    parentById: ParentReader;
    hasMessage: (id: string) => boolean;
  }>
): void => {
  if (parentId !== ROOT_PARENT_ID && !readers.hasMessage(parentId)) {
    throw new Error(`Unknown parent message ${parentId}`);
  }
  let ancestorId = parentId;
  while (ancestorId !== ROOT_PARENT_ID) {
    if (ancestorId === message.id) {
      throw new Error(`Cannot create a cycle involving ${message.id}`);
    }
    ancestorId = readers.parentById.get(ancestorId) ?? ROOT_PARENT_ID;
  }
};

const assertLeaf = (messageId: string, children: readonly string[]): void => {
  if (children.length > EMPTY_CHILD_COUNT) {
    throw new Error(`Cannot remove non-leaf message ${messageId}`);
  }
};

const validateMessagePath = (
  messages: readonly Readonly<{ id: string }>[],
  parentById: ParentReader,
  validateExistingParents: boolean
): void => {
  const ids = new Set<string>();
  let parentId: string | null = ROOT_PARENT_ID;
  for (const message of messages) {
    if (ids.has(message.id)) {
      throw new Error(`Duplicate message id ${message.id} in path`);
    }
    ids.add(message.id);
    if (validateExistingParents) {
      assertParentUnchanged(message, parentId, parentById);
    }
    parentId = message.id;
  }
};

export {
  ROOT_PARENT_ID,
  ABSENT_MESSAGE,
  assertLeaf,
  assertParentUnchanged,
  assertParentExistsAndAcyclic,
  validateMessagePath,
};
