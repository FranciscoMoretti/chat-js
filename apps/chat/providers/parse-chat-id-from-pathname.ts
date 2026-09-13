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
