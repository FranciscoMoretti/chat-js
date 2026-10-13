import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import type { SessionSnapshot } from "eve/client";
import { Client } from "eve/client";
import { defineEval } from "eve/evals";

import { acceptance, correlationIds, wireBody } from "./evidence";
import { patched } from "./expected";

const number0 = 0;
const number1 = 1;
const number202 = 202;
const number100 = 100;
const number50 = 50;
const number2 = 2;
const number3 = 3;
export default defineEval({
  description:
    "Real HTTP admission, lost proxy response, durable exact-message replay",
  async test(evaluation) {
    const client = new Client({ host: evaluation.target.url });
    const mappings = new Map<string, string>();
    const originalFetch = globalThis.fetch;
    // Test oracle only: the failed creation caller never sees this.
    let acceptedSession = "";
    let accepted = 0;
    const loseResponse = async (
      token: string,
      send: () => Promise<unknown>,
      afterAcceptance: () => void = (): void => {
        throw new Error("injected proxy death before mapping write");
      }
    ): Promise<void> => {
      globalThis.fetch = Object.assign(
        async (
          input: Parameters<typeof fetch>[typeof number0],
          init?: Parameters<typeof fetch>[typeof number1]
        ): Promise<Response> => {
          if (init?.method !== "POST" || typeof init.body !== "string") {
            return await originalFetch(input, init);
          }
          const body = wireBody.parse(JSON.parse(init.body));
          // Exercise HTTP parser independently of client support.
          body.correlationId = token;
          const response = await originalFetch(input, {
            ...init,
            body: JSON.stringify(body),
          });
          assert.equal(response.status, number202);
          const evidence = acceptance.parse(await response.clone().json());
          acceptedSession = evidence.sessionId;
          accepted += number1;
          // Inject failure AFTER real eve acceptance, BEFORE proxy delivery mapping persists.
          afterAcceptance();
          mappings.set(token, evidence.deliveryId ?? evidence.sessionId);
          return response;
        },
        { preconnect: originalFetch.preconnect }
      );
      try {
        await assert.rejects(send, /injected proxy death/u);
      } finally {
        globalThis.fetch = originalFetch;
      }
      assert.equal(mappings.size, number0);
    };
    await loseResponse(
      "create-a",
      async () => await client.sessions.create({ message: "initial" })
    );
    assert.ok(acceptedSession);
    // This oracle permits inspecting native evidence; it is NOT allocation recovery.
    const knownSession = acceptedSession;
    const snapshotAfter = async (count: number): Promise<SessionSnapshot> => {
      for (let attempt = 0; attempt < number100; attempt += number1) {
        // oxlint-disable-next-line no-await-in-loop -- Poll receipt evidence sequentially after each delay.
        const snapshot = await new Client({
          host: evaluation.target.url,
        }).sessions
          .attach(knownSession)
          .snapshot();
        if (
          snapshot.events.filter((event) => event.type === "turn.completed")
            .length >= count
        ) {
          return snapshot;
        }
        // oxlint-disable-next-line no-await-in-loop -- Poll receipt evidence sequentially after each delay.
        await delay(number50);
      }
      throw new Error("worker did not complete expected turns");
    };
    await snapshotAfter(number1);
    await loseResponse(
      "follow-a",
      async () => await client.sessions.attach(knownSession).send("identical")
    );
    await snapshotAfter(number2);
    await loseResponse(
      "follow-b",
      async () => await client.sessions.attach(knownSession).send("identical")
    );
    const snapshot = await snapshotAfter(number3);
    const received = snapshot.events.filter(
      (event) => event.type === "message.received"
    );
    assert.deepEqual(
      received.map((event) => event.data.message),
      ["initial", "identical", "identical"]
    );
    assert.deepEqual(
      received.map((event) => correlationIds(event.data)),
      patched ? [["create-a"], ["follow-a"], ["follow-b"]] : [[], [], []]
    );
    // No resend after any injected failure.
    assert.equal(accepted, number3);
    const replay = await new Client({ host: evaluation.target.url }).sessions
      .attach(knownSession)
      .snapshot();
    assert.deepEqual(replay.events, snapshot.events);
    const other = await client.sessions.create({ message: "unrelated" });
    await other.response.result();
    const otherSnapshot = await other.session.snapshot();
    assert.ok(
      otherSnapshot.events
        .filter((event) => event.type === "message.received")
        .every((event) => correlationIds(event.data).length === number0)
    );
  },
});
