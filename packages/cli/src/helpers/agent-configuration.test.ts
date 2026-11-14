import { expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeAgentConfiguration } from "./agent-configuration";

test("native configuration preserves model settings without generating authored capabilities", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-agent-config-"));
  try {
    await writeAgentConfiguration(cwd, {
      model: "test/model",
      allowedModels: ["test/alternative"],
      reasoning: "high",
    });
    expect(await readFile(path.join(cwd, "agent/agent.ts"), "utf-8")).toContain(
      'applicationModel("test/model")'
    );
    expect(
      await readFile(path.join(cwd, "integrations/chat/models.ts"), "utf-8")
    ).toContain('"test/alternative"');
    for (const directory of ["skills", "subagents", "instructions"]) {
      expect(access(path.join(cwd, "agent", directory))).rejects.toThrow();
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
