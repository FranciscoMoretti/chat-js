import { expect, it } from "vitest";

import {
  consumeComparisonDraftIntent,
  saveComparisonDraftIntent,
} from "./comparison-draft-intent";

it("retains explicit composer intent through recovery and never infers it from message equality", () => {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
  saveComparisonDraftIntent(
    storage,
    "owner",
    "chat",
    "composer-operation",
    true
  );
  expect(
    consumeComparisonDraftIntent(
      storage,
      "other-owner",
      "chat",
      "composer-operation"
    )
  ).toBe(false);
  expect(
    consumeComparisonDraftIntent(storage, "owner", "chat", "composer-operation")
  ).toBe(true);
  expect(
    consumeComparisonDraftIntent(storage, "owner", "chat", "composer-operation")
  ).toBe(false);
  saveComparisonDraftIntent(storage, "owner", "chat", "older-operation", true);
  saveComparisonDraftIntent(
    storage,
    "owner",
    "chat",
    "suggestion-operation",
    false
  );
  expect(
    consumeComparisonDraftIntent(
      storage,
      "owner",
      "chat",
      "suggestion-operation"
    )
  ).toBe(false);
});
