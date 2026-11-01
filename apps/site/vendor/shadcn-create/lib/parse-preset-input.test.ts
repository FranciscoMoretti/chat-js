import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { parsePresetInput } from "./parse-preset-input"

describe("parsePresetInput", () => {
  it("accepts a raw preset code", () => {
    assert.equal(parsePresetInput("b0"), "b0")
  })

  it("accepts a --preset flag", () => {
    assert.equal(parsePresetInput(" --preset b0 "), "b0")
  })

  it("rejects invalid preset input", () => {
    assert.equal(parsePresetInput("open sesame"), null)
  })
})
