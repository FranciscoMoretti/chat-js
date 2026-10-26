"use client"

import { getPresetCode } from "@/vendor/shadcn-create/lib/preset-code"
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params"

// Returns the canonical preset code derived from the current search params.
export function usePresetCode() {
  const [params] = useDesignSystemSearchParams()

  return getPresetCode(params)
}
