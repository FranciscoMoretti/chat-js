import { expect, it } from "vitest";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
/* oxlint-enable sort-imports */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("restores explicit selections and treats historical messages as automatic") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */

it("does not silently broaden an invalid persisted tool selection", () => {
  expect(() =>
    eveMessageTool({
      metadata: { custom: { chatjs: { selectedTool: "unknown-tool" } } },
    })
  ).toThrow();
});
