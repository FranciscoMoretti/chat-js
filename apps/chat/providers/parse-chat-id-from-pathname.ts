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

/**
 * Parses a Next.js pathname into its chat route shape.
 * Unknown paths remain passthrough routes and do not become draft chats.
 * @param {string | null} pathname Browser pathname, or null when it is unavailable.
 * @returns {ParsedChatIdFromPathname} The matched share, project, chat, home, or passthrough route.
 */
const parseChatIdFromPathname = (
  pathname: string | null
): ParsedChatIdFromPathname => {
  const shareId = pathname?.match(SHARE_ROUTE_PATTERN)?.groups?.shareId;
  if (typeof shareId === "string" && shareId !== "") {
    return {
      id: shareId,
      projectId: null,
      source: "share",
      type: "share",
    };
  }

  const projectGroups = pathname?.match(PROJECT_ROUTE_PATTERN)?.groups;
  const matchedProjectId = projectGroups?.projectId;
  if (
    projectGroups &&
    typeof matchedProjectId === "string" &&
    matchedProjectId !== ""
  ) {
    const { chatId, projectId } = projectGroups;
    if (typeof chatId === "string" && chatId !== "") {
      return { id: chatId, projectId, source: "project", type: "projectChat" };
    }
    return { id: null, projectId, source: "project", type: "projectHome" };
  }

  const chatId = pathname?.match(CHAT_ROUTE_PATTERN)?.groups?.chatId;
  if (typeof chatId === "string" && chatId !== "") {
    return { id: chatId, projectId: null, source: "chat", type: "chat" };
  }

  if (pathname === "/") {
    return { id: null, projectId: null, source: "home", type: "home" };
  }

  return { id: null, projectId: null, source: null, type: "passthrough" };
};
export { parseChatIdFromPathname };
export type { ChatRouteSource, ParsedChatIdFromPathname };
