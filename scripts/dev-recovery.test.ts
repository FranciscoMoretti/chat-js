import { expect, test } from "bun:test";

import { shouldRestartAfterReadinessFailures } from "./dev-recovery";

const MINIMUM_PROBES = 0;
const FEW_PROBES = 1;
const SEVERAL_PROBES = 3;
const MANY_PROBES = 7;
const REPEATED_PROBES = 8;
const COLD_START_PROBES = 10;
const EXTENDED_COLD_START_PROBES = 20;
const LONG_COLD_START_PROBES = 30;
const LATE_COLD_START_PROBES = 40;
const BRIEF_FAILURE_WINDOW_MS = 48_000;
const LONG_ACTIVE_REQUEST_WINDOW_MS = 300_000;
const JUST_BEFORE_READY_GRACE_MS = 119_999;
const READY_GRACE_MS = 120_000;
const JUST_BEFORE_COLD_START_GRACE_MS = 179_999;
const COLD_START_GRACE_MS = 180_000;
const EXTENDED_COLD_START_GRACE_MS = 360_000;
const JUST_BEFORE_EXTENDED_GRACE_LIMIT_MS = 599_999;
const EXTENDED_GRACE_LIMIT_MS = 600_000;
const FIRST_FAILED_START = 1;
const SECOND_FAILED_START = 2;
const MANY_FAILED_STARTS = 100;

test("brief failed probes during compilation do not interrupt active requests", () => {
  expect(
    shouldRestartAfterReadinessFailures(
      SEVERAL_PROBES,
      BRIEF_FAILURE_WINDOW_MS,
      true
    )
  ).toBe(false);
  expect(
    shouldRestartAfterReadinessFailures(
      MANY_PROBES,
      JUST_BEFORE_READY_GRACE_MS,
      true
    )
  ).toBe(false);
});

test("sustained failure still recovers the runtime after multiple observations", () => {
  expect(
    shouldRestartAfterReadinessFailures(MANY_PROBES, READY_GRACE_MS, true)
  ).toBe(true);
  expect(
    shouldRestartAfterReadinessFailures(
      FEW_PROBES,
      LONG_ACTIVE_REQUEST_WINDOW_MS,
      true
    )
  ).toBe(false);
  expect(
    shouldRestartAfterReadinessFailures(
      MINIMUM_PROBES,
      LONG_ACTIVE_REQUEST_WINDOW_MS,
      true
    )
  ).toBe(false);
});

test("cold startup receives its full compilation grace period", () => {
  expect(
    shouldRestartAfterReadinessFailures(
      COLD_START_PROBES,
      JUST_BEFORE_COLD_START_GRACE_MS,
      false
    )
  ).toBe(false);
  expect(
    shouldRestartAfterReadinessFailures(
      COLD_START_PROBES,
      COLD_START_GRACE_MS,
      false
    )
  ).toBe(true);
});

test("repeated cold-start failures get a bounded longer chance to finish compilation", () => {
  expect(
    shouldRestartAfterReadinessFailures(
      EXTENDED_COLD_START_PROBES,
      COLD_START_GRACE_MS,
      false,
      FIRST_FAILED_START
    )
  ).toBe(false);
  expect(
    shouldRestartAfterReadinessFailures(
      LONG_COLD_START_PROBES,
      EXTENDED_COLD_START_GRACE_MS,
      false,
      FIRST_FAILED_START
    )
  ).toBe(true);
  expect(
    shouldRestartAfterReadinessFailures(
      LATE_COLD_START_PROBES,
      JUST_BEFORE_EXTENDED_GRACE_LIMIT_MS,
      false,
      SECOND_FAILED_START
    )
  ).toBe(false);
  expect(
    shouldRestartAfterReadinessFailures(
      LATE_COLD_START_PROBES,
      EXTENDED_GRACE_LIMIT_MS,
      false,
      MANY_FAILED_STARTS
    )
  ).toBe(true);
  expect(
    shouldRestartAfterReadinessFailures(
      REPEATED_PROBES,
      READY_GRACE_MS,
      true,
      MANY_FAILED_STARTS
    )
  ).toBe(true);
});
