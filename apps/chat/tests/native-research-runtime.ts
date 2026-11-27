/** Run the installed native research files without ChatJS services, using a documented OpenAPI connection. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hasEveBin = (value: unknown): value is { bin: { eve: string } } =>
  typeof value === "object" &&
  value !== null &&
  "bin" in value &&
  typeof value.bin === "object" &&
  value.bin !== null &&
  "eve" in value.bin &&
  typeof value.bin.eve === "string";

const main = async (): Promise<void> => {
  const app = path.resolve(path.dirname(process.argv[1]), "..");
  const workspaceNodeModules = path.resolve(app, "../../node_modules");
  const researchSource = path.resolve(
    app,
    "../../packages/registry/src/tools/deep-research/agent"
  );
  const evePackageJson = fileURLToPath(import.meta.resolve("eve/package.json"));
  const evePackage: unknown = JSON.parse(
    await readFile(evePackageJson, "utf-8")
  );
  if (!hasEveBin(evePackage)) {
    throw new Error("The resolved Eve package does not declare its CLI bin.");
  }
  const eveBin = path.resolve(path.dirname(evePackageJson), evePackage.bin.eve);
  const fixture = await mkdtemp(path.join(tmpdir(), "chatjs-native-research-"));
  const write = async (name: string, content: string): Promise<void> => {
    const target = path.join(fixture, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  const fixtureModules = path.join(fixture, "node_modules");
  await mkdir(fixtureModules);
  const workspaceDependencies = await readdir(workspaceNodeModules);
  await Promise.all(
    workspaceDependencies
      .filter((name) => name !== "eve")
      .map(async (name) => {
        await symlink(
          path.join(workspaceNodeModules, name),
          path.join(fixtureModules, name)
        );
      })
  );
  await symlink(
    path.dirname(evePackageJson),
    path.join(fixtureModules, "eve"),
    "dir"
  );

  await mkdir(path.join(fixture, "agent/tools"), { recursive: true });
  await cp(
    path.join(researchSource, "tools/deep-research.ts"),
    path.join(fixture, "agent/tools/deepResearch.ts")
  );
  await cp(
    path.join(researchSource, "lib/research"),
    path.join(fixture, "agent/lib/research"),
    { recursive: true }
  );
  await cp(
    path.join(researchSource, "lib/research/delivery.native.ts"),
    path.join(fixture, "agent/lib/research/delivery.ts")
  );
  await write(
    "package.json",
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { eve: `file:${path.dirname(evePackageJson)}` },
    })
  );
  await write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        module: "Preserve",
        moduleResolution: "bundler",
        target: "ESNext",
        types: ["eve/workflow-modules"],
      },
    })
  );
  await write(
    "environment.mjs",
    'process.env.NODE_ENV="development"; process.env.EVE_MOCK_AUTHORED_MODELS="0";'
  );
  await write(
    "agent/instructions.md",
    "Use deepResearch for explicit research requests. Follow the delegated phase instructions when called as a native copy.\n"
  );
  await write(
    "agent/sandbox.ts",
    `import { defineSandbox } from "eve/sandbox";
import { JustBashSandbox } from "eve/sandbox/just-bash";
export const environment = JustBashSandbox.environment({ autoInstall: false });
export default defineSandbox(() => environment.open());`
  );
  await write(
    "agent/channels/eve.ts",
    `import { eveChannel } from "eve/channels/eve";
export default eveChannel({ auth: () => ({ principalId: "native-user", principalType: "user", authenticator: "fixture", attributes: {}, allowAgentInfo: true }) });`
  );
  let searches = 0;
  const searchServer = createServer((_request, response) => {
    searches += 1;
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        evidence: "SOURCE_SENTINEL",
        url: "https://example.test/source",
      })
    );
  });
  searchServer.listen(0, "127.0.0.1");
  await once(searchServer, "listening");
  const address = searchServer.address();
  assert.ok(address !== null && typeof address === "object");
  const spec = {
    openapi: "3.0.0",
    info: { title: "Research evidence", version: "1" },
    servers: [{ url: `http://127.0.0.1:${address.port}` }],
    paths: {
      "/search": {
        get: {
          operationId: "search",
          summary: "Search source evidence",
          responses: {
            "200": {
              description: "Evidence",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      evidence: { type: "string" },
                      url: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  await write(
    "agent/connections/evidence.ts",
    `import { defineOpenAPIConnection } from "eve/connections";
export default defineOpenAPIConnection({ description: "Search source evidence", spec: ${JSON.stringify(spec)} });`
  );
  await write(
    "agent/tools/deliver_report.ts",
    `import { defineTool } from "eve/tools";
import { z } from "zod";
export default defineTool({ availableInSubagents: false, description: "Fixture channel file delivery, separate from research", inputSchema: z.object({ path: z.string() }), async execute({ path }, ctx) {
 const sandbox = await ctx.getSandbox();
 return { content: await sandbox.readTextFile({ path }), path };
} });`
  );
  await write(
    "agent/agent.ts",
    `import { defineAgent } from "eve";
import { mockModel } from "eve/evals";
export default defineAgent({ defaultTools: false, modelContextWindowTokens: 128000,
 model: mockModel(({lastUserMessage, tools, toolResults}) => {
  const message = lastUserMessage ?? "";
  if (toolResults.length > 20) throw new Error("Fixture model exceeded expected tool calls");
  const reply = tools.find(t => t.name === "eve__reply");
  if (reply) {
    if (tools.some(t => t.name === "deepResearch" || t.name === "deliver_report")) throw new Error("Root-only tools leaked into research copy");
    const fields = reply.inputSchema.properties;
    let output;
    if (fields.need_clarification) return "eve__reply(need_clarification=False, question='', verification='')";
    else if (fields.research_brief) output = { research_brief: "Compare evidence", title: "Report" };
    else if (fields.complete) output = message.includes("SOURCE_SENTINEL") ? { complete: true, topics: [] } : { complete: false, topics: ["Evidence topic"] };
    else throw new Error("Unexpected structured research phase");

    return { toolCalls: [{ name: "eve__reply", input: output }] };
  }
  if (message.includes("Reply with exactly one JSON object") && message.includes("need_clarification")) {
    return JSON.stringify({ need_clarification: false, question: "", verification: "" });
  }
  if (message.includes("Topic:\\n")) {
    if (!toolResults.some(r => r.name === "eve__search")) return { toolCalls: [{ name: "eve__search", input: { query: "evidence__" } }] };
    if (!toolResults.some(r => r.name === "eve__tool")) return { toolCalls: [{ name: "eve__tool", input: { name: "evidence__search", input: {} } }] };
    if (!JSON.stringify(toolResults).includes("SOURCE_SENTINEL")) throw new Error("Native connection result missing");
    return "# Findings\\nSOURCE_SENTINEL https://example.test/source";
  }
  if (message.includes("Please clean up these findings")) {
    if (!message.includes("SOURCE_SENTINEL")) throw new Error("Compressor lost source file");
    return "# Notes\\nSOURCE_SENTINEL https://example.test/source";
  }
  if (message.includes("The workflow will publish your reply")) {
    if (!message.includes("SOURCE_SENTINEL")) throw new Error("Writer lost saved research notes");
    return "# Report\\nSOURCE_SENTINEL https://example.test/source";
  }
  const report = toolResults.find(r => r.name === "deepResearch");
  if (!report) return { toolCalls: [{ name: "deepResearch", input: { request: "Research source evidence" } }] };
  if (!toolResults.some(r => r.name === "deliver_report")) return { toolCalls: [{ name: "deliver_report", input: { path: report.output.path } }] };
  return "Report delivered";
 }) });`
  );
  await write(
    "evals/evals.config.ts",
    'import { defineEvalConfig } from "eve/evals"; export default defineEvalConfig({ maxConcurrency: 1 });'
  );
  await write(
    "evals/research.eval.ts",
    `import assert from "node:assert/strict";
import { defineEval } from "eve/evals";
export default [defineEval({ description: "native research preserves cited Markdown from a tool-using researcher through report delivery", async test(t) {
 const turn = await t.send("Research");
 turn.succeeded();
 const result = turn.requireToolCall("deepResearch").output.output;
 assert.equal(result.format, "report");
 assert.ok(result.path.startsWith("/workspace/research/"));
 assert.equal(result.fileId, undefined);
 const delivery = turn.requireToolCall("deliver_report").output;
 assert.equal(delivery.path, result.path);
 assert.ok(delivery.content.includes("SOURCE_SENTINEL"));
 assert.ok(turn.events.some(e => e.type === "child.opened" && e.data.name === "agent"));
 }}), defineEval({ description: "cancellation stops research without delivering a report", async test(t) {
 const session = await t.session();
 const live = await session.start("Research then cancel");
 await live.waitForEvent("call.progress");
 await live.cancel();
 const turn = await live.result();
 turn.event("turn.settled", { count: 1, data: { outcome: "cancelled" } });
 assert.ok(!turn.events.some(e => e.type === "call.settled" && e.data.output?.output?.format === "report"));
 }})];`
  );
  console.log(`Native research fixture: ${fixture}`);
  try {
    const worker = spawn(
      "node",
      [
        "--import",
        "./environment.mjs",
        eveBin,
        "eval",
        "--strict",
        "--verbose",
        "--timeout",
        "60000",
      ],
      { cwd: fixture, env: process.env, stdio: "inherit" }
    );
    const exitArguments: unknown[] = await once(worker, "exit");
    const [code] = exitArguments;
    if (code !== 0) {
      throw new Error(
        `Native research verification failed. Fixture retained at ${fixture}`
      );
    }
    assert.equal(searches, 1, "Research must fetch the source once");
    await rm(fixture, { force: true, recursive: true });
  } finally {
    if (searchServer.listening) {
      const closed = once(searchServer, "close");
      searchServer.close();
      searchServer.closeAllConnections();
      await closed;
    }
  }
};
try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
