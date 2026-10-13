import assert from "node:assert/strict";

import { Client } from "eve/client";
import { defineEval } from "eve/evals";

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
