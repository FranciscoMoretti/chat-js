import { describe, expect, it } from "vitest";

import { resolvePreviewDatabaseEnvironment } from "./preview-environment";

const preview = {
  CHATJS_PREVIEW_DATABASE_URL:
    "postgres://preview:secret@ep-child-pooler.eu.neon.tech/neondb?sslmode=require",
  CHATJS_PREVIEW_DATABASE_URL_UNPOOLED:
    "postgres://preview:secret@ep-child.eu.neon.tech/neondb?sslmode=require",
  CHATJS_PREVIEW_NEON_PROJECT_ID: "preview-project",
  CHATJS_PREVIEW_PARENT_HOST: "ep-parent.eu.neon.tech",
  VERCEL: "1",
  VERCEL_ENV: "preview",
};

describe("isolated preview databases", () => {
  it("selects integration credentials ahead of inherited application credentials", () => {
    expect(
      resolvePreviewDatabaseEnvironment({
        ...preview,
        DATABASE_URL: "postgres://legacy/db",
      })
    ).toEqual({
      DATABASE_MIGRATION_URL: preview.CHATJS_PREVIEW_DATABASE_URL_UNPOOLED,
      DATABASE_URL: preview.CHATJS_PREVIEW_DATABASE_URL,
    });
  });

  it.each([
    { ...preview, VERCEL: "" },
    { ...preview, VERCEL_ENV: "production" },
    { ...preview, VERCEL_ENV: "development" },
    { VERCEL: "1", VERCEL_ENV: "preview" },
  ])(
    "leaves other deployments and unconfigured previews unchanged",
    (source) => {
      expect(resolvePreviewDatabaseEnvironment(source)).toBeUndefined();
    }
  );

  it.each([
    { ...preview, CHATJS_PREVIEW_DATABASE_URL: "" },
    { ...preview, CHATJS_PREVIEW_DATABASE_URL_UNPOOLED: "" },
    { ...preview, CHATJS_PREVIEW_PARENT_HOST: "" },
    { ...preview, CHATJS_PREVIEW_PARENT_HOST: "ep-child.eu.neon.tech" },
    { ...preview, CHATJS_PREVIEW_DATABASE_URL_UNPOOLED: "not-a-url" },
    {
      ...preview,
      CHATJS_PREVIEW_DATABASE_URL_UNPOOLED: preview.CHATJS_PREVIEW_DATABASE_URL,
    },
    {
      ...preview,
      CHATJS_PREVIEW_DATABASE_URL:
        "postgres://preview:secret@ep-other.eu.neon.tech/neondb",
    },
    {
      ...preview,
      CHATJS_PREVIEW_DATABASE_URL:
        "postgres://preview:secret@ep-child.eu.neon.tech/another-db",
    },
  ])(
    "refuses incomplete, parent, pooled migration, and mismatched connections",
    (source) => {
      expect(() => resolvePreviewDatabaseEnvironment(source)).toThrow(
        "Preview database"
      );
    }
  );
});
