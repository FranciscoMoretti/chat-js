import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import icons from "./capability-icons.json";
import { capabilityBrandIcon } from "./capability-visuals";

void test("every curated capability references a shipped local asset", () => {
  for (const [id, file] of Object.entries(icons)) {
    assert.match(file, /^[a-z0-9.-]+\.(?:svg|png|ico)$/u);
    assert.ok(
      existsSync(
        new URL(`../../public/capability-icons/${file}`, import.meta.url)
      ),
      id
    );
  }
  assert.equal(
    capabilityBrandIcon("channel/linear"),
    capabilityBrandIcon("connection/linear")
  );
});

void test("unknown registry identities cannot borrow a known service's logo", () => {
  assert.equal(capabilityBrandIcon("@unrelated/slack"), undefined);
  assert.equal(capabilityBrandIcon("connection/future-service"), undefined);
  assert.equal(capabilityBrandIcon("constructor"), undefined);
});
