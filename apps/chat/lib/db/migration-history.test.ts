/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { readFileSync } from "node:fs";; its Node runtime boundary deliberately permits these built-ins.
 */
import { readFileSync } from "node:fs";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describe, expect, test } from "vitest";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  KNOWN_CHATJS_TABLE_NAMES,
  getMigrationHistoryProblem,
} from "./migration-history";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

const baseline = { createdAt: 2, hash: "eve" };
const next = { createdAt: 3, hash: "next" };

/* oxlint-disable max-lines-per-function, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): describe("getMigrationHistoryProblem") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * node/no-sync (#538): describe("getMigrationHistoryProblem") uses readFileSync( new URL("migrations/0000_eve_baseline.sql", import.meta.url), "utf-8"  within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/prefer-readonly-parameter-types (#565): describe("getMigrationHistoryProblem") accepts match; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): describe("getMigrationHistoryProblem") intentionally keeps the existing falsy-value behavior of match.groups?.table; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing baseline own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable max-lines-per-function, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
