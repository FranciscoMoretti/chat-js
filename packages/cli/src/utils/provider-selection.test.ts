import { expect, test } from "bun:test";

import { toolDefinitionSchema } from "../../../registry/metadata";
import { validateProviderSelection } from "./provider-selection";

const executor = (id: string, compatible: boolean) =>
  toolDefinitionSchema.parse({
    contractVersion: 1,
    id,
    kind: "tool",
    ...(compatible ? { savedCodeExecution: true } : {}),
    slot: "codeExecution",
    tools: [{ toolExport: "executeCode" }],
  });

test("rejects a new provider without masking the installed executor", () => {
  expect(() =>
    validateProviderSelection(
      [executor("existing", false)],
      [executor("replacement", true)]
    )
  ).toThrow("Remove existing before installing replacement");
  expect(() =>
    validateProviderSelection(
      [],
      [executor("first", true), executor("second", true)]
    )
  ).toThrow("Only one codeExecution");
});

test("allows reinstalling the same provider without duplicate selection", () => {
  expect(() =>
    validateProviderSelection(
      [executor("existing", false)],
      [executor("existing", true)]
    )
  ).not.toThrow();
});
