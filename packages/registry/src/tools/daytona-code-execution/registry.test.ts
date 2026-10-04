/* oxlint-disable typescript/prefer-readonly-parameter-types -- Registry schema entries retain their parsed public descriptor types at this integration boundary. */
import { expect, test } from "bun:test";

/* oxlint-disable import/no-relative-parent-imports -- These package-local tests exercise the actual published registry descriptors. */
import { toolDefinitionSchema } from "../../../metadata";
import { registry } from "../../../registry";
/* oxlint-enable import/no-relative-parent-imports */

const daytona = registry.items.find(
  (item) => item.name === "daytona-code-execution"
);
const descriptor = toolDefinitionSchema.parse(daytona?.meta?.chatjs);

test("Daytona installation declares its credentials and shared executor without Vercel dependencies", () => {
  expect(daytona?.dependencies).toContain("@daytona/sdk@0.220.0");
  expect(
    daytona?.dependencies?.some((dependency) =>
      dependency.startsWith("@vercel/")
    )
  ).toBe(false);
  expect(daytona?.registryDependencies).toEqual([
    "@chatjs/code-execution-ui",
    "@chatjs/code-execution-runtime",
  ]);
  expect(descriptor.codeExecutorExport).toBe("executeCode");
  expect(descriptor.envRequirements).toEqual([
    { options: [["DAYTONA_API_KEY", "DAYTONA_ORGANIZATION_ID"]] },
  ]);
  expect(descriptor.codeExecutionCapabilities?.languages).toEqual([
    "python",
    "javascript",
  ]);
});

test("external executors need no central provider name and reject incompatible capabilities", () => {
  expect(
    toolDefinitionSchema.parse({ ...descriptor, id: "external-executor" }).id
  ).toBe("external-executor");
  expect(() =>
    toolDefinitionSchema.parse({
      ...descriptor,
      codeExecutionCapabilities: {
        ...descriptor.codeExecutionCapabilities,
        languages: ["python"],
      },
    })
  ).toThrow("Python and JavaScript");
  expect(() =>
    toolDefinitionSchema.parse({
      ...descriptor,
      codeExecutionCapabilities: {
        ...descriptor.codeExecutionCapabilities,
        cleanup: "none",
      },
    })
  ).toThrow();
});
