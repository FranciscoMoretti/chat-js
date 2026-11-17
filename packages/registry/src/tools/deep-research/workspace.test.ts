import path from "node:path";
import { rejects } from "node:assert/strict";
import { expect, it, mock } from "bun:test";
import type { SandboxSession } from "eve/sandbox";
import {
  readResearchFiles,
  writeResearchFile,
} from "./agent/lib/research/workspace";

const fixture = () => {
  const files = new Map<string, string>();
  const sandbox = {
    resolvePath: (name: string) => path.posix.resolve("/workspace", name),
    writeTextFile: mock<SandboxSession["writeTextFile"]>(
      async ({ path: name, content }) => {
        files.set(name, content);
        await Promise.resolve();
      }
    ),
    readTextFile: mock<SandboxSession["readTextFile"]>(
      async ({ path: name }) => await Promise.resolve(files.get(name) ?? null)
    ),
  };
  const context = {
    callId: "research-call",
    abortSignal: new AbortController().signal,
    getSandbox: mock(async () => await Promise.resolve(sandbox)),
  };
  return { files, sandbox, context };
};

it("keeps stages in the session sandbox, retries whole writes, and isolates research invocations", async () => {
  const { files, context } = fixture();
  const first = await writeResearchFile(context, "report.md", "# Café");
  expect(await readResearchFiles(context, ["report.md"])).toEqual(["# Café"]);
  expect(await writeResearchFile(context, "report.md", "# Café")).toBe(first);
  expect(files.size).toBe(1);
  const second = await writeResearchFile(
    { ...context, callId: "next-call" },
    "report.md",
    "# Revision"
  );
  expect(second).not.toBe(first);
  expect(files.get(first)).toBe("# Café");
  expect(files.get(second)).toBe("# Revision");
  files.set(first, "# Updated in sandbox");
  expect(await readResearchFiles(context, ["report.md"])).toEqual([
    "# Updated in sandbox",
  ]);
});

it("fails explicitly when native sandbox lifecycle has removed intermediate files", async () => {
  const { files, context } = fixture();
  await writeResearchFile(context, "brief.md", "Brief");
  files.clear();
  await rejects(
    readResearchFiles(context, ["brief.md"]),
    /no longer available/u
  );
});

it("rejects path traversal and stops before sandbox access after cancellation", async () => {
  const { context, sandbox } = fixture();
  await rejects(
    writeResearchFile(context, "../report.md", "Report"),
    /filename/u
  );
  expect(sandbox.writeTextFile).not.toHaveBeenCalled();
  context.getSandbox.mockClear();
  const abortSignal = AbortSignal.abort(new Error("Cancelled"));
  await rejects(
    writeResearchFile({ ...context, abortSignal }, "report.md", "Report"),
    /Cancelled/u
  );
  await rejects(
    readResearchFiles({ ...context, abortSignal }, ["report.md"]),
    /Cancelled/u
  );
  expect(context.getSandbox).not.toHaveBeenCalled();
});
