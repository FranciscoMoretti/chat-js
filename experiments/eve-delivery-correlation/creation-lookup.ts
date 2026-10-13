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
