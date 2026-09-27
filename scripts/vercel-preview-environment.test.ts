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
