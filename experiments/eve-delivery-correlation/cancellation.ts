/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports, no-console, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-await-expression-member --
 * import/no-nodejs-modules: This isolated runtime proof owns Node assertions and local fixture paths.
 * import/no-relative-parent-imports: The proof imports only the copied shared controller in its ignored runtime area.
 * no-console: Emit sanitized test-only runtime evidence for the local proof log.
 * no-magic-numbers: HTTP statuses, input argument positions and expected receipt counts are protocol assertions.
 * no-undefined: The bounded polling helper uses undefined for evidence not yet available.
 * typescript/prefer-readonly-parameter-types: Native EVE callbacks retain their SDK event types without mutating events.
 * unicorn/no-await-expression-member: Parse the completed test HTTP response at the evidence observation point.
 */
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

/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports, no-console, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-await-expression-member */
