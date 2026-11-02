import type { QueryClient } from "@tanstack/react-query";
import type { EveMessage, SessionStreamEvent } from "eve/client";

import type { Session } from "@/lib/auth";
import type {
  getEveChatPageConversation,
  listEveConversations,
} from "@/lib/db/eve-queries";
import type { getProjectById } from "@/chatjs/plugins/projects/db/project-queries";
import type { getPublicEveTranscript } from "@/chatjs/plugins/sharing/public-conversation";

/** What the route files' server reads return for this request. */
export interface ServerData {
  conversation?: Awaited<ReturnType<typeof getEveChatPageConversation>>;
  conversations?: Awaited<ReturnType<typeof listEveConversations>>;
  project?: Awaited<ReturnType<typeof getProjectById>>;
  transcript?: Awaited<ReturnType<typeof getPublicEveTranscript>>;
}

/** The request a page test renders: read by the next/*, auth, data, and tRPC doubles in setup.tsx. */
export const route: {
  /** The error the replayed EVE session reports, as when the last reply failed. */
  agentError: string | null;
  agentStatus: "ready" | "streaming";
  agentEventHandlers: Map<string, (event: SessionStreamEvent) => void>;
  events: Record<string, readonly SessionStreamEvent[]>;
  cookies: Record<string, string>;
  /** The sign-in method this browser remembers using last. */
  lastLoginMethod: string | null;
  /** Procedures the page called that have no fixture; the test fails on any. */
  missingFixtures: Set<string>;
  path: string;
  queryClients: Set<QueryClient>;
  search: string;
  server: ServerData;
  session: Session | null;
  /** Messages each EVE session replays, keyed by session id. */
  transcripts: Record<string, readonly EveMessage[]>;
  /** Each procedure's result, or a function of its input. */
  trpc: Record<string, unknown>;
} = {
  agentError: null,
  agentStatus: "ready",
  agentEventHandlers: new Map(),
  events: {},
  cookies: {},
  lastLoginMethod: null,
  missingFixtures: new Set(),
  path: "/",
  queryClients: new Set(),
  search: "",
  server: {},
  session: null,
  transcripts: {},
  trpc: {},
};

const ERROR_SHAPES = {
  INTERNAL_SERVER_ERROR: { code: -32_603, httpStatus: 500 },
  NOT_FOUND: { code: -32_004, httpStatus: 404 },
  UNAUTHORIZED: { code: -32_001, httpStatus: 401 },
} as const;

/** A procedure fixture that fails the way the server would. */
export class TrpcFixtureError {
  public readonly code: keyof typeof ERROR_SHAPES;
  public readonly message: string;

  public constructor(code: keyof typeof ERROR_SHAPES, message: string) {
    this.code = code;
    this.message = message;
  }

  /** The error tRPC sends for `path`, before serialization. */
  public toResponse(path: string): {
    code: number;
    data: { code: string; httpStatus: number; path: string };
    message: string;
  } {
    const { code, httpStatus } = ERROR_SHAPES[this.code];
    return {
      code,
      data: { code: this.code, httpStatus, path },
      message: this.message,
    };
  }
}
