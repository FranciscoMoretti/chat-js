import type { ModelMessage } from "ai";
import { expect, test, vi } from "vitest";

import installed from "../../agent/tools/installed";
import type { eveImageContext } from "./image-context";

const state = vi.hoisted(() => ({
  update: vi.fn<(update: () => ReturnType<typeof eveImageContext>) => void>(),
}));
vi.mock("./tool-image-context", () => ({ eveToolImageContext: state }));
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

test("steps retain only current image inputs, not the conversation history", async () => {
  const resolve = installed.events["step.started"];
  if (!resolve) {
    throw new Error("Missing tool resolver");
  }
  const messages: ModelMessage[] = [
    { content: "Private conversation text", role: "user" },
    {
      content: [
        {
          data: "data:image/png;base64,b2xk",
          mediaType: "image/png",
          type: "file",
        },
      ],
      role: "user",
    },
    {
      content: [
        {
          data: "data:image/png;base64,bmV3",
          mediaType: "image/png",
          type: "file",
        },
      ],
      role: "user",
    },
  ];
  const context = {
    channel: {},
    messages,
    model: null,
    session: { auth: { current: null, initiator: null }, id: "test" },
  };
  await resolve({}, context);
  const initial = state.update.mock.lastCall?.[0]();
  expect(initial?.attachments).toHaveLength(1);
  expect(initial?.attachments[0].url).toBe("data:image/png;base64,bmV3");
  messages.push({
    content: [
      {
        output: {
          type: "json",
          value: { imageUrl: "/api/files/abcdefghijklmnopqrstuvwx.png" },
        },
        toolCallId: "image",
        toolName: "generateImage",
        type: "tool-result",
      },
    ],
    role: "tool",
  });
  await resolve({}, context);
  const next = state.update.mock.lastCall?.[0]();
  expect(next?.attachments).toEqual(initial?.attachments);
  expect(next?.lastGeneratedImage?.imageUrl).toBe(
    "/api/files/abcdefghijklmnopqrstuvwx.png"
  );
  expect(JSON.stringify(next)).not.toContain("Private conversation");
  expect(JSON.stringify(next)).not.toContain("b2xk");
  messages.push({ content: "Edit it", role: "user" });
  await resolve({}, context);
  expect(state.update.mock.lastCall?.[0]()).toEqual({
    attachments: [],
    lastGeneratedImage: next?.lastGeneratedImage,
  });
});
