import { test, expect } from "bun:test";

import { runtime, patched } from "./load-runtime.ts";
import { reconcile, submissionSchema } from "./projection";
import type { Command, ReceivedEvent, Parser } from "./runtime-types";

const number0 = 0;
const number1 = 1;
const number129 = 129;

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
] satisfies readonly (readonly [string, Parser])[]) {
  test(`${name} parser ${patched ? "retains" : "silently drops"} caller identity`, () => {
    const parsed = parse({ correlationId: "op-a", message: "identical" });
    if (parsed instanceof Response) {
      throw new TypeError("Message unexpectedly rejected");
    }
    expect(parsed.correlationId ?? "").toBe(patched ? "op-a" : "");
  });
}
// oxlint-disable-next-line eslint/max-statements -- Keep this bounded runtime fault-injection and verification sequence ordered and visible together.
test("real session send dispatch and coalescer preserve only supported fields", async () => {
  const commands: Command[] = [];
  const session = createSession(
    "session-a",
    {
      // oxlint-disable-next-line require-await, typescript/require-await -- The mock preserves the asynchronous dispatcher interface while recording admission in memory.
      async dispatchSession(input) {
        commands.push(structuredClone(input));
        return {
          deliveryId: input.command.delivery.deliveryId,
          sessionId: input.sessionId,
          status: "accepted",
        };
      },
    },
    { channelKind: "http", channelName: "chat" }
  );
  for (const correlationId of ["op-a", "op-b"]) {
    // oxlint-disable-next-line eslint/no-await-in-loop, unicorn/no-null -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario. Explicit null is part of the tested auth and last-selection wire contract; absence has different semantics.
    await session.send("identical", { auth: null, correlationId });
  }
  expect(commands[number0].command.delivery.deliveryId).not.toBe(
    commands[number1].command.delivery.deliveryId
  );
  const inputs = commands.map(({ command }) =>
    defaultDeliverResult(command.payload)
  );
  const input = coalesceTurnInputs(inputs[number0], inputs[number1]);
  const events: ReceivedEvent[] = [];
  await emitTurnPreamble(
    // oxlint-disable-next-line require-await, typescript/require-await -- The mock preserves the asynchronous emitter interface while recording events in memory.
    async (event) => {
      events.push(event);
    },
    input,
    { sequence: 0, sessionStarted: false, stepIndex: 0, turnId: "" },
    []
  );
  const receipt = events.find((event) => event.type === "message.received");
  expect(receipt?.data.correlationIds ?? []).toEqual(
    patched ? ["op-a", "op-b"] : []
  );
  expect(createTurnInputMessages(input)).toEqual([
    { content: "identical\n\nidentical", kind: "user", role: "user" },
  ]);
});

test("coalescing does not inherit control tokens and does not erase preceding user tokens", async () => {
  const first = { correlationIds: ["op-a"], message: "same" };
  const second = { correlationIds: ["op-b"], message: "same" };
  const control = { context: ["control"], correlationIds: ["unrelated"] };
  const input = coalesceTurnInputs(coalesceTurnInputs(first, control), second);
  const events: ReceivedEvent[] = [];
  await emitTurnPreamble(
    // oxlint-disable-next-line require-await, typescript/require-await -- The mock preserves the asynchronous emitter interface while recording events in memory.
    async (event) => {
      events.push(event);
    },
    input,
    { sequence: 0, sessionStarted: false, stepIndex: 0, turnId: "" },
    []
  );
  expect(
    events.find((event) => event.type === "message.received")?.data
      .correlationIds ?? []
  ).toEqual(patched ? ["op-a", "op-b"] : []);
  const controls: ReceivedEvent[] = [];
  await emitTurnPreamble(
    // oxlint-disable-next-line require-await, typescript/require-await -- The mock preserves the asynchronous emitter interface while recording events in memory.
    async (event) => {
      controls.push(event);
    },
    control,
    { sequence: 0, sessionStarted: false, stepIndex: 0, turnId: "" },
    []
  );
  expect(controls.some((event) => event.type === "message.received")).toBe(
    false
  );
});

// oxlint-disable-next-line eslint/max-lines-per-function -- Keep this bounded runtime fault-injection and verification sequence ordered and visible together.
test("ChatJS projection reconciles every ID in trusted owner/session scope and retains final null selection on reload", () => {
  const submissions = submissionSchema.array().parse(
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- This proof deliberately tests JSON persistence and reload, not an in-memory clone.
    JSON.parse(
      JSON.stringify([
        {
          operationId: "op-a",
          ownerId: "owner",
          selectedTool: "webSearch",
          sessionId: "a",
          status: "uncertain",
        },
        {
          operationId: "op-b",
          ownerId: "owner",
          // oxlint-disable-next-line unicorn/no-null -- Explicit null is part of the tested auth and last-selection wire contract; absence has different semantics.
          selectedTool: null,
          sessionId: "a",
          status: "uncertain",
        },
        {
          operationId: "op-a",
          ownerId: "owner",
          selectedTool: "other",
          sessionId: "b",
          status: "uncertain",
        },
        {
          operationId: "op-a",
          ownerId: "foreign",
          selectedTool: "other",
          sessionId: "a",
          status: "uncertain",
        },
        {
          operationId: "queued",
          ownerId: "owner",
          // oxlint-disable-next-line unicorn/no-null -- Explicit null is part of the tested auth and last-selection wire contract; absence has different semantics.
          selectedTool: null,
          sessionId: "a",
          status: "admitted",
        },
      ])
    )
  );
  const scope = { ownerId: "owner", sessionId: "a" };
  const event = {
    data: { correlationIds: ["op-a", "op-b"] },
    type: "message.received",
  };
  const projected = reconcile(submissions, scope, event);
  expect(projected.submissions.map((row) => row.status)).toEqual([
    "received",
    "received",
    "uncertain",
    "uncertain",
    "admitted",
  ]);
  // oxlint-disable-next-line unicorn/no-null -- Explicit null is part of the tested auth and last-selection wire contract; absence has different semantics.
  expect(projected.annotation).toEqual({ selectedTool: null });
  expect(
    reconcile(submissions, scope, { data: event.data, type: "turn.completed" })
      .annotation
  ).toBeUndefined();
  expect(
    reconcile(submissions, scope, {
      data: { correlationIds: ["op-a", "missing"] },
      type: "message.received",
    }).annotation
  ).toBeUndefined();
});

if (patched) {
  for (const parse of [parseCreateBody, parseSessionMessageBody]) {
    test("rejects unbounded/invalid tokens and controls carrying user tokens", () => {
      for (const correlationId of [
        "",
        "a".repeat(number129),
        "not ascii ☃",
        number1,
        [],
      ]) {
        expect(parse({ correlationId, message: "hello" })).toBeInstanceOf(
          Response
        );
      }
      expect(parse({ correlationId: "control" })).toBeInstanceOf(Response);
    });
  }
}
