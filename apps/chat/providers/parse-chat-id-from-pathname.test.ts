import { describe, expect, it } from "vitest";

import { parseChatIdFromPathname } from "./parse-chat-id-from-pathname";

describe("parseChatIdFromPathname", () => {
  it("returns home for /", () => {
    expect(parseChatIdFromPathname("/")).toEqual({
      type: "home",
      id: null,
      source: "home",
      projectId: null,
    });
  });

  it("returns projectHome for /project/:projectId", () => {
    expect(parseChatIdFromPathname("/project/proj-123")).toEqual({
      type: "projectHome",
      id: null,
      source: "project",
      projectId: "proj-123",
    });
  });

  it("returns chat for /chat/:id", () => {
    expect(parseChatIdFromPathname("/chat/chat-789")).toEqual({
      type: "chat",
      id: "chat-789",
      source: "chat",
      projectId: null,
    });
  });

  it("returns projectChat for /project/:projectId/chat/:chatId", () => {
    expect(parseChatIdFromPathname("/project/proj-123/chat/chat-456")).toEqual({
      type: "projectChat",
      id: "chat-456",
      source: "project",
      projectId: "proj-123",
    });
  });

  it("returns share for /share/:id", () => {
    expect(parseChatIdFromPathname("/share/abc-123")).toEqual({
      type: "share",
      id: "abc-123",
      source: "share",
      projectId: null,
    });
  });

  it("returns passthrough for null pathname", () => {
    expect(parseChatIdFromPathname(null)).toEqual({
      type: "passthrough",
      id: null,
      source: null,
      projectId: null,
    });
  });

  it("returns passthrough for settings", () => {
    expect(parseChatIdFromPathname("/settings")).toEqual({
      type: "passthrough",
      id: null,
      source: null,
      projectId: null,
    });
  });

  it("returns passthrough for unknown routes", () => {
    expect(parseChatIdFromPathname("/unknown/path")).toEqual({
      type: "passthrough",
      id: null,
      source: null,
      projectId: null,
    });
  });

  it("returns passthrough for chat routes with extra segments", () => {
    expect(parseChatIdFromPathname("/chat/a/b")).toEqual({
      type: "passthrough",
      id: null,
      source: null,
      projectId: null,
    });
  });

  it("returns passthrough for share routes with extra segments", () => {
    expect(parseChatIdFromPathname("/share/a/b")).toEqual({
      type: "passthrough",
      id: null,
      source: null,
      projectId: null,
    });
  });

  it("returns passthrough for project chat routes with extra segments", () => {
    expect(parseChatIdFromPathname("/project/p/chat/a/b")).toEqual({
      type: "passthrough",
      id: null,
      source: null,
      projectId: null,
    });
  });
});
