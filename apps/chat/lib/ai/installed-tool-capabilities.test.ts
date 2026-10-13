import { expect, test, vi } from "vitest";

import {
  getCodeSandboxCleanup,
  withCodeSandboxCleanup,
} from "./installed-tool-capabilities";
import type { Mock } from "vitest";

test("attaches a non-enumerable sandbox lifecycle capability to an AI SDK tool", () => {
  const tool = { execute: vi.fn() };
  const capability = {
    createCleanupSession: (): {
      deleteAndConfirmAbsent: Mock;
      provider: { projectId: string; teamId: string };
    } => ({
      deleteAndConfirmAbsent: vi.fn(),
      provider: { projectId: "project", teamId: "team" },
    }),
  };

  expect(getCodeSandboxCleanup(tool)).toBeUndefined();
  expect(withCodeSandboxCleanup(tool, capability)).toBe(tool);
  expect(getCodeSandboxCleanup(tool)).toBe(capability);
  expect(Object.keys(tool)).toEqual(["execute"]);
});
