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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of scope rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
  expect(eveCodeSandboxName({ ...scope })).toBe(name);
  expect(name).toMatch(sandboxNamePattern);
  expect(name).not.toContain(scope.ownerId);
  for (const other of [
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...scope, ownerId: "bob" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing provider own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...scope, provider: { ...provider, teamId: "team-b" } },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing provider own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...scope, provider: { ...provider, projectId: "project-b" } },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...scope, sessionId: "fork-b" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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

/* oxlint-disable no-undefined --
 * no-undefined (#519): test("missing native identity cannot allocate an anonymous fallback sandbox") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable no-undefined */
