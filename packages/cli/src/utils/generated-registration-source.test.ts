import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- The generator contract test creates isolated files for the installed native linter.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This Node/Bun generator contract test uses the host temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules, sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places node:os (tmpdir) before node:path (path); sort-imports requires the reverse.
import path from "node:path";

// oxlint-disable-next-line sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places node:path (path) before ./generated-registration-source (generatedRegistrationSource); sort-imports requires the reverse.
import { generatedRegistrationSource } from "./generated-registration-source";

const registrationReason =
  "Generated registrations expose separate named contracts";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("groups registration values without changing literal data or initializer order", async () => {
  const literal = 'export const fake = "use step";\nundefined;';
  const generated = generatedRegistrationSource(
    `"use client";\nconst order: string[] = [];\nexport const first = (order.push("first"), ${JSON.stringify(literal)});\nexport const second = (order.push("second"), order);\n`
  );
  const runtime = await new Bun.Transpiler({ loader: "ts" }).transform(
    generated
  );
  const loaded: unknown = await import(
    `data:text/javascript;base64,${Buffer.from(runtime).toString("base64")}`
  );
  if (
    typeof loaded !== "object" ||
    loaded === null ||
    !("first" in loaded) ||
    !("second" in loaded)
  ) {
    throw new Error("Missing registration exports");
  }
  expect(loaded.first).toBe(literal);
  expect(loaded.second).toEqual(["first", "second"]);
  expect(generated.startsWith('"use client";')).toBe(true);
  expect(generated).not.toContain("import/group-exports");
});
/* oxlint-enable oxc/no-async-await */
test("keeps type exports separate and preserves optional capability exceptions", () => {
  const generated = generatedRegistrationSource(
    "export type WorkflowTools = { tool: string };\nexport const composerTools: Readonly<Record<string, { icon: string } | undefined>> = {};\nexport const DocumentRun: (() => void) | undefined = InstalledDocumentRun;\nexport const codeExecutor: (() => void) | undefined = undefined;\n"
  );
  expect(generated).toContain("export type { WorkflowTools };");
  expect(generated).toContain(
    "export { composerTools, DocumentRun, codeExecutor };"
  );
  expect(generated).toContain("typescript/consistent-type-definitions");
  expect(generated).not.toContain(
    "// oxlint-disable-next-line no-undefined -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.\nconst composerTools:"
  );
  expect(generated).not.toContain(
    "// oxlint-disable-next-line no-undefined -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.\nconst DocumentRun:"
  );
  expect(generated).toContain(
    "// oxlint-disable-next-line no-undefined -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.\nconst codeExecutor: (() => void) | undefined = undefined;"
  );
  expect(generated).toContain(registrationReason);
  expect(generated).not.toContain("import/group-exports");
});

test("keeps the no-undefined exception for a multiline empty capability", () => {
  const generated = generatedRegistrationSource(
    "export const capability: string | undefined =\n  undefined;\n"
  );
  expect(generated).toContain(
    "export const capability: string | undefined =\n// oxlint-disable-next-line no-undefined -- No installed provider implements this optional capability.\n  undefined;"
  );
});

test("preserves empty, single value and single type reexport registrations", () => {
  expect(generatedRegistrationSource("").trim()).toBe("");
  expect(
    generatedRegistrationSource("export const empty = {};\n").endsWith(
      "export const empty = {};\n"
    )
  ).toBe(true);
  const reexport = 'export type { Contract } from "./contract";\n';
  expect(generatedRegistrationSource(reexport).endsWith(reexport)).toBe(true);
});

test("rejects unsupported mixed exports rather than narrowing their public API", () => {
  expect(() =>
    generatedRegistrationSource(
      'export const value = {};\nexport { external } from "./external";\n'
    )
  ).toThrow("Unsupported generated registration export");
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("preserves trailing dollar signs in public registration bindings", async () => {
  const generated = generatedRegistrationSource(
    'export const item$ = "first";\nexport const second = "second";\n'
  );
  const runtime = await new Bun.Transpiler({ loader: "ts" }).transform(
    generated
  );
  const loaded: unknown = await import(
    `data:text/javascript;base64,${Buffer.from(runtime).toString("base64")}`
  );
  if (
    typeof loaded !== "object" ||
    loaded === null ||
    !("item$" in loaded) ||
    !("second" in loaded)
  ) {
    throw new Error("Missing registration exports");
  }
  expect(loaded.item$).toBe("first");
  expect(loaded.second).toBe("second");
  expect(Object.keys(loaded).toSorted()).toEqual(["item$", "second"]);
});
/* oxlint-enable oxc/no-async-await */

const exportPolicyFixtures: Readonly<Record<string, string>> = {
  capability: "export const capability: string | undefined =\n  undefined;\n",
  clause: "const one = 1, two = 2;\nexport { one, two };\n",
  default: "export default 1;\n",
  defaultAlias: "const one = 1;\nexport { one as default };\n",
  empty: "",
  inlineTypeReexport: 'export { type Contract } from "./source";\n',
  mixed:
    "export const one = 1;\nexport type WorkflowTools = { tool: string };\n",
  mixedReexport: 'export { one, type Contract } from "./source";\n',
  multiple: "export const one = 1;\nexport const two = 2;\n",
  multipleReexport: 'export { one, two } from "./source";\n',
  namespace: 'export * as contracts from "./source";\n',
  reexport: 'export { one } from "./source";\n',
  single: "export const one = 1;\n",
  star: 'export * from "./source";\n',
  type: "export type WorkflowTools = { tool: string };\n",
  typeReexport: 'export type { Contract } from "./source";\n',
};

const generatedExportRules: readonly string[] = [
  "import/no-named-export",
  "import/prefer-default-export",
  "no-undefined",
  "typescript/consistent-type-definitions",
];

/* oxlint-disable oxc/no-async-await -- Await isolated fixture writes and cleanup before the generator contract test completes. */
test("generated named contracts satisfy native export rules without unused exceptions", async (): Promise<void> => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "chatjs-registration-exports-")
  );
  try {
    const config = path.join(directory, "oxlint.json");
    await writeFile(config, JSON.stringify({ rules: {} }));
    await Promise.all(
      Object.entries(exportPolicyFixtures).map(
        async ([name, source]: readonly [string, string]): Promise<void> => {
          await writeFile(
            path.join(directory, `${name}.ts`),
            generatedRegistrationSource(source)
          );
        }
      )
    );
    const result = Bun.spawn({
      cmd: [
        path.join(import.meta.dir, "../../../../node_modules/.bin/oxlint"),
        "-c",
        config,
        "--import-plugin",
        "-A",
        "all",
        ...generatedExportRules.flatMap((rule): string[] => ["-D", rule]),
        "--no-ignore",
        "--report-unused-disable-directives-severity",
        "error",
        directory,
      ],
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      result.exited,
      new Response(result.stdout).text(),
      new Response(result.stderr).text(),
    ]);
    const diagnosticOutput = `Native export validation failed:\n${stdout}\n${stderr}`;
    // oxlint-disable-next-line no-magic-numbers -- Exit status zero confirms all generated export scopes pass native lint and unused-directive validation.
    expect(exitCode, diagnosticOutput).toBe(0);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
