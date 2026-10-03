import type { EveMessage, EveMessageData } from "eve/client";
import type { UseEveAgentHelpers } from "eve/react";

import type { EveBranchReference } from "./fork-source";
import { LogicalCommands } from "./logical-commands";

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): NativeChatAgent is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): NativeChatAgent stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type NativeChatAgent = UseEveAgentHelpers<EveMessageData>;
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): LogicalBranch is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): LogicalBranch stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type LogicalBranch = EveBranchReference & {
  sessionId: string | null;
  createdAt: Date | string;
  initialModelId: string | null;
  operationId: string;
  groupCandidates?:
    | {
        modelId: string;
        operationId: string;
        rejection?: { error: string; code?: "project_not_found" };
      }[]
    | null;
};
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): LogicalNode preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type LogicalNode = {
  id: string;
  parentId: string | null;
  conversationId: string;
  message: EveMessage;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-disable import/exports-last, import/group-exports, typescript/consistent-type-definitions --
 * import/exports-last (#522): LogicalChatSnapshot is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): LogicalChatSnapshot stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/consistent-type-definitions (#559): LogicalChatSnapshot preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type LogicalChatSnapshot = {
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
};
/* oxlint-enable import/exports-last, import/group-exports, typescript/consistent-type-definitions */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): logicalNativeId accepts message: EveMessage; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): logicalNativeId intentionally keeps the existing falsy-value behavior of custom; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const logicalNativeId = (sessionId: string, message: EveMessage): string => {
  const custom = message.metadata?.custom?.chatjs;
  if (
    message.role === "user" &&
    custom &&
    typeof custom === "object" &&
    "operationId" in custom &&
    typeof custom.operationId === "string"
  ) {
    return JSON.stringify([sessionId, "operation", custom.operationId, "user"]);
  }
  return JSON.stringify([sessionId, message.id]);
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

const aliasKey = (branchId: string, messageId: string): string =>
  JSON.stringify([branchId, messageId]);

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): busy accepts agent?: NativeChatAgent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const busy = (agent?: NativeChatAgent): boolean =>
  agent?.status === "streaming" ||
  agent?.status === "submitted" ||
  agent?.status === "resuming";
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): latestMessageTime accepts agent: NativeChatAgent | undefined; createdAt: string | Date; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const latestMessageTime = (
  agent: NativeChatAgent | undefined,
  createdAt: string | Date
): number => {
  let time = new Date(createdAt).getTime();
  for (const event of agent?.events ?? []) {
    if (
      (event.type === "message.received" || event.type === "step.started") &&
      event.meta?.at
    ) {
      time = Math.max(time, new Date(event.meta.at).getTime());
    }
  }
  return time;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, import/exports-last, import/group-exports, init-declarations, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * id-length (#506): LogicalChat uses a; b as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/exports-last (#522): LogicalChat is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): LogicalChat stays exported at its declaration so its public contract is visible beside its implementation.
 * init-declarations (#507): LogicalChat assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): LogicalChat keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): LogicalChat keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): LogicalChat skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): LogicalChat uses 0, -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): LogicalChat uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep LogicalChat's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep LogicalChat's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): LogicalChat accepts branches: readonly LogicalBranch[]; a; b; agent: NativeChatAgent; branch; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): LogicalChat intentionally keeps the existing falsy-value behavior of path?.length; last; id; branch.parentConversationId; agent?.data.messages.length; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): LogicalChat preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Chat identity and selection are independent of native session lifetime.
 * Durable branch intent plus native replay reconstructs this disposable index.
 * Content remains in the native store; copied prefixes never become writers.
 */
export class LogicalChat {
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

  public getSnapshot = () => this.snapshot;
  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public setBranches(branches: readonly LogicalBranch[]): void {
    this.branches = branches.toSorted(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        (a.responseGroupIndex ?? 0) - (b.responseGroupIndex ?? 0) ||
        a.id.localeCompare(b.id)
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
    if (path?.length && this.snapshot.readyBranches.has(conversationId)) {
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
    let last = this.snapshot.children.get(node.id)?.at(-1);
    while (last) {
      node = this.snapshot.nodes.get(last) ?? node;
      last = this.snapshot.children.get(node.id)?.at(-1);
    }
    this.pendingSelection = undefined;
    this.selected = node.conversationId;
    this.cursor = node.id;
    this.follow =
      node.message.role === "user" &&
      busy(this.agents.get(node.conversationId));
    this.publish();
  }

  public logicalId(conversationId: string, nativeId: string) {
    return this.snapshot.aliases.get(aliasKey(conversationId, nativeId));
  }

  public siblings(conversationId: string, nativeId: string) {
    const id = this.logicalId(conversationId, nativeId);
    const node = id ? this.snapshot.nodes.get(id) : undefined;
    const ids = node ? (this.snapshot.children.get(node.parentId) ?? []) : [];
    return { ids, index: id ? ids.indexOf(id) : -1 };
  }

  // oxlint-disable-next-line eslint/complexity -- Atomically publish topology, aliases and selection after ordered projection.
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
          branch.parentConversationId &&
          !paths.has(branch.parentConversationId)
        ) {
          continue;
        }
        const agent = this.agents.get(id);
        if (!agent?.data.messages.length) {
          continue;
        }
        try {
          const stagedNodes = new Map(nodes);
          const stagedAliases = new Map(aliases);
          // oxlint-disable-next-line eslint/no-use-before-define -- Projection helpers are kept below the public controller.
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
    const pendingPath =
      this.pendingSelection && paths.get(this.pendingSelection);
    if (
      pendingPath?.length &&
      this.pendingSelection &&
      readyBranches.has(this.pendingSelection)
    ) {
      this.selected = this.pendingSelection;
      this.pendingSelection = undefined;
      this.cursor = pendingPath.at(-1) ?? null;
    }
    const selectedPath = paths.get(this.selected);
    if (this.follow || !this.cursor) {
      this.cursor = selectedPath?.at(-1) ?? this.cursor;
    }
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
/* oxlint-enable id-length, import/exports-last, import/group-exports, init-declarations, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-params, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-params (#511): sourcePrefix keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): sourcePrefix uses -1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): sourcePrefix uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep sourcePrefix's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): sourcePrefix accepts branch: LogicalBranch; aliases: ReadonlyMap<string, string>; sourceAgent?: NativeChatAgent; message; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): sourcePrefix intentionally keeps the existing falsy-value behavior of branch.parentConversationId; branch.forkMessageId; boundaryId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const sourcePrefix = (
  branch: LogicalBranch,
  source: readonly string[],
  aliases: ReadonlyMap<string, string>,
  sourceAgent?: NativeChatAgent
) => {
  if (!branch.parentConversationId) {
    return { prefix: [], replaced: undefined };
  }
  const sourceId = branch.parentConversationId;
  const boundaryId = branch.forkMessageId
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
  const index = boundaryId ? source.indexOf(boundaryId) : -1;
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
/* oxlint-enable max-params, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): projectBranch keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): projectBranch keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): projectBranch keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): projectBranch uses -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep projectBranch's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): projectBranch accepts branch: LogicalBranch; agent: NativeChatAgent; paths: ReadonlyMap<string, string[]>; nodes: Map<string, LogicalNode>; aliases: Map<string, string>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): projectBranch intentionally keeps the existing falsy-value behavior of replaced; branch.responseGroupId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): projectBranch preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line eslint/complexity -- Prefix aliases, regenerated users and new native nodes share a single ordered pass.
const projectBranch = (
  branch: LogicalBranch,
  agent: NativeChatAgent,
  paths: ReadonlyMap<string, string[]>,
  nodes: Map<string, LogicalNode>,
  aliases: Map<string, string>,
  sourceAgent?: NativeChatAgent
) => {
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
    } else {
      const firstUser = index === prefix.length && message.role === "user";
      if (firstUser && branch.forkKind === "regenerate" && replaced) {
        id = replaced;
      } else if (firstUser && branch.responseGroupId) {
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
  const hasLocalMessage = needsResponse
    ? messages
        .slice(prefix.length)
        .some((message) => message.role === "assistant")
    : messages.length > prefix.length;
  return { hasLocalMessage, path };
};
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): logicalChatBusy stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/prefer-readonly-parameter-types (#565): logicalChatBusy accepts snapshot: LogicalChatSnapshot; agent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const logicalChatBusy = (snapshot: LogicalChatSnapshot): boolean =>
  [...snapshot.agents.values()].some((agent) => busy(agent));
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- #509: This logical-chat.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
