export type ChatRouteSource = "chat" | "home" | "project" | "share";

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

const SHARE_ROUTE_PATTERN = /^\/share\/(?<shareId>[^/]+)$/u;
const PROJECT_ROUTE_PATTERN =
  /^\/project\/(?<projectId>[^/]+)(?:\/chat\/(?<chatId>[^/]+))?$/u;
const CHAT_ROUTE_PATTERN = /^\/chat\/(?<chatId>[^/]+)$/u;

/**
 * Parse a Next.js pathname into the chat route shape.
 * Unknown paths are passthrough routes and must not become draft chats.
 */
export function parseChatIdFromPathname(
  pathname: string | null
): ParsedChatIdFromPathname {
  const shareId = pathname?.match(SHARE_ROUTE_PATTERN)?.groups?.shareId;
  if (shareId) {
    return {
      type: "share",
      id: shareId,
      source: "share",
      projectId: null,
    };
  }

  const projectGroups = pathname?.match(PROJECT_ROUTE_PATTERN)?.groups;
  if (projectGroups?.projectId) {
    const { chatId, projectId } = projectGroups;
    if (chatId) {
      return { type: "projectChat", id: chatId, source: "project", projectId };
    }
    return { type: "projectHome", id: null, source: "project", projectId };
  }

  const chatId = pathname?.match(CHAT_ROUTE_PATTERN)?.groups?.chatId;
  if (chatId) {
    return { type: "chat", id: chatId, source: "chat", projectId: null };
  }

  if (pathname === "/") {
    return { type: "home", id: null, source: "home", projectId: null };
  }

  return { type: "passthrough", id: null, source: null, projectId: null };
}
