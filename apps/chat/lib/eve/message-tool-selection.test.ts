import { expect, it } from "vitest";
import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";

it("restores explicit selections and treats historical messages as automatic", () => {
  expect(eveMessageTool({})).toBeNull();
  expect(
    eveMessageTool({ metadata: { custom: eveToolMetadata(null) } })
  ).toBeNull();
  expect(
    eveMessageTool({
      metadata: { custom: eveToolMetadata("createTextDocument") },
    })
  ).toBe("createTextDocument");
});

it("does not silently broaden an invalid persisted tool selection", () => {
  expect(() =>
    eveMessageTool({
      metadata: { custom: { chatjs: { selectedTool: "unknown-tool" } } },
    })
  ).toThrow();
});
