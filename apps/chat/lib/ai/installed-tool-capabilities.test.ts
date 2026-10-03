import { expect, test, vi } from "vitest";

import {
  getCodeSandboxCleanup,
  withCodeSandboxCleanup,
} from "./installed-tool-capabilities";

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep test("attaches a non-enumerable sandbox lifecycle capability to an AI SDK tool")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
test("attaches a non-enumerable sandbox lifecycle capability to an AI SDK tool", () => {
  const tool = { execute: vi.fn() };
  const capability = {
    createCleanupSession: () => ({
      deleteAndConfirmAbsent: vi.fn(),
      provider: { projectId: "project", teamId: "team" },
    }),
  };

  expect(getCodeSandboxCleanup(tool)).toBeUndefined();
  expect(withCodeSandboxCleanup(tool, capability)).toBe(tool);
  expect(getCodeSandboxCleanup(tool)).toBe(capability);
  expect(Object.keys(tool)).toEqual(["execute"]);
});
/* oxlint-enable typescript/explicit-function-return-type */
