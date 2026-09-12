import { jsonSchema, tool } from "ai";
import { beforeEach, expect, it, vi } from "vitest";
import mcp from "../../agent/tools/mcp";
import { discoverEveMcpTools, executeEveMcpTool } from "./mcp-tools";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  connect: vi.fn(),
  close: vi.fn(),
  tools: vi.fn(),
  enabled: { enabled: true },
}));
vi.mock("../config", () => ({
  config: { ai: { tools: { mcp: mocks.enabled } } },
}));
vi.mock("../db/mcp-queries", () => ({
  getMcpConnectorsByUserId: mocks.list,
  getMcpConnectorById: mocks.get,
}));
vi.mock("../ai/mcp/mcp-client", () => ({
  MCPClient: class {
    status = "connected";
    connect = mocks.connect;
    tools = mocks.tools;
    close = mocks.close;
  },
}));

const connector = {
  id: "connector",
  userId: "owner",
  name: "Server",
  nameId: "server",
  url: "https://secret.mcp.test",
  type: "http",
  enabled: true,
  oauthClientId: "secret-id",
  oauthClientSecret: "secret-password",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const context = {
  callId: "call",
  abortSignal: new AbortController().signal,
  session: {
    id: "session",
    auth: {
      current: null,
      initiator: {
        principalId: "owner",
        principalType: "user",
        authenticator: "test",
        attributes: {},
      },
    },
    turn: { id: "turn", sequence: 1 },
  },
};
const execute = vi.fn();
const definition = tool({
  description: "Echo",
  inputSchema: jsonSchema({
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  }),
  execute,
  toModelOutput: ({ output }) => ({ type: "text", value: String(output) }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.enabled = true;
  mocks.list.mockResolvedValue([connector]);
  mocks.get.mockResolvedValue(connector);
  mocks.connect.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.tools.mockResolvedValue({ echo: definition });
  execute.mockResolvedValue("Echo output");
});

it("returns serializable namespaced discovery without credentials or live connections", async () => {
  const tools = await discoverEveMcpTools("owner", context.abortSignal);
  expect(tools).toMatchObject([
    {
      name: "server__echo",
      connectorId: "connector",
      remoteName: "echo",
      description: "Echo",
    },
  ]);
  expect(JSON.stringify(tools)).not.toContain("secret");
  expect(mocks.close).toHaveBeenCalledOnce();
});

it.each([
  { userId: "stranger" },
  { enabled: false },
])("rejects inaccessible or disabled connectors before connection: %j", async (change) => {
  mocks.get.mockResolvedValue({ ...connector, ...change });
  await expect(
    executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).rejects.toThrow("unavailable");
  expect(mocks.connect).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
});

it("revalidates after discovery and refuses a revoked connector", async () => {
  await discoverEveMcpTools("owner", context.abortSignal);
  mocks.get.mockResolvedValue(undefined);
  await expect(
    executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).rejects.toThrow("unavailable");
  expect(execute).not.toHaveBeenCalled();
});

it("keeps the execution connection open and preserves the MCP model output", async () => {
  const pending = Promise.withResolvers<string>();
  execute.mockReturnValue(pending.promise);
  const result = executeEveMcpTool(
    "connector",
    "echo",
    { text: "test" },
    context,
    []
  );
  await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
  expect(mocks.close).not.toHaveBeenCalled();
  pending.resolve("Echo output");
  expect(await result).toEqual({
    kind: "chatjs.mcp-result",
    output: "Echo output",
    modelOutput: { type: "text", value: "Echo output" },
  });
  expect(mocks.close).toHaveBeenCalledOnce();
});

it("closes on execution errors and rejects invalid input before invoking the tool", async () => {
  await expect(
    executeEveMcpTool("connector", "echo", { text: 123 }, context, [])
  ).rejects.toThrow("Invalid tool input");
  expect(execute).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalledOnce();
  execute.mockRejectedValueOnce(new Error("remote failure"));
  await expect(
    executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).rejects.toThrow("remote failure");
  expect(mocks.close).toHaveBeenCalledTimes(2);
});

it("permits global connectors with a separate namespace", async () => {
  mocks.list.mockResolvedValue([{ ...connector, userId: null }]);
  expect(await discoverEveMcpTools("owner", context.abortSignal)).toMatchObject(
    [{ name: "global__server__echo" }]
  );
  mocks.get.mockResolvedValue({ ...connector, userId: null });
  expect(
    await executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).toMatchObject({ output: "Echo output" });
});

it("forwards cancellation and closes the connection once", async () => {
  const cancellation = new AbortController();
  execute.mockImplementation(
    (_input, options) =>
      new Promise((_resolve, reject) => {
        options.abortSignal.addEventListener(
          "abort",
          () => reject(options.abortSignal.reason),
          { once: true }
        );
      })
  );
  const result = executeEveMcpTool(
    "connector",
    "echo",
    { text: "test" },
    { ...context, abortSignal: cancellation.signal },
    []
  );
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
  cancellation.abort();
  await rejected;
  expect(mocks.close).toHaveBeenCalledOnce();
});

it.each([
  undefined,
  "https://json-schema.org/draft/2020-12/schema",
])("enforces modern MCP schema keywords with dialect %s", async ($schema) => {
  const schema = {
    $schema,
    type: "object" as const,
    properties: {
      text: { type: "string" as const },
      language: { type: "string" as const },
    },
    dependentRequired: { text: ["language"] },
  };
  mocks.tools.mockResolvedValue({
    echo: { ...definition, inputSchema: jsonSchema(schema) },
  });
  await expect(
    executeEveMcpTool("connector", "echo", { text: "hello" }, context, [])
  ).rejects.toThrow("Invalid tool input");
  expect(execute).not.toHaveBeenCalled();
  await expect(
    executeEveMcpTool(
      "connector",
      "echo",
      { text: "hello", language: "en" },
      context,
      []
    )
  ).resolves.toMatchObject({ output: "Echo output" });
});

it("retains explicitly declared draft-07 tuple validation", async () => {
  mocks.tools.mockResolvedValue({
    echo: {
      ...definition,
      inputSchema: jsonSchema({
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          pair: {
            type: "array",
            items: [{ type: "string" }, { type: "number" }],
          },
        },
      }),
    },
  });
  await expect(
    executeEveMcpTool(
      "connector",
      "echo",
      { pair: ["hello", "invalid"] },
      context,
      []
    )
  ).rejects.toThrow("Invalid tool input");
  expect(execute).not.toHaveBeenCalled();
  await expect(
    executeEveMcpTool("connector", "echo", { pair: ["hello", 1] }, context, [])
  ).resolves.toMatchObject({ output: "Echo output" });
});

it("refuses a policy that escalates after a definition was discovered without approval", async () => {
  const [description] = await discoverEveMcpTools("owner", context.abortSignal);
  expect(description.requiresApproval).toBe(false);
  mocks.tools.mockResolvedValue({
    echo: { ...definition, needsApproval: true },
  });
  await expect(
    executeEveMcpTool(
      "connector",
      "echo",
      { text: "test" },
      context,
      [],
      description.requiresApproval
    )
  ).rejects.toThrow("approval policy changed");
  expect(execute).not.toHaveBeenCalled();
});

it.each([
  true,
  () => false,
  async () => true,
])("keeps policy-bearing MCP tools available with a durable approval requirement", async (needsApproval) => {
  mocks.tools.mockResolvedValue({ echo: { ...definition, needsApproval } });
  const [description] = await discoverEveMcpTools("owner", context.abortSignal);
  expect(description.requiresApproval).toBe(true);
  expect(JSON.stringify(description)).not.toContain("needsApproval");
  expect(
    await executeEveMcpTool(
      "connector",
      "echo",
      { text: "test" },
      context,
      [],
      description.requiresApproval
    )
  ).toMatchObject({ output: "Echo output" });
});

it("registers native per-call approval restricted to the session owner", async () => {
  mocks.tools.mockResolvedValue({
    echo: { ...definition, needsApproval: true },
  });
  const resolve = mcp.events["step.started"];
  if (!resolve) {
    throw new Error("Missing MCP resolver.");
  }
  const tools = await resolve(
    {},
    { session: context.session, channel: {}, messages: [] }
  );
  const approval = tools.server__echo.approval;
  if (!approval || typeof approval === "function" || !approval.response) {
    throw new Error("Missing native owner approval policy.");
  }
  expect(
    await approval.request({
      session: context.session,
      callId: "call",
      toolName: "server__echo",
      toolInput: { text: "write" },
      approvedTools: new Set(),
      getSandbox: () => {
        throw new Error("Unexpected sandbox");
      },
      getSkill: () => {
        throw new Error("Unexpected skill");
      },
    })
  ).toBe("user-approval");
  const initiator = context.session.auth.initiator;
  const response = {
    auth: {
      getToken: vi.fn(),
      requireAuth: () => {
        throw new Error("Unexpected auth");
      },
    },
    request: { callId: "call", requestId: "request", toolName: "server__echo" },
    response: { decision: "approve" as const },
    responder: initiator,
    session: { id: "session", initiator, turn: context.session.turn },
  };
  expect(await approval.response(response)).toEqual({ status: "allowed" });
  expect(
    await approval.response({
      ...response,
      responder: { ...initiator, principalId: "other" },
    })
  ).toMatchObject({ status: "rejected" });
  expect(execute).not.toHaveBeenCalled();
});
