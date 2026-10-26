import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { resolvePresetOverrides } from "./preset-query"

describe("resolvePresetOverrides", () => {
  it("prefers explicit fontHeading and chartColor query params", () => {
    const overrides = resolvePresetOverrides(
      new URLSearchParams("fontHeading=playfair-display&chartColor=emerald"),
      {
        theme: "neutral",
        chartColor: "blue",
        fontHeading: "inherit",
      }
    )

    assert.deepEqual(overrides, {
      fontHeading: "playfair-display",
      chartColor: "emerald",
    })
  })

  it("falls back to decoded preset values when no overrides are present", () => {
    const overrides = resolvePresetOverrides(new URLSearchParams(), {
      theme: "neutral",
      chartColor: "blue",
      fontHeading: "inherit",
    })

    assert.deepEqual(overrides, {
      fontHeading: "inherit",
      chartColor: "blue",
    })
  })
})
