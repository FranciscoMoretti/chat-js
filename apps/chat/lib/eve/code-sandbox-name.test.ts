import { expect, test } from "vitest";
import { eveCodeSandboxName } from "./code-sandbox-name";

const sandboxNamePattern = /^chatjs-code-[a-f0-9]{48}$/;

test("the same native call has a stable opaque name, isolated by owner and session", () => {
  const scope = { ownerId: "alice", sessionId: "session-a", callId: "call-a" };
  const name = eveCodeSandboxName(scope);
  expect(eveCodeSandboxName({ ...scope })).toBe(name);
  expect(name).toMatch(sandboxNamePattern);
  expect(name).not.toContain(scope.ownerId);
  for (const other of [
    { ...scope, ownerId: "bob" },
    { ...scope, sessionId: "fork-b" },
    { ...scope, callId: "call-b" },
  ]) {
    expect(eveCodeSandboxName(other)).not.toBe(name);
  }
  expect(
    eveCodeSandboxName({ ownerId: "a:b", sessionId: "c", callId: "d" })
  ).not.toBe(
    eveCodeSandboxName({ ownerId: "a", sessionId: "b:c", callId: "d" })
  );
});

test("missing native identity cannot allocate an anonymous fallback sandbox", () => {
  for (const scope of [
    { ownerId: undefined, sessionId: "session", callId: "call" },
    { ownerId: "owner", sessionId: undefined, callId: "call" },
    { ownerId: "owner", sessionId: "session", callId: " " },
  ]) {
    expect(() => eveCodeSandboxName(scope)).toThrow(
      "authenticated native tool call"
    );
  }
});
