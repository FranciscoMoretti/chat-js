import type { ReadonlyEveMessageInput } from "@/lib/eve/readonly-message-types";
import type { MessageStreamEvent } from "eve/client";
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
  readonly conversationId: string;
  readonly message: ReadonlyEveMessageInput;
}

export interface ChatServerIntegration {
  /** Grants read access beyond ownership. Core always requires bound conversations. */
  readonly publicReadFilter?: () => SQL;
  /** After a root creation response, outside its transaction. May repeat on recovery. */
  readonly afterCreate?: (context: ChatCreatedContext) => Promise<void>;
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
      readonly conversationIds: readonly string[];
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
    readonly conversationId?: string | null;
    readonly state?: string;
  };
}
export interface ChatMessageActionProps {
  readonly conversationId: string;
  readonly messageId: string;
  readonly disabled: boolean;
}
export interface ChatSuggestionsProps {
  readonly conversationId: string;
  readonly events: readonly MessageStreamEvent[];
  readonly lastMessage?: {
    readonly role: string;
    readonly metadata?: { readonly turnId?: string };
  };
  readonly disabled: boolean;
  readonly onSelect: (suggestion: string) => void;
}
