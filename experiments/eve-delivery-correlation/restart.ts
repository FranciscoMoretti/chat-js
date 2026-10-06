// oxlint-disable-next-line import/no-nodejs-modules -- The isolated process-restart proof uses Node assertions.
import assert from "node:assert/strict";
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only local fixture and isolated installation paths.
import path from "node:path";

import { Client } from "eve/client";
import { z } from "zod";

// oxlint-disable-next-line import/no-relative-parent-imports -- Lane D's controller is copied unchanged into this ignored runtime area by the shared-support setup step.
import {
  createPersistentRuntime,
  until,
  // oxlint-disable-next-line import/no-relative-parent-imports -- The standalone EVE fixture shares its local barrier helper and has no application alias resolver.
} from "../../apps/chat/.eve/lane-c-shared/persistent-runtime";
import { acceptance, correlationIds } from "./fixture/evals/evidence";

// oxlint-disable-next-line node/no-process-env -- This flag selects the explicitly isolated stock or experimental installation.
const patched = process.env.CORRELATION_PATCHED === "1";
const expectedCount = 2;
const acceptedStatus = 202;
const zero = 0;
const one = 1;
const driver = await createPersistentRuntime(
  path.resolve("experiments/eve-delivery-correlation/fixture"),
  {
    nodeModules: path.resolve(
      patched
        ? "apps/chat/.eve/lane-c-deps/node_modules"
        : "apps/chat/.eve/lane-c-stock-deps/node_modules"
    ),
    provenance: patched
      ? "Lane C runtime.patch based on fab8ba1424eddfdedd6a177cac21710258da0e81"
      : "Published eve@0.71.3 / fab8ba1424eddfdedd6a177cac21710258da0e81",
  }
);
const processIdentity = z.object({ pid: z.number().int().positive() });
const readProcessId = async (): Promise<number> => {
  const response = await fetch(`${driver.url}/proof/process`);
  assert.equal(response.ok, true);
  return processIdentity.parse(await response.json()).pid;
};
const processIds: number[] = [];
const client = new Client({ host: driver.url });
const mappings = new Map<string, string>();
let dispatches = zero;
const injectFailure = (): void => {
  throw new Error("proxy response lost before mapping");
};
const loseFollowup = async (sessionId: string): Promise<void> => {
  const response = await fetch(`${driver.url}/eve/v1/session/${sessionId}`, {
    body: JSON.stringify({
      correlationId: "lost-restart",
      message: "identical",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  dispatches += one;
  assert.equal(response.status, acceptedStatus);
  // This fault is after real acceptance and before an application mapping write.
  const evidence = acceptance.parse(await response.json());
  injectFailure();
  mappings.set("lost-restart", evidence.deliveryId ?? evidence.sessionId);
};
try {
  await driver.start();
  processIds.push(await readProcessId());
  const creation = { correlationId: "create-restart", message: "initial" };
  const created = await client.sessions.create(creation);
  await created.response.result();
  await assert.rejects(
    async () => await loseFollowup(created.session.state.sessionId),
    /proxy response lost/u
  );
  const before = await until(async () => {
    const snapshot = await created.session.snapshot();
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
    return snapshot.events.filter((event) => event.type === "turn.completed")
      .length === expectedCount
      ? snapshot
      : // oxlint-disable-next-line no-undefined -- The shared bounded poller uses undefined for evidence that is not yet ready.
        undefined;
  });
  await driver.crash();
  assert.equal(
    await Bun.file(
      path.join(driver.directory, ".eve/dev-server-state.v1.json")
    ).exists(),
    false
  );
  await driver.start();
  processIds.push(await readProcessId());
  assert.notEqual(processIds[zero], processIds[one]);
  const after = await new Client({ host: driver.url }).sessions
    .attach(created.session.state.sessionId)
    .snapshot();
  assert.deepEqual(after.events, before.events);
  const received = after.events.filter(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
    (event) => event.type === "message.received"
  );
  assert.deepEqual(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
    received.map((event) => event.data.message),
    ["initial", "identical"]
  );
  assert.deepEqual(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
    received.map((event) => correlationIds(event.data)),
    patched ? [["create-restart"], ["lost-restart"]] : [[], []]
  );
  assert.equal(mappings.size, zero);
  assert.equal(dispatches, one);
} finally {
  await driver.crash();
}
await driver.remove();

await Bun.write(
  Bun.stdout,
  `Restart receipt replay passed (${patched ? "experimental" : "stock counterexample"}); server PIDs ${processIds.join(" -> ")}; one dispatch, no resend.\n`
);
