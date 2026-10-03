/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { expect, it } from "vitest";

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
