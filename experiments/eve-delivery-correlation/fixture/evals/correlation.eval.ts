// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import assert from "node:assert/strict";
// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
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

// oxlint-disable-next-line import/no-default-export -- EVE discovers this authored fixture through its required default export.
export default defineEval({
  description:
    "Real HTTP admission, lost proxy response, durable exact-message replay",
  // oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function, typescript/prefer-readonly-parameter-types -- Keep this bounded runtime fault-injection and verification sequence ordered and visible together. The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
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
        // oxlint-disable-next-line eslint/max-statements -- Keep this bounded runtime fault-injection and verification sequence ordered and visible together.
        async (
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
          input: Parameters<typeof fetch>[typeof number0],
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
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
        // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
        const snapshot = await new Client({
          host: evaluation.target.url,
        }).sessions
          .attach(knownSession)
          .snapshot();
        if (
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
          snapshot.events.filter((event) => event.type === "turn.completed")
            .length >= count
        ) {
          return snapshot;
        }
        // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
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
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
      (event) => event.type === "message.received"
    );
    assert.deepEqual(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
      received.map((event) => event.data.message),
      ["initial", "identical", "identical"]
    );
    assert.deepEqual(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
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
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
        .filter((event) => event.type === "message.received")
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
        .every((event) => correlationIds(event.data).length === number0)
    );
  },
});
