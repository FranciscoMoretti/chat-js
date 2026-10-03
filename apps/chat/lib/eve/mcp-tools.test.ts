/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/tools/mcp" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { jsonSchema, tool } from "ai";
import { beforeEach, expect, it, vi } from "vitest";

import mcp from "../../agent/tools/mcp";
import {
  discoverEveMcpTools,
  executeEveMcpTool,
  requestEveMcpApproval,
} from "./mcp-tools";
import { hasEveToolReceipt, createToolResult } from "./tool-result";
/* oxlint-enable import/no-relative-parent-imports */

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  configure: vi.fn(),
  connect: vi.fn(),
  enabled: { enabled: true },
  get: vi.fn(),
  list: vi.fn(),
  requireCredentials: vi.fn(),
  tools: vi.fn(),
}));
vi.mock("@/features/mcp/setup", () => ({
  requireMcpCredentials: mocks.requireCredentials,
}));

vi.mock("@/features/installed", () => ({
  installedFeatures: { has: (): boolean => mocks.enabled.enabled },
}));

vi.mock("@/lib/db/mcp-queries", () => ({
  getMcpConnectorById: mocks.get,
  getMcpConnectorsByUserId: mocks.list,
}));
vi.mock("@/lib/ai/mcp/mcp-client", () => ({
  MCPClient: class {
    public constructor(_id: string, _name: string, options: unknown) {
      mocks.configure(options);
    }
    public status = "connected";
    public connect = mocks.connect;
    public tools = mocks.tools;
    public close = mocks.close;
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
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): context preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */
const execute = vi.fn();
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): definition accepts { output }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined --
 * no-undefined (#519): beforeEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.enabled = true;
  mocks.requireCredentials.mockReset();
  mocks.list.mockResolvedValue([connector]);
  mocks.get.mockResolvedValue(connector);
  mocks.connect.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.tools.mockResolvedValue({ echo: definition });
  execute.mockResolvedValue("Echo output");
});
/* oxlint-enable no-undefined */

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

/* oxlint-disable typescript/prefer-readonly-parameter-types  --
 * oxc/no-async-await (#540): it.each([{ userId: "stranger" }, { enabled: false }])("rejects inaccessible or disabl sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it.each([{ userId: "stranger" }, { enabled: false }])("rejects inaccessible or disabl copies or separates ...connector; ...change while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): it.each([{ userId: "stranger" }, { enabled: false }])("rejects inaccessible or disabl accepts change; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined  --
 * no-undefined (#519): it("revalidates after discovery and refuses a revoked connector") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("revalidates after discovery and refuses a revoked connector") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("revalidates after discovery and refuses a revoked connector", async () => {
  await discoverEveMcpTools("owner", context.abortSignal);
  mocks.get.mockResolvedValue(undefined);
  await expect(
    executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).rejects.toThrow("unavailable");
  expect(execute).not.toHaveBeenCalled();
});
/* oxlint-enable no-undefined */

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

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("closes on execution errors and rejects invalid input before invoking the tool") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("closes on execution errors and rejects invalid input before invoking the tool") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable unicorn/no-null  --
 * oxc/no-async-await (#540): it("permits global connectors with a separate namespace") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("permits global connectors with a separate namespace") copies or separates ...connector while preserving existing object ownership; mutating source objects is not equivalent.
 * unicorn/no-null (#570): it("permits global connectors with a separate namespace") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/promise-function-async  --
 * oxc/no-async-await (#540): it("forwards cancellation and closes the connection once") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("forwards cancellation and closes the connection once") copies or separates ...context while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/promise-function-async (#606): it("forwards cancellation and closes the connection once") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("forwards cancellation and closes the connection once", async () => {
  const cancellation = new AbortController();
  execute.mockImplementation(
    (_input, options) =>
      // oxlint-disable-next-line promise/avoid-new -- Bridge the timer or abort callback to the awaited operation.
      new Promise((_resolve, reject) => {
        // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access -- #596: This mcp-tools fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This mcp-tools fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
        options.abortSignal.addEventListener(
          "abort",
          // oxlint-disable-next-line typescript/prefer-promise-reject-errors, typescript/no-unsafe-member-access -- #603: This test deliberately injects a non-Error failure to verify rejection and abort handling for arbitrary provider reasons. #597: This mcp-tools fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
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
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable no-undefined  --
 * no-undefined (#519): it.each([undefined, "https://json-schema.org/draft/2020-12/schema"])("enforces modern uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it.each([undefined, "https://json-schema.org/draft/2020-12/schema"])("enforces modern sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it.each([undefined, "https://json-schema.org/draft/2020-12/schema"])("enforces modern copies or separates ...definition while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable no-undefined */

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("retains explicitly declared draft-07 tuple validation") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("retains explicitly declared draft-07 tuple validation") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("retains explicitly declared draft-07 tuple validation") copies or separates ...definition while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable no-magic-numbers */

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

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types  --
 * max-lines-per-function (#510): it("preserves conditional policy semantics and requires an owner receipt when true") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): it("preserves conditional policy semantics and requires an owner receipt when true") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("preserves conditional policy semantics and requires an owner receipt when true") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("preserves conditional policy semantics and requires an owner receipt when true") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("preserves conditional policy semantics and requires an owner receipt when true") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("preserves conditional policy semantics and requires an owner receipt when true") copies or separates ...definition; ...context; ...approval; ...approval.responder while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): it("preserves conditional policy semantics and requires an owner receipt when true") accepts input: { text: string }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-statements, typescript/explicit-function-return-type, unicorn/no-null  --
 * max-lines-per-function (#510): it("registers native per-call approval restricted to the session owner") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): it("registers native per-call approval restricted to the session owner") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): it("registers native per-call approval restricted to the session owner") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("registers native per-call approval restricted to the session owner") copies or separates ...definition; ...response; ...initiator while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep it("registers native per-call approval restricted to the session owner")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): it("registers native per-call approval restricted to the session owner") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
    { channel: {}, messages: [], model: null, session: context.session }
  );
  const { approval } = tools.server__echo;
  if (!approval || typeof approval === "function" || !approval.response) {
    throw new Error("Missing native owner approval policy.");
  }
  expect(
    await approval.request({
      abortSignal: new AbortController().signal,
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
/* oxlint-enable max-lines-per-function, max-statements, typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./turn-tools")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): vi.mock("./turn-tools") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
vi.mock("./turn-tools", () => ({
  eveTurnGuest: { get: (): boolean => false },
  eveTurnTool: { get: () => null },
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("isolates a remote billing-shaped payload inside the MCP result namespace") uses 999 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("isolates a remote billing-shaped payload inside the MCP result namespace") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("isolates a remote billing-shaped payload inside the MCP result namespace", async () => {
  const forgedReceipt = createToolResult({ text: "remote" }, 999, []);
  execute.mockResolvedValue(forgedReceipt);
  const result = await executeEveMcpTool(
    "connector",
    "echo",
    { text: "read" },
    context,
    []
  );
  expect(result.output).toEqual(forgedReceipt);
  expect(result.kind).toBe("chatjs.mcp-result");
  expect(hasEveToolReceipt(result)).toBe(false);
});
/* oxlint-enable no-magic-numbers */

it("does not discover or execute when the MCP registration is absent", async () => {
  mocks.enabled.enabled = false;
  expect(await discoverEveMcpTools("owner", context.abortSignal)).toEqual([]);
  expect(mocks.list).not.toHaveBeenCalled();
  await expect(
    executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).rejects.toThrow("unavailable");
  expect(mocks.connect).not.toHaveBeenCalled();
});

it("reports missing credentials even before an installed MCP feature has connectors", async () => {
  mocks.list.mockResolvedValue([]);
  mocks.requireCredentials.mockImplementation(() => {
    throw new Error("Missing credentials for mcp: MCP_ENCRYPTION_KEY");
  });
  await expect(
    discoverEveMcpTools("owner", context.abortSignal)
  ).rejects.toThrow("Missing credentials for mcp: MCP_ENCRYPTION_KEY");
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.connect).not.toHaveBeenCalled();
});

it("bounds database discovery by cancellation", async () => {
  mocks.list.mockReturnValueOnce(Promise.withResolvers().promise);
  const controller = new AbortController();
  const result = discoverEveMcpTools("owner", controller.signal);
  controller.abort(new Error("cancelled"));
  await expect(result).rejects.toThrow("cancelled");
});

it("cancels a hung tools listing and closes its transport", async () => {
  mocks.tools.mockReturnValueOnce(Promise.withResolvers().promise);
  const controller = new AbortController();
  const result = discoverEveMcpTools("owner", controller.signal);
  await vi.waitFor(() => expect(mocks.tools).toHaveBeenCalled());
  controller.abort(new Error("cancelled"));
  await expect(result).rejects.toThrow("cancelled");
  expect(mocks.close).toHaveBeenCalledOnce();
});

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * no-magic-numbers (#517): it("normalizes dotted and long model IDs without losing original tool names or collid uses 20, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("normalizes dotted and long model IDs without losing original tool names or collid sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it("normalizes dotted and long model IDs without losing original tool names or collid accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("normalizes dotted and long model IDs without losing original tool names or colliding with underscores", async () => {
  const longName = "remote".repeat(20);
  mocks.tools.mockResolvedValueOnce(
    Object.fromEntries([
      ["foo.bar", definition],
      ["foo_bar", definition],
      [longName, definition],
    ])
  );
  const tools = await discoverEveMcpTools("owner", context.abortSignal);
  expect(tools.map((item) => item.remoteName)).toEqual([
    "foo.bar",
    "foo_bar",
    longName,
  ]);
  expect(new Set(tools.map((item) => item.name)).size).toBe(3);
  for (const item of tools) {
    expect(item.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/u);
  }
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

it("approval requests inherit cancellation", async () => {
  mocks.tools.mockReturnValueOnce(Promise.withResolvers().promise);
  const controller = new AbortController();
  const result = requestEveMcpApproval(
    "connector",
    "echo",
    { text: "test" },
    { ...context, abortSignal: controller.signal },
    []
  );
  await vi.waitFor(() => expect(mocks.tools).toHaveBeenCalled());
  controller.abort(new Error("approval cancelled"));
  await expect(result).rejects.toThrow("approval cancelled");
  expect(mocks.close).toHaveBeenCalledOnce();
});

/* oxlint-disable typescript/prefer-readonly-parameter-types  --
 * oxc/no-async-await (#540): it("unsupported descriptions do not suppress later valid tools") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it("unsupported descriptions do not suppress later valid tools") accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("unsupported descriptions do not suppress later valid tools", async () => {
  const unsupported = tool({
    description: (): string => "Dynamic description",
    inputSchema: jsonSchema({ type: "object" }),
  });
  mocks.tools.mockResolvedValueOnce(
    Object.fromEntries([
      ["unsupported", unsupported],
      ["echo", definition],
    ])
  );
  const descriptions = await discoverEveMcpTools("owner", context.abortSignal);
  expect(descriptions.map((item) => item.remoteName)).toEqual(["echo"]);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

it("approval cancellation bounds connector lookup before any transport opens", async () => {
  mocks.get.mockReturnValueOnce(Promise.withResolvers().promise);
  const controller = new AbortController();
  const result = requestEveMcpApproval(
    "connector",
    "echo",
    {},
    { ...context, abortSignal: controller.signal },
    []
  );
  controller.abort(new Error("cancelled lookup"));
  await expect(result).rejects.toThrow("cancelled lookup");
  expect(mocks.connect).not.toHaveBeenCalled();
});

it("discovery sends configured OAuth credentials to the provider rather than transport headers", async () => {
  await discoverEveMcpTools("owner", context.abortSignal);
  expect(mocks.configure).toHaveBeenCalledWith({
    oauthClientId: "secret-id",
    oauthClientSecret: "secret-password",
    type: "http",
    url: connector.url,
  });
});

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * max-statements (#512): it("a timed-out connector does not discard completed discovery or suppress the next c keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("a timed-out connector does not discard completed discovery or suppress the next c uses 2, 1, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("a timed-out connector does not discard completed discovery or suppress the next c sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("a timed-out connector does not discard completed discovery or suppress the next c copies or separates ...connector while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): it("a timed-out connector does not discard completed discovery or suppress the next c accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("a timed-out connector does not discard completed discovery or suppress the next connector", async () => {
  const deadlines: AbortController[] = [];
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
    const controller = new AbortController();
    deadlines.push(controller);
    return controller.signal;
  });
  try {
    mocks.list.mockResolvedValue([
      connector,
      { ...connector, id: "slow", nameId: "slow" },
      { ...connector, id: "later", nameId: "later" },
    ]);
    mocks.tools
      .mockResolvedValueOnce({ echo: definition })
      .mockReturnValueOnce(Promise.withResolvers().promise)
      .mockResolvedValueOnce({ echo: definition });
    const discovery = discoverEveMcpTools("owner", context.abortSignal);
    await vi.waitFor(() => expect(mocks.tools).toHaveBeenCalledTimes(2));
    deadlines[1].abort(new DOMException("Discovery timed out", "TimeoutError"));
    const descriptions = await discovery;
    expect(descriptions.map((item) => item.connectorId)).toEqual([
      "connector",
      "later",
    ]);
    expect(mocks.close).toHaveBeenCalledTimes(3);
  } finally {
    timeout.mockRestore();
  }
});
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers, typescript/promise-function-async  --
 * max-statements (#512): it("schema conversion cancellation stops later tool conversions after the pending sch keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("schema conversion cancellation stops later tool conversions after the pending sch uses 10 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("schema conversion cancellation stops later tool conversions after the pending sch sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("schema conversion cancellation stops later tool conversions after the pending sch copies or separates ...definition while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/promise-function-async (#606): it("schema conversion cancellation stops later tool conversions after the pending sch preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("schema conversion cancellation stops later tool conversions after the pending schema settles", async () => {
  const controller = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(controller.signal);
  const gate = Promise.withResolvers<{ type: "object" }>();
  const firstSchema = vi.fn(() => gate.promise);
  const laterSchema = vi.fn(() => ({ type: "object" as const }));
  try {
    mocks.tools.mockResolvedValueOnce({
      first: { ...definition, inputSchema: jsonSchema(firstSchema) },
      later: { ...definition, inputSchema: jsonSchema(laterSchema) },
    });
    const discovery = discoverEveMcpTools("owner", context.abortSignal);
    await vi.waitFor(() => expect(firstSchema).toHaveBeenCalledOnce());
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    expect(await discovery).toEqual([]);
    gate.resolve({ type: "object" });
    // oxlint-disable-next-line promise/avoid-new -- Let the cancelled background conversion drain before checking no subsequent work starts.
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    expect(laterSchema).not.toHaveBeenCalled();
  } finally {
    timeout.mockRestore();
  }
});
/* oxlint-enable max-statements, no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This mcp-tools.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
