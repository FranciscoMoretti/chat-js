import assert from "node:assert/strict";

import { Client } from "eve/client";
import { defineEval } from "eve/evals";

import patched from "./expected";

export default defineEval({
  description:
    "Real HTTP admission, lost proxy response, durable exact-message replay",
  async test(evaluation) {
    const client = new Client({ host: evaluation.target.url });
    const mappings = new Map<string, string>();
    const originalFetch = globalThis.fetch;
    let acceptedSession = ""; // Test oracle only: the failed creation caller never sees this.
    let accepted = 0;
    const loseResponse = async (
      token: string,
      send: () => Promise<unknown>,
      afterAcceptance: () => void = () => {
        throw new Error("injected proxy death before mapping write");
      }
    ) => {
      globalThis.fetch = async (input, init) => {
        if (init?.method !== "POST" || typeof init.body !== "string")
          return originalFetch(input, init);
        const body = JSON.parse(init.body);
        body.correlationId = token; // Exercise HTTP parser independently of client support.
        const response = await originalFetch(input, {
          ...init,
          body: JSON.stringify(body),
        });
        assert.equal(response.status, 202);
        const evidence = await response.clone().json();
        acceptedSession = evidence.sessionId;
        accepted++;
        // Inject failure AFTER real eve acceptance, BEFORE proxy delivery mapping persists.
        afterAcceptance();
        mappings.set(token, evidence.deliveryId);
        return response;
      };
      try {
        await assert.rejects(send, /injected proxy death/);
      } finally {
        globalThis.fetch = originalFetch;
      }
      assert.equal(mappings.size, 0);
    };
    await loseResponse("create-a", () =>
      client.sessions.create({ message: "initial" })
    );
    assert.ok(acceptedSession);
    // This oracle permits inspecting native evidence; it is NOT allocation recovery.
    const knownSession = acceptedSession;
    const snapshotAfter = async (count: number) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const snapshot = await new Client({
          host: evaluation.target.url,
        }).sessions
          .attach(knownSession)
          .snapshot();
        if (
          snapshot.events.filter((event) => event.type === "turn.completed")
            .length >= count
        )
          return snapshot;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("worker did not complete expected turns");
    };
    await snapshotAfter(1);
    await loseResponse("follow-a", () =>
      client.sessions.attach(knownSession).send("identical")
    );
    await snapshotAfter(2);
    await loseResponse("follow-b", () =>
      client.sessions.attach(knownSession).send("identical")
    );
    const snapshot = await snapshotAfter(3);
    const received = snapshot.events.filter(
      (event) => event.type === "message.received"
    );
    assert.deepEqual(
      received.map((event) => event.data.message),
      ["initial", "identical", "identical"]
    );
    assert.deepEqual(
      received.map((event) => event.data.correlationIds),
      patched
        ? [["create-a"], ["follow-a"], ["follow-b"]]
        : [undefined, undefined, undefined]
    );
    assert.equal(accepted, 3); // No resend after any injected failure.
    const replay = await new Client({ host: evaluation.target.url }).sessions
      .attach(knownSession)
      .snapshot();
    assert.deepEqual(replay.events, snapshot.events);
    const other = await client.sessions.create({ message: "unrelated" });
    const otherResult = await other.response.result();
    assert.ok(otherResult);
    const otherSnapshot = await other.session.snapshot();
    assert.ok(
      otherSnapshot.events
        .filter((event) => event.type === "message.received")
        .every((event) => event.data.correlationIds === undefined)
    );
  },
});
