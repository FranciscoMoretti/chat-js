import assert from "node:assert/strict";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "eve/client";
import { defineEval } from "eve/evals";
import { fixtureHome } from "../barrier";
import { correlationIds, queueOptions } from "./evidence";
import { patched } from "./expected";

const number200 = 200;
const number1 = 1;
const number25 = 25;
const number0 = 0;

const waitReady = async (key: string): Promise<void> => {
  for (let attempt = 0; attempt < number200; attempt += number1) {
    if (
      // oxlint-disable-next-line no-await-in-loop -- Poll readiness sequentially before admitting the next queued command.
      await access(path.join(fixtureHome(), `${key}.ready`)).then(
        () => true,
        () => false
      )
    ) {
      return;
    }
    // oxlint-disable-next-line no-await-in-loop -- Poll readiness sequentially before admitting the next queued command.
    await delay(number25);
  }
  throw new Error(`barrier not reached: ${key}`);
};
export default defineEval({
  description:
    "Real queued identical sends coalesce; paused admission has no fabricated receipt",
  async test(evaluation) {
    const client = new Client({ host: evaluation.target.url });
    const held = await client.sessions.create({ message: "hold-coalesce" });
    await waitReady("hold-coalesce");
    const first = await held.session.send("same", queueOptions("queued-a"));
    const second = await held.session.send("same", queueOptions("queued-b"));
    await writeFile(
      path.join(fixtureHome(), "hold-coalesce.release"),
      "release"
    );
    await held.response.result();
    await first.result();
    await second.result();
    const snapshot = await held.session.snapshot();
    const received = snapshot.events.filter(
      (event) => event.type === "message.received"
    );
    assert.deepEqual(
      received.map((event) => event.data.message),
      ["hold-coalesce", "same\n\nsame"]
    );
    assert.deepEqual(
      correlationIds(received[number1].data),
      patched ? ["queued-a", "queued-b"] : []
    );
    assert.ok(
      snapshot.events
        .filter((event) => event.type !== "message.received")
        .every((event) => correlationIds(event.data ?? {}).length === number0)
    );

    const heldPending = await client.sessions.create({
      message: "hold-pending",
    });
    await waitReady("hold-pending");
    await heldPending.session.send(
      "not-yet-materialized",
      queueOptions("pending")
    );
    const pendingSnapshot = await heldPending.session.snapshot();
    assert.ok(
      pendingSnapshot.events
        .filter((event) => event.type === "message.received")
        .every((event) => event.data.message !== "not-yet-materialized")
    );
    assert.ok(
      pendingSnapshot.events
        .filter((event) => event.type === "message.received")
        .every((event) => !correlationIds(event.data).includes("pending"))
    );
    // Keep the model paused. The launcher shuts down this disposable worker after the eval.
    // Absence of a receipt is uncertainty, not evidence of a rejected admission.
  },
});
