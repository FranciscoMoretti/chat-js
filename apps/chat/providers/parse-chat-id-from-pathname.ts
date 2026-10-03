/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): ChatRouteSource is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ChatRouteSource stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ChatRouteSource API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ChatRouteSource = "chat" | "home" | "project" | "share";
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): ParsedChatIdFromPathname is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ParsedChatIdFromPathname stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ParsedChatIdFromPathname API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ParsedChatIdFromPathname =
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
/* oxlint-enable import/exports-last, import/group-exports */

const SHARE_ROUTE_PATTERN = /^\/share\/(?<shareId>[^/]+)$/u;
const PROJECT_ROUTE_PATTERN =
  /^\/project\/(?<projectId>[^/]+)(?:\/chat\/(?<chatId>[^/]+))?$/u;
const CHAT_ROUTE_PATTERN = /^\/chat\/(?<chatId>[^/]+)$/u;

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/strict-boolean-expressions, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named parseChatIdFromPathname API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): parseChatIdFromPathname's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): parseChatIdFromPathname's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): parseChatIdFromPathname keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-optional-chaining (#542): parseChatIdFromPathname handles optional pathname?.match(SHARE_ROUTE_PATTERN)?.groups?.shareId; pathname?.match(PROJECT_ROUTE_PATTERN)?.groups; projectGroups?.projectId; pathname?.match(CHAT_ROUTE_PATTERN)?.groups?.chatId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/strict-boolean-expressions (#610): parseChatIdFromPathname intentionally keeps the existing falsy-value behavior of shareId; projectGroups?.projectId; chatId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): parseChatIdFromPathname preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Parse a Next.js pathname into the chat route shape.
 * Unknown paths are passthrough routes and must not become draft chats.
 */
export const parseChatIdFromPathname = (
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/strict-boolean-expressions, unicorn/no-null */
