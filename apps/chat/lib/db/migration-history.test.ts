import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
  getMigrationHistoryProblem,
  KNOWN_CHATJS_TABLE_NAMES,
} from "./migration-history";

const baseline = { createdAt: 2, hash: "eve" };
const next = { createdAt: 3, hash: "next" };

describe("getMigrationHistoryProblem", () => {
  test("recognizes every baseline table and every retired table", () => {
    const baselineSql = readFileSync(
      new URL("migrations/0000_eve_baseline.sql", import.meta.url),
      "utf-8"
    );
    const baselineTables = [
      ...baselineSql.matchAll(/^CREATE TABLE "(?<table>[^"]+)"/gmu),
    ].flatMap((match) => (match.groups?.table ? [match.groups.table] : []));
    expect(KNOWN_CHATJS_TABLE_NAMES).toEqual(
      expect.arrayContaining(baselineTables)
    );
    expect(KNOWN_CHATJS_TABLE_NAMES).toEqual(
      expect.arrayContaining([
        "Chat",
        "Document",
        "GenerationCancellation",
        "Message",
        "Part",
        "Suggestion",
        "Vote",
      ])
    );
  });

  test("allows an empty database and the exact EVE baseline", () => {
    expect(
      getMigrationHistoryProblem({
        applied: [],
        available: [baseline],
        hasChatJsTables: false,
      })
    ).toBeNull();
    expect(
      getMigrationHistoryProblem({
        applied: [baseline],
        available: [baseline],
        hasChatJsTables: true,
      })
    ).toBeNull();
  });

  test("rejects untracked and legacy schemas", () => {
    expect(
      getMigrationHistoryProblem({
        applied: [],
        available: [baseline],
        hasChatJsTables: true,
      })
    ).toMatch(/no EVE baseline/u);
    expect(
      getMigrationHistoryProblem({
        applied: [{ createdAt: 1, hash: "legacy" }],
        available: [baseline],
        hasChatJsTables: true,
      })
    ).toMatch(/before the EVE-only baseline/u);
  });

  test("rejects an altered baseline record", () => {
    expect(
      getMigrationHistoryProblem({
        applied: [{ ...baseline, hash: "modified" }],
        available: [baseline],
        hasChatJsTables: true,
      })
    ).toMatch(/before the EVE-only baseline/u);
  });

  test("allows an applied prefix when newer migrations are available", () => {
    expect(
      getMigrationHistoryProblem({
        applied: [baseline],
        available: [baseline, next],
        hasChatJsTables: true,
      })
    ).toBeNull();
    expect(
      getMigrationHistoryProblem({
        applied: [baseline, next],
        available: [baseline, next],
        hasChatJsTables: true,
      })
    ).toBeNull();
  });

  test("rejects migrations newer than the checked-out application", () => {
    expect(
      getMigrationHistoryProblem({
        applied: [baseline, next],
        available: [baseline],
        hasChatJsTables: true,
      })
    ).toMatch(/unknown/u);
  });
});
