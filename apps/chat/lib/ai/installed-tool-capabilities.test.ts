import { expect, test, vi } from "vitest";

import {
  getCodeSandboxCleanup,
  withCodeSandboxCleanup,
} from "./installed-tool-capabilities";

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
