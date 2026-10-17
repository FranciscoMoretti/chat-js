import { isNonEmptyString } from "@/lib/is-non-empty-string";

import type { EveMessage, EveMessageData } from "eve/client";
import type { UseEveAgentHelpers } from "eve/react";

import type { EveBranchReference } from "./fork-source";
import { LogicalCommands } from "./logical-commands";

type NativeChatAgent = UseEveAgentHelpers<EveMessageData>;

type LogicalBranch = EveBranchReference & {
  readonly sessionId: string | null;
  readonly createdAt: Date | string;
  readonly initialModelId: string | null;
  readonly operationId: string;
  readonly groupCandidates?:
    | readonly {
        readonly modelId: string;
        readonly operationId: string;
        readonly rejection?: {
          readonly error: string;
          readonly code?: "project_not_found";
        };
      }[]
    | null;
};

interface LogicalNode {
  id: string;
  parentId: string | null;
  conversationId: string;
  message: EveMessage;
}
interface LogicalChatSnapshot {
  readyBranches: ReadonlySet<string>;
  chatId: string;
  conversationId: string;
  cursorId: string | null;
  nodes: ReadonlyMap<string, LogicalNode>;
  paths: ReadonlyMap<string, readonly string[]>;
  aliases: ReadonlyMap<string, string>;
  children: ReadonlyMap<string | null, readonly string[]>;
  branches: readonly LogicalBranch[];
  agents: ReadonlyMap<string, NativeChatAgent>;
  error?: string;
}

const logicalNativeId = (sessionId: string, message: EveMessage): string =>
  JSON.stringify([sessionId, message.id]);

const aliasKey = (branchId: string, messageId: string): string =>
  JSON.stringify([branchId, messageId]);

const busy = (agent?: NativeChatAgent): boolean => {
  if (!agent) {
    return false;
  }
  return (
    agent.status === "streaming" ||
    agent.status === "submitted" ||
    agent.status === "resuming"
  );
};

const latestMessageTime = (
  agent: NativeChatAgent | undefined,
  createdAt: string | Date
): number => {
  let time = new Date(createdAt).getTime();
  if (!agent) {
    return time;
  }
  for (const event of agent.events ?? []) {
    if (
      (event.type === "message.received" || event.type === "step.started") &&
      event.meta?.at
    ) {
      time = Math.max(time, new Date(event.meta.at).getTime());
    }
  }
  return time;
};

const sourcePrefix = (
  branch: LogicalBranch,
  source: readonly string[],
  aliases: ReadonlyMap<string, string>,
  sourceAgent?: NativeChatAgent
): { prefix: string[]; replaced: string | undefined } => {
  if (!isNonEmptyString(branch.parentConversationId)) {
    return { prefix: [], replaced: undefined };
  }
  const sourceId = branch.parentConversationId;
  const boundaryId = isNonEmptyString(branch.forkMessageId)
    ? aliases.get(aliasKey(sourceId, branch.forkMessageId))
    : aliases.get(
        aliasKey(
          sourceId,
          sourceAgent?.data.messages.find(
            (message) =>
              message.role === "user" &&
              message.metadata?.turnId === branch.forkTurnId
          )?.id ?? ""
        )
      );
  const index = isNonEmptyString(boundaryId) ? source.indexOf(boundaryId) : -1;
  // Named idle checkpoints have no following user yet: the entire source is inherited.
  if (index < 0 && branch.forkKind === "comparison") {
    return { prefix: [...source], replaced: undefined };
  }
  if (index < 0) {
    throw new Error(
      "The saved fork boundary is not available yet. Reconnect to restore its source."
    );
  }
  return { prefix: source.slice(0, index), replaced: boundaryId };
};

const assertInheritedMessage = (
  id: string,
  message: NativeChatAgent["data"]["messages"][number],
  branch: LogicalBranch,
  nodes: ReadonlyMap<string, LogicalNode>,
  aliases: ReadonlyMap<string, string>
): void => {
  const origin = nodes.get(id);
  if (!origin || origin.message.role !== message.role) {
    throw new Error(
      "Inherited message identities do not match the saved fork."
    );
  }
  // Both native checkpoints and imported user-boundary forks preserve the
  // retained prefix IDs. Never guess a new alias from position or text.
  if (message.id !== origin.message.id) {
    const inherited = aliases.get(
      aliasKey(branch.parentConversationId ?? "", message.id)
    );
    if (inherited !== id) {
      throw new Error("Unknown inherited message identity.");
    }
  }
};

const projectBranch = (
  branch: LogicalBranch,
  agent: NativeChatAgent,
  paths: ReadonlyMap<string, string[]>,
  nodes: Map<string, LogicalNode>,
  aliases: Map<string, string>,
  sourceAgent?: NativeChatAgent
): { hasLocalMessage: boolean; path: string[] } => {
  const source = paths.get(branch.parentConversationId ?? "") ?? [];
  const { prefix, replaced } = sourcePrefix(
    branch,
    source,
    aliases,
    sourceAgent
  );
  const messages = agent.data.messages.filter(
    (message) =>
      !(message.metadata?.optimistic && message.metadata.status === "failed")
  );
  if (messages.length < prefix.length) {
    throw new Error("Restoring inherited messages…");
  }
  const path: string[] = [];
  for (const [index, message] of messages.entries()) {
    let id = prefix[index];
    if (id) {
      assertInheritedMessage(id, message, branch, nodes, aliases);
    } else {
      const firstUser = index === prefix.length && message.role === "user";
      if (
        firstUser &&
        branch.forkKind === "regenerate" &&
        isNonEmptyString(replaced)
      ) {
        id = replaced;
      } else if (firstUser && isNonEmptyString(branch.responseGroupId)) {
        id = `group:${branch.responseGroupId}:user`;
      } else {
        id = logicalNativeId(branch.sessionId ?? branch.id, message);
      }
      if (!nodes.has(id)) {
        nodes.set(id, {
          conversationId: branch.id,
          id,
          message,
          parentId: path.at(-1) ?? null,
        });
      }
    }
    aliases.set(aliasKey(branch.id, message.id), id);
    if (!path.includes(id)) {
      path.push(id);
    }
  }
  const needsResponse =
    branch.forkKind === "regenerate" ||
    (Boolean(branch.responseGroupId) && branch.forkKind !== "edit");
  if (needsResponse) {
    return {
      hasLocalMessage: messages
        .slice(prefix.length)
        .some((message) => message.role === "assistant"),
      path,
    };
  }
  return { hasLocalMessage: messages.length > prefix.length, path };
};

/**
 * Chat identity and selection are independent of native session lifetime.
 * Durable branch intent plus native replay reconstructs this disposable index.
 * Content remains in the native store; copied prefixes never become writers.
 */
class LogicalChat {
  public readonly commands = new LogicalCommands();
  private branches: LogicalBranch[] = [];
  private readonly agents = new Map<string, NativeChatAgent>();
  private readonly listeners = new Set<() => void>();
  private selected: string;
  private cursor: string | null = null;
  private follow = true;
  private visible = false;
  private hydrateLatest: boolean;
  private pendingSelection: string | undefined;
  private snapshot: LogicalChatSnapshot;

  public readonly chatId: string;
  public constructor(
    chatId: string,
    initialConversationId: string,
    hydrateLatest = false
  ) {
    this.hydrateLatest = hydrateLatest;
    this.chatId = chatId;
    this.selected = initialConversationId;
    this.snapshot = {
      agents: new Map(),
      aliases: new Map(),
      branches: [],
      chatId,
      children: new Map(),
      conversationId: initialConversationId,
      cursorId: null,
      nodes: new Map(),
      paths: new Map(),
      readyBranches: new Set(),
    };
  }

  public getSnapshot = (): LogicalChatSnapshot => this.snapshot;
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  };

  public setBranches(branches: readonly LogicalBranch[]): void {
    this.branches = branches.toSorted(
      (leftBranch, rightBranch) =>
        new Date(leftBranch.createdAt).getTime() -
          new Date(rightBranch.createdAt).getTime() ||
        (leftBranch.responseGroupIndex ?? 0) -
          (rightBranch.responseGroupIndex ?? 0) ||
        leftBranch.id.localeCompare(rightBranch.id)
    );
    this.publish();
  }

  public observe(conversationId: string, agent: NativeChatAgent): void {
    const previous = this.agents.get(conversationId);
    if (
      previous?.data === agent.data &&
      previous.events === agent.events &&
      previous.status === agent.status &&
      previous.error === agent.error
    ) {
      return;
    }
    this.agents.set(conversationId, agent);
    this.publish();
  }

  public setVisible(visible: boolean): void {
    if (this.visible && !visible) {
      this.leave();
    }
    this.visible = visible;
  }

  public leave(): void {
    this.hydrateLatest = false;
    this.follow = false;
    this.pendingSelection = undefined;
  }

  public selectBranch(conversationId: string): void {
    this.hydrateLatest = false;
    this.follow = true;
    const path = this.snapshot.paths.get(conversationId);
    if (
      path !== undefined &&
      path.length > 0 &&
      this.snapshot.readyBranches.has(conversationId)
    ) {
      this.pendingSelection = undefined;
      this.selected = conversationId;
      this.cursor = path.at(-1) ?? null;
    } else {
      this.pendingSelection = conversationId;
    }
    this.publish();
  }

  public selectNode(id: string): void {
    this.hydrateLatest = false;
    let node = this.snapshot.nodes.get(id);
    if (!node) {
      return;
    }
    let last = (this.snapshot.children.get(node.id) ?? []).at(-1);
    while (isNonEmptyString(last)) {
      node = this.snapshot.nodes.get(last) ?? node;
      last = (this.snapshot.children.get(node.id) ?? []).at(-1);
    }
    this.pendingSelection = undefined;
    this.selected = node.conversationId;
    this.cursor = node.id;
    this.follow =
      node.message.role === "user" &&
      busy(this.agents.get(node.conversationId));
    this.publish();
  }

  public logicalId(
    conversationId: string,
    nativeId: string
  ): string | undefined {
    return this.snapshot.aliases.get(aliasKey(conversationId, nativeId));
  }

  public siblings(
    conversationId: string,
    nativeId: string
  ): { ids: readonly string[]; index: number } {
    const id = this.logicalId(conversationId, nativeId);
    if (!isNonEmptyString(id)) {
      return { ids: [], index: -1 };
    }
    const node = this.snapshot.nodes.get(id);
    if (!node) {
      return { ids: [], index: -1 };
    }
    const ids = this.snapshot.children.get(node.parentId) ?? [];
    return { ids, index: ids.indexOf(id) };
  }

  private selectHydratedBranch(
    paths: ReadonlyMap<string, readonly string[]>
  ): void {
    if (
      this.hydrateLatest &&
      paths.size === this.branches.length &&
      this.branches.every(
        (branch) => this.agents.get(branch.id)?.status !== "resuming"
      )
    ) {
      this.hydrateLatest = false;
      const newest = this.branches
        .toSorted(
          (left, right) =>
            latestMessageTime(this.agents.get(left.id), left.createdAt) -
            latestMessageTime(this.agents.get(right.id), right.createdAt)
        )
        .at(-1);
      if (newest) {
        this.selected = newest.id;
      }
    }
  }

  private selectReadyBranch(
    paths: ReadonlyMap<string, readonly string[]>,
    readyBranches: ReadonlySet<string>
  ): void {
    const { pendingSelection } = this;
    const pendingPath = isNonEmptyString(pendingSelection)
      ? paths.get(pendingSelection)
      : pendingSelection;
    if (
      pendingPath !== undefined &&
      pendingPath.length > 0 &&
      isNonEmptyString(this.pendingSelection) &&
      readyBranches.has(this.pendingSelection)
    ) {
      this.selected = this.pendingSelection;
      this.pendingSelection = undefined;
      this.cursor = pendingPath.at(-1) ?? null;
    }
  }

  private followSelectedBranch(
    paths: ReadonlyMap<string, readonly string[]>
  ): void {
    const selectedPath = paths.get(this.selected);
    if (this.follow || !isNonEmptyString(this.cursor)) {
      this.cursor = (selectedPath ?? []).at(-1) ?? this.cursor;
    }
  }

  private publish(): void {
    const nodes = new Map<string, LogicalNode>();
    const paths = new Map<string, string[]>();
    const readyBranches = new Set<string>();
    const aliases = new Map<string, string>();
    const children = new Map<string | null, string[]>();
    const waiting = new Map(this.branches.map((branch) => [branch.id, branch]));
    let error: string | undefined;
    // Parents must be reduced before descendants, regardless of stream arrival.
    while (waiting.size > 0) {
      let progressed = false;
      for (const [id, branch] of waiting) {
        if (
          isNonEmptyString(branch.parentConversationId) &&
          !paths.has(branch.parentConversationId)
        ) {
          continue;
        }
        const agent = this.agents.get(id);
        if (agent === undefined || agent.data.messages.length === 0) {
          continue;
        }
        try {
          const stagedNodes = new Map(nodes);
          const stagedAliases = new Map(aliases);
          const projection = projectBranch(
            branch,
            agent,
            paths,
            stagedNodes,
            stagedAliases,
            this.agents.get(branch.parentConversationId ?? "")
          );
          for (const [key, node] of stagedNodes) {
            nodes.set(key, node);
          }
          for (const [key, alias] of stagedAliases) {
            aliases.set(key, alias);
          }
          paths.set(id, projection.path);
          if (projection.hasLocalMessage) {
            readyBranches.add(id);
          }
        } catch (projectionError) {
          error =
            projectionError instanceof Error
              ? projectionError.message
              : "Unable to restore the chat tree.";
        }
        waiting.delete(id);
        progressed = true;
      }
      if (!progressed) {
        break;
      }
    }
    // Insertion order follows durable branch reservation order, never stream arrival.
    for (const node of nodes.values()) {
      const siblings = children.get(node.parentId) ?? [];
      siblings.push(node.id);
      children.set(node.parentId, siblings);
    }
    this.selectHydratedBranch(paths);
    this.selectReadyBranch(paths, readyBranches);
    this.followSelectedBranch(paths);
    this.snapshot = {
      agents: new Map(this.agents),
      aliases,
      branches: this.branches,
      chatId: this.chatId,
      children,
      conversationId: this.selected,
      cursorId: this.cursor,
      error,
      nodes,
      paths,
      readyBranches,
    };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const logicalChatBusy = (snapshot: LogicalChatSnapshot): boolean =>
  [...snapshot.agents.values()].some((agent) => busy(agent));

export { LogicalChat, logicalChatBusy };
export type { LogicalBranch, LogicalChatSnapshot, NativeChatAgent };
