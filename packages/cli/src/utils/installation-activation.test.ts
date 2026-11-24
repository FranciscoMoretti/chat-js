import { expect, test } from "bun:test";
import { installationActivation } from "./installation-activation";

test("separates declared composition, native entry points and ordinary framework source", () => {
  const result = installationActivation(
    {
      contractVersion: 3,
      id: "projects",
      kind: "plugin",
      files: [
        "chatjs/plugins/projects/router.ts",
        "chatjs/plugins/projects/chat-server.ts",
      ],
      databaseSchemas: ["chatjs/plugins/projects/schema.ts"],
    },
    [
      "app/(chat)/project/[id]/page.tsx",
      "app/(chat)/project/helper.ts",
      "agent/hooks/projects.ts",
      "agent/subagents/researcher/tools/search.ts",
      "agent/hooks/projects.test.ts",
      "chatjs/plugins/projects/client.tsx",
    ]
  );
  expect(result.integrations).toEqual([
    "integrations/chat/server.ts",
    "integrations/database.ts",
    "integrations/routers.ts",
  ]);
  expect(result.nativeEntryPoints).toEqual([
    { path: "agent/hooks/projects.ts", convention: "EVE hooks" },
    {
      path: "agent/subagents/researcher/tools/search.ts",
      convention: "EVE tools",
    },
    { path: "app/(chat)/project/[id]/page.tsx", convention: "Next.js page" },
  ]);
  expect(result.frameworkFiles).toEqual(["app/(chat)/project/helper.ts"]);
});

test("reports plugin startup wiring from its owned instrumentation entry", () => {
  const result = installationActivation(
    {
      contractVersion: 3,
      id: "startup",
      kind: "plugin",
      files: ["chatjs/plugins/startup/instrumentation.ts"],
    },
    []
  );
  expect(result.integrations).toEqual(["integrations/instrumentation.ts"]);
});
test("describes custom tool definitions without evaluating them", () => {
  const result = installationActivation(
    {
      contractVersion: 1,
      id: "diagram",
      kind: "tool",
      tools: [{ toolExport: "drawDiagram", definitionExport: "diagramTool" }],
    },
    []
  );
  expect(result.integrations).toContain("integrations/tools/definitions.ts");
});

test("reports native root configuration, markdown instructions and nested EVE tools", () => {
  const result = installationActivation({}, [
    "agent/agent.ts",
    "agent/instructions.md",
    "agent/instructions/brief.md",
    "agent/sandbox.ts",
    "agent/tools/notes/create.ts",
    "agent/lib/helper.ts",
    "agent/tools/notes/create.test.ts",
  ]);
  expect(result.nativeEntryPoints.map((item) => item.path)).toEqual([
    "agent/agent.ts",
    "agent/instructions.md",
    "agent/instructions/brief.md",
    "agent/sandbox.ts",
    "agent/tools/notes/create.ts",
  ]);
  expect(result.frameworkFiles).toEqual(["agent/lib/helper.ts"]);
});
