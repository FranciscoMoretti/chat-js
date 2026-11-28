import type { ReadonlyEveMessageInput } from "@/lib/eve/readonly-message-types";
import type { SessionStreamEvent } from "eve/client";
import type { SQL } from "drizzle-orm";
import type { db } from "@/lib/db/client";

/** Browser-safe context for recovering a request in its original draft location. */
export interface ChatCreationScope {
  readonly key: string;
  readonly label: string;
}

export interface ChatLinks {
  readonly href: string;
  readonly parentHref: string;
}

export interface ChatCreatedContext {
  readonly ownerId: string;
  readonly branchId: string;
  readonly message: ReadonlyEveMessageInput;
}

/** Presentation metadata for branches that share an authored message. */
export interface ChatBranchGroup {
  readonly id: string;
  /** Branch creation operations in prompt display order. */
  readonly operationIds: readonly string[];
  /** Serializable details interpreted by the integration that supplied the group. */
  readonly details?: unknown;
}

export interface ChatServerIntegration {
  /** Runs under the owner lock, before reservation/replay. A retired operation may reject. */
  readonly resolveCreationChatId?: (
    tx: Readonly<Pick<typeof db, "select">>,
    ownerId: string,
    operationId: string
  ) => Promise<string | undefined>;
  /** May repeat at finalization; changes must commit with the caller's deletion fence. */
  readonly onFenceConversations?: (
    tx: Readonly<Pick<typeof db, "update">>,
    ownerId: string,
    members: readonly { readonly id: string; readonly operationId: string }[]
  ) => Promise<void>;
  /** Prompt groups for an already-authorized list of branch operations. */
  readonly branchGroups?: (
    ownerId: string,
    operationIds: readonly string[]
  ) => Promise<readonly ChatBranchGroup[]>;
  /** Grants read access beyond ownership. Core always requires bound conversations. */
  readonly publicReadFilter?: () => SQL;
  /** After a root creation response, outside its transaction. May repeat on recovery. */
  readonly afterCreate?: (context: ChatCreatedContext) => Promise<void>;
  /** After a branch is bound, outside its transaction. May repeat on recovery. */
  readonly afterBranch?: (context: {
    readonly ownerId: string;
    readonly branchId: string;
    readonly sessionId: string;
  }) => Promise<void>;
  /** Called only for a newly inserted logical chat, before its transaction commits. */
  readonly onCreate?: (context: {
    readonly tx: Readonly<Pick<typeof db, "select" | "insert">>;
    readonly chatId: string;
    readonly ownerId: string;
    readonly projectId?: string;
  }) => Promise<void>;
  /** Additional restriction ANDed with core ownership and cursor predicates. */
  readonly historyFilter?: (
    input: { readonly projectId?: string | null },
    surface: "sidebar" | "all"
  ) => SQL | undefined;
  /** Batched links for already-authorized chat IDs. */
  readonly links?: (
    ownerId: string,
    chatIds: readonly string[]
  ) => Promise<ReadonlyMap<string, ChatLinks>>;
  /** Runs inside deletion's transaction before these conversations are tombstoned. */
  readonly onDeleteConversations?: (
    tx: Readonly<Pick<typeof db, "delete">>,
    context: {
      readonly branchIds: readonly string[];
      readonly sessionIds: readonly string[];
    }
  ) => Promise<void>;
  /** Called within deletion's existing transaction when the last session is removed. */
  readonly onDelete?: (
    tx: Readonly<Pick<typeof db, "delete">>,
    chatId: string
  ) => Promise<void>;
}

export interface ChatActionProps {
  readonly chat: {
    readonly id: string;
    readonly title: string;
    readonly branchId?: string | null;
    readonly state?: string;
  };
}
export interface ChatMessageProps {
  readonly branchId: string;
  readonly messageId: string;
  readonly disabled: boolean;
}
export interface ChatResponseProps extends ChatMessageProps {
  readonly onModelChange: (modelId: string) => void | Promise<void>;
}
export interface ChatSuggestionsProps {
  readonly sessionId: string;
  readonly branchId: string;
  readonly events: readonly SessionStreamEvent[];
  readonly lastMessage?: {
    readonly role: string;
    readonly metadata?: { readonly turnId?: string };
  };
  readonly disabled: boolean;
  readonly onSelect: (suggestion: string) => void;
}
