import { expect, test } from "vitest";

import {
  MissingCredentialsError,
  requireCredentials,
} from "./required-credentials";

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

/* oxlint-disable id-length --
 * id-length (#506): test("supports alternative credentials, combined groups, and Vercel runtime auth") uses C; D as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
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
/* oxlint-enable id-length */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers  --
 * init-declarations (#507): test("reports only unsatisfied subgroups recursively, even without descriptions") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("reports only unsatisfied subgroups recursively, even without descriptions") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("reports only unsatisfied subgroups recursively, even without descriptions") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("reports only unsatisfied subgroups recursively, even without descriptions") uses 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-optional-chaining (#542): test("reports only unsatisfied subgroups recursively, even without descriptions") handles optional failure?.requirements; failure?.message; requirements[0]?.allOf without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): test("reports only unsatisfied subgroups recursively, even without descriptions") copies or separates ...env while preserving existing object ownership; mutating source objects is not equivalent.
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
  expect(failure?.message).toContain("MISSING_KEY");
  expect(failure?.message).toContain(
    "ALTERNATIVE_A or ALTERNATIVE_B + ALTERNATIVE_C"
  );
  expect(failure?.message).not.toMatch(
    /SATISFIED|VERCEL_TOKEN|supplied-secret|nested-secret/u
  );
  expect(JSON.stringify(failure?.requirements)).not.toMatch(
    /supplied-secret|nested-secret/u
  );
  expect(requirements[0]?.allOf).toHaveLength(2);
  expect(() =>
    requireCredentials("grouped-feature", requirements, {
      ...env,
      ALTERNATIVE_A: "token",
      MISSING_KEY: "key",
      NODE_ENV: "test",
    })
  ).not.toThrow();
});
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers */
