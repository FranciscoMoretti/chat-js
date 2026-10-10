import {
  MissingCredentialsError,
  requireCredentials,
} from "./required-credentials";

import { expect, test } from "vitest";

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("reports missing groups explicitly without exposing supplied secrets") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("reports missing groups explicitly without exposing supplied secrets") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable max-statements, no-magic-numbers */

test("supports alternative credentials, combined groups, and Vercel runtime auth", () => {
  expect(() =>
    requireCredentials(
      "feature",
      [
        { options: [["A", "B"], ["TOKEN"]] },
        {
          allOf: [
            { options: [["CREDENTIAL_C"]] },
            { options: [["CREDENTIAL_D"]] },
          ],
          options: [],
        },
        { options: [["VERCEL_TOKEN"]], runtimeAuth: "vercel-oidc" },
      ],
      {
        CREDENTIAL_C: "set",
        CREDENTIAL_D: "set",
        NODE_ENV: "test",
        TOKEN: "set",
        VERCEL: "1",
      }
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

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers --
 * init-declarations (#507): test("reports only unsatisfied subgroups recursively, even without descriptions") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("reports only unsatisfied subgroups recursively, even without descriptions") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("reports only unsatisfied subgroups recursively, even without descriptions") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("reports only unsatisfied subgroups recursively, even without descriptions") uses 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("reports only unsatisfied subgroups recursively, even without descriptions", () => {
  const requirements = [
    {
      allOf: [
        { options: [["SATISFIED_GROUP"]] },
        {
          allOf: [
            { options: [["NESTED_SATISFIED"]] },
            { options: [["VERCEL_TOKEN"]], runtimeAuth: "vercel-oidc" },
            { allOf: [{ options: [["MISSING_KEY"]] }], options: [] },
            {
              options: [["ALTERNATIVE_A"], ["ALTERNATIVE_B", "ALTERNATIVE_C"]],
            },
          ],
          options: [],
        },
      ],
      options: [],
    },
  ];
  const env = {
    NESTED_SATISFIED: "nested-secret",
    NODE_ENV: "test",
    SATISFIED_GROUP: "supplied-secret",
    VERCEL: "1",
  };
  let failure: MissingCredentialsError | undefined;
  try {
    requireCredentials("grouped-feature", requirements, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing env own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...env,
      NODE_ENV: "test",
    });
  } catch (error) {
    if (!(error instanceof MissingCredentialsError)) {
      throw error;
    }
    failure = error;
  }
  expect(failure).toBeDefined();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading requirements from failure; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(failure?.requirements).toEqual([
    {
      allOf: [
        {
          allOf: [
            { allOf: [{ options: [["MISSING_KEY"]] }], options: [] },
            {
              options: [["ALTERNATIVE_A"], ["ALTERNATIVE_B", "ALTERNATIVE_C"]],
            },
          ],
          options: [],
        },
      ],
      options: [],
    },
  ]);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading message from failure; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(failure?.message).toContain("MISSING_KEY");
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading message from failure; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(failure?.message).toContain(
    "ALTERNATIVE_A or ALTERNATIVE_B + ALTERNATIVE_C"
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading message from failure; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(failure?.message).not.toMatch(
    /SATISFIED|VERCEL_TOKEN|supplied-secret|nested-secret/u
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading requirements from failure; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(JSON.stringify(failure?.requirements)).not.toMatch(
    /supplied-secret|nested-secret/u
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading allOf from requirements[0]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(requirements[0]?.allOf).toHaveLength(2);
  expect(() =>
    requireCredentials("grouped-feature", requirements, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing env own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...env,
      ALTERNATIVE_A: "token",
      MISSING_KEY: "key",
      NODE_ENV: "test",
    })
  ).not.toThrow();
});
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers */
