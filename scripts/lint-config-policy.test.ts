import { expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const root = path.resolve(import.meta.dir, "..");
const childDeadlineMs = 10_000;
const testDeadlineMs = 30_000;
const presetNames = ["core", "react", "next", "tanstack"] as const;
const toolFiles = [
  "agent/tools/deepResearch.ts",
  "agent/subagents/researcher/tools/webSearch.ts",
  "agent/tools/otherTool.ts",
];
const compliantImports =
  'import { Zulu, alpha } from "members";\nimport Zebra from "zebra";\nimport apple from "apple";\nexport const chosen = [Zulu, alpha, Zebra, apple];\n';

const runNative = async (
  cwd: string,
  executable: "oxfmt" | "oxlint",
  args: readonly string[]
): Promise<{ output: string; exitCode: number }> => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--bun",
      path.join(root, `node_modules/${executable}/bin/${executable}`),
      ...args,
    ],
    { cwd, stderr: "pipe", stdout: "pipe" }
  );
  const deadline = setTimeout(() => {
    child.kill("SIGKILL");
  }, childDeadlineMs);
  try {
    const [output, errors, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(errors).toBe("");
    return { exitCode, output };
  } finally {
    clearTimeout(deadline);
    child.kill("SIGKILL");
    await child.exited;
  }
};

const writeConfig = async (temporary: string, source: string) => {
  await writeFile(
    path.join(temporary, "oxlint.config.ts"),
    `import config from ${JSON.stringify(path.join(root, source))};\nexport default { ...config, options: { ...config.options, typeAware: false } };\n`
  );
};

const writeHookFixture = async (temporary: string): Promise<void> => {
  await mkdir(path.join(temporary, "scripts"));
  await writeFile(
    path.join(temporary, "scripts/ai-post-codegen.sh"),
    await readFile(path.join(root, "scripts/ai-post-codegen.sh"), "utf-8")
  );
  await writeFile(
    path.join(temporary, "scripts/ai-handoff.ts"),
    await readFile(path.join(root, "scripts/ai-handoff.ts"), "utf-8")
  );
  await symlink(
    path.join(root, "node_modules"),
    path.join(temporary, "node_modules")
  );
  await writeConfig(temporary, "oxlint.config.ts");
  await writeFile(
    path.join(temporary, "oxfmt.config.ts"),
    `import config from ${JSON.stringify(path.join(root, "oxfmt.config.ts"))};\nexport default config;\n`
  );
};

const runAgentHook = async (
  temporary: string,
  mode: "edit" | "start" | "check",
  payload: unknown
): Promise<{ exitCode: number; output: string; errors: string }> => {
  const child = Bun.spawn(
    ["bash", path.join(temporary, "scripts/ai-post-codegen.sh"), mode],
    {
      cwd: path.join(temporary, "scripts"),
      stdin: new Blob([JSON.stringify(payload)]),
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const deadline = setTimeout(() => {
    child.kill("SIGKILL");
  }, childDeadlineMs);
  try {
    const [output, errors, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { errors, exitCode, output };
  } finally {
    clearTimeout(deadline);
    child.kill("SIGKILL");
    await child.exited;
  }
};

const hookCommand = (
  mode: "start" | "edit" | "check",
  rootCommand = '"$(git rev-parse --show-toplevel)"'
) => ({
  type: "command",
  command: `${rootCommand}/scripts/ai-post-codegen.sh ${mode}`,
});

test("agent configurations invoke the maintained hook modes", async () => {
  const codex: unknown = JSON.parse(
    await readFile(path.join(root, ".codex/hooks.json"), "utf-8")
  );
  const claude: unknown = JSON.parse(
    await readFile(path.join(root, ".claude/settings.json"), "utf-8")
  );
  const cursor: unknown = JSON.parse(
    await readFile(path.join(root, ".cursor/hooks.json"), "utf-8")
  );
  expect(codex).toMatchObject({
    hooks: {
      UserPromptSubmit: [{ hooks: [hookCommand("start")] }],
      PostToolUse: [{ matcher: "apply_patch", hooks: [hookCommand("edit")] }],
      Stop: [{ hooks: [hookCommand("check")] }],
    },
  });
  expect(claude).toMatchObject({
    hooks: {
      PostToolUse: [
        {
          matcher: "Write|Edit|MultiEdit",
          hooks: [hookCommand("edit", '"$CLAUDE_PROJECT_DIR"')],
        },
      ],
    },
  });
  expect(cursor).toMatchObject({
    hooks: {
      afterFileEdit: [{ command: "bash scripts/ai-post-codegen.sh edit" }],
    },
  });
});

test.each(["codex", "cursor", "claude"])(
  "%s edit hook fixes only the edited file, even from a nested directory",
  async (host) => {
    const temporary = await mkdtemp(path.join(tmpdir(), "chatjs-edit-hook-"));
    const untouched = "export  const untouched={answer:0}\n";
    try {
      await writeHookFixture(temporary);
      await writeFile(
        path.join(temporary, "edited.ts"),
        "export  const chosen={answer:42}\n"
      );
      await writeFile(path.join(temporary, "untouched.ts"), untouched);
      const payloads = {
        codex: {
          hook_event_name: "PostToolUse",
          tool_name: "apply_patch",
          tool_input: {
            command:
              "*** Begin Patch\n*** Update File: edited.ts\n@@\n+export  const chosen={answer:42}\n*** End Patch",
          },
        },
        claude: {
          hook_event_name: "PostToolUse",
          tool_name: "Edit",
          tool_input: { file_path: path.join(temporary, "edited.ts") },
        },
        cursor: { file_path: path.join(temporary, "edited.ts") },
      };
      const result = await runAgentHook(temporary, "edit", payloads[host]);
      expect(result.exitCode, result.errors).toBe(0);
      expect(await readFile(path.join(temporary, "edited.ts"), "utf-8")).toBe(
        "export const chosen = { answer: 42 };\n"
      );
      expect(
        await readFile(path.join(temporary, "untouched.ts"), "utf-8")
      ).toBe(untouched);
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);

test(
  "deletion-only hooks do not fall back to fixing the whole repository",
  async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), "chatjs-delete-hook-"));
    const untouched = "export  const untouched={answer:0}\n";
    try {
      await writeHookFixture(temporary);
      await writeFile(path.join(temporary, "untouched.ts"), untouched);
      const result = await runAgentHook(temporary, "edit", {
        hook_event_name: "PostToolUse",
        tool_name: "apply_patch",
        tool_input:
          "*** Begin Patch\n*** Delete File: deleted.ts\n*** End Patch",
      });
      expect(result.exitCode, result.errors).toBe(0);
      expect(
        await readFile(path.join(temporary, "untouched.ts"), "utf-8")
      ).toBe(untouched);
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);

test(
  "Codex receives remaining lint errors through hook stderr and exit code 2",
  async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), "chatjs-error-hook-"));
    try {
      await writeHookFixture(temporary);
      await writeFile(
        path.join(temporary, "edited.ts"),
        "export const execute = (source: string): unknown => eval(source);\n"
      );
      const result = await runAgentHook(temporary, "edit", {
        hook_event_name: "PostToolUse",
        tool_name: "apply_patch",
        tool_input:
          "*** Begin Patch\n*** Update File: edited.ts\n@@\n+eval(source);\n*** End Patch",
      });
      expect(result.exitCode, result.errors).toBe(2);
      expect(result.errors).toContain("no-eval");
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);

test.each([null, "lint", "test:types"])(
  "handoff hook reports %s failures without fixing files",
  async (failingScript) => {
    const temporary = await mkdtemp(path.join(tmpdir(), "chatjs-check-hook-"));
    const untouched = "export  const untouched={answer:0}\n";
    try {
      await writeHookFixture(temporary);
      await writeFile(path.join(temporary, "untouched.ts"), untouched);
      await writeFile(
        path.join(temporary, "package.json"),
        JSON.stringify({
          scripts: {
            lint:
              failingScript === "lint"
                ? "bun -e 'console.error(\"lint failed\"); process.exit(1)'"
                : "bun -e 'console.log(\"lint checked\")'",
            "test:types":
              failingScript === "test:types"
                ? "bun -e 'console.error(\"types failed\"); process.exit(1)'"
                : "bun -e 'console.log(\"types checked\")'",
          },
        })
      );
      const initialize = Bun.spawnSync(["git", "init"], { cwd: temporary });
      expect(initialize.exitCode).toBe(0);
      const commit = Bun.spawnSync(
        [
          "git",
          "-c",
          "user.name=Fixture",
          "-c",
          "user.email=fixture@example.test",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--allow-empty",
          "-m",
          "fixture",
        ],
        { cwd: temporary }
      );
      expect(commit.exitCode).toBe(0);
      const payload = { session_id: "check-fixture" };
      const started = await runAgentHook(temporary, "start", payload);
      expect(started.exitCode).toBe(0);
      const discussion = await runAgentHook(temporary, "check", payload);
      expect(discussion.output).toBe("{}");
      expect(discussion.errors).toBe("");
      await writeFile(
        path.join(temporary, "changed.ts"),
        "export const changed = true;\n"
      );
      const steered = await runAgentHook(temporary, "start", payload);
      expect(steered.exitCode).toBe(0);
      const otherSession = await runAgentHook(temporary, "check", {
        session_id: "different-session",
      });
      expect(otherSession.output).toContain("no prompt-start snapshot");
      expect(otherSession.errors).toBe("");
      const result = await runAgentHook(temporary, "check", payload);
      expect(result.exitCode, result.errors).toBe(
        failingScript === null ? 0 : 2
      );
      expect(result.output).toBe(failingScript === null ? "{}" : "");
      expect(result.errors).toContain(
        failingScript === "lint" ? "lint failed" : "lint checked"
      );
      expect(result.errors).toContain(
        failingScript === "test:types" ? "types failed" : "types checked"
      );
      expect(
        await readFile(path.join(temporary, "untouched.ts"), "utf-8")
      ).toBe(untouched);
      const unchanged = await runAgentHook(temporary, "check", payload);
      expect(unchanged.exitCode).toBe(0);
      expect(unchanged.output).toContain(
        failingScript === null ? "{}" : "previously failed"
      );
      expect(unchanged.errors).toBe("");
      await writeFile(
        path.join(temporary, "changed.ts"),
        "export const changed = false;\n"
      );
      const continued = await runAgentHook(temporary, "check", {
        ...payload,
        stop_hook_active: true,
      });
      expect(continued.exitCode).toBe(0);
      expect(continued.errors).toContain(
        failingScript === "lint" ? "lint failed" : "lint checked"
      );
      expect(continued.output).toContain(
        failingScript === null ? "{}" : "Automatic continuation stopped"
      );
      if (failingScript === null) {
        const staged = Bun.spawnSync(["git", "add", "--", "changed.ts"], {
          cwd: temporary,
        });
        expect(staged.exitCode).toBe(0);
        const committed = Bun.spawnSync(
          [
            "git",
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-m",
            "change",
          ],
          { cwd: temporary }
        );
        expect(committed.exitCode).toBe(0);
        const afterCommit = await runAgentHook(temporary, "check", payload);
        expect(afterCommit.errors).toContain("lint checked");
        await writeFile(
          path.join(temporary, "changed.ts"),
          "export const changed = 3;\n"
        );
        const trackedEdit = await runAgentHook(temporary, "check", payload);
        expect(trackedEdit.errors).toContain("lint checked");
        await rm(path.join(temporary, "changed.ts"));
        const deletion = await runAgentHook(temporary, "check", payload);
        expect(deletion.errors).toContain("lint checked");
      }
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

test.each(["oxlint.config.ts", "apps/chat/oxlint.config.ts"])(
  "%s rejects unused suppressions but retains necessary ones",
  async (source) => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "chatjs-unused-disable-")
    );
    try {
      await writeConfig(temporary, source);
      await writeFile(
        path.join(temporary, "stale.ts"),
        "// oxlint-disable-next-line no-debugger\nexport const value = 1;\n"
      );
      await writeFile(
        path.join(temporary, "necessary.ts"),
        "// oxlint-disable-next-line no-debugger\ndebugger;\n"
      );
      const flags =
        source === "oxlint.config.ts"
          ? []
          : ["--report-unused-disable-directives-severity", "error"];
      const stale = await runNative(temporary, "oxlint", [
        "stale.ts",
        ...flags,
      ]);
      expect(stale.exitCode).toBe(1);
      expect(stale.output).toContain("Unused");
      const necessary = await runNative(temporary, "oxlint", [
        "necessary.ts",
        ...flags,
      ]);
      expect(necessary.exitCode, necessary.output).toBe(0);
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);

const readEffectiveConfig = async (temporary: string, filename: string) => {
  const { output, exitCode } = await runNative(temporary, "oxlint", [
    "-c",
    path.join(temporary, filename),
    "--print-config",
  ]);
  expect(exitCode).toBe(0);
  const parsed: unknown = JSON.parse(output);
  if (!isRecord(parsed) || !Array.isArray(parsed.overrides)) {
    throw new TypeError("Native configuration must contain overrides");
  }
  const overrides: unknown[] = parsed.overrides;
  return { overrides, rules: parsed.rules };
};

test.each(["oxlint.config.ts", "apps/chat/oxlint.config.ts"])(
  "%s retains Ultracite preset defaults",
  async (source) => {
    const temporary = await mkdtemp(path.join(tmpdir(), "chatjs-lint-policy-"));
    try {
      const imports = presetNames.map(
        (name) =>
          `import ${name} from ${JSON.stringify(import.meta.resolve(`ultracite/oxlint/${name}`))};`
      );
      await writeFile(
        path.join(temporary, "reference.config.ts"),
        `${imports.join("\n")}\nexport default { extends: [${presetNames.join(", ")}], options: { typeAware: false } };\n`
      );
      const reference = await readEffectiveConfig(
        temporary,
        "reference.config.ts"
      );
      await writeConfig(temporary, source);
      const actual = await readEffectiveConfig(temporary, "oxlint.config.ts");
      expect(actual.rules, source).toEqual(reference.rules);
      if (source === "oxlint.config.ts") {
        expect(actual.overrides).toEqual(reference.overrides);
      } else {
        expect(actual.overrides.slice(0, -1)).toEqual(reference.overrides);
        expect(actual.overrides.at(-1)).toMatchObject({
          files: toolFiles.slice(0, -1),
          rules: { "unicorn/filename-case": "allow" },
        });
      }
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);

test.each(["", "apps/chat/"])(
  "%s configs exclude installed and generated files but check authored code",
  async (sourcePrefix) => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "chatjs-lint-excludes-")
    );
    const fixturePrefix = sourcePrefix === "" ? "apps/chat/" : "";
    const ignored = [
      "components/ui/button.ts",
      "components/ai-elements/message.ts",
      "components/ui/nested/installed.ts",
      "components/ai-elements/nested/installed.ts",
      "features/installed.ts",
      "features/installed-routers.ts",
      "features/installed-uploads.ts",
      "features/installed-layout.ts",
      "features/installed-instrumentation.ts",
      "tools/chatjs/tools.ts",
      "tools/chatjs/ui.ts",
      "tools/chatjs/providers.ts",
      "tools/chatjs/code-executor.ts",
      "tools/chatjs/workflow-types.ts",
      "tools/chatjs/tool-availability.ts",
      "tools/chatjs/document-ui.ts",
      "tools/chatjs/document-run.ts",
      "tools/chatjs/installed-features.ts",
      "tools/chatjs/composer-tools.ts",
      "lib/ai/models.generated.ts",
      "features/composer-icons.generated.ts",
      "next-env.d.ts",
      ".next/types/routes.ts",
      ".eve/worker.ts",
    ];
    const checked = [
      "components/authored.ts",
      "components/ui/extra/wrapper.ts",
      "components/ai-elements/extra/mcp-tool-header.ts",
      "components/ui/extra/nested/wrapper.ts",
      "components/ai-elements/extra/nested/wrapper.ts",
      "components/ui/button.test.ts",
      "components/ai-elements/message.spec.ts",
      "components/ui/nested/button.spec.ts",
      "components/ai-elements/nested/message.test.ts",
      "components/ui/__tests__/fixture.ts",
      "components/ai-elements/nested/__tests__/fixture.ts",
      "features/mcp/component.ts",
      "tools/chatjs/custom-tools.ts",
      "tools/chatjs/custom-ui.ts",
      "tools/chatjs/retrieve-url/tool.ts",
      "scripts/generate-models.ts",
    ];
    const malformed = "debugger;export  const chosen={answer:42}\n";
    try {
      await writeConfig(temporary, `${sourcePrefix}oxlint.config.ts`);
      await writeFile(
        path.join(temporary, "oxfmt.config.ts"),
        `import config from ${JSON.stringify(path.join(root, sourcePrefix, "oxfmt.config.ts"))};\nexport default config;\n`
      );
      await Promise.all(
        [...ignored, ...checked].map(async (file) => {
          const target = path.join(temporary, fixturePrefix, file);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, malformed);
        })
      );
      const lint = await runNative(temporary, "oxlint", [
        ".",
        "--format",
        "unix",
      ]);
      expect(lint.exitCode).toBe(1);
      for (const file of ignored) {
        expect(lint.output).not.toContain(`${file}:`);
      }
      for (const file of checked) {
        expect(lint.output).toContain(`${file}:`);
      }
      const format = await runNative(temporary, "oxfmt", ["--write", "."]);
      expect(format.exitCode).toBe(0);
      const contents = await Promise.all(
        [...ignored, ...checked].map(
          async (file) =>
            await readFile(path.join(temporary, fixturePrefix, file), "utf-8")
        )
      );
      expect(contents.slice(0, ignored.length)).toEqual(
        ignored.map(() => malformed)
      );
      for (const content of contents.slice(ignored.length)) {
        expect(content).not.toBe(malformed);
      }
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);

test(
  "standalone filename exceptions cover only EVE's established tool IDs",
  async () => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "chatjs-tool-filenames-")
    );
    try {
      const unexpected = path.join(temporary, "otherTool.ts");
      await writeFile(unexpected, 'export const chosen = "chosen";\n');
      const app = path.join(root, "apps/chat");
      const { output, exitCode } = await runNative(app, "oxlint", [
        "-c",
        path.join(app, "oxlint.config.ts"),
        ...toolFiles.slice(0, -1).map((file) => path.join(app, file)),
        unexpected,
        "--format",
        "unix",
      ]);
      expect(exitCode).toBe(1);
      const diagnostics = output
        .split("\n")
        .filter((line) => line.includes("[Error/unicorn(filename-case)]"));
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toContain("otherTool.ts:");
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);

test.each(["oxfmt.config.ts", "apps/chat/oxfmt.config.ts"])(
  "%s preserves import order and checks formatting",
  async (source) => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "chatjs-formatter-policy-")
    );
    try {
      const config = path.join(temporary, "oxfmt.config.ts");
      const compliant = path.join(temporary, "compliant.ts");
      const malformed = path.join(temporary, "malformed.ts");
      await writeFile(
        config,
        `import config from ${JSON.stringify(path.join(root, source))};\nexport default config;\n`
      );
      await writeFile(compliant, compliantImports);
      await writeFile(malformed, "export  const chosen={answer:42}\n");
      const check = await runNative(temporary, "oxfmt", [
        "-c",
        config,
        "--check",
        malformed,
      ]);
      expect(check.exitCode, source).toBe(1);
      const formatted = await runNative(temporary, "oxfmt", [
        "-c",
        config,
        "--write",
        compliant,
        malformed,
      ]);
      expect(formatted.exitCode, source).toBe(0);
      expect(await readFile(compliant, "utf-8"), source).toBe(compliantImports);
      expect(await readFile(malformed, "utf-8"), source).toBe(
        "export const chosen = { answer: 42 };\n"
      );
      const rechecked = await runNative(temporary, "oxfmt", [
        "-c",
        config,
        "--check",
        compliant,
        malformed,
      ]);
      expect(rechecked.exitCode, source).toBe(0);
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);
