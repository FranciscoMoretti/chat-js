/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/tools/installed" dependency within this package instead of introducing an alias or barrel API.
 */
import type { ModelMessage } from "ai";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import installed from "../../agent/tools/installed";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { eveImageContext } from "./image-context";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const state = vi.hoisted(() => ({
  update: vi.fn<(update: () => ReturnType<typeof eveImageContext>) => void>(),
}));
vi.mock("./tool-image-context", () => ({ eveToolImageContext: state }));

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

vi.mock("../../tools/chatjs/tools", () => ({ tools: definitions }));
/* oxlint-disable id-length, typescript/explicit-function-return-type --
 * id-length (#506): vi.mock("./turn-tools") uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./turn-tools")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./turn-tools", () => ({ filterEveTools: <T>(tools: T) => tools }));
/* oxlint-enable id-length, typescript/explicit-function-return-type */
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
/* oxlint-enable no-magic-numbers, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null --
 * max-lines-per-function (#510): test("steps retain only current image inputs, not the conversation history") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("steps retain only current image inputs, not the conversation history") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null */
