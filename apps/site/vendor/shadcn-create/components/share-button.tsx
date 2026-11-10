"use client"

import * as React from "react"
import { Share03Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { encodeInstallationQuery } from "@/components/create-model"
import { useInstallation } from "@/components/create-preview/installation-provider"
import { copyToClipboardWithMeta } from "@/components/create-preview/copy-clipboard"
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button"
import { usePresetCode } from "@/vendor/shadcn-create/hooks/use-design-system"
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params"

export function ShareButton() {
  const [params] = useDesignSystemSearchParams()
  const presetCode = usePresetCode()
  const { installation } = useInstallation()
  const [hasCopied, setHasCopied] = React.useState(false)

  const getShareUrl = () => {
    const url = new URL(window.location.href)
    url.searchParams.set("preset", presetCode)
    // Only known public setup fields are shared; provider credentials never belong in links.
    const allowed = ["preset", "base", "item", "rtl", "pointer", "size", "storage-config", "app", "installation"]
    for (const key of [...url.searchParams.keys()]) if (!allowed.includes(key)) url.searchParams.delete(key)
    if (installation) {
      for (const [key, value] of Object.entries(encodeInstallationQuery(installation))) {
        if (value === null) url.searchParams.delete(key)
        else url.searchParams.set(key, value)
      }
    }
    return url.toString()
  }

  React.useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => setHasCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [hasCopied])

  const handleCopy = React.useCallback(async () => {
    const shareUrl = getShareUrl()
    const copied = await copyToClipboardWithMeta(shareUrl, {
      name: "copy_create_share_url",
      properties: {
        url: shareUrl,
      },
    })
    setHasCopied(copied)
  }, [params, presetCode, installation])

  return (
    <Button variant="outline" className="hidden sm:flex" disabled={!installation} onClick={handleCopy}>
      {hasCopied ? (
        <HugeiconsIcon
          icon={Tick02Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
      ) : (
        <HugeiconsIcon
          icon={Share03Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
      )}
      Share
    </Button>
  )
}
