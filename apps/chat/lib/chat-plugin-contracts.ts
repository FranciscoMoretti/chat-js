import type { ComponentType } from "react";
import type { SQL } from "drizzle-orm";
import type { z } from "zod";
import type { db } from "./db/client";

/** Browser-safe context for recovering a request in its original draft location. */
export interface ChatCreationScope {
  readonly key: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly label: string;
}

export interface PluginChatRoute {
  readonly id: string | null;
  readonly parentHref: string;
  readonly contextId: string;
}

/** Pure contracts may be imported by both servers and browsers. */
export interface ChatSharedPlugin {
  readonly id: string;
  readonly creationFields?: z.ZodRawShape;
  readonly historyFields?: z.ZodRawShape;
  readonly validateCreation?: (
    input: Readonly<Record<string, unknown>>
  ) => boolean;
  readonly creationScope?: (input: unknown) => ChatCreationScope | undefined;
  readonly parseRoute?: (pathname: string) => PluginChatRoute | undefined;
}

export interface ChatLinks {
  readonly href: string;
  readonly parentHref: string;
}

export interface ChatServerIntegration {
  /** Called only for a newly inserted logical chat, before its transaction commits. */
  readonly onCreate?: (context: {
    readonly tx: Readonly<Pick<typeof db, "select" | "insert">>;
    readonly chatId: string;
    readonly ownerId: string;
    readonly request: unknown;
  }) => Promise<void>;
  /** Additional restriction ANDed with core ownership and cursor predicates. */
  readonly historyFilter?: (
    input: unknown,
    surface: "sidebar" | "all"
  ) => SQL | undefined;
  /** Batched links for already-authorized chat IDs. */
  readonly links?: (
    ownerId: string,
    chatIds: readonly string[]
  ) => Promise<ReadonlyMap<string, ChatLinks>>;
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
    readonly state?: string;
  };
}
export interface ChatClientIntegration {
  readonly Sidebar?: ComponentType;
  readonly Actions?: ComponentType<ChatActionProps>;
  readonly Breadcrumb?: ComponentType<{ readonly chatId: string }>;
}
