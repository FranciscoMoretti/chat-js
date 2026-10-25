import { beforeEach, expect, test, vi } from "vitest";
import type { ChatServerIntegration } from "./chat-plugin-contracts";
import { runChatAfterCreate } from "./chat-plugins";

const mocks = vi.hoisted(() => {
  const plugins: ChatServerIntegration[] = [];
  return { plugins, warn: vi.fn() };
});
vi.mock("@/composition/generated/installed-chat", () => ({
  installedChatPlugins: mocks.plugins,
}));
vi.mock("./logger", () => ({
  createModuleLogger: () => ({ warn: mocks.warn }),
}));
const context = {
  ownerId: "owner",
  conversationId: "bound",
  message: "Private message",
};
beforeEach(() => {
  mocks.plugins.splice(0);
  mocks.warn.mockReset();
});

test("root creation enrichment is optional", async () => {
  await expect(runChatAfterCreate(context)).resolves.toBeUndefined();
  expect(mocks.warn).not.toHaveBeenCalled();
});
test("one failed contribution does not prevent the remaining contributions or expose the message", async () => {
  const next = vi.fn<() => Promise<void>>().mockResolvedValue();
  mocks.plugins.push(
    {
      afterCreate: vi
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error(context.message)),
    },
    { afterCreate: next }
  );
  await expect(runChatAfterCreate(context)).resolves.toBeUndefined();
  expect(next).toHaveBeenCalledWith(context);
  expect(mocks.warn).toHaveBeenCalledWith(
    { errorName: "Error" },
    "Chat afterCreate contribution failed"
  );
});
