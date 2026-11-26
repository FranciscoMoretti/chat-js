import { afterEach, expect, it, vi } from "vitest";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawnSync: spawn }));

const originalArgs = process.argv;
const check = ["x", "tsx", "scripts/check-workflow-backend.ts"];
const compile = ["x", "eve", "build"];

afterEach(() => {
  process.argv = originalArgs;
  vi.unstubAllEnvs();
  vi.resetModules();
  spawn.mockReset();
});

it.each([
  {
    target: "Vercel Next host",
    vercel: "1",
    args: ["--next-host"],
    commands: [check],
  },
  {
    target: "explicit Vercel worker",
    vercel: "1",
    args: [],
    commands: [check, compile],
  },
  {
    target: "self-hosted Next app",
    vercel: undefined,
    args: ["--next-host"],
    commands: [check, compile],
  },
])(
  "runs the required build steps for the $target",
  async ({ vercel, args, commands }) => {
    vi.stubEnv("VERCEL", vercel);
    process.argv = ["node", "build-eve.ts", ...args];
    spawn.mockReturnValue({ status: 0 });
    await import("./build-eve");
    expect(spawn.mock.calls).toEqual(
      commands.map((command) => ["bun", command, { stdio: "inherit" }])
    );
  }
);

it("stops before compiling when backend validation fails", async () => {
  process.argv = ["node", "build-eve.ts"];
  spawn.mockReturnValue({ status: 1 });
  await expect(import("./build-eve")).rejects.toThrow(
    "backend compatibility check failed"
  );
  expect(spawn.mock.calls).toEqual([["bun", check, { stdio: "inherit" }]]);
});
