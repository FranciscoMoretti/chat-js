"use client"

import * as React from "react"
import { cn } from "cn"

import { copyToClipboardWithMeta } from "@/components/create-preview/copy-clipboard"
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button"
import { usePresetCode } from "@/vendor/shadcn-create/hooks/use-design-system"

export function CopyPreset({ className }: React.ComponentProps<typeof Button>) {
  const presetCode = usePresetCode()
  const [hasCopied, setHasCopied] = React.useState(false)
  const label = hasCopied ? "Copied" : `--preset ${presetCode}`

  React.useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => setHasCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [hasCopied])

  const handleCopy = React.useCallback(async () => {
    const copied = await copyToClipboardWithMeta(`--preset ${presetCode}`, {
      name: "copy_preset_command",
      properties: {
        preset: presetCode,
      },
    })
    setHasCopied(copied)
  }, [presetCode])

  return (
    <Button
      variant="outline"
      onClick={handleCopy}
      title={label}
      className={cn(
        "touch-manipulation bg-transparent! px-2! py-0! text-sm! transition-none select-none hover:bg-muted! pointer-coarse:h-10!",
        className
      )}
    >
      <span className="block min-w-0 truncate">{label}</span>
    </Button>
  )
}
