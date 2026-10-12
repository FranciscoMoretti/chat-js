import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { generatedRegistrationSource } from "./generated-registration-source";

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
test("keeps type exports separate without obsolete capability exceptions", () => {
  const generated = generatedRegistrationSource(
    "export interface WorkflowTools { tool: string }\nexport const composerTools: Readonly<Record<string, { icon: string } | undefined>> = {};\nexport const DocumentRun: (() => void) | undefined = InstalledDocumentRun;\nexport const codeExecutor: (() => void) | undefined = undefined;\n"
  );
  expect(generated).toContain("export type { WorkflowTools };");
  expect(generated).toContain(
    "export { composerTools, DocumentRun, codeExecutor };"
  );
  expect(generated).toContain("interface WorkflowTools { tool: string }");
  expect(generated).not.toContain("typescript/consistent-type-definitions");
  expect(generated).not.toContain("no-undefined");
  expect(generated).not.toContain("import/no-named-export");
  expect(generated).not.toContain("import/prefer-default-export");
  expect(generated).toContain(
    "const codeExecutor: (() => void) | undefined = undefined;"
  );
  expect(generated).not.toContain("import/group-exports");
});

test("preserves a multiline empty capability without a suppression", () => {
  const generated = generatedRegistrationSource(
    "export const capability: string | undefined =\n  undefined;\n"
  );
  expect(generated).toContain(
    "export const capability: string | undefined =\n  undefined;"
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

const exportPolicyFixtures: Readonly<Record<string, string>> = {
  capability: "export const capability: string | undefined =\n  undefined;\n",
  clause: "const one = 1, two = 2;\nexport { one, two };\n",
  default: "export default 1;\n",
  defaultAlias: "const one = 1;\nexport { one as default };\n",
  empty: "",
  inlineTypeReexport: 'export { type Contract } from "./source";\n',
  mixed:
    "export const one = 1;\nexport interface WorkflowTools { tool: string }\n",
  mixedReexport: 'export { one, type Contract } from "./source";\n',
  multiple: "export const one = 1;\nexport const two = 2;\n",
  multipleReexport: 'export { one, two } from "./source";\n',
  namespace: 'export * as contracts from "./source";\n',
  reexport: 'export { one } from "./source";\n',
  single: "export const one = 1;\n",
  star: 'export * from "./source";\n',
  type: "export interface WorkflowTools { tool: string }\n",
  typeReexport: 'export type { Contract } from "./source";\n',
};

const generatedExportRules: readonly string[] = [
  "typescript/consistent-type-definitions",
];

test("generated named contracts satisfy enabled native rules without unused exceptions", async (): Promise<void> => {
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
    expect(exitCode, diagnosticOutput).toBe(0);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
