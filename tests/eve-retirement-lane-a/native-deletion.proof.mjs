/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument, typescript/strict-boolean-expressions -- This standalone experiment imports pinned runtime internals by filesystem path; the two distributions have no shared static type contract. Runtime assertions validate the boundary. */
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import {
  fixture,
  fork,
  foreign,
  input,
  manifest,
  owner,
  scratch,
} from "./native-fixture.mjs";

const scenarios = [
  [
    "missing approval stays pending",
    async (subject) => {
      await subject.advance();
      assert.equal(subject.pending().length, 1);
      assert.equal(subject.state.effects.length, 0);
    },
  ],
  [
    "owner approval executes exact input after serialized continuation reload",
    async (subject) => {
      await subject.advance();
      await subject.reload();
      await subject.respond(owner, "approve");
      assert.deepEqual(subject.state.effects, [input]);
    },
  ],
  [
    "foreign approval cannot execute; owner can still approve",
    async (subject) => {
      await subject.advance();
      await subject.respond(foreign, "approve");
      assert.equal(subject.state.effects.length, 0);
      assert.equal(subject.pending().length, 1);
      await subject.respond(owner, "approve");
      assert.deepEqual(subject.state.effects, [input]);
    },
  ],
  [
    "foreign cancellation cannot settle owner's request",
    async (subject) => {
      await subject.advance();
      await subject.respond(foreign, "cancel");
      assert.equal(subject.state.effects.length, 0);
      assert.equal(
        subject.pending().length,
        1,
        "foreign cancellation must leave the request pending"
      );
      assert.deepEqual(subject.state.policyResponses, [
        { decision: "cancel", principalId: "foreign" },
      ]);
      await subject.respond(owner, "approve");
      assert.deepEqual(subject.state.effects, [input]);
    },
  ],
  [
    "owner cancellation rejects late approval",
    async (subject) => {
      await subject.advance();
      const [{ requestId }] = subject.pending();
      await subject.respond(owner, "cancel");
      await subject.respond(owner, "approve", requestId);
      assert.equal(subject.state.effects.length, 0);
      assert.equal(subject.pending().length, 0);
    },
  ],
  [
    "anonymous approval cannot execute",
    async (subject) => {
      await subject.advance();
      await subject.respond(null, "approve");
      assert.equal(subject.state.effects.length, 0);
      assert.equal(subject.pending().length, 1);
    },
  ],
  [
    "approval text does not replace authenticated decision",
    async (subject) => {
      await subject.advance();
      await subject.advance({ message: "approve" });
      assert.equal(subject.state.effects.length, 0);
    },
  ],
  [
    "foreign request ID cannot authorize the pending call",
    async (subject) => {
      await subject.advance();
      await subject.respond(owner, "approve", "another-request");
      assert.equal(subject.state.effects.length, 0);
    },
  ],
  ...["revision", "ownership", "cancellation"].map((change) => [
    `${change} changed during response blocks effect`,
    async (subject) => {
      await subject.advance();
      subject.state.afterApproval = () => {
        if (change === "revision") {
          subject.state.revision = "revision-2";
        }
        if (change === "ownership") {
          subject.state.ownerId = "another-owner";
        }
        if (change === "cancellation") {
          subject.state.cancel();
        }
      };
      await subject.respond(owner, "approve").catch(() => {
        /* A denied recheck may reject the model step; effects must still remain zero. */
      });
      assert.equal(subject.state.effects.length, 0);
    },
  ]),
  [
    "historical approval does not authorize a second identical call",
    async (subject) => {
      await subject.advance();
      await subject.respond(owner, "approve");
      subject.state.callNext = true;
      await subject.advance({ message: "Delete again" });
      assert.equal(subject.state.effects.length, 1);
      assert.equal(subject.pending().length, 1);
      await subject.respond(owner, "approve");
      assert.equal(subject.state.effects.length, 2);
    },
  ],
];
if (!fork) {
  scenarios.push([
    "out-of-turn invocation cannot bypass approval",
    async (subject) => {
      const ownerResult = await subject.invoke(owner);
      assert.equal(ownerResult.status, "approval-required");
      const foreignResult = await subject.invoke(foreign);
      assert.equal(foreignResult.status, "failed");
      assert.equal(subject.state.effects.length, 0);
    },
  ]);
}
let failures = 0;
try {
  for (const stream of [false, true]) {
    /* oxlint-disable eslint/no-await-in-loop -- Scenarios share runtime modules and disposable session storage, so execute them serially. */
    for (const [name, scenario] of scenarios) {
      try {
        await scenario(fixture(stream));
        console.log(`PASS ${stream ? "stream" : "generate"}: ${String(name)}`);
      } catch (error) {
        failures += 1;
        console.error(
          `FAIL ${stream ? "stream" : "generate"}: ${String(name)}: ${String(error.message)}`
        );
      }
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */
} finally {
  await rm(scratch, { force: true, recursive: true });
}
console.log(
  JSON.stringify({
    cases: scenarios.length * 2,
    failures,
    package: manifest.name,
    version: manifest.version,
  })
);
assert.equal(failures, 0, "native deletion removal gate");
