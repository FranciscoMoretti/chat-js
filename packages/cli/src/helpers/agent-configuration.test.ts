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
    ).toContain('modelIds: ["test/model", "test/alternative"]');
    for (const directory of ["skills", "subagents", "instructions"]) {
      expect(access(path.join(cwd, "agent", directory))).rejects.toThrow();
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test.each([{ modelIds: undefined }, { modelIds: [] }])(
  "generates an unrestricted catalog for %j",
  async ({ modelIds }) => {
    const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-agent-discovery-"));
    try {
      await writeAgentConfiguration(cwd, { modelIds });
      expect(
        await readFile(path.join(cwd, "integrations/chat/models.ts"), "utf-8")
      ).toContain("= {};");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
);

test.each([undefined, true, false])(
  "generated agent enables native tools by default and honors override %s",
  async (defaultTools) => {
    const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-agent-defaults-"));
    try {
      await writeAgentConfiguration(
        cwd,
        defaultTools === undefined ? undefined : { defaultTools }
      );
      expect(
        await readFile(path.join(cwd, "agent/agent.ts"), "utf-8")
      ).toContain(`"defaultTools": ${defaultTools ?? true}`);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
);

test("writes native disable overrides only for unchecked defaults", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-agent-defaults-"));
  try {
    await writeAgentConfiguration(cwd, {
      disabledDefaultTools: ["tool/bash", "tool/web_fetch"],
    });
    const source = await readFile(path.join(cwd, "agent/agent.ts"), "utf-8");
    expect(source).toContain('"defaultTools": true');
    expect(source).not.toContain("disabledDefaultTools");
    const paths = ["bash.ts", "web_fetch.ts"].map((file) =>
      path.join(cwd, "agent/tools", file)
    );
    const overrides = await Promise.all(
      paths.map(async (file) => await readFile(file, "utf-8"))
    );
    const nativeOverride =
      'import { disableTool } from "eve/tools";\n\nexport default disableTool();\n';
    expect(overrides).toEqual([nativeOverride, nativeOverride]);
    expect(
      access(path.join(cwd, "agent/tools/read_file.ts"))
    ).rejects.toThrow();
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
