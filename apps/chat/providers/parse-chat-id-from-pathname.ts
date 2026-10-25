import { installedPlugins } from "@/composition/generated/installed";

type ChatRouteSource = "chat" | "home" | "plugin" | "share";
interface ParsedChatIdFromPathname {
  readonly type:
    | "home"
    | "chat"
    | "pluginHome"
    | "pluginChat"
    | "share"
    | "passthrough";
  readonly id: string | null;
  readonly source: ChatRouteSource | null;
  readonly contextId: string | null;
  readonly pluginId: string | null;
  readonly parentHref: string;
}
const SHARE_ROUTE_PATTERN = /^\/share\/(?<id>[^/]+)$/u;
const PROJECT_ROUTE_PATTERN =
  /^\/project\/(?<projectId>[^/]+)(?:\/chat\/(?<chatId>[^/]+))?$/u;
const CHAT_ROUTE_PATTERN = /^\/chat\/(?<id>[^/]+)$/u;
const parseChatIdFromPathname = (
  pathname: string | null
): ParsedChatIdFromPathname => {
  const base = { contextId: null, pluginId: null, parentHref: "/" as const };
  const shareId = pathname?.match(SHARE_ROUTE_PATTERN)?.groups?.id;
  if (shareId !== undefined) {
    return { ...base, id: shareId, source: "share", type: "share" };
  }
  const project = pathname?.match(PROJECT_ROUTE_PATTERN)?.groups;
  if (installedPlugins.has("projects") && project?.projectId !== undefined) {
    return {
      id: project.chatId ?? null,
      contextId: project.projectId,
      parentHref: `/project/${project.projectId}`,
      pluginId: "projects",
      source: "plugin",
      type: project.chatId === undefined ? "pluginHome" : "pluginChat",
    };
  }
  const chatId = pathname?.match(CHAT_ROUTE_PATTERN)?.groups?.id;
  if (chatId !== undefined) {
    return { ...base, id: chatId, source: "chat", type: "chat" };
  }
  if (pathname === "/") {
    return { ...base, id: null, source: "home", type: "home" };
  }
  return { ...base, id: null, source: null, type: "passthrough" };
};
export { parseChatIdFromPathname };
export type { ChatRouteSource, ParsedChatIdFromPathname };
