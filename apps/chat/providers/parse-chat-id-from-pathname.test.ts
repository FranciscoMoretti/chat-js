import { describe, expect, it } from "vitest";

import { parseChatIdFromPathname } from "./parse-chat-id-from-pathname";

describe("parseChatIdFromPathname", () => {
  it("returns home for /", () => {
    expect(parseChatIdFromPathname("/")).toEqual({
      id: null,
      projectId: null,
      source: "home",
      type: "home",
    });
  });

  it("returns projectHome for /project/:projectId", () => {
    expect(parseChatIdFromPathname("/project/proj-123")).toEqual({
      id: null,
      projectId: "proj-123",
      source: "project",
      type: "projectHome",
    });
  });

  it("returns chat for /chat/:id", () => {
    expect(parseChatIdFromPathname("/chat/chat-789")).toEqual({
      id: "chat-789",
      projectId: null,
      source: "chat",
      type: "chat",
    });
  });

  it("returns projectChat for /project/:projectId/chat/:chatId", () => {
    expect(parseChatIdFromPathname("/project/proj-123/chat/chat-456")).toEqual({
      id: "chat-456",
      projectId: "proj-123",
      source: "project",
      type: "projectChat",
    });
  });

  it("returns share for /share/:id", () => {
    expect(parseChatIdFromPathname("/share/abc-123")).toEqual({
      id: "abc-123",
      projectId: null,
      source: "share",
      type: "share",
    });
  });

  it("returns passthrough for null pathname", () => {
    expect(parseChatIdFromPathname(null)).toEqual({
      id: null,
      projectId: null,
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for settings", () => {
    expect(parseChatIdFromPathname("/settings")).toEqual({
      id: null,
      projectId: null,
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for unknown routes", () => {
    expect(parseChatIdFromPathname("/unknown/path")).toEqual({
      id: null,
      projectId: null,
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for chat routes with extra segments", () => {
    expect(parseChatIdFromPathname("/chat/a/b")).toEqual({
      id: null,
      projectId: null,
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for share routes with extra segments", () => {
    expect(parseChatIdFromPathname("/share/a/b")).toEqual({
      id: null,
      projectId: null,
      source: null,
      type: "passthrough",
    });
  });

  it("returns passthrough for project chat routes with extra segments", () => {
    expect(parseChatIdFromPathname("/project/p/chat/a/b")).toEqual({
      id: null,
      projectId: null,
      source: null,
      type: "passthrough",
    });
  });
});
