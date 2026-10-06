/* oxlint-disable typescript/prefer-readonly-parameter-types -- Evaluation and durable event objects are supplied by EVE; the fixture only reads them. */
/* oxlint-disable eslint/no-magic-numbers, eslint/max-statements, eslint/max-lines-per-function -- Keep the ordered owner/foreign approval scenario and zero-effect expectations together. */
/* oxlint-disable import/no-nodejs-modules -- The native evaluation uses Node assertions. */
import assert from "node:assert/strict";

import { Client } from "eve/client";
import { defineEval } from "eve/evals";

// oxlint-disable-next-line import/no-default-export -- EVE discovers the fixture evaluation by default export.
export default defineEval({
  description:
    "Native owner approval and cancellation through HTTP and durable Workflow",
  async test(evaluation) {
    const session = await evaluation.session();
    await session.send("Delete the document");
    const request = session.requireInputRequest();
    assert.equal(
      session.events.filter((event) => event.type === "action.result").length,
      0
    );
    await session.respond(
      [{ optionId: "approve", requestId: request.requestId }],
      { headers: { "x-proof-principal": "foreign" } }
    );
    assert.ok(
      session.events.some(
        (event) =>
          event.type === "approval.candidate" &&
          event.data.outcome === "rejected" &&
          event.data.responderPrincipalId === "foreign"
      )
    );
    await session.respond(
      [{ optionId: "cancel", requestId: request.requestId }],
      { headers: { "x-proof-principal": "foreign" } }
    );
    assert.ok(
      session.events.some(
        (event) =>
          event.type === "approval.candidate" &&
          event.data.outcome === "rejected" &&
          event.data.responderPrincipalId === "foreign"
      )
    );
    assert.equal(
      session.events.filter((event) => event.type === "action.result").length,
      0
    );
    const approved = await session.respond([
      { optionId: "approve", requestId: request.requestId },
    ]);
    assert.equal(
      approved.requireToolCall("delete-document").status,
      "completed"
    );
    const replay = await new Client({ host: evaluation.target.url }).sessions
      .attach(session.sessionId)
      .snapshot();
    assert.ok(replay.events.some((event) => event.type === "action.result"));
    const cancelledSession = await evaluation.session();
    await cancelledSession.send("Delete the document");
    const cancelledRequest = cancelledSession.requireInputRequest();
    const cancelled = await cancelledSession.respond([
      { optionId: "cancel", requestId: cancelledRequest.requestId },
    ]);
    assert.equal(
      cancelled.toolCalls.filter((call) => call.status === "completed").length,
      0
    );
    evaluation.log(
      "Owner approval executed; foreign approve/cancel did not settle; owner cancellation did not execute; durable events replayed."
    );
  },
});

/* oxlint-enable import/no-nodejs-modules */

/* oxlint-enable eslint/no-magic-numbers, eslint/max-statements, eslint/max-lines-per-function */

/* oxlint-enable typescript/prefer-readonly-parameter-types */
