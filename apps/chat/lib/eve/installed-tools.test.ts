import { expect, test, vi } from "vitest";

import installed from "../../agent/tools/installed";

const state = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("./tool-messages", () => ({ eveToolMessages: state }));
const definitions = await vi.hoisted(async () => {
  const { defineTool } = await import("eve/tools");
  const { z } = await import("zod");
  return {
    customEcho: defineTool({
      approval: () => "user-approval",
      description: "Custom echo",
      execute: ({ text }) => text,
      inputSchema: z.object({ text: z.string() }),
      toModelOutput: (text) => ({ type: "text" as const, value: text }),
    }),
  };
});
vi.mock("../../tools/chatjs/tools", () => ({ tools: definitions }));
vi.mock("./turn-tools", () => ({ filterEveTools: <T>(tools: T) => tools }));
test("installed and custom definitions retain their native policies and concrete definitions", async () => {
  const resolve = installed.events["step.started"];
  if (!resolve) {
    throw new Error("Missing tool resolver");
  }
  const result = await resolve(
    {},
    {
      channel: {},
      messages: [],
      model: null,
      session: { auth: { current: null, initiator: null }, id: "test" },
    }
  );
  expect(Object.values(result)[0]).toBe(definitions.customEcho);
  expect(state.update).toHaveBeenCalledOnce();
});
