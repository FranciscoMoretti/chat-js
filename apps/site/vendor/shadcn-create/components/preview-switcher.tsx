"use client"

import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button"
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params"

const PREVIEW_ITEMS = [
  { label: "Chat", value: "preview-02" },
  { label: "New chat", value: "preview" },
  { label: "Tool examples", value: "preview-tools" },
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
    <div className="absolute inset-x-2 bottom-2 z-20 flex shrink-0 flex-wrap items-center justify-end gap-1 md:relative md:inset-auto md:justify-between md:border-b md:bg-background md:px-3 md:py-2">
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
        <span className="hidden text-xs font-medium text-muted-foreground md:inline">Preview scene</span>
      )}
      <div role="group" aria-label="Preview scene" className={`${guest ? "invisible " : ""}flex items-center gap-1 rounded-xl bg-card/90 p-1 shadow-lg backdrop-blur-xl md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none`}>
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
