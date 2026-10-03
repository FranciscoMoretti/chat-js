/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { describe, expect, it } from "vitest";

import { createConversationInput } from "./contracts";
import { prepareCreation } from "./pending-create";
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "./request-policy";
import { sendCommand } from "./send-command";
/* oxlint-enable sort-imports */

/* oxlint-disable max-lines-per-function, oxc/no-optional-chaining, unicorn/no-null --
 * max-lines-per-function (#510): describe("Eve request policy") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-optional-chaining (#542): describe("Eve request policy") handles optional parseSessionRequest("/eve/v1/session/a/stream", "GET")?.sessionId; policy?.schema.safeParse(input).success; policy?.schema.safeParse({ message: "hello", owner: "other" }).success; policy?.schema.safeParse({ message: " " }).success; policy?.schema.safeParse({ inputResponses: [{ optionId: "allow", requestId: "req" }], without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * unicorn/no-null (#570): describe("Eve request policy") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
describe("Eve request policy", () => {
  it("denies raw create, control bypasses and cross-origin mutations", () => {
    for (const path of [
      "/eve/v1/session",
      "/eve/v1/session/a/reset",
      "/eve/v1/session/a/compact",
      "/eve/v1/session/a/clear",
      "/eve/v1/session/a/subagents",
      "/eve/v1/session/a%2fb",
    ]) {
      expect(parseSessionRequest(path, "POST")).toBeNull();
    }
    expect(
      parseSessionRequest("/eve/v1/session/a/stream", "GET")?.sessionId
    ).toBe("a");
    expect(parseSessionRequest("/eve/v1/session/a/cancel", "GET")).toBeNull();
    expect(
      sameOrigin(
        new Request("http://localhost/api", {
          headers: { origin: "https://evil.test" },
          method: "POST",
        }),
        "http://localhost"
      )
    ).toBe(false);
    expect(
      sameOrigin(
        new Request("http://localhost/api", { method: "POST" }),
        "http://localhost"
      )
    ).toBe(false);
  });
  it("accepts native active-turn cancellation but rejects malformed or expanded controls", () => {
    const policy = parseSessionRequest("/eve/v1/session/a/cancel", "POST");
    for (const input of [{}, { turnId: "turn-1" }]) {
      expect(policy?.schema.safeParse(input).success).toBe(true);
    }
    for (const input of [
      { turnId: "" },
      { turnId: null },
      { turnId: 1 },
      { tasks: true },
      { owner: "other" },
    ]) {
      expect(policy?.schema.safeParse(input).success).toBe(false);
    }
  });
  it("rejects malformed native messages and stream cursors", () => {
    const policy = parseSessionRequest("/eve/v1/session/a", "POST");
    expect(
      policy?.schema.safeParse({ message: "hello", owner: "other" }).success
    ).toBe(false);
    expect(policy?.schema.safeParse({ message: "  " }).success).toBe(false);
    expect(
      policy?.schema.safeParse({
        inputResponses: [{ optionId: "allow", requestId: "req" }],
      }).success
    ).toBe(true);
    for (const query of [
      "startIndex=-1",
      "follow=123",
      "foo=true",
      "startIndex=1&startIndex=2",
    ]) {
      expect(safeStreamQuery(new URLSearchParams(query))).toBeNull();
    }
    expect(
      safeStreamQuery(
        new URLSearchParams("startIndex=0&includeTailIndex=1")
      )?.get("startIndex")
    ).toBe("0");
  });
  it("preserves native stream control negotiation while rejecting unsupported queries", () => {
    for (const query of [
      "streamControlVersion=1&includeTailIndex=1",
      "startIndex=12&streamControlVersion=1&includeTailIndex=1",
    ]) {
      expect(safeStreamQuery(new URLSearchParams(query))?.toString()).toBe(
        query
      );
    }
    for (const query of [
      "streamControlVersion=2",
      "streamControlVersion=",
      "streamControlVersion=1&streamControlVersion=1",
      "streamControlVersion=1&foo=true",
    ]) {
      expect(safeStreamQuery(new URLSearchParams(query))).toBeNull();
    }
  });
});
/* oxlint-enable max-lines-per-function, oxc/no-optional-chaining, unicorn/no-null */

/* oxlint-disable max-lines-per-function, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/no-null --
 * max-lines-per-function (#510): describe("Eve command recovery") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("Eve command recovery") uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): describe("Eve command recovery") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep describe("Eve command recovery")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): describe("Eve command recovery") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): describe("Eve command recovery") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
describe("Eve command recovery", () => {
  it("validates before retaining intent and isolates pending intents by account", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      removeItem: (key: string): void => {
        data.delete(key);
      },
      setItem: (key: string, value: string): void => {
        data.set(key, value);
      },
    };
    expect(() => prepareCreation(storage, "alice", " ")).toThrow();
    expect(data.size).toBe(0);
    const first = prepareCreation(
      storage,
      "alice",
      "hello",
      "openai/gpt-4.1-mini"
    );
    expect(prepareCreation(storage, "alice", "edited", "other-model")).toEqual(
      first
    );
    expect(prepareCreation(storage, "bob", "other").message).toBe("other");
  });
  it("surfaces callback-only failures and catches up after cancellation", async () => {
    let replayed = 0;
    await expect(
      sendCommand(
        () => Promise.resolve(),
        () => {
          replayed += 1;
          return Promise.resolve();
        },
        true,
        () => new Error("failed")
      )
    ).rejects.toThrow("failed");
    expect(replayed).toBe(0);
    await sendCommand(
      () => Promise.resolve(),
      () => {
        replayed += 1;
        return Promise.resolve();
      },
      true,
      () => {
        // This test verifies replay without an additional side effect.
      }
    );
    expect(replayed).toBe(1);
  });
});
/* oxlint-enable max-lines-per-function, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/promise-function-async, unicorn/no-null */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/promise-function-async --
 * no-magic-numbers (#517): it("waits for authoritative acceptance after cancellation without submitting twice") uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("waits for authoritative acceptance after cancellation without submitting twice") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): it("waits for authoritative acceptance after cancellation without submitting twice") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("waits for authoritative acceptance after cancellation without submitting twice", async () => {
  let submissions = 0;
  let snapshots = 0;
  await sendCommand(
    () => {
      submissions += 1;
      return Promise.resolve();
    },
    () => {
      snapshots += 1;
      return Promise.resolve();
    },
    true,
    () => {
      // This test verifies cancellation without an additional side effect.
    },
    () => snapshots >= 2
  );
  expect(submissions).toBe(1);
  expect(snapshots).toBe(2);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/promise-function-async */

/* oxlint-disable oxc/no-rest-spread-properties --
 * oxc/no-rest-spread-properties (#543): it("accepts conversation-based forks and rejects raw native identities or invalid tur copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("accepts conversation-based forks and rejects raw native identities or invalid turns", () => {
  const input = { message: "replacement", operationId: crypto.randomUUID() };
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { beforeTurnId: "turn_1", conversationId: crypto.randomUUID() },
    }).success
  ).toBe(true);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { beforeTurnId: "turn_1", sessionId: "native-session" },
    }).success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { beforeTurnId: "turn_-1", conversationId: crypto.randomUUID() },
    }).success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({ ...input, forkKind: "edit" }).success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { beforeTurnId: "turn_1", conversationId: crypto.randomUUID() },
      forkKind: "regenerate",
    }).success
  ).toBe(true);
});
/* oxlint-enable oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-rest-spread-properties --
 * oxc/no-rest-spread-properties (#543): it("allows a project for new conversations while forks inherit their existing project copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("allows a project for new conversations while forks inherit their existing project", () => {
  const input = {
    message: "Project conversation",
    operationId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
  };
  expect(createConversationInput.safeParse(input).success).toBe(true);
  expect(
    createConversationInput.safeParse({ ...input, projectId: "invalid" })
      .success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { beforeTurnId: "turn_0", conversationId: crypto.randomUUID() },
    }).success
  ).toBe(false);
});
/* oxlint-enable oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-rest-spread-properties --
 * oxc/no-rest-spread-properties (#543): it("accepts exactly one canonical imported fork boundary") copies or separates ...input.fork; ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("accepts exactly one canonical imported fork boundary", () => {
  const input = {
    fork: {
      beforeMessageId: "seed_message_2",
      conversationId: crypto.randomUUID(),
    },
    message: "Replacement question",
    operationId: crypto.randomUUID(),
  };
  expect(createConversationInput.parse(input)).toEqual(input);
  for (const fork of [
    { ...input.fork, beforeTurnId: "turn_0" },
    { ...input.fork, checkpointId: crypto.randomUUID() },
    { ...input.fork, beforeMessageId: "seed_message_02" },
    { ...input.fork, beforeMessageId: "seed_message_10000" },
    { ...input.fork, beforeMessageId: "message_2" },
  ]) {
    expect(createConversationInput.safeParse({ ...input, fork }).success).toBe(
      false
    );
  }
});
/* oxlint-enable oxc/no-rest-spread-properties */
