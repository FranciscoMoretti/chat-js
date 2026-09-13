import { describe, expect, it } from "vitest";

import { mapUIMessagePartsToDBParts } from "./message-mapping";

describe("SDK 7 persistence boundary", () => {
  it("rejects reasoning files and custom content absent from the persisted schema", () => {
    expect(() =>
      mapUIMessagePartsToDBParts(
        [
          {
            mediaType: "image/png",
            type: "reasoning-file",
            url: "https://example.com/reasoning.png",
          },
        ],
        "message"
      )
    ).toThrow("Unsupported part type: reasoning-file");
    expect(() =>
      mapUIMessagePartsToDBParts(
        [{ kind: "provider.hidden", type: "custom" }],
        "message"
      )
    ).toThrow("Unsupported part type: custom");
  });
  it("retains a dynamic tool's name, input and output with the v7 tool guard", () => {
    const [part] = mapUIMessagePartsToDBParts(
      [
        {
          input: { query: "test" },
          output: { found: true },
          state: "output-available",
          toolCallId: "call",
          toolName: "connector_lookup",
          type: "dynamic-tool",
        },
      ],
      "message"
    );
    expect(part).toMatchObject({
      tool_input: { query: "test" },
      tool_name: "connector_lookup",
      tool_output: { found: true },
      tool_toolCallId: "call",
    });
  });
});
