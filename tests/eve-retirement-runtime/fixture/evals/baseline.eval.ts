/* oxlint-disable import/no-nodejs-modules -- This native runtime proof uses Node assertions, outside application/browser code. */
import assert from "node:assert/strict";

/* oxlint-enable import/no-nodejs-modules */
import { Client } from "eve/client";
import { defineEval } from "eve/evals";

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types, no-magic-numbers -- Keep the ordered runtime scenario together; EVE owns the mutable evaluation/event types, and zero is the empty-receipt boundary. */
// oxlint-disable-next-line import/no-default-export -- EVE discovers evaluations through their default exports.
export default defineEval({
  description:
    "Real create/send/tool execution and durable replay on the pinned release",
  async test(evaluation) {
    const session = await evaluation.session();
    const first = await session.send("first");
    first.succeeded();
    assert.equal(first.requireToolCall("record").status, "completed");
    const second = await session.send("second");
    second.succeeded();
    assert.equal(second.requireToolCall("record").status, "completed");
    const client = new Client({ host: evaluation.target.url });
    const snapshot = await client.sessions.attach(session.sessionId).snapshot();
    const received = snapshot.events.filter(
      (event) => event.type === "message.received"
    );
    assert.deepEqual(
      received.map((event) => event.data.message),
      ["first", "second"]
    );
    assert.ok(
      received.every((event) => (event.meta.deliveryIds?.length ?? 0) > 0)
    );
    const replay = await new Client({ host: evaluation.target.url }).sessions
      .attach(session.sessionId)
      .snapshot();
    assert.deepEqual(replay.events, snapshot.events);
  },
});
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types, no-magic-numbers */
