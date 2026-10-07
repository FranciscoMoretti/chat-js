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

/* oxlint-disable max-statements, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-statements (#512): parseChatIdFromPathname keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): parseChatIdFromPathname intentionally keeps the existing falsy-value behavior of shareId; projectGroups?.projectId; chatId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): parseChatIdFromPathname preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Parses a Next.js pathname into its chat route shape.
 * Unknown paths remain passthrough routes and do not become draft chats.
 * @param {string | null} pathname Browser pathname, or null when it is unavailable.
 * @returns {ParsedChatIdFromPathname} The matched share, project, chat, home, or passthrough route.
 */
const parseChatIdFromPathname = (
  pathname: string | null
): ParsedChatIdFromPathname => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading shareId from pathname.match(...).groups; read groups from pathname.match(...); read match from pathname; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const shareId = pathname?.match(SHARE_ROUTE_PATTERN)?.groups?.shareId;
  if (shareId) {
    return {
      id: shareId,
      projectId: null,
      source: "share",
      type: "share",
    };
  }

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading groups from pathname.match(...); read match from pathname; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const projectGroups = pathname?.match(PROJECT_ROUTE_PATTERN)?.groups;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading projectId from projectGroups; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (projectGroups?.projectId) {
    const { chatId, projectId } = projectGroups;
    if (chatId) {
      return { id: chatId, projectId, source: "project", type: "projectChat" };
    }
    return { id: null, projectId, source: "project", type: "projectHome" };
  }

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatId from pathname.match(...).groups; read groups from pathname.match(...); read match from pathname; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable max-statements, typescript/strict-boolean-expressions, unicorn/no-null */
export { parseChatIdFromPathname };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ChatRouteSource, ParsedChatIdFromPathname); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ChatRouteSource, ParsedChatIdFromPathname };
/* oxlint-enable import/no-named-export */
