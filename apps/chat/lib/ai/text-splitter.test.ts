/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import assert from "node:assert/strict";; its Node runtime boundary deliberately permits these built-ins.
 */
import assert from "node:assert/strict";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { beforeEach, describe, it } from "vitest";
/* oxlint-enable sort-imports */

import { RecursiveCharacterTextSplitter } from "./text-splitter";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable init-declarations, max-lines-per-function, no-magic-numbers --
 * init-declarations (#507): describe("RecursiveCharacterTextSplitter") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): describe("RecursiveCharacterTextSplitter") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("RecursiveCharacterTextSplitter") uses 1000, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
describe("RecursiveCharacterTextSplitter", () => {
  let splitter: RecursiveCharacterTextSplitter;

  beforeEach(() => {
    splitter = new RecursiveCharacterTextSplitter({
      chunkOverlap: 10,
      chunkSize: 50,
    });
  });

  it("Should correctly split text by separators", () => {
    const text = "Hello world, this is a test of the recursive text splitter.";

    // Test with initial chunkSize
    assert.deepEqual(splitter.splitText(text), [
      "Hello world",
      "this is a test of the recursive text splitter",
    ]);

    // Test with updated chunkSize
    splitter.chunkSize = 100;
    assert.deepEqual(
      splitter.splitText(
        "Hello world, this is a test of the recursive text splitter. If I have a period, it should split along the period."
      ),
      [
        "Hello world, this is a test of the recursive text splitter",
        "If I have a period, it should split along the period.",
      ]
    );

    // Test with another updated chunkSize
    splitter.chunkSize = 110;
    assert.deepEqual(
      splitter.splitText(
        "Hello world, this is a test of the recursive text splitter. If I have a period, it should split along the period.\nOr, if there is a new line, it should prioritize splitting on new lines instead."
      ),
      [
        "Hello world, this is a test of the recursive text splitter",
        "If I have a period, it should split along the period.",
        "Or, if there is a new line, it should prioritize splitting on new lines instead.",
      ]
    );
  });

  it("Should handle empty string", () => {
    assert.deepEqual(splitter.splitText(""), []);
  });

  it("Should handle special characters and large texts", () => {
    const largeText = "A".repeat(1000);
    splitter.chunkSize = 200;
    assert.deepEqual(
      splitter.splitText(largeText),
      Array.from({ length: 5 }, () => "A".repeat(200))
    );

    const specialCharText = "Hello!@# world$%^ &*( this) is+ a-test";
    assert.deepEqual(splitter.splitText(specialCharText), [
      "Hello!@#",
      "world$%^",
      "&*( this)",
      "is+",
      "a-test",
    ]);
  });

  it("Should handle chunkSize equal to chunkOverlap", () => {
    splitter.chunkSize = 50;
    splitter.chunkOverlap = 50;
    assert.throws(
      () => splitter.splitText("Invalid configuration"),
      new Error("Cannot have chunkOverlap >= chunkSize")
    );
  });
});
/* oxlint-enable init-declarations, max-lines-per-function, no-magic-numbers */
