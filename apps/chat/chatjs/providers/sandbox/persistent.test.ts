import { beforeEach, expect, it, vi } from "vitest";
import { createPersistentProvider } from "@/chatjs/providers/sandbox/persistent";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  run: vi.fn(),
  logs: vi.fn(),
  wait: vi.fn<
    (options: { signal: AbortSignal }) => Promise<{ exitCode: number }>
  >(),
  kill: vi.fn<
    (signal: undefined, options: { abortSignal: AbortSignal }) => Promise<void>
  >(),
}));
vi.mock("@vercel/sandbox", () => ({
  APIError: class extends Error {},
  Sandbox: { get: mocks.get },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({
    name: "fixture",
    persistent: true,
    runCommand: mocks.run,
  });
});
it("reads multiplexed output only on demand and retains both streams", async () => {
  let reads = 0;
  mocks.logs.mockImplementation(async function* logs() {
    reads += 1;
    yield { stream: "stderr", data: "error\n" };
    yield { stream: "stdout", data: "output\n" };
  });
  mocks.wait.mockResolvedValue({ exitCode: 0 });
  mocks.kill.mockResolvedValue();
  mocks.run.mockResolvedValue({
    logs: mocks.logs,
    wait: mocks.wait,
    kill: mocks.kill,
  });
  const sandbox = await createPersistentProvider({
    teamId: "team",
    projectId: "project",
    token: "fixture",
  }).open("fixture");
  const process = await sandbox.spawn({ command: "fixture" });
  expect(reads).toBe(0);
  const output = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  expect(output).toEqual(["output\n", "error\n"]);
  expect(await process.wait()).toEqual({ exitCode: 0 });
  await process.kill();
  expect(mocks.wait.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
  expect(mocks.kill.mock.calls[0]?.[1].abortSignal).toBeInstanceOf(AbortSignal);
});
