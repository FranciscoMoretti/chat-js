import { describe, expect, it } from "vitest";
import { mapUIMessagePartsToDBParts } from "./message-mapping";

describe("SDK 7 persistence boundary", () => {
  it("rejects reasoning files and custom content absent from the persisted schema", () => {
    expect(() =>
      mapUIMessagePartsToDBParts(
        [
          {
            type: "reasoning-file",
            mediaType: "image/png",
            url: "https://example.com/reasoning.png",
          },
        ],
        "message"
      )
    ).toThrow("Unsupported part type: reasoning-file");
    expect(() =>
      mapUIMessagePartsToDBParts(
        [{ type: "custom", kind: "provider.hidden" }],
        "message"
      )
    ).toThrow("Unsupported part type: custom");
  });
  it("retains a dynamic tool's name, input and output with the v7 tool guard", () => {
    const [part] = mapUIMessagePartsToDBParts(
      [
        {
          type: "dynamic-tool",
          toolName: "connector_lookup",
          toolCallId: "call",
          state: "output-available",
          input: { query: "test" },
          output: { found: true },
        },
      ],
      "message"
    );
    expect(part).toMatchObject({
      tool_name: "connector_lookup",
      tool_toolCallId: "call",
      tool_input: { query: "test" },
      tool_output: { found: true },
    });
  });
});
