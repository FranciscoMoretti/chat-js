import { expect, test } from "bun:test";

import { generatedRegistrationSource } from "./generated-registration-source";

const registrationReason =
  "Generated registrations expose separate named contracts";

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
  expect(generatedRegistrationSource("export const empty = {};\n")).toBe(
    "export const empty = {};\n"
  );
  const reexport = 'export type { Contract } from "./contract";\n';
  expect(generatedRegistrationSource(reexport)).toBe(reexport);
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
