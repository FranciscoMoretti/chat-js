import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

import { defineEval } from "eve/evals";
import { z } from "zod";

import { input } from "../proof/input";
import { mode } from "../proof/mode";

const effectSchema = z.object({
  detail: z
    .object({
      conversationId: z.string().optional(),
      ownerId: z.string().optional(),
      revisionId: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .loose(),
  kind: z.string(),
});
const effects = async (): Promise<z.infer<typeof effectSchema>[]> => {
  const text = await readFile("proof-effects.jsonl", "utf-8").catch(() => "");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => effectSchema.parse(JSON.parse(line)));
};
const deletionCount = async (): Promise<number> => {
  const recorded = await effects();
  return recorded.filter((effect) => effect.kind === "delete").length;
};
export default defineEval({
  description:
    "Actual ChatJS installed registry/resolver and document request/scope/execution",
  async test(evaluation) {
    const session = await evaluation.session();
    await session.send("Delete document");
    const request = session.requireInputRequest();
    evaluation.log(JSON.stringify(request));
    assert.equal(request.action?.toolName, "deleteDocument");
    assert.deepEqual(request.action?.input, input);
    assert.equal(await deletionCount(), 0);
    await session.respond(
      [{ optionId: "approve", requestId: request.requestId }],
      { headers: { "x-proof-principal": "foreign" } }
    );
    await session.respond(
      [{ optionId: "cancel", requestId: request.requestId }],
      { headers: { "x-proof-principal": "foreign" } }
    );
    assert.equal(await deletionCount(), 0);
    if (mode !== "unchanged") {
      assert.equal(
        session.events.filter(
          (event) =>
            event.type === "approval.candidate" &&
            event.data.outcome === "rejected" &&
            event.data.responderPrincipalId === "foreign" &&
            event.data.requestId === request.requestId
        ).length,
        2
      );
    }
    const owner = await session.respond([
      { optionId: "approve", requestId: request.requestId },
    ]);
    const deleted = await deletionCount();
    assert.equal(deleted, mode === "native-candidate" ? 1 : 0);
    if (mode === "unchanged") {
      assert.ok(
        session.events.some(
          (event) =>
            event.type === "approval.candidate" &&
            event.data.outcome === "failed"
        )
      );
    } else {
      const calls = owner.toolCalls.filter(
        (entry) => entry.name === "deleteDocument"
      );
      assert.equal(calls.length, 1);
      const [call] = calls;
      assert.equal(
        call.status,
        mode === "native-candidate" ? "completed" : "failed"
      );
      if (mode === "response-adapted") {
        assert.ok(
          JSON.stringify(call.output).includes(
            "Document deletion requires the owner"
          )
        );
      }
    }
    if (mode !== "native-candidate") {
      return;
    }
    /* oxlint-disable eslint/no-await-in-loop -- Foreign approval and cancellation attempts must settle before the owner response on the same session. */
    for (const change of ["revision", "owner"]) {
      const changed = await evaluation.session();
      await changed.send("Delete document");
      const pending = changed.requireInputRequest();
      await writeFile(
        `proof-${changed.sessionId}.json`,
        JSON.stringify(
          change === "revision"
            ? { revisionId: "c37456d0-9587-4e14-a80e-36a85873ed86" }
            : { ownerId: "foreign" }
        )
      );
      await changed.respond([
        { optionId: "approve", requestId: pending.requestId },
      ]);
      assert.equal(await deletionCount(), 1);
      const records = await effects();
      assert.ok(
        records.some(({ kind, detail }) =>
          change === "revision"
            ? kind === "revision" &&
              detail.conversationId === changed.sessionId &&
              detail.revisionId === "c37456d0-9587-4e14-a80e-36a85873ed86"
            : kind === "scope" &&
              detail.sessionId === changed.sessionId &&
              detail.ownerId === "foreign"
        )
      );
    }
    /* oxlint-enable eslint/no-await-in-loop */
    const cancelled = await evaluation.session();
    await cancelled.send("Delete document");
    await cancelled.respondAll("cancel");
    assert.equal(await deletionCount(), 1);
    evaluation.log(
      `Actual installed dynamic source passed mode=${mode}; effects guarded by original request/scope code and disposable DB boundary.`
    );
  },
});
