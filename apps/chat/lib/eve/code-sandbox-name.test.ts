import { expect, test } from "vitest";

import { eveCodeSandboxName } from "./code-sandbox-name";

const provider = { projectId: "project-a", teamId: "team-a" };
const sandboxNamePattern = /^chatjs-code-[a-f0-9]{48}$/u;

test("the same native call has a stable opaque name, isolated by owner and session", () => {
  const scope = {
    callId: "call-a",
    ownerId: "alice",
    provider,
    sessionId: "session-a",
  };
  const name = eveCodeSandboxName(scope);
  expect(eveCodeSandboxName({ ...scope })).toBe(name);
  expect(name).toMatch(sandboxNamePattern);
  expect(name).not.toContain(scope.ownerId);
  for (const other of [
    { ...scope, ownerId: "bob" },
    { ...scope, provider: { ...provider, teamId: "team-b" } },
    { ...scope, provider: { ...provider, projectId: "project-b" } },
    { ...scope, sessionId: "fork-b" },
    { ...scope, callId: "call-b", provider },
  ]) {
    expect(eveCodeSandboxName(other)).not.toBe(name);
  }
  expect(
    eveCodeSandboxName({
      callId: "d",
      ownerId: "a:b",
      provider,
      sessionId: "c",
    })
  ).not.toBe(
    eveCodeSandboxName({
      callId: "d",
      ownerId: "a",
      provider,
      sessionId: "b:c",
    })
  );
});

test("missing native identity cannot allocate an anonymous fallback sandbox", () => {
  for (const scope of [
    { callId: "call", ownerId: undefined, provider, sessionId: "session" },
    { callId: "call", ownerId: "owner", provider, sessionId: undefined },
    { callId: " ", ownerId: "owner", provider, sessionId: "session" },
  ]) {
    expect(() => eveCodeSandboxName(scope)).toThrow(
      "authenticated native tool call"
    );
  }
});
