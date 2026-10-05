/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "drizzle-orm" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-deletion"; "../lib/db/eve-queries"; "../lib/db/eve-response-groups"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-shadow -- Nested callback names mirror the protocol fields and transaction APIs under test. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
import { eq } from "drizzle-orm";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterAll, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { completeEveConversationDeletion } from "../lib/db/eve-deletion";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  beginEveConversationDeletion,
  createEveConversation,
  getEveCreation,
} from "../lib/db/eve-queries";
/* oxlint-enable sort-imports */
import {
  getEveResponseGroup,
  getEveResponseGroupForConversation,
  recordEveResponseGroupRejection,
  reserveEveResponseGroup,
} from "../lib/db/eve-response-groups";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveConversation, eveResponseGroup, user } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createEveConversationOperation } from "../lib/eve/create-conversation-operation";
/* oxlint-enable sort-imports */
import { createEveResponseGroup } from "../lib/eve/response-group";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

vi.mock("server-only", () => ({}));
vi.mock("../lib/eve/create-conversation-operation", () => ({
  createEveConversationOperation: vi.fn(),
}));
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite inserts the response-group owner before registering its scenarios.
await db.insert(user).values({
  email: `${owner}@test.invalid`,
  id: owner,
  name: "Response group test",
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): afterAll accepts row; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): afterAll intentionally keeps the existing falsy-value behavior of rows.filter((row) => row.parentConversationId); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
afterAll(async () => {
  await db.delete(eveResponseGroup).where(eq(eveResponseGroup.ownerId, owner));
  // Fork foreign keys require deleting children before roots.
  const rows = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.ownerId, owner));
  for (const row of rows.filter((row) => row.parentConversationId)) {
    await db.delete(eveConversation).where(eq(eveConversation.id, row.id));
  }
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("parallel reservations and partial dispatch retries keep ordered exact identitie keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("parallel reservations and partial dispatch retries keep ordered exact identitie keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("parallel reservations and partial dispatch retries keep ordered exact identitie uses 3, 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("parallel reservations and partial dispatch retries keep ordered exact identitie accepts operation; candidate; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("parallel reservations and partial dispatch retries keep ordered exact identitie preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("parallel reservations and partial dispatch retries keep ordered exact identities", async () => {
  const input = {
    message: "Compare these models",
    modelIds: ["model-a", "model-b", "model-c"],
    operationId: crypto.randomUUID(),
  };
  const [left, right] = await Promise.all([
    reserveEveResponseGroup(owner, input),
    reserveEveResponseGroup(owner, input),
  ]);
  expect(left).toEqual(right);
  await expect(
    reserveEveResponseGroup(owner, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...input,
      modelIds: [...input.modelIds].toReversed(),
    })
  ).rejects.toThrow("different message");
  await expect(
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    reserveEveResponseGroup(owner, { ...input, message: "Different" })
  ).rejects.toThrow("different message");
  let failSecond = true;
  const nativeCalls: string[] = [];
  vi.mocked(createEveConversationOperation).mockImplementation(
    async (ownerId, operation) => {
      if (operation.modelId === "model-b" && failSecond) {
        return Response.json({ error: "Unavailable" }, { status: 503 });
      }
      const binding = await createEveConversation(
        ownerId,
        operation.operationId,
        // oxlint-disable-next-line typescript/no-base-to-string -- These response-group fixtures submit string messages; coercion preserves the mock launcher contract without constraining the production message union.
        String(operation.message),
        (id) => {
          nativeCalls.push(id);
          return Promise.resolve(`session-${id}`);
        },
        { fork: operation.fork, initialModelId: operation.modelId }
      );
      return Response.json(binding);
    }
  );
  const first = await createEveResponseGroup(owner, input);
  expect(first.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "unresolved",
    "bound",
  ]);
  failSecond = false;
  const retried = await createEveResponseGroup(owner, input);
  expect(retried.candidates.map((candidate) => candidate.operationId)).toEqual(
    left.candidates.map((candidate) => candidate.operationId)
  );
  expect(
    retried.candidates.every((candidate) => candidate.state === "bound")
  ).toBe(true);
  expect(new Set(nativeCalls).size).toBe(3);
  expect(nativeCalls).toHaveLength(3);
  const root = await getEveCreation(owner, left.candidates[0].operationId);
  for (const candidate of left.candidates.slice(1)) {
    const child = await getEveCreation(owner, candidate.operationId);
    expect(child?.parentConversationId).toBe(root?.id);
    expect(child?.rootConversationId).toBe(root?.id);
    expect(child?.forkTurnId).toBe("turn_0");
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("unconfirmed initial creation never starts independent secondary roots") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("unconfirmed initial creation never starts independent secondary roots", async () => {
  vi.mocked(createEveConversationOperation)
    .mockReset()
    .mockResolvedValue(Response.json({ error: "Lost reply" }, { status: 409 }));
  const input = {
    message: "Wait for root",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const result = await createEveResponseGroup(owner, input);
  expect(result.candidates.map((candidate) => candidate.state)).toEqual([
    "unresolved",
    "waiting",
  ]);
  expect(createEveConversationOperation).toHaveBeenCalledTimes(1);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("continuation candidates share one source checkpoint and reject inaccessible sou keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): test("continuation candidates share one source checkpoint and reject inaccessible sou accepts operation; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("continuation candidates share one source checkpoint and reject inaccessible sou preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("continuation candidates share one source checkpoint and reject inaccessible sources", async () => {
  const source = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Original",
    (id) => Promise.resolve(`source-${id}`)
  );
  vi.mocked(createEveConversationOperation)
    .mockReset()
    .mockImplementation(async (ownerId, operation) => {
      const binding = await createEveConversation(
        ownerId,
        operation.operationId,
        // oxlint-disable-next-line typescript/no-base-to-string -- These response-group fixtures submit string messages; coercion preserves the mock launcher contract without constraining the production message union.
        String(operation.message),
        (id) => Promise.resolve(`continued-${id}`),
        { fork: operation.fork, initialModelId: operation.modelId }
      );
      return Response.json(binding);
    });
  const fork = { beforeTurnId: "turn_0", conversationId: source.id };
  const input = {
    fork,
    message: "Continue",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const result = await createEveResponseGroup(owner, input);
  expect(
    result.candidates.every((candidate) => candidate.state === "bound")
  ).toBe(true);
  for (const candidate of result.candidates) {
    const row = await getEveCreation(owner, candidate.operationId);
    expect(row?.parentConversationId).toBe(source.id);
    expect(row?.forkTurnId).toBe(fork.beforeTurnId);
  }
  await expect(
    createEveResponseGroup(owner, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...input,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing fork own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      fork: { ...fork, conversationId: crypto.randomUUID() },
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow("Source conversation not found");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): test("definitive rejection is distinct from uncertainty and repeated model choices re uses 5, 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("definitive rejection is distinct from uncertainty and repeated model choices re accepts candidate; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("definitive rejection is distinct from uncertainty and repeated model choices remain independent", async () => {
  const input = {
    message: "Five responses",
    modelIds: ["model-a", "model-a", "model-b", "model-c", "model-d"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  expect(group.candidates.map((candidate) => candidate.modelId)).toEqual(
    input.modelIds
  );
  expect(
    new Set(group.candidates.map((candidate) => candidate.operationId)).size
  ).toBe(5);
  vi.mocked(createEveConversationOperation)
    .mockReset()
    .mockResolvedValue(
      Response.json(
        { creationRejected: true, error: "Model unavailable" },
        { status: 400 }
      )
    );
  const result = await createEveResponseGroup(owner, input);
  expect(result.candidates[0]).toMatchObject({
    error: "Model unavailable",
    state: "rejected",
  });
  expect(
    result.candidates
      .slice(1)
      .every((candidate) => candidate.state === "waiting")
  ).toBe(true);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. Native-session fixture resolves `session-${id}` for createEveConversation; synchronous return would fail its create callback contract. Native-session fixture resolves "must-not-create" for createEveConversation; synchronous return would fail its create callback contract. Native-session fixture resolves "must-not-create-root" for createEveConversation; synchronous return would fail its create callback contract. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null --
 * max-lines-per-function (#510): test("deleting a partial family erases group payloads and fences unstarted candidates keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("deleting a partial family erases group payloads and fences unstarted candidates keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("deleting a partial family erases group payloads and fences unstarted candidates uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): test("deleting a partial family erases group payloads and fences unstarted candidates preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("deleting a partial family erases group payloads and fences unstarted candidates", async () => {
  const input = {
    message: "Private group",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  const root = await createEveConversation(
    owner,
    group.candidates[0].operationId,
    input.message,
    async (id) => `session-${id}`
  );
  const forkInput = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...input,
    fork: { beforeTurnId: "turn_0", conversationId: root.id },
    operationId: crypto.randomUUID(),
  };
  const pendingFork = await reserveEveResponseGroup(owner, forkInput);
  const unrelated = await reserveEveResponseGroup(owner, {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...input,
    operationId: crypto.randomUUID(),
  });
  await beginEveConversationDeletion(owner, root.id);
  await completeEveConversationDeletion(owner, root.id);
  for (const { saved, original } of [
    { original: input, saved: group },
    { original: forkInput, saved: pendingFork },
  ]) {
    const [row] = await db
      .select()
      .from(eveResponseGroup)
      .where(eq(eveResponseGroup.id, saved.id));
    expect(row).toMatchObject({
      candidateOperationIds: saved.candidateOperationIds,
      candidates: null,
      deleted: true,
      inputHash: null,
    });
    await expect(reserveEveResponseGroup(owner, original)).rejects.toThrow(
      "deleted"
    );
  }
  await expect(
    createEveConversation(
      owner,
      group.candidates[1].operationId,
      input.message,
      async () => "must-not-create",
      { fork: { beforeTurnId: "turn_0", conversationId: root.id } }
    )
  ).rejects.toThrow();
  await expect(
    createEveConversation(
      owner,
      group.candidates[1].operationId,
      input.message,
      async () => "must-not-create-root"
    )
  ).rejects.toThrow("response group has been deleted");
  const [untouched] = await db
    .select()
    .from(eveResponseGroup)
    .where(eq(eveResponseGroup.id, unrelated.id));
  expect(untouched.deleted).toBe(false);
  expect(untouched.inputHash).toBe(unrelated.inputHash);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. Native-session fixture resolves `session-${id}` for createEveConversation; synchronous return would fail its create callback contract. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): test("group reservation racing retirement cannot leave an active unstarted group") accepts row; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("group reservation racing retirement cannot leave an active unstarted group", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Race",
    async (id) => `session-${id}`
  );
  const input = {
    fork: { beforeTurnId: "turn_0", conversationId: root.id },
    message: "Concurrent",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  await Promise.allSettled([
    reserveEveResponseGroup(owner, input),
    beginEveConversationDeletion(owner, root.id),
  ]);
  const rows = await db
    .select()
    .from(eveResponseGroup)
    .where(eq(eveResponseGroup.operationId, input.operationId));
  expect(
    rows.every(
      (row) => row.deleted && row.candidates === null && row.inputHash === null
    )
  ).toBe(true);
  await expect(
    reserveEveResponseGroup(owner, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...input,
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow("unavailable");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. Native-session fixture resolves `session-${id}` for createEveConversation; synchronous return would fail its create callback contract. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): test("pre-contract groups block erasure until an exact replay recovers their source i preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("pre-contract groups block erasure until an exact replay recovers their source identity", async () => {
  const root = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Old group",
    async (id) => `session-${id}`
  );
  const input = {
    fork: { beforeTurnId: "turn_0", conversationId: root.id },
    message: "Preserved",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  await db
    .update(eveResponseGroup)
    .set({ sourceConversationId: null, sourceIdentityKnown: false })
    .where(eq(eveResponseGroup.id, group.id));
  await expect(beginEveConversationDeletion(owner, root.id)).rejects.toThrow(
    "Recover saved response group"
  );
  await reserveEveResponseGroup(owner, input);
  await beginEveConversationDeletion(owner, root.id);
  const [row] = await db
    .select()
    .from(eveResponseGroup)
    .where(eq(eveResponseGroup.id, group.id));
  expect(row).toMatchObject({
    deleted: true,
    sourceConversationId: root.id,
    sourceIdentityKnown: true,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. Native-session fixture resolves `session-${id}` for createEveConversation; synchronous return would fail its create callback contract. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): test("owner-only group reads preserve order and rejection recovery without exposing i keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("owner-only group reads preserve order and rejection recovery without exposing i keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("owner-only group reads preserve order and rejection recovery without exposing i uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("owner-only group reads preserve order and rejection recovery without exposing intent hashes", async () => {
  const input = {
    message: "Read group",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  const first = await createEveConversation(
    owner,
    group.candidates[0].operationId,
    input.message,
    async (id) => `session-${id}`
  );
  await recordEveResponseGroupRejection(
    owner,
    group.id,
    group.candidates[1].operationId,
    { code: "project_not_found", error: "Project missing" }
  );
  const result = await getEveResponseGroup(owner, group.id);
  expect(result?.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "rejected",
  ]);
  expect(result?.candidates[1]).toMatchObject({ code: "project_not_found" });
  expect(result).not.toHaveProperty("inputHash");
  expect(await getEveResponseGroupForConversation(owner, first.id)).toEqual(
    result
  );
  expect(await getEveResponseGroup("other-owner", group.id)).toBeUndefined();
  expect(
    await getEveResponseGroupForConversation("other-owner", first.id)
  ).toBeUndefined();
  await recordEveResponseGroupRejection(
    owner,
    group.id,
    group.candidates[1].operationId
  );
  const responseCandidates = await getEveResponseGroup(owner, group.id);
  expect(responseCandidates?.candidates[1].state).toBe("waiting");
  await beginEveConversationDeletion(owner, first.id);
  expect(await getEveResponseGroup(owner, group.id)).toBeUndefined();
  await expect(
    recordEveResponseGroupRejection(
      owner,
      group.id,
      group.candidates[1].operationId,
      { error: "late write" }
    )
  ).rejects.toThrow("unavailable");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions --
 * max-statements (#512): test("an in-flight candidate prevents family erasure until its binding resolves") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("an in-flight candidate prevents family erasure until its binding resolves") uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("an in-flight candidate prevents family erasure until its binding resolves") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): test("an in-flight candidate prevents family erasure until its binding resolves") intentionally keeps the existing falsy-value behavior of root; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("an in-flight candidate prevents family erasure until its binding resolves", async () => {
  const input = {
    message: "In flight",
    modelIds: ["model-a", "model-b"],
    operationId: crypto.randomUUID(),
  };
  const group = await reserveEveResponseGroup(owner, input);
  const entered = Promise.withResolvers<undefined>();
  const release = Promise.withResolvers<undefined>();
  const creation = createEveConversation(
    owner,
    group.candidates[0].operationId,
    input.message,
    async (id) => {
      entered.resolve(undefined);
      await release.promise;
      return `session-${id}`;
    }
  );
  await entered.promise;
  try {
    const root = await getEveCreation(owner, group.candidates[0].operationId);
    if (!root) {
      throw new Error("Missing creating candidate");
    }
    await expect(beginEveConversationDeletion(owner, root.id)).rejects.toThrow(
      "Finish recovering"
    );
  } finally {
    release.resolve(undefined);
  }
  const root = await creation;
  await beginEveConversationDeletion(owner, root.id);
  await expect(createEveResponseGroup(owner, input)).rejects.toThrow("deleted");
  expect(
    await getEveCreation(owner, group.candidates[1].operationId)
  ).toBeUndefined();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines -- #509: This eve-response-groups.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
