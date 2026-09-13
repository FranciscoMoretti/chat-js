import { expect, test } from "vitest";

import { eveCodeSandboxName } from "./code-sandbox-name";

const provider = { teamId: "team-a", projectId: "project-a" };
const sandboxNamePattern = /^chatjs-code-[a-f0-9]{48}$/;

test("the same native call has a stable opaque name, isolated by owner and session", () => {
  const scope = {
    ownerId: "alice",
    sessionId: "session-a",
    callId: "call-a",
    provider,
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
      ownerId: "a:b",
      sessionId: "c",
      callId: "d",
      provider,
    })
  ).not.toBe(
    eveCodeSandboxName({
      ownerId: "a",
      sessionId: "b:c",
      callId: "d",
      provider,
    })
  );
});

test("missing native identity cannot allocate an anonymous fallback sandbox", () => {
  for (const scope of [
    { ownerId: undefined, sessionId: "session", callId: "call", provider },
    { ownerId: "owner", sessionId: undefined, callId: "call", provider },
    { ownerId: "owner", sessionId: "session", callId: " ", provider },
  ]) {
    expect(() => eveCodeSandboxName(scope)).toThrow(
      "authenticated native tool call"
    );
  }
});
