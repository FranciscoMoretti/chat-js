import assert from "node:assert/strict";
import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Client } from "eve/client";
import { defineEval } from "eve/evals";

import patched from "./expected";

const waitReady = async (key: string) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (
      await access(join(process.env.HOME!, `${key}.ready`)).then(
        () => true,
        () => false
      )
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 25));
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
    const first = await held.session.send("same", {
      turnPolicy: "queue",
      correlationId: "queued-a",
    });
    const second = await held.session.send("same", {
      turnPolicy: "queue",
      correlationId: "queued-b",
    });
    await writeFile(
      join(process.env.HOME!, "hold-coalesce.release"),
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
      received[1].data.correlationIds,
      patched ? ["queued-a", "queued-b"] : undefined
    );
    assert.ok(
      snapshot.events
        .filter((event) => event.type !== "message.received")
        .every((event) => !("correlationIds" in event.data))
    );

    const heldPending = await client.sessions.create({
      message: "hold-pending",
    });
    await waitReady("hold-pending");
    await heldPending.session.send("not-yet-materialized", {
      turnPolicy: "queue",
      correlationId: "pending",
    });
    const pendingSnapshot = await heldPending.session.snapshot();
    assert.ok(
      pendingSnapshot.events
        .filter((event) => event.type === "message.received")
        .every((event) => event.data.message !== "not-yet-materialized")
    );
    assert.ok(
      pendingSnapshot.events
        .filter((event) => event.type === "message.received")
        .every((event) => !event.data.correlationIds?.includes("pending"))
    );
    // Keep the model paused. The launcher shuts down this disposable worker after the eval.
    // Absence of a receipt is uncertainty, not evidence of a rejected admission.
  },
});
