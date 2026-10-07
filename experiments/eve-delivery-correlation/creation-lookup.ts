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
import { z } from "zod";

import { createPersistentRuntime } from "../../apps/chat/.eve/lane-c-shared/persistent-runtime";

const driver = await createPersistentRuntime(
  path.resolve("experiments/eve-delivery-correlation/fixture"),
  {
    nodeModules: path.resolve("apps/chat/.eve/lane-c-stock-deps/node_modules"),
    provenance:
      "Published eve@0.71.3 / fab8ba1424eddfdedd6a177cac21710258da0e81; creation lookup negative control",
  }
);
const accepted = z.object({ sessionId: z.string() });
try {
  await driver.start();
  const operationId = crypto.randomUUID();
  const dispatch = async (): Promise<string> => {
    const response = await fetch(`${driver.url}/eve/v1/session`, {
      body: JSON.stringify({ message: "allocation proof", operationId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 202);
    return accepted.parse(await response.json()).sessionId;
  };
  const first = await dispatch();
  const lookup = await fetch(`${driver.url}/eve/v1/operation/${operationId}`);
  assert.equal(lookup.status, 404);
  const lookupBody = await lookup.text();
  assert.equal(lookupBody.includes("eve_operation_not_found"), false);
  const second = await dispatch();
  assert.equal(first, second);
  const client = new Client({ host: driver.url });
  await Promise.all([
    client.sessions.attach(first).snapshot(),
    client.sessions.attach(second).snapshot(),
  ]);
  await client.sessions.attach(first).reset();
  const afterRetirement = await dispatch();
  assert.notEqual(first, afterRetirement);
  console.log(
    JSON.stringify({
      afterRetirement,
      first,
      lookupBody,
      lookupStatus: lookup.status,
      result:
        "Creation operation replay recovers a live allocation; read-only lookup is absent. Retirement behavior is recorded separately.",
      second,
    })
  );
} finally {
  await driver.remove();
}

/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports, no-console, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-await-expression-member */
