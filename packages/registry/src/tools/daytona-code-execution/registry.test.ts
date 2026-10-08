import { expect, test } from "bun:test";

/* oxlint-disable import/no-relative-parent-imports -- These package-local tests exercise the actual published registry descriptors. */
import { toolDefinitionSchema } from "../../../metadata";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { registry } from "../../../registry";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const daytona = registry.items.find(
  (item: { readonly name: string }) => item.name === "daytona-code-execution"
);
if (!daytona) {
  throw new Error("Daytona registry item is missing");
}
const { dependencies, meta, registryDependencies } = daytona;
if (!meta) {
  throw new Error("Daytona registry metadata is missing");
}
const descriptor = toolDefinitionSchema.parse(meta.chatjs);
if (!dependencies) {
  throw new Error("Daytona registry dependencies are missing");
}
const { codeExecutionCapabilities: capabilities } = descriptor;
if (!capabilities) {
  throw new Error("Daytona code execution capabilities are missing");
}

test("Daytona installation declares its credentials and shared executor without Vercel dependencies", () => {
  expect(dependencies).toContain("@daytona/sdk@0.220.0");
  expect(
    dependencies.some((dependency) => dependency.startsWith("@vercel/"))
  ).toBe(false);
  expect(registryDependencies).toEqual([
    "@chatjs/code-execution-ui",
    "@chatjs/code-execution-runtime",
  ]);
  expect(descriptor.codeExecutorExport).toBe("executeCode");
  expect(descriptor.envRequirements).toEqual([
    { options: [["DAYTONA_API_KEY", "DAYTONA_ORGANIZATION_ID"]] },
  ]);
  expect(capabilities.languages).toEqual(["python", "javascript"]);
});

test("external executors need no central provider name and reject incompatible capabilities", () => {
  expect(
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing descriptor own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    toolDefinitionSchema.parse({ ...descriptor, id: "external-executor" }).id
  ).toBe("external-executor");
  expect(() =>
    toolDefinitionSchema.parse({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing descriptor own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...descriptor,
      codeExecutionCapabilities: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing descriptor.codeExecutionCapabilities own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...descriptor.codeExecutionCapabilities,
        languages: ["python"],
      },
    })
  ).toThrow("Python and JavaScript");
  expect(() =>
    toolDefinitionSchema.parse({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing descriptor own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...descriptor,
      codeExecutionCapabilities: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing descriptor.codeExecutionCapabilities own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...descriptor.codeExecutionCapabilities,
        cleanup: "none",
      },
    })
  ).toThrow();
});
