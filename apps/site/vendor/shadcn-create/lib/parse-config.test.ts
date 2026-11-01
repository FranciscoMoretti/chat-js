import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { parseDesignSystemConfig } from "./parse-config"

describe("parseDesignSystemConfig", () => {
  it("defaults pointer to false when omitted", () => {
    const result = parseDesignSystemConfig(
      new URLSearchParams(
        "base=base&style=sera&baseColor=taupe&theme=taupe&iconLibrary=lucide&font=noto-sans&rtl=false&menuAccent=subtle&menuColor=default&radius=default&fontHeading=playfair-display&template=vite&track=1"
      )
    )

    assert.ok(result.success)

    assert.equal(result.data.pointer, false)
  })

  it("parses pointer=true", () => {
    const result = parseDesignSystemConfig(
      new URLSearchParams(
        "base=base&style=sera&baseColor=taupe&theme=taupe&iconLibrary=lucide&font=noto-sans&rtl=false&pointer=true&menuAccent=subtle&menuColor=default&radius=default&fontHeading=playfair-display&template=vite&track=1"
      )
    )

    assert.ok(result.success)

    assert.equal(result.data.pointer, true)
  })

  it("defaults missing chartColor from the selected theme", () => {
    const result = parseDesignSystemConfig(
      new URLSearchParams(
        "base=base&style=sera&baseColor=taupe&theme=taupe&iconLibrary=lucide&font=noto-sans&rtl=false&menuAccent=subtle&menuColor=default&radius=default&fontHeading=playfair-display&template=vite&track=1"
      )
    )

    assert.ok(result.success)

    assert.equal(result.data.chartColor, "taupe")
  })

  it("honors explicit fontHeading and chartColor overrides when a preset is present", () => {
    const result = parseDesignSystemConfig(
      new URLSearchParams(
        "preset=a0&fontHeading=playfair-display&chartColor=emerald"
      )
    )

    assert.ok(result.success)

    assert.equal(result.data.fontHeading, "playfair-display")
    assert.equal(result.data.chartColor, "emerald")
  })

  it("keeps pointer outside preset decoding", () => {
    const result = parseDesignSystemConfig(
      new URLSearchParams("preset=a0&pointer=true")
    )

    assert.ok(result.success)

    assert.equal(result.data.pointer, true)
  })
})
