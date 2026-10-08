import { expect, test, vi } from "vitest";
import type { ModelMessage } from "ai";
import type { eveImageContext } from "./image-context";
import installed from "@/agent/tools/installed";

const state = vi.hoisted(() => ({
  update: vi.fn<(update: () => ReturnType<typeof eveImageContext>) => void>(),
}));
vi.mock("./tool-image-context", () => ({ eveToolImageContext: state }));

/* oxlint-disable oxc/no-async-await -- Await native tool definitions and step hooks before inspecting their concrete contracts and captured image context. */
// oxlint-disable-next-line node/no-top-level-await -- Vitest awaits hoisted tool definitions before applying the tool-registry mocks that consume them.
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
/* oxlint-enable oxc/no-async-await */
vi.mock("../../tools/chatjs/tools", () => ({ tools: definitions }));

vi.mock("./turn-tools", () => ({
  filterEveTools: <Tools>(tools: Tools): Tools => tools,
}));
/* oxlint-disable oxc/no-async-await -- Await native tool definitions and step hooks before inspecting their concrete contracts and captured image context. */

/* oxlint-disable no-magic-numbers, unicorn/no-null --
 * no-magic-numbers (#517): test("installed and custom definitions retain their native policies and concrete defi uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): test("installed and custom definitions retain their native policies and concrete defi preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native tool definitions and step hooks before inspecting their concrete contracts and captured image context. */
/* oxlint-enable no-magic-numbers, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null --
 * max-lines-per-function (#510): Keep the old/current attachment fixtures, native step invocation and captured image-context checks in one scenario so prior-turn images cannot leak into the active tool context.
 * max-statements (#512): Keep the old/current attachment fixtures, native step invocation and captured image-context checks in one scenario so prior-turn images cannot leak into the active tool context.
 * no-magic-numbers (#517): test("steps retain only current image inputs, not the conversation history") uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): test("steps retain only current image inputs, not the conversation history") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 0 from state.update.mock.lastCall; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const initial = state.update.mock.lastCall?.[0]();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attachments from initial; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(initial?.attachments).toHaveLength(1);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attachments from initial; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 0 from state.update.mock.lastCall; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const next = state.update.mock.lastCall?.[0]();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attachments from next; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. Keep the existing nullish guard when reading attachments from initial; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(next?.attachments).toEqual(initial?.attachments);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading imageUrl from next.lastGeneratedImage; read lastGeneratedImage from next; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(next?.lastGeneratedImage?.imageUrl).toBe(
    "/api/files/abcdefghijklmnopqrstuvwx.png"
  );
  expect(JSON.stringify(next)).not.toContain("Private conversation");
  expect(JSON.stringify(next)).not.toContain("b2xk");
  messages.push({ content: "Edit it", role: "user" });
  await resolve({}, context);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 0 from state.update.mock.lastCall; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(state.update.mock.lastCall?.[0]()).toEqual({
    attachments: [],
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading lastGeneratedImage from next; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    lastGeneratedImage: next?.lastGeneratedImage,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null */
