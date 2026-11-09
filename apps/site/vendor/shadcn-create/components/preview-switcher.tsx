"use client"

import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button"
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params"

const PREVIEW_ITEMS = [
  { label: "Chat", value: "preview-02" },
  { label: "New chat", value: "preview" },
  { label: "Tools", value: "preview-tools" },
]

export function PreviewSwitcher({ guestEnabled, guest, onGuestChange }: {
  readonly guestEnabled: boolean
  readonly guest: boolean
  readonly onGuestChange: (guest: boolean) => void
}) {
  const [params, setParams] = useDesignSystemSearchParams()

  const isPreview =
    params.item === "preview" || params.item.startsWith("preview-")

  if (!isPreview) {
    return null
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-1 border-b bg-background px-2 py-2 sm:px-3">
      {guestEnabled ? (
        <div role="group" aria-label="Preview identity" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {[{ label: "Signed in", value: false }, { label: "Guest", value: true }].map(({ label, value }) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              aria-pressed={guest === value}
              className="h-6 px-1.5 text-xs aria-pressed:bg-background aria-pressed:text-foreground sm:px-2"
              onClick={() => onGuestChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      ) : (
        <span className="text-xs font-medium text-muted-foreground">Preview scene</span>
      )}
      <div role="group" aria-label="Preview scene" className={guest ? "invisible flex items-center gap-1" : "flex items-center gap-1"}>
      {PREVIEW_ITEMS.map((item) => (
        <Button
          key={item.value}
          variant="ghost"
          size="sm"
          aria-pressed={params.item === item.value}
          data-active={params.item === item.value}
          className="h-7 min-w-8 cursor-pointer rounded-lg px-1.5 text-xs sm:px-2.5 font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
          onClick={() => setParams({ item: item.value })}
        >
          {item.label}
        </Button>
      ))}
      </div>
    </div>
  )
}
