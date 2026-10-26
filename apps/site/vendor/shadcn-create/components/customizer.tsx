"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { type RegistryItem } from "shadcn/schema"

import { useIsMobile } from "@/vendor/shadcn-create/hooks/use-mobile"
import { getThemesForBaseColor, STYLES } from "@/vendor/shadcn-create/registry/config"
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/vendor/shadcn-create/styles/base-nova/ui/card"
import { FieldGroup, FieldSeparator } from "@/vendor/shadcn-create/styles/base-nova/ui/field"
import { MenuAccentPicker } from "@/vendor/shadcn-create/components/accent-picker"
import { ActionMenu } from "@/vendor/shadcn-create/components/action-menu"
import { BaseColorPicker } from "@/vendor/shadcn-create/components/base-color-picker"
import { BasePicker } from "@/vendor/shadcn-create/components/base-picker"
import { ChartColorPicker } from "@/vendor/shadcn-create/components/chart-color-picker"
import { CopyPreset } from "@/vendor/shadcn-create/components/copy-preset"
import { FontPicker } from "@/vendor/shadcn-create/components/font-picker"
import { IconLibraryPicker } from "@/vendor/shadcn-create/components/icon-library-picker"
import { MainMenu } from "@/vendor/shadcn-create/components/main-menu"
import { MenuColorPicker } from "@/vendor/shadcn-create/components/menu-picker"
import { OpenPreset } from "@/vendor/shadcn-create/components/open-preset"
import { RadiusPicker } from "@/vendor/shadcn-create/components/radius-picker"
import { RandomButton } from "@/vendor/shadcn-create/components/random-button"
import { ResetDialog } from "@/vendor/shadcn-create/components/reset-button"
import { StylePicker } from "@/vendor/shadcn-create/components/style-picker"
import { ThemePicker } from "@/vendor/shadcn-create/components/theme-picker"
import { FONT_HEADING_OPTIONS, FONTS } from "@/vendor/shadcn-create/lib/fonts"
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params"

// Only visible when user clicks "Create Project". Rendered client-only to
// avoid a useId hydration mismatch on the Base UI dialog trigger. The loading
// placeholder mirrors the trigger button exactly so there is no layout shift.
const ProjectForm = dynamic(
  () =>
    import("@/components/create-preview/project-form").then(
      (m) => m.ProjectForm
    ),
  {
    ssr: false,
    loading: () => (
      <Button disabled aria-hidden>
        Get Code
      </Button>
    ),
  }
)

export function Customizer({
  itemsByBase,
}: {
  itemsByBase: Record<string, Pick<RegistryItem, "name" | "title" | "type">[]>
}) {
  const [params] = useDesignSystemSearchParams()
  const isMobile = useIsMobile()
  const anchorRef = React.useRef<HTMLDivElement | null>(null)

  const availableThemes = React.useMemo(
    () => getThemesForBaseColor(params.baseColor),
    [params.baseColor]
  )

  return (
    <Card
      className="dark top-24 right-12 isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)"
      ref={anchorRef}
      size="sm"
    >
      <CardHeader className="hidden items-center justify-between gap-2 border-b group-data-reversed/layout:flex-row-reverse md:flex">
        <MainMenu />
      </CardHeader>
      <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden md:overflow-y-auto">
        <FieldGroup className="flex-row gap-2.5 py-px **:data-[slot=field-separator]:-mx-4 **:data-[slot=field-separator]:w-auto md:flex-col md:gap-3.25">
          <StylePicker
            styles={STYLES}
            isMobile={isMobile}
            anchorRef={anchorRef}
          />
          <FieldSeparator className="hidden md:block" />
          <BaseColorPicker isMobile={isMobile} anchorRef={anchorRef} />
          <ThemePicker
            themes={availableThemes}
            isMobile={isMobile}
            anchorRef={anchorRef}
          />
          <ChartColorPicker isMobile={isMobile} anchorRef={anchorRef} />
          <FieldSeparator className="hidden md:block" />
          <FontPicker
            label="Heading"
            param="fontHeading"
            fonts={FONT_HEADING_OPTIONS}
            isMobile={isMobile}
            anchorRef={anchorRef}
          />
          <FontPicker
            label="Font"
            param="font"
            fonts={FONTS}
            isMobile={isMobile}
            anchorRef={anchorRef}
          />
          <FieldSeparator className="hidden md:block" />
          <IconLibraryPicker isMobile={isMobile} anchorRef={anchorRef} />
          <RadiusPicker isMobile={isMobile} anchorRef={anchorRef} />
          <FieldSeparator className="hidden md:block" />
          <MenuColorPicker isMobile={isMobile} anchorRef={anchorRef} />
          <MenuAccentPicker isMobile={isMobile} anchorRef={anchorRef} />
          {isMobile && <BasePicker isMobile={isMobile} anchorRef={anchorRef} />}
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex min-w-0 gap-2 md:flex-col md:rounded-b-none md:**:[button,a]:w-full">
        <CopyPreset className="min-w-0 flex-1 md:flex-none" />
        <OpenPreset
          className="max-w-20 min-w-0 flex-1 sm:max-w-none md:flex-none"
          label={isMobile ? "Open" : "Open Preset"}
        />
        <RandomButton className="max-w-20 min-w-0 flex-1 sm:max-w-none md:flex-none" />
        <ActionMenu itemsByBase={itemsByBase} />
        <ResetDialog />
      </CardFooter>
      <CardFooter className="-mt-3 hidden min-w-0 gap-2 md:flex md:flex-col md:**:[button,a]:w-full">
        <ProjectForm />
      </CardFooter>
    </Card>
  )
}
