"use client";

// Same native icon-placeholder contract; limit bundles to the four icons used
// by this Create shell instead of shipping the whole upstream icon explorer.
import { CheckIcon, ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import {
  IconCheck,
  IconChevronRight,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import {
  Tick02Icon,
  ArrowRight01Icon,
  Search01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckIcon as PhCheck,
  CaretRightIcon,
  MagnifyingGlassIcon,
  XIcon as PhX,
} from "@phosphor-icons/react";
import {
  RiCheckLine,
  RiArrowRightSLine,
  RiSearchLine,
  RiCloseLine,
} from "@remixicon/react";
import type { ComponentProps } from "react";
import type { IconLibraryName } from "shadcn/icons";
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params";

const lucideIcons = { CheckIcon, ChevronRightIcon, SearchIcon, XIcon };
const tablerIcons = {
  CheckIcon: IconCheck,
  ChevronRightIcon: IconChevronRight,
  SearchIcon: IconSearch,
  XIcon: IconX,
};
const hugeIcons = {
  CheckIcon: Tick02Icon,
  ChevronRightIcon: ArrowRight01Icon,
  SearchIcon: Search01Icon,
  XIcon: Cancel01Icon,
};
const phosphorIcons = {
  CheckIcon: PhCheck,
  ChevronRightIcon: CaretRightIcon,
  SearchIcon: MagnifyingGlassIcon,
  XIcon: PhX,
};
const remixIcons = {
  CheckIcon: RiCheckLine,
  ChevronRightIcon: RiArrowRightSLine,
  SearchIcon: RiSearchLine,
  XIcon: RiCloseLine,
};
const iconSets = {
  lucide: lucideIcons,
  tabler: tablerIcons,
  phosphor: phosphorIcons,
  remixicon: remixIcons,
};
export const IconPlaceholder = ({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  children: _children,
  strokeWidth,
  ...props
}: Record<IconLibraryName, string> & ComponentProps<"svg">) => {
  const [{ iconLibrary }] = useDesignSystemSearchParams();
  const name = (
    ["CheckIcon", "ChevronRightIcon", "SearchIcon", "XIcon"] as const
  ).find((value) => value === lucide);
  if (!name) {
    return null;
  }
  if (iconLibrary === "hugeicons") {
    return (
      <HugeiconsIcon
        icon={hugeIcons[name]}
        strokeWidth={Number(strokeWidth) || 2}
        {...props}
      />
    );
  }
  const Icon = iconSets[iconLibrary][name];
  return <Icon {...props} />;
};
