import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { DEFAULT_CONFIG } from "@/vendor/shadcn-create/registry/config"

import { buildPresetUrlUpdate } from "./search-params"

describe("buildPresetUrlUpdate", () => {
  it("encodes design system params into preset and clears individual keys", () => {
    const update = buildPresetUrlUpdate({
      ...DEFAULT_CONFIG,
      preset: "b0",
      template: "next",
      item: "preview-02",
      size: 100,
      custom: false,
    })

    assert.equal(typeof update.preset, "string")
    assert.equal(update.style, null)
    assert.equal(update.theme, null)
    assert.equal(update.baseColor, null)
  })

  it("preserves template when syncing preset from ?template=start", () => {
    const update = buildPresetUrlUpdate({
      ...DEFAULT_CONFIG,
      preset: "b0",
      template: "start",
      item: "preview-02",
      size: 100,
      custom: false,
    })

    assert.equal(update.template, "start")
    assert.equal(typeof update.preset, "string")
  })

  it("applies non-design-system updates from resolvedUpdates", () => {
    const update = buildPresetUrlUpdate(
      {
        ...DEFAULT_CONFIG,
        preset: "b0",
        template: "next",
        item: "preview-02",
        size: 100,
        custom: false,
      },
      { template: "vite" }
    )

    assert.equal(update.template, "vite")
  })
})
