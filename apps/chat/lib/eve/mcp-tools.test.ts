import { jsonSchema, tool } from "ai";
import { beforeEach, expect, it, vi } from "vitest";

import mcp from "../../agent/tools/mcp";
import {
  discoverEveMcpTools,
  executeEveMcpTool,
  requestEveMcpApproval,
} from "./mcp-tools";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  connect: vi.fn(),
  enabled: { enabled: true },
  get: vi.fn(),
  list: vi.fn(),
  tools: vi.fn(),
}));
vi.mock("../config", () => ({
  config: { ai: { tools: { mcp: mocks.enabled } } },
}));
vi.mock("../db/mcp-queries", () => ({
  getMcpConnectorById: mocks.get,
  getMcpConnectorsByUserId: mocks.list,
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
  createdAt: new Date(),
  enabled: true,
  id: "connector",
  name: "Server",
  nameId: "server",
  oauthClientId: "secret-id",
  oauthClientSecret: "secret-password",
  type: "http",
  updatedAt: new Date(),
  url: "https://secret.mcp.test",
  userId: "owner",
};
const context = {
  abortSignal: new AbortController().signal,
  callId: "call",
  session: {
    auth: {
      current: null,
      initiator: {
        attributes: {},
        authenticator: "test",
        principalId: "owner",
        principalType: "user",
      },
    },
    id: "session",
    turn: { id: "turn", sequence: 1 },
  },
};
const execute = vi.fn();
const definition = tool({
  description: "Echo",
  execute,
  inputSchema: jsonSchema({
    additionalProperties: false,
    properties: { text: { type: "string" } },
    required: ["text"],
    type: "object",
  }),
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
      connectorId: "connector",
      description: "Echo",
      name: "server__echo",
      remoteName: "echo",
    },
  ]);
  expect(JSON.stringify(tools)).not.toContain("secret");
  expect(mocks.close).toHaveBeenCalledOnce();
});

it.each([{ userId: "stranger" }, { enabled: false }])(
  "rejects inaccessible or disabled connectors before connection: %j",
  async (change) => {
    mocks.get.mockResolvedValue({ ...connector, ...change });
    await expect(
      executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
    ).rejects.toThrow("unavailable");
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  }
);

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
    modelOutput: { type: "text", value: "Echo output" },
    output: "Echo output",
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
      // oxlint-disable-next-line promise/avoid-new -- Bridge the timer or abort callback to the awaited operation.
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

it.each([undefined, "https://json-schema.org/draft/2020-12/schema"])(
  "enforces modern MCP schema keywords with dialect %s",
  async ($schema) => {
    const schema = {
      $schema,
      dependentRequired: { text: ["language"] },
      properties: {
        language: { type: "string" as const },
        text: { type: "string" as const },
      },
      type: "object" as const,
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
        { language: "en", text: "hello" },
        context,
        []
      )
    ).resolves.toMatchObject({ output: "Echo output" });
  }
);

it("retains explicitly declared draft-07 tuple validation", async () => {
  mocks.tools.mockResolvedValue({
    echo: {
      ...definition,
      inputSchema: jsonSchema({
        $schema: "http://json-schema.org/draft-07/schema#",
        properties: {
          pair: {
            items: [{ type: "string" }, { type: "number" }],
            type: "array",
          },
        },
        type: "object",
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

it("refuses a policy that escalates between request and execution without a receipt", async () => {
  expect(
    await requestEveMcpApproval(
      "connector",
      "echo",
      { text: "test" },
      context,
      []
    )
  ).toBe("not-applicable");
  mocks.tools.mockResolvedValue({
    echo: { ...definition, needsApproval: true },
  });
  await expect(
    executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).rejects.toThrow("approval policy changed");
  expect(execute).not.toHaveBeenCalled();
});

it("preserves conditional policy semantics and requires an owner receipt when true", async () => {
  const needsApproval = vi.fn(
    (input: { text: string }) => input.text === "write"
  );
  mocks.tools.mockResolvedValue({ echo: { ...definition, needsApproval } });
  const messages = [{ content: "Read then write", role: "user" as const }];
  expect(await discoverEveMcpTools("owner", context.abortSignal)).toHaveLength(
    1
  );
  expect(
    await requestEveMcpApproval(
      "connector",
      "echo",
      { text: "read" },
      context,
      messages
    )
  ).toBe("not-applicable");
  expect(
    await executeEveMcpTool(
      "connector",
      "echo",
      { text: "read" },
      context,
      messages
    )
  ).toMatchObject({ output: "Echo output" });
  expect(
    await requestEveMcpApproval(
      "connector",
      "echo",
      { text: "write" },
      context,
      messages
    )
  ).toBe("user-approval");
  await expect(
    executeEveMcpTool("connector", "echo", { text: "write" }, context, messages)
  ).rejects.toThrow("approval policy changed");
  const approval = {
    requestId: "request",
    responder: {
      authenticator: "test",
      principalId: "owner",
      principalType: "user",
    },
  };
  expect(
    await executeEveMcpTool(
      "connector",
      "echo",
      { text: "write" },
      { ...context, approval },
      messages
    )
  ).toMatchObject({ output: "Echo output" });
  await expect(
    executeEveMcpTool(
      "connector",
      "echo",
      { text: "write" },
      {
        ...context,
        approval: {
          ...approval,
          responder: { ...approval.responder, principalId: "other" },
        },
      },
      messages
    )
  ).rejects.toThrow("approval policy changed");
  expect(needsApproval).toHaveBeenLastCalledWith(
    { text: "write" },
    { context: undefined, messages, toolCallId: "call" }
  );
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
    { channel: {}, messages: [], session: context.session }
  );
  const { approval } = tools.server__echo;
  if (!approval || typeof approval === "function" || !approval.response) {
    throw new Error("Missing native owner approval policy.");
  }
  expect(
    await approval.request({
      approvedTools: new Set(),
      callId: "call",
      getSandbox: () => {
        throw new Error("Unexpected sandbox");
      },
      getSkill: () => {
        throw new Error("Unexpected skill");
      },
      session: context.session,
      toolInput: { text: "write" },
      toolName: "server__echo",
    })
  ).toBe("user-approval");
  const { initiator } = context.session.auth;
  const response = {
    auth: {
      getToken: vi.fn(),
      requireAuth: () => {
        throw new Error("Unexpected auth");
      },
    },
    request: { callId: "call", requestId: "request", toolName: "server__echo" },
    responder: initiator,
    response: { decision: "approve" as const },
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

vi.mock("./turn-tools", () => ({
  eveTurnGuest: { get: () => false },
  eveTurnTool: { get: () => null },
}));
