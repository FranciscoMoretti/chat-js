import { beforeEach, expect, test, vi } from "vitest";
import type { ChatServerIntegration } from "./chat-plugin-contracts";
import { runChatAfterCreate } from "./chat-after-create";

const mocks = vi.hoisted(() => {
  const plugins: ChatServerIntegration[] = [];
  return { plugins, warn: vi.fn(), settle: vi.fn() };
});
vi.mock("@/composition/generated/installed-chat", () => ({
  installedChat: mocks.plugins,
}));
vi.mock("./db/eve-title", () => ({ settleEveRootFallbackTitle: mocks.settle }));
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
  mocks.settle.mockReset();
});

test("root creation enrichment is optional", async () => {
  await expect(runChatAfterCreate(context)).resolves.toBeUndefined();
  expect(mocks.warn).not.toHaveBeenCalled();
  expect(mocks.settle).toHaveBeenCalledWith(
    "owner",
    "bound",
    "Private message"
  );
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
  expect(mocks.settle).toHaveBeenCalledAfter(next);
  expect(mocks.warn).toHaveBeenCalledWith(
    { errorName: "Error" },
    "Chat afterCreate contribution failed"
  );
});
