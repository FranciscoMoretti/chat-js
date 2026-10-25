import { afterEach, expect, test, vi } from "vitest";
import type {
  ChatServerIntegration,
  ChatSharedPlugin,
} from "./chat-plugin-contracts";

const installed = vi.hoisted(() => {
  const shared: ChatSharedPlugin[] = [];
  const server: ChatServerIntegration[] = [];
  return { shared, server };
});
vi.mock("@/composition/generated/installed-shared", () => ({
  installedSharedPlugins: installed.shared,
  installedCreationFields: {},
}));
vi.mock("@/composition/generated/installed-chat", () => ({
  installedChatPlugins: installed.server,
}));
const { pluginCreationScope } = await import("./eve/plugin-creation-input");
const { chatLinks } = await import("./chat-plugins");
afterEach(() => {
  installed.shared.length = 0;
  installed.server.length = 0;
});

test("metadata plugins coexist with one primary draft scope, but two owners fail", () => {
  installed.shared.push({
    id: "metadata",
    creationFields: {},
    historyFields: {},
  });
  expect(pluginCreationScope({})).toBeUndefined();
  const contextual = {
    id: "contextual",
    creationFields: {},
    historyFields: {},
    creationScope: () => ({ key: "context:one", label: "context" }),
  };
  installed.shared.push(contextual);
  expect(pluginCreationScope({})?.key).toBe("context:one");
  installed.shared.push({ ...contextual, id: "another" });
  expect(() => pluginCreationScope({})).toThrow(
    "Multiple plugins supplied a creation scope"
  );
});

test("navigation contributions can own different chats but cannot compete for one", async () => {
  const first = new Map([["one", { href: "/one", parentHref: "/" }]]);
  const second = new Map([["two", { href: "/two", parentHref: "/" }]]);
  installed.server.push(
    {
      links: vi
        .fn<NonNullable<ChatServerIntegration["links"]>>()
        .mockResolvedValue(first),
    },
    {
      links: vi
        .fn<NonNullable<ChatServerIntegration["links"]>>()
        .mockResolvedValue(second),
    }
  );
  expect(await chatLinks("owner", ["one", "two"])).toEqual(
    new Map([...first, ...second])
  );
  installed.server.push({
    links: vi
      .fn<NonNullable<ChatServerIntegration["links"]>>()
      .mockResolvedValue(first),
  });
  await expect(chatLinks("owner", ["one"])).rejects.toThrow(
    "Multiple plugins supplied navigation"
  );
});
