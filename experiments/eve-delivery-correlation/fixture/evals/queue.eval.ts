// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import assert from "node:assert/strict";
// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import { access, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "eve/client";
import { defineEval } from "eve/evals";

// oxlint-disable-next-line import/no-relative-parent-imports -- The standalone EVE fixture shares its local barrier helper and has no application alias resolver.
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
      // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
      await access(path.join(fixtureHome(), `${key}.ready`)).then(
        () => true,
        () => false
      )
    ) {
      return;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
    await delay(number25);
  }
  throw new Error(`barrier not reached: ${key}`);
};
// oxlint-disable-next-line import/no-default-export -- EVE discovers this authored fixture through its required default export.
export default defineEval({
  description:
    "Real queued identical sends coalesce; paused admission has no fabricated receipt",
  // oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function, typescript/prefer-readonly-parameter-types -- Keep this bounded runtime fault-injection and verification sequence ordered and visible together. The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
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
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
      (event) => event.type === "message.received"
    );
    assert.deepEqual(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
      received.map((event) => event.data.message),
      ["hold-coalesce", "same\n\nsame"]
    );
    assert.deepEqual(
      correlationIds(received[number1].data),
      patched ? ["queued-a", "queued-b"] : []
    );
    assert.ok(
      snapshot.events
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
        .filter((event) => event.type !== "message.received")
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
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
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
        .filter((event) => event.type === "message.received")
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
        .every((event) => event.data.message !== "not-yet-materialized")
    );
    assert.ok(
      pendingSnapshot.events
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
        .filter((event) => event.type === "message.received")
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
        .every((event) => !correlationIds(event.data).includes("pending"))
    );
    // Keep the model paused. The launcher shuts down this disposable worker after the eval.
    // Absence of a receipt is uncertainty, not evidence of a rejected admission.
  },
});
