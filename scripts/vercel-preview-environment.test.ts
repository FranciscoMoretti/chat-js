import { describe, expect, it } from "bun:test";

import { resolveMaintainerPreviewDatabase } from "./vercel-preview-environment";

const preview = {
  CHATJS_PREVIEW_NEON_PROJECT_ID: "preview-project",
  CHATJS_PREVIEW_PARENT_HOST: "ep-parent.eu.neon.tech",
  DATABASE_URL:
    "postgres://preview:secret@ep-child-pooler.eu.neon.tech/neondb?sslmode=require",
  DATABASE_URL_UNPOOLED:
    "postgres://preview:secret@ep-child.eu.neon.tech/neondb?sslmode=require",
  NEON_PROJECT_ID: "preview-project",
  VERCEL: "1",
  VERCEL_ENV: "preview",
};

/* oxlint-disable oxc/no-rest-spread-properties -- isolated preview databases: The scenario copies fixture inputs so later assertions retain their original values. */
describe("isolated preview databases", () => {
  it("uses the standard runtime URL and direct migration connection", () => {
    expect(
      resolveMaintainerPreviewDatabase({
        ...preview,
      })
    ).toEqual({
      DATABASE_MIGRATION_URL: preview.DATABASE_URL_UNPOOLED,
      DATABASE_URL: preview.DATABASE_URL,
    });
  });

  it.each([
    { ...preview, VERCEL: "" },
    { ...preview, VERCEL_ENV: "production" },
    { ...preview, VERCEL_ENV: "development" },
  ])("leaves non-preview deployments unchanged", (source) => {
    expect(resolveMaintainerPreviewDatabase(source)).toBeUndefined();
  });

  it.each([
    { VERCEL: "1", VERCEL_ENV: "preview" },
    { ...preview, NEON_PROJECT_ID: "another-project" },
    { ...preview, DATABASE_URL: "" },
    { ...preview, DATABASE_URL_UNPOOLED: "" },
    { ...preview, CHATJS_PREVIEW_PARENT_HOST: "" },
    { ...preview, CHATJS_PREVIEW_PARENT_HOST: "ep-child.eu.neon.tech" },
    { ...preview, DATABASE_URL_UNPOOLED: "not-a-url" },
    {
      ...preview,
      DATABASE_URL_UNPOOLED: preview.DATABASE_URL,
    },
    {
      ...preview,
      DATABASE_URL: "postgres://preview:secret@ep-other.eu.neon.tech/neondb",
    },
    {
      ...preview,
      DATABASE_URL:
        "postgres://preview:secret@ep-child.eu.neon.tech/another-db",
    },
  ])(
    "refuses incomplete, parent, pooled migration, and mismatched connections",
    (source) => {
      expect(() => resolveMaintainerPreviewDatabase(source)).toThrow(
        "Preview database"
      );
    }
  );
});
/* oxlint-enable oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-rest-spread-properties -- rejects the parent regardless of hostname spelling: %s: The scenario copies fixture inputs so later assertions retain their original values. */
it.each([
  "EP-CHILD.EU.NEON.TECH",
  "ep-child.eu.neon.tech.",
  "EP-CHILD-POOLER.EU.NEON.TECH.",
])("rejects the parent regardless of hostname spelling: %s", (parent) => {
  expect(() =>
    resolveMaintainerPreviewDatabase({
      ...preview,
      CHATJS_PREVIEW_PARENT_HOST: parent,
    })
  ).toThrow("not its parent");
});
/* oxlint-enable oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-rest-spread-properties -- rejects malformed parent configuration: %s: The scenario copies fixture inputs so later assertions retain their original values. */
it.each([
  "https://ep-parent.eu.neon.tech",
  "ep-parent.eu.neon.tech/path",
  "ep-parent.eu.neon.tech:5432",
  "user@ep-parent.eu.neon.tech",
  "ep-parent.eu.neon.tech?x=1",
  "not a hostname",
])("rejects malformed parent configuration: %s", (parent) => {
  expect(() =>
    resolveMaintainerPreviewDatabase({
      ...preview,
      CHATJS_PREVIEW_PARENT_HOST: parent,
    })
  ).toThrow("parent must be a Neon hostname");
});
/* oxlint-enable oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-rest-spread-properties -- normalizes connection hostnames too when rejecting the parent: The scenario copies fixture inputs so later assertions retain their original values. */
it("normalizes connection hostnames too when rejecting the parent", () => {
  expect(() =>
    resolveMaintainerPreviewDatabase({
      ...preview,
      CHATJS_PREVIEW_PARENT_HOST: "ep-child.eu.neon.tech",
      DATABASE_URL: preview.DATABASE_URL.replace(
        "ep-child-pooler.eu.neon.tech",
        "EP-CHILD-POOLER.EU.NEON.TECH."
      ),
      DATABASE_URL_UNPOOLED: preview.DATABASE_URL_UNPOOLED.replace(
        "ep-child.eu.neon.tech",
        "EP-CHILD.EU.NEON.TECH."
      ),
    })
  ).toThrow("not its parent");
});
/* oxlint-enable oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-rest-spread-properties -- rejects mismatched or invalid connection authorities: The scenario copies fixture inputs so later assertions retain their original values. */
it.each([
  preview.DATABASE_URL_UNPOOLED.replace(":secret@", ":different@"),
  preview.DATABASE_URL_UNPOOLED.replace("/neondb", ":6543/neondb"),
  preview.DATABASE_URL_UNPOOLED.replace("preview:", "someone-else:"),
  preview.DATABASE_URL_UNPOOLED.replace(":secret@", ":%invalid@"),
])("rejects mismatched or invalid connection authorities", (direct) => {
  expect(() =>
    resolveMaintainerPreviewDatabase({
      ...preview,
      DATABASE_URL_UNPOOLED: direct,
    })
  ).toThrow("Preview database");
});
/* oxlint-enable oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-optional-chaining -- accepts equivalent default ports and percent-encoded credentials: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
/* oxlint-disable oxc/no-rest-spread-properties -- accepts equivalent default ports and percent-encoded credentials: The scenario copies fixture inputs so later assertions retain their original values. */
it("accepts equivalent default ports and percent-encoded credentials", () => {
  const direct = preview.DATABASE_URL_UNPOOLED.replace(
    "preview:secret",
    "%70review:%73ecret"
  ).replace("/neondb", ":5432/neondb");
  expect(
    resolveMaintainerPreviewDatabase({
      ...preview,
      DATABASE_URL_UNPOOLED: direct,
    })?.DATABASE_MIGRATION_URL
  ).toBe(direct);
});
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-optional-chaining */
