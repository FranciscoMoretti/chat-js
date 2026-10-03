/* oxlint-disable import/no-nodejs-modules  --
 * import/no-nodejs-modules (#529): This test harness requires import { readFileSync } from "node:fs";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
  getMigrationHistoryProblem,
  KNOWN_CHATJS_TABLE_NAMES,
} from "./migration-history";
/* oxlint-enable import/no-nodejs-modules */

const baseline = { createdAt: 2, hash: "eve" };
const next = { createdAt: 3, hash: "next" };

/* oxlint-disable max-lines-per-function, node/no-sync, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * max-lines-per-function (#510): describe("getMigrationHistoryProblem") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): describe("getMigrationHistoryProblem") derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * node/no-sync (#538): describe("getMigrationHistoryProblem") uses readFileSync( new URL("migrations/0000_eve_baseline.sql", import.meta.url), "utf-8"  within its synchronous fixture setup contract; asynchronous conversion changes its callers and lifecycle.
 * oxc/no-optional-chaining (#542): describe("getMigrationHistoryProblem") handles optional match.groups?.table without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): describe("getMigrationHistoryProblem") copies or separates ...baseline while preserving existing object ownership; mutating source objects is not equivalent.
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
