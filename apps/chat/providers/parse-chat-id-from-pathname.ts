type ChatRouteSource = "chat" | "home" | "project" | "share";

type ParsedChatIdFromPathname =
  | {
      type: "home";
      id: null;
      source: "home";
      projectId: null;
    }
  | {
      type: "projectHome";
      id: null;
      source: "project";
      projectId: string;
    }
  | {
      type: "chat";
      id: string;
      source: "chat";
      projectId: null;
    }
  | {
      type: "projectChat";
      id: string;
      source: "project";
      projectId: string;
    }
  | {
      type: "share";
      id: string;
      source: "share";
      projectId: null;
    }
  | {
      type: "passthrough";
      id: null;
      source: null;
      projectId: null;
    };

const SHARE_ROUTE_PATTERN = /^\/share\/(?<shareId>[^/]+)$/u;
const PROJECT_ROUTE_PATTERN =
  /^\/project\/(?<projectId>[^/]+)(?:\/chat\/(?<chatId>[^/]+))?$/u;
const CHAT_ROUTE_PATTERN = /^\/chat\/(?<chatId>[^/]+)$/u;

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/strict-boolean-expressions, unicorn/no-null --
 * jsdoc/require-param (#534): parseChatIdFromPathname's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): parseChatIdFromPathname's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): parseChatIdFromPathname keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): parseChatIdFromPathname intentionally keeps the existing falsy-value behavior of shareId; projectGroups?.projectId; chatId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): parseChatIdFromPathname preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Parse a Next.js pathname into the chat route shape.
 * Unknown paths are passthrough routes and must not become draft chats.
 */
const parseChatIdFromPathname = (
  pathname: string | null
): ParsedChatIdFromPathname => {
  const shareId = pathname?.match(SHARE_ROUTE_PATTERN)?.groups?.shareId;
  if (shareId) {
    return {
      id: shareId,
      projectId: null,
      source: "share",
      type: "share",
    };
  }

  const projectGroups = pathname?.match(PROJECT_ROUTE_PATTERN)?.groups;
  if (projectGroups?.projectId) {
    const { chatId, projectId } = projectGroups;
    if (chatId) {
      return { id: chatId, projectId, source: "project", type: "projectChat" };
    }
    return { id: null, projectId, source: "project", type: "projectHome" };
  }

  const chatId = pathname?.match(CHAT_ROUTE_PATTERN)?.groups?.chatId;
  if (chatId) {
    return { id: chatId, projectId: null, source: "chat", type: "chat" };
  }

  if (pathname === "/") {
    return { id: null, projectId: null, source: "home", type: "home" };
  }

  return { id: null, projectId: null, source: null, type: "passthrough" };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (parseChatIdFromPathname); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/strict-boolean-expressions, unicorn/no-null */
export { parseChatIdFromPathname };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ChatRouteSource, ParsedChatIdFromPathname); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ChatRouteSource, ParsedChatIdFromPathname };
/* oxlint-enable import/no-named-export */
