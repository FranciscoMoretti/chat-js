import assert from "node:assert/strict";
import path from "node:path";

import { Client } from "eve/client";

import {
  createPersistentRuntime,
  until,
} from "../../apps/chat/.eve/lane-c-shared/persistent-runtime";
import { correlationIds, queueOptions } from "./fixture/evals/evidence";

const driver = await createPersistentRuntime(
  path.resolve("experiments/eve-delivery-correlation/fixture"),
  {
    nodeModules: path.resolve("apps/chat/.eve/lane-c-deps/node_modules"),
    provenance:
      "Lane C correlation patch, published eve@0.71.3 / fab8ba14; cancellation disposition",
  }
);
try {
  await driver.start();
  const client = new Client({ host: driver.url });
  const created = await client.sessions.create({ message: "hold-cancel" });
  await until(async () =>
    (await Bun.file(path.join(driver.directory, "hold-cancel.ready")).exists())
      ? true
      : undefined
  );
  await created.session.send("queued-cancel", queueOptions("queued-cancel"));
  const before = await created.session.snapshot();
  assert.equal(
    before.events.some(
      (event) =>
        event.type === "message.received" &&
        correlationIds(event.data).includes("queued-cancel")
    ),
    false
  );
  await created.session.cancel();
  await Bun.write(
    path.join(driver.directory, "hold-cancel.release"),
    "release"
  );
  const after = await until(async () => {
    const snapshot = await created.session.snapshot();
    return snapshot.events.some((event) => event.type === "turn.completed")
      ? snapshot
      : undefined;
  });
  assert.equal(
    after.events.some((event) => event.type === "turn.cancelled"),
    true
  );
  assert.equal(
    after.events.some(
      (event) =>
        event.type === "message.received" &&
        correlationIds(event.data).includes("queued-cancel")
    ),
    true
  );
  assert.equal(
    after.events
      .filter((event) => event.type !== "message.received")
      .some((event) =>
        correlationIds(event.data ?? {}).includes("queued-cancel")
      ),
    false
  );
  console.log(
    JSON.stringify({
      directory: driver.directory,
      events: after.events,
      native: created.session.state.sessionId,
    })
  );
} finally {
  await driver.crash();
}
