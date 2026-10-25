import { installedSharedPlugins } from "@/composition/generated/installed-shared";

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
const CHAT_ROUTE_PATTERN = /^\/chat\/(?<id>[^/]+)$/u;
const parseChatIdFromPathname = (
  pathname: string | null
): ParsedChatIdFromPathname => {
  const base = { contextId: null, pluginId: null, parentHref: "/" as const };
  const shareId = pathname?.match(SHARE_ROUTE_PATTERN)?.groups?.id;
  if (shareId !== undefined) {
    return { ...base, id: shareId, source: "share", type: "share" };
  }
  for (const plugin of installedSharedPlugins) {
    const route = pathname === null ? undefined : plugin.parseRoute?.(pathname);
    if (route) {
      return {
        ...route,
        pluginId: plugin.id,
        source: "plugin",
        type: route.id === null ? "pluginHome" : "pluginChat",
      };
    }
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
