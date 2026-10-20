import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn<(...args: unknown[]) => Promise<{ stdout: string }>>(),
}));
vi.mock("node:util", () => ({ promisify: () => mocks.execute }));
const root = await mkdtemp(path.join(tmpdir(), "sandbox-cleanup-test-"));
const directory = path.join(root, "apps/chat/.eve/chatjs-cleanup");
const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
const { preparePersistentSandboxCleanup } =
  await import("./persistent-sandbox-cleanup");
cwd.mockRestore();
afterEach(async () => {
  vi.restoreAllMocks();
  mocks.execute.mockReset();
  await rm(directory, { recursive: true, force: true });
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

test("an inconclusive process lookup preserves a live run's intent", async () => {
  const runId = crypto.randomUUID();
  const content = JSON.stringify({
    pid: process.pid,
    started: "original",
    runId,
  });
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${runId}.json`), content);
  mocks.execute.mockRejectedValue(new Error("ps timed out"));
  const probe = vi.spyOn(process, "kill").mockReturnValue(true);
  await expect(
    preparePersistentSandboxCleanup(crypto.randomUUID())
  ).rejects.toThrow("Cannot confirm");
  expect(probe).toHaveBeenCalledWith(process.pid, 0);
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  expect(await readFile(path.join(directory, `${runId}.json`), "utf-8")).toBe(
    content
  );
});

test("publishes a complete intent and never overwrites an existing run", async () => {
  const runId = crypto.randomUUID();
  mocks.execute.mockResolvedValue({ stdout: "started" });
  await preparePersistentSandboxCleanup(runId);
  const filename = `${runId}.json`;
  expect(await readdir(directory)).toEqual([filename]);
  const content = await readFile(path.join(directory, filename), "utf-8");
  expect(JSON.parse(content)).toEqual({
    pid: process.pid,
    started: "started",
    runId,
  });
  await expect(preparePersistentSandboxCleanup(runId)).rejects.toThrow(
    "EEXIST"
  );
  expect(await readFile(path.join(directory, filename), "utf-8")).toBe(content);
  expect(await readdir(directory)).toEqual([filename]);
});

test("a dead supervisor does not prove its detached workers have stopped", async () => {
  const runId = crypto.randomUUID();
  const content = JSON.stringify({
    pid: process.pid,
    started: "original",
    runId,
  });
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${runId}.json`), content);
  mocks.execute.mockRejectedValue(new Error("ps found no process"));
  vi.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("no process"), { code: "ESRCH" });
  });
  await expect(
    preparePersistentSandboxCleanup(crypto.randomUUID())
  ).rejects.toThrow("without confirming worker termination");
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  expect(await readFile(path.join(directory, `${runId}.json`), "utf-8")).toBe(
    content
  );
});
