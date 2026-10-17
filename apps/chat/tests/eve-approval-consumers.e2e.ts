import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { jsonSchema, tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import type { MessageResponse } from "eve/client";
import { Client } from "eve/client";
import { executeEveMcpTool, requestEveMcpApproval } from "../lib/eve/mcp-tools";
import {
  executeDocumentDeletion,
  requestDocumentDeletion,
} from "../tools/chatjs/delete-document/execute";
import { deleteDocumentInput } from "../tools/chatjs/delete-document/schemas";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  revision: vi.fn(),
  remove: vi.fn(),
  tools: vi.fn(),
  scope: vi.fn(),
  close: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("@/features/mcp/setup", () => ({ requireMcpCredentials: vi.fn() }));
vi.mock("@/features/installed", () => ({
  installedFeatures: new Set(["mcp"]),
}));
vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: new Set(["text"]),
}));
vi.mock("@/lib/db/mcp-queries", () => ({
  getMcpConnectorById: mocks.get,
  getMcpConnectorsByUserId: vi.fn(),
}));
vi.mock("@/lib/eve/conversation-scope", () => ({
  resolveEveConversationScope: mocks.scope,
}));
vi.mock("@/lib/db/eve-documents", () => ({
  getEveDocumentRevision: mocks.revision,
  removeEveDocumentFromConversation: mocks.remove,
}));
vi.mock("@/lib/ai/mcp/mcp-client", () => ({
  MCPClient: class {
    status = "connected";
    connect = mocks.connect;
    close = mocks.close;
    tools = mocks.tools;
  },
}));
const principal = z.object({
  principalId: z.string(),
  principalType: z.string(),
  authenticator: z.string(),
  attributes: z.record(z.string(), z.string()),
});
const wire = z.object({
  kind: z.enum(["mcp", "deletion"]),
  phase: z.enum(["request", "execute"]),
  input: z.unknown(),
  context: z.object({
    callId: z.string(),
    session: z.object({
      id: z.string(),
      auth: z.object({
        current: principal.nullable(),
        initiator: principal.nullable(),
      }),
      turn: z.object({ id: z.string(), sequence: z.number() }),
    }),
    approval: z.object({ responder: principal }).optional(),
  }),
});
const docId = "00000000-0000-4000-8000-000000000001";
const revId = "00000000-0000-4000-8000-000000000002";
let connector = {
  enabled: true,
  id: "connector",
  name: "Fixture",
  oauthClientId: null,
  oauthClientSecret: null,
  requireApproval: true,
  type: "http",
  url: "https://fixture.invalid",
  userId: "owner",
};
let currentRevision = revId;
let flipPolicy = false;
const remote = vi.fn(async (input: unknown) => await Promise.resolve(input));
const audit: z.infer<typeof wire>[] = [];
const failures: string[] = [];
let failureStart = 0;
const server = createServer((incoming, outgoing) => {
  void (async () => {
    try {
      let body = "";
      for await (const chunk of incoming) {
        body += String(chunk);
      }
      const item = wire.parse(JSON.parse(body));
      audit.push(item);
      const context = {
        ...item.context,
        abortSignal: new AbortController().signal,
        approval:
          item.context.approval === undefined
            ? undefined
            : {
                responder: {
                  ...item.context.approval.responder,
                  getToken: (): never => {
                    throw new Error(
                      "Fixture does not transfer native token capabilities."
                    );
                  },
                },
              },
      };
      let result: unknown;
      if (item.kind === "mcp") {
        if (item.phase === "request") {
          result = await requestEveMcpApproval(
            "connector",
            "echo",
            item.input,
            context
          );
          if (flipPolicy) {
            connector = { ...connector, requireApproval: true };
          }
        } else {
          result = await executeEveMcpTool(
            "connector",
            "echo",
            item.input,
            context,
            []
          );
        }
      } else if (item.phase === "request") {
        result = await requestDocumentDeletion(item.input, context);
      } else {
        result = await executeDocumentDeletion(
          deleteDocumentInput.parse(item.input),
          context
        );
      }
      outgoing.setHeader("content-type", "application/json");
      outgoing.end(JSON.stringify({ result }));
    } catch (error: unknown) {
      failures.push(error instanceof Error ? error.message : String(error));
      outgoing.statusCode = 409;
      outgoing.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  })();
});
const eveRoot = path.dirname(
  fileURLToPath(import.meta.resolve("eve/package.json"))
);
const workspaceModules = path.resolve(
  import.meta.dirname,
  "../../../node_modules"
);
let worker: ReturnType<typeof spawn> | undefined;
let app = "";
let host = "";
let logs = "";
beforeAll(async () => {
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Missing bridge port");
  }
  const bridge = `http://127.0.0.1:${address.port}`;
  app = await mkdtemp(path.join(tmpdir(), "eve080-consumers-"));
  await symlink(workspaceModules, path.join(app, "node_modules"));
  await mkdir(path.join(app, "agent/channels"), { recursive: true });
  await mkdir(path.join(app, "agent/tools"));
  await writeFile(
    path.join(app, "package.json"),
    JSON.stringify({
      type: "module",
      dependencies: { eve: "0.80.1", ai: "7.0.137" },
    })
  );
  await writeFile(
    path.join(app, "agent/instructions.md"),
    "Use the selected deterministic tool."
  );
  await writeFile(
    path.join(app, "agent/agent.mjs"),
    `import {defineAgent} from 'eve';import {mockModel} from 'eve/evals';export default defineAgent({defaultTools:false,model:mockModel(({toolResults,lastUserMessage})=>toolResults.length?'done':{toolCalls:[{name:lastUserMessage==='deletion'?'deletion':'mcp',input:lastUserMessage==='deletion'?{documentId:'${docId}',expectedRevisionId:'${revId}',title:'Document'}:{text:'original'}}]})});`
  );
  await writeFile(
    path.join(app, "agent/channels/eve.mjs"),
    "import {eveChannel} from 'eve/channels/eve';export default eveChannel({auth:(request)=>({attributes:{},authenticator:'consumer-fixture',principalId:request.headers.get('x-fixture-actor')??'owner',principalType:'user'})});"
  );
  for (const kind of ["mcp", "deletion"]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Materialize the two authored tool fixtures before starting the runtime.
    await writeFile(
      path.join(app, `agent/tools/${kind}.mjs`),
      `import {defineTool} from 'eve/tools';import {z} from 'zod';
async function bridge(phase,input,ctx){const result=await fetch('${bridge}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'${kind}',phase,input,context:{callId:ctx.callId,session:ctx.session,approval:ctx.approval}})});const body=await result.json();if(!result.ok)throw new Error(body.error);return body.result;}
export default defineTool({description:'Actual ChatJS consumer bridge',inputSchema:${kind === "mcp" ? "z.object({text:z.string()})" : "z.object({documentId:z.string().uuid(),expectedRevisionId:z.string().uuid(),title:z.string()})"},approval:{request:ctx=>bridge('request',ctx.toolInput,ctx),response:({response,session})=>response.principal.principalId===session.initiator?.principalId?{status:'allowed'}:{status:'rejected',reason:'owner only'}},execute:(input,ctx)=>bridge('execute',input,ctx)});`
    );
  }
  worker = spawn(
    process.execPath,
    [
      path.join(eveRoot, "bin/eve.js"),
      "dev",
      "--no-ui",
      "--host",
      "127.0.0.1",
      "--port",
      "0",
      "--no-default-extensions",
    ],
    {
      cwd: app,
      env: {
        PATH: `${path.dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin`,
        HOME: app,
        NODE_ENV: "development",
        EVE_MOCK_AUTHORED_MODELS: "0",
        DOCKER_HOST: `unix://${app}/no-docker.sock`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  worker.stdout?.on("data", (chunk) => {
    logs += chunk;
  });
  worker.stderr?.on("data", (chunk) => {
    logs += chunk;
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const readyAddress = /http:\/\/127\.0\.0\.1:\d+/u.exec(logs)?.[0];
    if (readyAddress !== undefined) {
      host = readyAddress;
      break;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Poll one native subprocess readiness barrier.
    await delay(100);
  }
  if (host === "") {
    throw new Error(`Native server failed: ${logs}`);
  }
});
beforeEach(() => {
  vi.clearAllMocks();
  failureStart = failures.length;
  currentRevision = revId;
  flipPolicy = false;
  connector = {
    ...connector,
    enabled: true,
    requireApproval: true,
    userId: "owner",
  };
  mocks.get.mockImplementation(() => connector);
  mocks.connect.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.close.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.tools.mockResolvedValue({
    echo: tool({
      description: "Echo",
      inputSchema: jsonSchema({
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false,
      }),
      execute: remote,
    }),
  });
  mocks.scope.mockImplementation((ownerId: string) => {
    if (ownerId !== "owner") {
      throw new Error("Foreign scope");
    }
    return { ownerId, conversationId: "conversation" };
  });
  mocks.revision.mockImplementation(() => ({
    id: currentRevision,
    title: "Document",
    kind: "text",
  }));
  mocks.remove.mockImplementation(
    (input: { expectedRevisionId: string }, scope: { ownerId: string }) => {
      if (
        scope.ownerId !== "owner" ||
        input.expectedRevisionId !== currentRevision
      ) {
        throw new Error("Revision changed");
      }
      return {
        status: "success",
        documentId: docId,
        title: "Document",
        result: "removed",
      };
    }
  );
});
const settle = async (pendingResponse: Promise<MessageResponse>) => {
  const response = await pendingResponse;
  return await response.result();
};
const pending = async (kind: string) => {
  const made = await new Client({ host }).sessions.create({ message: kind });
  const snapshot = await made.response.result();
  expect(snapshot.inputRequests).toHaveLength(1);
  return { made, request: snapshot.inputRequests[0] };
};
test("actual MCP consumer executes with a native owner receipt after rejecting a foreign responder", async () => {
  const { made, request } = await pending("mcp");
  expect(remote).not.toHaveBeenCalled();
  const foreign = new Client({
    host,
    headers: { "x-fixture-actor": "foreign" },
  }).sessions.attach(made.session.state.sessionId);
  await settle(
    foreign.respond([{ requestId: request.requestId, optionId: "approve" }])
  );
  expect(remote).not.toHaveBeenCalled();
  await settle(
    made.session.respond([
      { requestId: request.requestId, optionId: "approve" },
    ])
  );
  expect(remote).toHaveBeenCalledTimes(1);
  const entry = audit.find(
    (item) =>
      item.phase === "execute" &&
      item.context.session.id === made.session.state.sessionId
  );
  const original = audit.find(
    (item) =>
      item.phase === "request" &&
      item.context.session.id === made.session.state.sessionId
  );
  expect(entry?.context.callId).toBe(original?.context.callId);
  expect(entry?.input).toEqual({ text: "original" });
  expect(entry?.context.approval).toMatchObject({
    responder: { principalId: "owner", authenticator: "consumer-fixture" },
  });
});
test("actual MCP consumer rechecks connector ownership before a pending effect", async () => {
  const { made, request } = await pending("mcp");
  connector = { ...connector, userId: "foreign" };
  await settle(
    made.session.respond([
      { requestId: request.requestId, optionId: "approve" },
    ])
  );
  expect(remote).not.toHaveBeenCalled();
  expect(failures.slice(failureStart)).toContain(
    "MCP connector is unavailable."
  );
});
test("actual MCP consumer rejects policy tightened after a no-approval request", async () => {
  connector = { ...connector, requireApproval: false };
  flipPolicy = true;
  const made = await new Client({ host }).sessions.create({ message: "mcp" });
  await made.response.result();
  expect(remote).not.toHaveBeenCalled();
  expect(
    audit.find(
      (item) =>
        item.phase === "execute" &&
        item.context.session.id === made.session.state.sessionId
    )?.context.approval
  ).toBeUndefined();
  expect(failures.slice(failureStart)).toContain(
    "MCP tools require an owner approval receipt."
  );
});
test("actual deletion consumer receives native consent for the exact owned document", async () => {
  const { made, request } = await pending("deletion");
  expect(mocks.remove).not.toHaveBeenCalled();
  await settle(
    made.session.respond([
      { requestId: request.requestId, optionId: "approve" },
    ])
  );
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(
    { documentId: docId, expectedRevisionId: revId, title: "Document" },
    { ownerId: "owner", conversationId: "conversation" },
    expect.any(AbortSignal)
  );
  const entry = audit.find(
    (item) =>
      item.phase === "execute" &&
      item.context.session.id === made.session.state.sessionId
  );
  expect(entry?.context.approval).toMatchObject({
    responder: { principalId: "owner" },
  });
});
test("changed deletion revision remains blocked after the original approval", async () => {
  const { made, request } = await pending("deletion");
  currentRevision = "00000000-0000-4000-8000-000000000003";
  await settle(
    made.session.respond([
      { requestId: request.requestId, optionId: "approve" },
    ])
  );
  expect(failures.slice(failureStart)).toContain(
    "Document changed. Read it again before requesting deletion."
  );
  // The real request consumer rechecks revision; the fixture persistence adapter also rejects stale removal.
  expect(mocks.remove).not.toHaveReturnedWith(
    expect.objectContaining({ status: "success" })
  );
});
afterAll(async () => {
  if (
    worker !== undefined &&
    worker.exitCode === null &&
    worker.signalCode === null
  ) {
    const stopped = once(worker, "exit");
    worker.kill("SIGTERM");
    const timer = setTimeout(() => {
      worker?.kill("SIGKILL");
    }, 10_000);
    await stopped;
    clearTimeout(timer);
  }
  const closed = once(server, "close");
  server.close();
  await closed;
  if (app !== "") {
    await writeFile(path.join(app, "server.log"), logs);
  }
  await writeFile(
    path.join(app, "approval-audit.json"),
    `${JSON.stringify({ eve: "0.80.1", app, audit, failures }, null, 2)}\n`
  );
});
