"use client";

// Same native icon-placeholder contract; limit bundles to the four icons used
// by this Create shell instead of shipping the whole upstream icon explorer.
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconChevronRight,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import {
  Tick02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowRight01Icon,
  Search01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckIcon as PhCheck,
  CaretRightIcon,
  CaretDownIcon,
  CaretUpIcon,
  MagnifyingGlassIcon,
  XIcon as PhX,
} from "@phosphor-icons/react";
import {
  RiCheckLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiArrowRightSLine,
  RiSearchLine,
  RiCloseLine,
} from "@remixicon/react";
import type { ComponentProps } from "react";
import type { IconLibraryName } from "shadcn/icons";
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params";

const lucideIcons = {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
};
const tablerIcons = {
  ChevronDownIcon: IconChevronDown,
  ChevronUpIcon: IconChevronUp,
  CheckIcon: IconCheck,
  ChevronRightIcon: IconChevronRight,
  SearchIcon: IconSearch,
  XIcon: IconX,
};
const hugeIcons = {
  ChevronDownIcon: ArrowDown01Icon,
  ChevronUpIcon: ArrowUp01Icon,
  CheckIcon: Tick02Icon,
  ChevronRightIcon: ArrowRight01Icon,
  SearchIcon: Search01Icon,
  XIcon: Cancel01Icon,
};
const phosphorIcons = {
  ChevronDownIcon: CaretDownIcon,
  ChevronUpIcon: CaretUpIcon,
  CheckIcon: PhCheck,
  ChevronRightIcon: CaretRightIcon,
  SearchIcon: MagnifyingGlassIcon,
  XIcon: PhX,
};
const remixIcons = {
  ChevronDownIcon: RiArrowDownSLine,
  ChevronUpIcon: RiArrowUpSLine,
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
    [
      "CheckIcon",
      "ChevronDownIcon",
      "ChevronUpIcon",
      "ChevronRightIcon",
      "SearchIcon",
      "XIcon",
    ] as const
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
