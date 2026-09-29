/* oxlint-disable eslint/no-await-in-loop -- Assemble each fixture before starting the native worker. */
/* oxlint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- CommonJS-compatible CLI entry point reports rejected startup work. */
/** Exercise the production workflow in a real EVE worker with deterministic models and storage. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const modelSource = (responder: string) => `import { defineAgent } from "eve";
import { mockModel } from "eve/evals";
export default defineAgent({ description: "Research fixture", defaultTools: false, tool: false, modelContextWindowTokens: 128000, model: mockModel(${responder}) });`;

const main = async () => {
  const app = path.resolve(path.dirname(process.argv[1]), "..");
  const fixture = await mkdtemp(path.join(tmpdir(), "chatjs-native-research-"));
  const write = async (name: string, content: string) => {
    const target = path.join(fixture, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  await symlink(
    path.join(app, "node_modules"),
    path.join(fixture, "node_modules"),
    "dir"
  );
  for (const name of [
    "agent/tools/deepResearch.ts",
    "agent/hooks/billing.ts",
    "lib/eve/usage.ts",
    "agent/subagents/researcher/tools/webSearch.ts",
    "lib/eve/research-tool.ts",
    "lib/eve/research-contracts.ts",
    "lib/eve/research-search-updates.ts",
    "tools/platform/research-updates-schema.ts",
    "lib/eve/tool-result.ts",
    "lib/eve/tool-model-output.ts",
    "tools/platform/deep-research/prompts.ts",
  ]) {
    await mkdir(path.dirname(path.join(fixture, name)), { recursive: true });
    await cp(path.join(app, name), path.join(fixture, name));
  }
  for (const role of [
    "researchPlanner",
    "researcher",
    "researchCompressor",
    "researchWriter",
  ]) {
    await write(
      `agent/subagents/${role}/hooks/billing.ts`,
      'export { default } from "../../../hooks/billing";'
    );
  }
  const ledger = path.join(fixture, "ledger");
  await write(
    "agent/channels/eve.ts",
    `import { eveChannel } from "eve/channels/eve";
export default eveChannel({ auth: () => ({ principalId: "owner", principalType: "user", authenticator: "fixture", attributes: {} }) });`
  );
  await write(
    "lib/db/eve-billing.ts",
    `import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export async function recordEveUsage(row) {
  await mkdir(${JSON.stringify(ledger)}, { recursive: true });
  await writeFile(${JSON.stringify(ledger)} + "/" + createHash("sha256").update(row.eventId).digest("hex") + ".json", JSON.stringify(row));
  return row.costUsd !== undefined;
}`
  );
  await write(
    "lib/db/eve-subagents.ts",
    `import { mkdir, readFile, writeFile } from "node:fs/promises";
const directory = ${JSON.stringify(path.join(fixture, "children"))};
export async function getEveSubagent(owner, session) {
  try { return JSON.parse(await readFile(directory + "/" + session + ".json", "utf8")); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
}
export async function registerEveSubagent(owner, parent, session, turn) {
  const ancestor = await getEveSubagent(owner, parent);
  const binding = { rootSessionId: ancestor?.rootSessionId ?? parent, rootTurnId: ancestor?.rootTurnId ?? turn };
  await mkdir(directory, { recursive: true });
  await writeFile(directory + "/" + session + ".json", JSON.stringify(binding));
  return binding;
}`
  );
  await write(
    "package.json",
    JSON.stringify({
      dependencies: { eve: "npm:@chat-js/eve@0.61.0-chatjs.0" },
      private: true,
      type: "module",
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
    'process.env.DOCKER_HOST="unix:///tmp/chatjs-native-test-no-docker.sock"; process.env.NODE_ENV="development"; process.env.EVE_MOCK_AUTHORED_MODELS="0";'
  );
  await write(
    "lib/eve/connection-options.ts",
    `import { readFileSync } from "node:fs";
export const getEveConnectionOptions = () => ({ host: readFileSync(${JSON.stringify(path.join(fixture, "host"))}, "utf8") });`
  );
  await write(
    "lib/eve/research-steps.ts",
    `
export async function prepareResearch() {
  "use step";
  return { config: { allow_clarification: false, max_concurrent_research_units: 2, max_researcher_iterations: 2, search_api_max_queries: 3 }, date: "Sep 28, 2026", messages: "Research the evidence", timestamp: 0 };
}
export async function saveResearchReport(ctx, report) {
  "use step";
  ctx.abortSignal.throwIfAborted();
  return { ...report, documentId: ctx.callId, revisionId: "revision", date: "2026-09-28", kind: "text", status: "success", result: "Saved" };
}
export async function researchCompletionTime() { "use step"; return 1; }
`
  );
  await write(
    "agent/agent.ts",
    `
import { defineAgent } from "eve";
import { mockModel } from "eve/evals";
export default defineAgent({ defaultTools: false, modelContextWindowTokens: 128000,
  model: mockModel(({toolResults}) => toolResults.some(r => r.name === "deepResearch") ? "Done" : { toolCalls: [{ name: "deepResearch", input: {} }] }),
});`
  );
  await write(
    "agent/instructions.md",
    "Use deepResearch once for each request.\n"
  );
  await write(
    "agent/subagents/researchPlanner/agent.ts",
    modelSource(`({lastUserMessage}) => {
 const message = lastUserMessage ?? "";
 const decision = message.includes("Decision round");
 const output = !decision ? { research_brief: "Compare evidence", title: "Report" } :
 message.includes("Follow-up evidence") ? { complete: true, topics: [] } :
 message.includes("First evidence") ? { complete: false, topics: ["Follow-up topic"] } : { complete: false, topics: ["Initial topic"] };
 return { toolCalls: [{ name: "final_output", input: output }] };
}`)
  );
  await write(
    "agent/subagents/researcher/agent.ts",
    modelSource(`({lastUserMessage,toolResults}) => !toolResults.some(r => r.name === "webSearch")
 ? { toolCalls: [{ name: "webSearch", input: { query: "evidence" } }] }
 : { toolCalls: [{ name: "final_output", input: { findings: lastUserMessage?.includes("Follow-up topic") ? "Follow-up evidence https://example.test/two" : "First evidence https://example.test/one" } }] }`)
  );
  await write(
    "agent/subagents/researchCompressor/agent.ts",
    modelSource(
      `({lastUserMessage}) => ({ toolCalls: [{ name: "final_output", input: { findings: lastUserMessage?.includes("Follow-up evidence") ? "Follow-up evidence" : "First evidence" } }] })`
    )
  );
  await write(
    "agent/subagents/researchWriter/agent.ts",
    modelSource(`({lastUserMessage}) => {
 if (!lastUserMessage?.includes("First evidence") || !lastUserMessage?.includes("Follow-up evidence")) throw new Error("Lost findings");
 return { toolCalls: [{ name: "final_output", input: { title: "Report", content: "# Both rounds" } }] };
}`)
  );
  await write(
    "tools/chatjs/tools.ts",
    `
import { defineTool } from "eve/tools";
import { z } from "zod";
import { setTimeout } from "node:timers/promises";
const webSearch = defineTool({ description: "Fixture search", inputSchema: z.object({ query: z.string() }),
 async execute(input, ctx) {
   await setTimeout(1000, undefined, { signal: ctx.abortSignal });
   return { kind: "chatjs.tool-result", version: 1, status: "success", output: { result: input.query }, usage: { costUsd: 0.02 }, updates: [{ type: "web", toolCallId: ctx.callId, title: "Search complete", status: "completed", queries: [input.query], results: [{ title: "Evidence", url: "https://example.com", content: input.query, source: "web" }] }] };
 },
});
export const tools = { webSearch };`
  );
  await write(
    "lib/config.ts",
    "export const config = { ai: { tools: { webSearch: { enabled: true } } } }; "
  );
  await write(
    "evals/evals.config.ts",
    'import { defineEvalConfig } from "eve/evals"; export default defineEvalConfig({ maxConcurrency: 1 });'
  );
  await write(
    "evals/research.eval.ts",
    `
import assert from "node:assert/strict";
import { defineEval } from "eve/evals";
import { Client } from "eve/client";
import { readdir, readFile, writeFile } from "node:fs/promises";
export default [defineEval({ description: "adaptive native research", async test(t) {
  await writeFile(${JSON.stringify(path.join(fixture, "host"))}, t.target.url);
  const turn = await t.send("Research");
  turn.succeeded();
  const receipt = turn.requireToolCall("deepResearch").output;
  assert.equal(receipt.output.format, "report");
  assert.equal(receipt.output.content, "# Both rounds");
  assert.equal(receipt.usage.costUsd, 0);
  assert.equal(receipt.updates.filter(u => u.type === "web").length, 2);
  const client = new Client({ host: t.target.url });
  const root = await client.sessions.attach(turn.sessionId).snapshot();
  const children = root.events.filter(e => e.type === "subagent.called");
  assert.equal(children.filter(e => e.data.name === "researcher").length, 2);
  let searchCalls = 0;
  for (const child of children) {
    const stream = await client.sessions.attach(child.data.childSessionId).snapshot();
    searchCalls += stream.events.filter(e => e.type === "action.result" && e.data.result.kind === "tool-result" && e.data.result.toolName === "webSearch").length;
  }
  assert.equal(searchCalls, 2);
  const ledger = ${JSON.stringify(ledger)};
  const evidence = await Promise.all((await readdir(ledger)).map(name => readFile(ledger + "/" + name, "utf8").then(JSON.parse)));
  const searchCharges = evidence.filter(row => row.eventId.startsWith("eve-tool:") && row.costUsd === 0.02 && row.sessionId === turn.sessionId);
  assert.equal(searchCharges.length, 2);
  assert.equal(new Set(searchCharges.map(row => row.turnId)).size, 1);
  assert.ok(evidence.some(row => row.eventId.startsWith("eve-child:") && row.sessionId === turn.sessionId));
  assert.ok(root.events.some(e => e.type === "action.partial"));
}}), defineEval({ description: "cancellation stops owned research", async test(t) {
  await writeFile(${JSON.stringify(path.join(fixture, "host"))}, t.target.url);
  const session = await t.session();
  const live = await session.start("Research then cancel");
  const called = await live.waitForEvent("subagent.called", { data: { name: "researcher" } });
  await live.cancel();
  await live.result();
  const client = new Client({ host: t.target.url });
  const root = await client.sessions.attach(session.sessionId).snapshot();
  assert.ok(root.events.some(e => e.type === "turn.cancelled"));
  assert.ok(!root.events.some(e => e.type === "action.result" && e.data.status === "completed" && e.data.result.kind === "tool-result" && e.data.result.output?.output?.format === "report"));
  let childStopped = false;
  for await (const event of client.sessions.attach(called.data.childSessionId).stream({ follow: true, signal: AbortSignal.timeout(10000) })) {
    if (["turn.cancelled", "turn.failed", "session.completed", "session.failed"].includes(event.type)) { childStopped = true; break; }
  }
  assert.ok(childStopped, "owned child must stop");
}})];`
  );
  console.log(`Native research fixture: ${fixture}`);
  const worker = spawn(
    process.execPath,
    [
      "--import",
      "./environment.mjs",
      path.join(app, "node_modules/eve/bin/eve.js"),
      "eval",
      "--strict",
      "--verbose",
      "--timeout",
      "60000",
    ],
    {
      cwd: fixture,
      env: process.env,
      stdio: "inherit",
    }
  );
  const [code] = await once(worker, "exit");
  if (code !== 0) {
    throw new Error(
      `Native research verification failed. Fixture retained at ${fixture}`
    );
  }
  await rm(fixture, { force: true, recursive: true });
};
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
