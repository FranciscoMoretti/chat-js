import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    `import config from ${JSON.stringify(path.join(root, source))};\nexport default { ...config, options: { typeAware: false } };\n`
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
