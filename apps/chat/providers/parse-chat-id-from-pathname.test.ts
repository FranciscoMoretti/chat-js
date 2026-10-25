import { describe, expect, it } from "vitest";

import { parseChatIdFromPathname } from "./parse-chat-id-from-pathname";

describe("parseChatIdFromPathname", () => {
  it("returns home for /", () => {
    expect(parseChatIdFromPathname("/")).toEqual({
      id: null,
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: "home",
      type: "home",
    });
  });

  it("returns pluginHome for /project/:projectId", () => {
    expect(parseChatIdFromPathname("/project/proj-123")).toEqual({
      id: null,
      contextId: "proj-123",
      pluginId: "projects",
      parentHref: "/project/proj-123",
      source: "plugin",
      type: "pluginHome",
    });
  });

  it("returns chat for /chat/:id", () => {
    expect(parseChatIdFromPathname("/chat/chat-789")).toEqual({
      id: "chat-789",
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: "chat",
      type: "chat",
    });
  });

  it("returns pluginChat for /project/:projectId/chat/:chatId", () => {
    expect(parseChatIdFromPathname("/project/proj-123/chat/chat-456")).toEqual({
      id: "chat-456",
      contextId: "proj-123",
      pluginId: "projects",
      parentHref: "/project/proj-123",
      source: "plugin",
      type: "pluginChat",
    });
  });

  it("returns share for /share/:id", () => {
    expect(parseChatIdFromPathname("/share/abc-123")).toEqual({
      id: "abc-123",
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: "share",
      type: "share",
    });
  });

  it("returns passthrough for null pathname", () => {
    expect(parseChatIdFromPathname(null)).toEqual({
      id: null,
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for settings", () => {
    expect(parseChatIdFromPathname("/settings")).toEqual({
      id: null,
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for unknown routes", () => {
    expect(parseChatIdFromPathname("/unknown/path")).toEqual({
      id: null,
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for chat routes with extra segments", () => {
    expect(parseChatIdFromPathname("/chat/a/b")).toEqual({
      id: null,
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for share routes with extra segments", () => {
    expect(parseChatIdFromPathname("/share/a/b")).toEqual({
      id: null,
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for project chat routes with extra segments", () => {
    expect(parseChatIdFromPathname("/project/p/chat/a/b")).toEqual({
      id: null,
      contextId: null,
      pluginId: null,
      parentHref: "/",
      source: null,
      type: "passthrough",
    });
  });
});
