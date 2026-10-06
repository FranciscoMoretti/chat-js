import { test, expect } from "bun:test";

import { runtime, patched } from "./load-runtime.mjs";
const { parseCreateBody, parseSessionMessageBody } = await runtime(
  "eve-channel/request"
);
const { createSession } = await runtime("channel/session");
const { defaultDeliverResult } = await runtime("channel/adapter");
const { coalesceTurnInputs, createTurnInputMessages } =
  await runtime("harness/messages");
const { emitTurnPreamble } = await runtime("harness/emission");

for (const [name, parse] of [
  ["creation", parseCreateBody],
  ["follow-up", parseSessionMessageBody],
]) {
  test(`${name} parser ${patched ? "retains" : "silently drops"} caller identity`, () => {
    const parsed = parse({ message: "identical", correlationId: "op-a" });
    expect(parsed.correlationId).toBe(patched ? "op-a" : undefined);
  });
}
test("real session send dispatch and coalescer preserve only supported fields", async () => {
  const commands = [];
  const session = createSession(
    "session-a",
    {
      async dispatchSession(input) {
        commands.push(structuredClone(input));
        return {
          status: "accepted",
          sessionId: input.sessionId,
          deliveryId: input.command.delivery.deliveryId,
        };
      },
    },
    { channelKind: "http", channelName: "chat" }
  );
  for (const correlationId of ["op-a", "op-b"])
    await session.send("identical", { auth: null, correlationId });
  expect(commands[0].command.delivery.deliveryId).not.toBe(
    commands[1].command.delivery.deliveryId
  );
  const input = commands
    .map(({ command }) => defaultDeliverResult(command.payload))
    .reduce(coalesceTurnInputs);
  const events = [];
  await emitTurnPreamble(
    async (event) => events.push(event),
    input,
    { sequence: 0, sessionStarted: false, stepIndex: 0, turnId: "" },
    []
  );
  const receipt = events.find((event) => event.type === "message.received");
  expect(receipt.data.correlationIds).toEqual(
    patched ? ["op-a", "op-b"] : undefined
  );
  expect(createTurnInputMessages(input)).toEqual([
    { role: "user", kind: "user", content: "identical\n\nidentical" },
  ]);
});

import { reconcile } from "./projection.mjs";

test("coalescing does not inherit control tokens and does not erase preceding user tokens", async () => {
  const first = { message: "same", correlationIds: ["op-a"] };
  const second = { message: "same", correlationIds: ["op-b"] };
  const control = { context: ["control"], correlationIds: ["unrelated"] };
  const input = coalesceTurnInputs(coalesceTurnInputs(first, control), second);
  const events = [];
  await emitTurnPreamble(
    async (event) => events.push(event),
    input,
    { sequence: 0, sessionStarted: false, stepIndex: 0, turnId: "" },
    []
  );
  expect(
    events.find((event) => event.type === "message.received").data
      .correlationIds
  ).toEqual(patched ? ["op-a", "op-b"] : undefined);
  const controls = [];
  await emitTurnPreamble(
    async (event) => controls.push(event),
    control,
    { sequence: 0, sessionStarted: false, stepIndex: 0, turnId: "" },
    []
  );
  expect(controls.some((event) => event.type === "message.received")).toBe(
    false
  );
});

test("ChatJS projection reconciles every ID in trusted owner/session scope and retains final null selection on reload", () => {
  const submissions = JSON.parse(
    JSON.stringify([
      {
        ownerId: "owner",
        sessionId: "a",
        operationId: "op-a",
        selectedTool: "webSearch",
        status: "uncertain",
      },
      {
        ownerId: "owner",
        sessionId: "a",
        operationId: "op-b",
        selectedTool: null,
        status: "uncertain",
      },
      {
        ownerId: "owner",
        sessionId: "b",
        operationId: "op-a",
        selectedTool: "other",
        status: "uncertain",
      },
      {
        ownerId: "foreign",
        sessionId: "a",
        operationId: "op-a",
        selectedTool: "other",
        status: "uncertain",
      },
      {
        ownerId: "owner",
        sessionId: "a",
        operationId: "queued",
        selectedTool: null,
        status: "admitted",
      },
    ])
  );
  const scope = { ownerId: "owner", sessionId: "a" };
  const event = {
    type: "message.received",
    data: { correlationIds: ["op-a", "op-b"] },
  };
  const projected = reconcile(submissions, scope, event);
  expect(projected.submissions.map((row) => row.status)).toEqual([
    "received",
    "received",
    "uncertain",
    "uncertain",
    "admitted",
  ]);
  expect(projected.annotation).toEqual({ selectedTool: null });
  expect(
    reconcile(submissions, scope, { type: "turn.completed", data: event.data })
      .annotation
  ).toBeUndefined();
  expect(
    reconcile(submissions, scope, {
      type: "message.received",
      data: { correlationIds: ["op-a", "missing"] },
    }).annotation
  ).toBeUndefined();
});

if (patched) {
  for (const parse of [parseCreateBody, parseSessionMessageBody]) {
    test("rejects unbounded/invalid tokens and controls carrying user tokens", () => {
      for (const correlationId of ["", "a".repeat(129), "not ascii ☃", 1, []])
        expect(parse({ message: "hello", correlationId })).toBeInstanceOf(
          Response
        );
      expect(parse({ correlationId: "control" })).toBeInstanceOf(Response);
    });
  }
}
