import { expect, test } from "bun:test";

import { parseAuthRequestOptions } from "./auth-request-options";

test("preserves valid sign-in options and extension fields without copying", () => {
  const options = {
    additionalData: { invite: "code", nested: { enabled: true } },
    callbackURL: "",
    disableRedirect: false,
    errorCallbackURL: "/error",
    extension: { tenant: "one" },
    newUserCallbackURL: "/welcome",
    provider: "github",
    requestSignUp: true,
    scopes: ["profile", "email"],
  };
  expect(parseAuthRequestOptions(options)).toBe(options);
  expect(parseAuthRequestOptions({})).toEqual({});
  expect(parseAuthRequestOptions()).toBeUndefined();
});

const invalidOptions: readonly unknown[] = [
  null,
  false,
  "github",
  [],
  { provider: 1 },
  { callbackURL: null },
  { newUserCallbackURL: false },
  { errorCallbackURL: {} },
  { disableRedirect: "false" },
  { requestSignUp: 1 },
  { scopes: "email" },
  { scopes: ["email", 1] },
  { additionalData: null },
  { additionalData: [] },
];

test.each(invalidOptions.map((options) => ({ options })))(
  "rejects malformed IPC sign-in options %#",
  ({ options }: { readonly options: unknown }) => {
    expect(() => parseAuthRequestOptions(options)).toThrow(
      "Invalid browser sign-in options."
    );
  }
);
