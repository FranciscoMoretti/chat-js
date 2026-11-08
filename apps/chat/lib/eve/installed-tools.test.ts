import type { DynamicContext } from "eve";
import { defineDynamic } from "eve/tools";
import type * as EveTools from "eve/tools";
import { testDynamicContext } from "../../tests/helpers/eve-dynamic-context";
import { expect, test, vi } from "vitest";
import type { ModelMessage } from "ai";
import type { eveImageContext } from "./image-context";
import "@/agent/tools/installed";

vi.mock("eve/tools", async (importOriginal) => {
  const actual = await importOriginal<typeof EveTools>();
  return { ...actual, defineDynamic: vi.fn(actual.defineDynamic) };
});

const resolveInstalled = async (context: DynamicContext) => {
  const { calls } = vi.mocked(defineDynamic).mock;
  if (calls.length === 0) {
    throw new Error(
      "Expected installed tools to register a dynamic definition"
    );
  }
  return await calls[0][0](context);
};

const state = vi.hoisted(() => ({
  update: vi.fn<(update: () => ReturnType<typeof eveImageContext>) => void>(),
}));
vi.mock("./tool-image-context", () => ({ eveToolImageContext: state }));

const definitions = await vi.hoisted(async () => {
  const { defineTool } = await import("eve/tools");
  const { z: zod } = await import("zod");
  return {
    customEcho: defineTool({
      approval: () => "user-approval",
      description: "Custom echo",
      execute: ({ text }): string => text,
      inputSchema: zod.object({ text: zod.string() }),
      toModelOutput: (text) => ({ type: "text" as const, value: text }),
    }),
  };
});
vi.mock("../../integrations/tools/execution", () => ({ tools: definitions }));

vi.mock("./turn-tools", () => ({
  filterEveTools: <Tools>(tools: Tools): Tools => tools,
}));

test("installed and custom definitions retain their native policies and concrete definitions", async () => {
  const result = await resolveInstalled(
    testDynamicContext({
      session: {
        auth: {
          current: null,
          initiator: {
            authenticator: "chatjs-gateway",
            attributes: {},
            principalId: "owner",
            principalType: "user",
          },
        },
        id: "test",
      },
    })
  );
  if (!result) {
    throw new Error("Expected installed tools");
  }
  expect(Object.values(result)[0]).toBe(definitions.customEcho);
  expect(state.update).toHaveBeenCalledOnce();
});

test("steps retain only current image inputs, not the conversation history", async () => {
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
  const context = testDynamicContext({
    messages: async () => await Promise.resolve(messages),
    session: {
      auth: {
        current: null,
        initiator: {
          authenticator: "chatjs-gateway",
          attributes: {},
          principalId: "owner",
          principalType: "user",
        },
      },
      id: "test",
    },
  });
  await resolveInstalled(context);
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
  await resolveInstalled(context);
  const next = state.update.mock.lastCall?.[0]();
  expect(next?.attachments).toEqual(initial?.attachments);
  expect(next?.lastGeneratedImage?.imageUrl).toBe(
    "/api/files/abcdefghijklmnopqrstuvwx.png"
  );
  expect(JSON.stringify(next)).not.toContain("Private conversation");
  expect(JSON.stringify(next)).not.toContain("b2xk");
  messages.push({ content: "Edit it", role: "user" });
  await resolveInstalled(context);
  expect(state.update.mock.lastCall?.[0]()).toEqual({
    attachments: [],
    lastGeneratedImage: next?.lastGeneratedImage,
  });
});

test.each([
  null,
  {
    authenticator: "removed-profile",
    attributes: {},
    principalId: "visitor",
    principalType: "user",
  },
])("unknown identities receive no installed tools: %o", async (initiator) => {
  expect(
    await resolveInstalled(
      testDynamicContext({
        session: { auth: { current: null, initiator }, id: "session" },
      })
    )
  ).toEqual({});
});
