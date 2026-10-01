import { expect, test } from "vitest";

import {
  MissingCredentialsError,
  requireCredentials,
} from "./required-credentials";

test("reports missing groups explicitly without exposing supplied secrets", () => {
  try {
    requireCredentials(
      "langfuse",
      [
        { options: [["PUBLIC_KEY", "SECRET_KEY"], ["TOKEN"]] },
        { options: [["HOST"]] },
      ],
      { HOST: "configured", NODE_ENV: "test", PUBLIC_KEY: "private-value" }
    );
    throw new Error("Expected missing credentials");
  } catch (error) {
    expect(error).toBeInstanceOf(MissingCredentialsError);
    if (!(error instanceof MissingCredentialsError)) {
      throw error;
    }
    expect(error.code).toBe("CHATJS_MISSING_CREDENTIALS");
    expect(error.integration).toBe("langfuse");
    expect(error.requirements).toHaveLength(1);
    expect(error.message).toContain("PUBLIC_KEY + SECRET_KEY or TOKEN");
    expect(error.message).not.toContain("private-value");
  }
});

test("supports alternative credentials, combined groups, and Vercel runtime auth", () => {
  expect(() =>
    requireCredentials(
      "feature",
      [
        { options: [["A", "B"], ["TOKEN"]] },
        { allOf: [{ options: [["C"]] }, { options: [["D"]] }], options: [] },
        { options: [["VERCEL_TOKEN"]], runtimeAuth: "vercel-oidc" },
      ],
      { C: "set", D: "set", NODE_ENV: "test", TOKEN: "set", VERCEL: "1" }
    )
  ).not.toThrow();
  expect(() =>
    requireCredentials("feature", [], { NODE_ENV: "test" })
  ).not.toThrow();
  expect(() =>
    requireCredentials("feature", [{ options: [["TOKEN"]] }], {
      NODE_ENV: "test",
      TOKEN: "",
    })
  ).toThrow(MissingCredentialsError);
});
