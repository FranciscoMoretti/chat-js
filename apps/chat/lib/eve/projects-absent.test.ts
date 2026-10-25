import { expect, test, vi } from "vitest";

vi.mock("@/composition/generated/installed", () => ({
  installedPlugins: new Set(),
}));
const { createConversationInput } = await import("./contracts");
const { eveResponseGroupInput } = await import("./response-group-input");
const { eveHistoryInput } = await import("./history-input");

test("project selection fails clearly without the plugin while ordinary requests work", () => {
  const request = { operationId: crypto.randomUUID(), message: "Hello" };
  const projectId = crypto.randomUUID();
  expect(createConversationInput.safeParse(request).success).toBe(true);
  expect(() =>
    createConversationInput.parse({ ...request, projectId })
  ).toThrow("Projects plugin is not installed");
  expect(() =>
    eveResponseGroupInput.parse({
      ...request,
      modelIds: ["one", "two"],
      projectId,
    })
  ).toThrow("Projects plugin is not installed");
  expect(() => eveHistoryInput.parse({ projectId })).toThrow(
    "Projects plugin is not installed"
  );
});
