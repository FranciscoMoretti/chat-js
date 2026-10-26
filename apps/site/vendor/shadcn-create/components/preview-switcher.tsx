"use client"

import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button"
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params"

const PREVIEW_ITEMS = [
  { label: "Chat", value: "preview-02" },
  { label: "New chat", value: "preview" },
  { label: "Tools", value: "preview-tools" },
]

export function PreviewSwitcher() {
  const [params, setParams] = useDesignSystemSearchParams()

  const isPreview =
    params.item === "preview" || params.item.startsWith("preview-")

  if (!isPreview) {
    return null
  }

  return (
    <div className="dark absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-xl bg-card/90 p-1 shadow-xl backdrop-blur-xl">
      {PREVIEW_ITEMS.map((item) => (
        <Button
          key={item.value}
          variant="ghost"
          size="sm"
          data-active={params.item === item.value}
          className="h-7 min-w-8 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
          onClick={() => setParams({ item: item.value })}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
}
