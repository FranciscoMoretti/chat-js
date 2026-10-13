import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";

import { Client } from "eve/client";
import { z } from "zod";

import {
  createPersistentRuntime,
  until,
} from "../../apps/chat/.eve/lane-c-pg-shared/persistent-runtime";
import { preparePostgresFixture } from "../../apps/chat/.eve/lane-c-pg-shared/postgres-fixture";
import { correlationIds } from "./fixture/evals/evidence";

const handoff = z.string().parse(process.argv[2]);
const processIdentity = z.object({ pid: z.number().int().positive() });
const prepared = await preparePostgresFixture({
  handoff,
  lane: "lane_c",
  nodeModules: path.resolve("apps/chat/.eve/lane-c-deps/node_modules"),
  source: path.resolve("experiments/eve-delivery-correlation/fixture"),
});
const driver = await createPersistentRuntime(
  prepared.source,
  {
    nodeModules: prepared.nodeModules,
    provenance: `Lane C correlation patch on fab8ba14; SHA256 ${createHash(
      "sha256"
    )
      .update(
        await Bun.file(
          "experiments/eve-delivery-correlation/runtime.patch"
        ).text()
      )
      .digest("hex")}`,
  },
  { inlineOwnershipLeaseSeconds: 1, world: "postgres" }
);
const client = new Client({ host: driver.url });
console.log(
  JSON.stringify({ directory: driver.directory, prepared, url: driver.url })
);
try {
  await driver.start();
  const beforeProcess = await fetch(`${driver.url}/proof/process`);
  const beforePid = processIdentity.parse(await beforeProcess.json());
  const creation = {
    correlationId: "initial-inflight",
    message: "hold-inflight",
  };
  const created = await client.sessions.create(creation);
  await until(
    async () =>
      (await Bun.file(
        path.join(driver.directory, "hold-inflight.ready")
      ).exists())
        ? true
        : undefined,
    15_000
  );
  const native = created.session.state.sessionId;
  const response = await fetch(`${driver.url}/eve/v1/session/${native}`, {
    body: JSON.stringify({
      correlationId: "lost-inflight",
      message: "queued-inflight",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 202);
  const before = await created.session.snapshot();
  assert.equal(
    before.events.some(
      (event) =>
        event.type === "message.received" &&
        correlationIds(event.data).includes("lost-inflight")
    ),
    false
  );
  await driver.crash(beforePid.pid);
  await Bun.write(
    path.join(driver.directory, "hold-inflight.release"),
    "release"
  );
  await driver.start();
  const afterProcess = await fetch(`${driver.url}/proof/process`);
  const afterPid = processIdentity.parse(await afterProcess.json());
  assert.notEqual(beforePid.pid, afterPid.pid);
  const after = await until(async () => {
    const snapshot = await new Client({ host: driver.url }).sessions
      .attach(native)
      .snapshot();
    return snapshot.events.some(
      (event) =>
        event.type === "message.received" &&
        correlationIds(event.data).includes("lost-inflight")
    )
      ? snapshot
      : undefined;
  }, 15_000);
  console.log(
    JSON.stringify({
      afterPid,
      beforePid,
      dispatches: 1,
      native,
      receipts: after.events.filter(
        (event) => event.type === "message.received"
      ),
    })
  );
} finally {
  await driver.crash();
}
