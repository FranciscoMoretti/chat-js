/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/tools/mcp" dependency within this package instead of introducing an alias or barrel API.
 */
import { jsonSchema, tool } from "ai";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { beforeEach, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import mcp from "../../agent/tools/mcp";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  discoverEveMcpTools,
  executeEveMcpTool,
  requestEveMcpApproval,
} from "./mcp-tools";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createToolResult, hasEveToolReceipt } from "./tool-result";
/* oxlint-enable sort-imports */
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
  requireApproval: true,
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
  approval: {
    requestId: "request",
    responder: {
      authenticator: "test",
      principalId: "owner",
      principalType: "user",
    },
  },
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

const definition = tool({
  description: "Echo",
  execute,
  inputSchema: jsonSchema({
    additionalProperties: false,
    properties: { text: { type: "string" } },
    required: ["text"],
    type: "object",
  }),
  toModelOutput: ({ output }: { readonly output: unknown }) => ({
    type: "text",
    value: String(output),
  }),
});

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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([{ userId: "stranger" }, { enabled: false }])'s awaited sequencing and rejected-Promise behavior. */

it.each([{ userId: "stranger" }, { enabled: false }])(
  "rejects inaccessible or disabled connectors before connection: %j",
  async (
    change: Readonly<
      | { userId: string; enabled?: undefined }
      | { enabled: boolean; userId?: undefined }
    >
  ) => {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing change own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    mocks.get.mockResolvedValue({ ...connector, ...change });
    await expect(
      executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
    ).rejects.toThrow("unavailable");
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-undefined --
 * no-undefined (#519): it("revalidates after discovery and refuses a revoked connector") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
it("revalidates after discovery and refuses a revoked connector", async () => {
  await discoverEveMcpTools("owner", context.abortSignal);
  mocks.get.mockResolvedValue(undefined);
  await expect(
    executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).rejects.toThrow("unavailable");
  expect(execute).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("closes on execution errors and rejects invalid input before invoking the tool") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("permits global connectors with a separate namespace") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("permits global connectors with a separate namespace", async () => {
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  mocks.list.mockResolvedValue([{ ...connector, userId: null }]);
  expect(await discoverEveMcpTools("owner", context.abortSignal)).toMatchObject(
    [{ name: "global__server__echo" }]
  );
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  mocks.get.mockResolvedValue({ ...connector, userId: null });
  expect(
    await executeEveMcpTool("connector", "echo", { text: "test" }, context, [])
  ).toMatchObject({ output: "Echo output" });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/promise-function-async --
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
          // oxlint-disable-next-line typescript/prefer-promise-reject-errors, typescript/no-unsafe-member-access -- #603: The tool mock forwards the abort signal reason unchanged while the test verifies cancellation and single connection cleanup. #597: This mcp-tools fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
          () => reject(options.abortSignal.reason),
          { once: true }
        );
      })
  );
  const result = executeEveMcpTool(
    "connector",
    "echo",
    { text: "test" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...context, abortSignal: cancellation.signal },
    []
  );
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
  cancellation.abort();
  await rejected;
  expect(mocks.close).toHaveBeenCalledOnce();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([undefined, "https://json-schema.org/draft/2020-12/schema"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable no-undefined --
 * no-undefined (#519): it.each([undefined, "https://json-schema.org/draft/2020-12/schema"])("enforces modern uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing definition own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("retains explicitly declared draft-07 tuple validation") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("retains explicitly declared draft-07 tuple validation", async () => {
  mocks.tools.mockResolvedValue({
    echo: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing definition own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

it("requires native owner approval when the connection setting is enabled", async () => {
  expect(
    await requestEveMcpApproval("connector", "echo", { text: "test" }, context)
  ).toBe("user-approval");
  expect(execute).not.toHaveBeenCalled();
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding unapprovedContext excludes approval from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  const { approval: _approval, ...unapprovedContext } = context;
  await expect(
    executeEveMcpTool(
      "connector",
      "echo",
      { text: "test" },
      unapprovedContext,
      []
    )
  ).rejects.toThrow("owner approval receipt");
  expect(execute).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("rejects a receipt from another principal", async () => {
  await expect(
    executeEveMcpTool(
      "connector",
      "echo",
      { text: "test" },
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...context,
        approval: {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context.approval own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...context.approval,
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context.approval.responder own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          responder: { ...context.approval.responder, principalId: "other" },
        },
      },
      []
    )
  ).rejects.toThrow("owner approval receipt");
  expect(execute).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("validates tool input before asking for consent", async () => {
  await expect(
    requestEveMcpApproval("connector", "echo", { text: 123 }, context)
  ).rejects.toThrow("Invalid tool input");
  expect(execute).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, typescript/explicit-function-return-type, unicorn/no-null --
 * max-lines-per-function (#510): it("registers native per-call approval restricted to the session owner") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): it("registers native per-call approval restricted to the session owner") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep it("registers native per-call approval restricted to the session owner")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): it("registers native per-call approval restricted to the session owner") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("registers native per-call approval restricted to the session owner", async () => {
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing response own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...response,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing initiator own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      responder: { ...initiator, principalId: "other" },
    })
  ).toMatchObject({ status: "rejected" });
  expect(execute).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./turn-tools")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): vi.mock("./turn-tools") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
vi.mock("./turn-tools", () => ({
  eveTurnGuest: { get: (): boolean => false },
  eveTurnTool: { get: () => null },
}));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("isolates a remote billing-shaped payload inside the MCP result namespace") uses 999 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("bounds database discovery by cancellation", async () => {
  mocks.list.mockReturnValueOnce(Promise.withResolvers().promise);
  const controller = new AbortController();
  const result = discoverEveMcpTools("owner", controller.signal);
  controller.abort(new Error("cancelled"));
  await expect(result).rejects.toThrow("cancelled");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("cancels a hung tools listing and closes its transport", async () => {
  mocks.tools.mockReturnValueOnce(Promise.withResolvers().promise);
  const controller = new AbortController();
  const result = discoverEveMcpTools("owner", controller.signal);
  await vi.waitFor(() => expect(mocks.tools).toHaveBeenCalled());
  controller.abort(new Error("cancelled"));
  await expect(result).rejects.toThrow("cancelled");
  expect(mocks.close).toHaveBeenCalledOnce();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("normalizes dotted and long model IDs without losing original tool names or collid uses 20, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
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
  expect(
    tools.map((item: { readonly remoteName: string }) => item.remoteName)
  ).toEqual(["foo.bar", "foo_bar", longName]);
  expect(
    new Set(tools.map((item: { readonly name: string }) => item.name)).size
  ).toBe(3);
  for (const item of tools) {
    expect(item.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/u);
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

it("approval requests inherit cancellation", async () => {
  mocks.tools.mockReturnValueOnce(Promise.withResolvers().promise);
  const controller = new AbortController();
  const result = requestEveMcpApproval(
    "connector",
    "echo",
    { text: "test" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...context, abortSignal: controller.signal }
  );
  await vi.waitFor(() => expect(mocks.tools).toHaveBeenCalled());
  controller.abort(new Error("approval cancelled"));
  await expect(result).rejects.toThrow("approval cancelled");
  expect(mocks.close).toHaveBeenCalledOnce();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

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
  expect(
    descriptions.map((item: { readonly remoteName: string }) => item.remoteName)
  ).toEqual(["echo"]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("approval cancellation bounds connector lookup before any transport opens", async () => {
  mocks.get.mockReturnValueOnce(Promise.withResolvers().promise);
  const controller = new AbortController();
  const result = requestEveMcpApproval(
    "connector",
    "echo",
    {},
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...context, abortSignal: controller.signal }
  );
  controller.abort(new Error("cancelled lookup"));
  await expect(result).rejects.toThrow("cancelled lookup");
  expect(mocks.connect).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("discovery sends configured OAuth credentials to the provider rather than transport headers", async () => {
  await discoverEveMcpTools("owner", context.abortSignal);
  expect(mocks.configure).toHaveBeenCalledWith({
    oauthClientId: "secret-id",
    oauthClientSecret: "secret-password",
    type: "http",
    url: connector.url,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): it("a timed-out connector does not discard completed discovery or suppress the next c keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("a timed-out connector does not discard completed discovery or suppress the next c uses 2, 1, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      { ...connector, id: "slow", nameId: "slow" },
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
    expect(
      descriptions.map(
        (item: { readonly connectorId: string }) => item.connectorId
      )
    ).toEqual(["connector", "later"]);
    expect(mocks.close).toHaveBeenCalledTimes(3);
  } finally {
    timeout.mockRestore();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers, typescript/promise-function-async --
 * max-statements (#512): it("schema conversion cancellation stops later tool conversions after the pending sch keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("schema conversion cancellation stops later tool conversions after the pending sch uses 10 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing definition own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      first: { ...definition, inputSchema: jsonSchema(firstSchema) },
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing definition own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This mcp-tools.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */

it("runs without a receipt when approval is disabled for this connection", async () => {
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  mocks.get.mockResolvedValue({ ...connector, requireApproval: false });
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding unapprovedContext excludes approval from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  const { approval: _approval, ...unapprovedContext } = context;
  expect(
    await requestEveMcpApproval(
      "connector",
      "echo",
      { text: "test" },
      unapprovedContext
    )
  ).toBe("not-applicable");
  await expect(
    executeEveMcpTool(
      "connector",
      "echo",
      { text: "test" },
      unapprovedContext,
      []
    )
  ).resolves.toMatchObject({ output: "Echo output" });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("rechecks the connection policy when approval is enabled after request evaluation", async () => {
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  mocks.get.mockResolvedValueOnce({ ...connector, requireApproval: false });
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding unapprovedContext excludes approval from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  const { approval: _approval, ...unapprovedContext } = context;
  expect(
    await requestEveMcpApproval(
      "connector",
      "echo",
      { text: "test" },
      unapprovedContext
    )
  ).toBe("not-applicable");
  await expect(
    executeEveMcpTool(
      "connector",
      "echo",
      { text: "test" },
      unapprovedContext,
      []
    )
  ).rejects.toThrow("owner approval receipt");
  expect(execute).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
