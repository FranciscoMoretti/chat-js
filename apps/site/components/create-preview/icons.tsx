"use client";

import { createContext, useContext } from "react";
import type { ComponentProps } from "react";
import type { PresetConfig } from "shadcn/preset";
import {
  ArrowUp,
  Loader2,
  ArrowDown,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Copy,
  FileText,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  IconCopy,
  IconLoader,
  IconSearch,
  IconDots,
  IconLayoutSidebar,
  IconX,
  IconCheck,
  IconChevronRight,
  IconChevronDown,
  IconChevronUp,
  IconArrowDown,
} from "@tabler/icons-react";
import {
  CopyIcon,
  SpinnerIcon,
  MagnifyingGlassIcon,
  DotsThreeIcon,
  SidebarIcon,
  XIcon,
  CheckIcon,
  CaretRightIcon,
  CaretDownIcon,
  CaretUpIcon,
  ArrowDownIcon,
} from "@phosphor-icons/react";
import {
  RiFileCopyLine,
  RiLoaderLine,
  RiSearchLine,
  RiMoreLine,
  RiSideBarLine,
  RiCloseLine,
  RiCheckLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiArrowDownLine,
} from "@remixicon/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Loading03Icon,
  Search01Icon,
  MoreHorizontalIcon,
  SidebarLeftIcon,
  Cancel01Icon,
  Tick02Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowDown02Icon,
} from "@hugeicons/core-free-icons";

export const IconLibraryContext =
  createContext<PresetConfig["iconLibrary"]>("lucide");
const appIcons = {
  up: ArrowUp,
  check: Check,
  down: ChevronDown,
  right: ChevronRight,
  copy: Copy,
  file: FileText,
  chat: MessageSquare,
  more: MoreHorizontal,
  plus: Plus,
  search: Search,
  close: X,
};

// ChatJS-owned icons remain Lucide in the generated app. Native shadcn icon
// selection changes the registry placeholders below, not app-owned glyphs.
export const PreviewIcon = ({
  name,
  className = "size-4",
}: Readonly<{ name: keyof typeof appIcons; className?: string }>) => {
  const Icon = appIcons[name];
  return <Icon aria-hidden className={className} />;
};

// Native registry placeholders follow the selected shadcn icon library.
export const IconPlaceholder = ({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  children: _children,
  ...props
}: Readonly<
  {
    lucide:
      | "Loader2Icon"
      | "SearchIcon"
      | "ChevronRightIcon"
      | "ChevronDownIcon"
      | "ChevronUpIcon"
      | "CheckIcon"
      | "ArrowDownIcon"
      | "CopyIcon"
      | "PanelLeftIcon"
      | "XIcon"
      | "MoreHorizontalIcon";
    tabler: string;
    hugeicons: string;
    phosphor: string;
    remixicon: string;
  } & ComponentProps<"svg">
>) => {
  const library = useContext(IconLibraryContext);
  const icons = {
    ChevronDownIcon: {
      hugeicons: ArrowDown01Icon,
      tabler: IconChevronDown,
      phosphor: CaretDownIcon,
      remixicon: RiArrowDownSLine,
      lucide: ChevronDown,
    },
    ChevronUpIcon: {
      hugeicons: ArrowUp01Icon,
      tabler: IconChevronUp,
      phosphor: CaretUpIcon,
      remixicon: RiArrowUpSLine,
      lucide: ChevronUp,
    },
    Loader2Icon: {
      hugeicons: Loading03Icon,
      tabler: IconLoader,
      phosphor: SpinnerIcon,
      remixicon: RiLoaderLine,
      lucide: Loader2,
    },
    SearchIcon: {
      hugeicons: Search01Icon,
      tabler: IconSearch,
      phosphor: MagnifyingGlassIcon,
      remixicon: RiSearchLine,
      lucide: Search,
    },
    MoreHorizontalIcon: {
      hugeicons: MoreHorizontalIcon,
      tabler: IconDots,
      phosphor: DotsThreeIcon,
      remixicon: RiMoreLine,
      lucide: MoreHorizontal,
    },
    PanelLeftIcon: {
      hugeicons: SidebarLeftIcon,
      tabler: IconLayoutSidebar,
      phosphor: SidebarIcon,
      remixicon: RiSideBarLine,
      lucide: PanelLeft,
    },
    XIcon: {
      hugeicons: Cancel01Icon,
      tabler: IconX,
      phosphor: XIcon,
      remixicon: RiCloseLine,
      lucide: X,
    },
    ChevronRightIcon: {
      hugeicons: ArrowRight01Icon,
      tabler: IconChevronRight,
      phosphor: CaretRightIcon,
      remixicon: RiArrowRightSLine,
      lucide: ChevronRight,
    },
    CheckIcon: {
      hugeicons: Tick02Icon,
      tabler: IconCheck,
      phosphor: CheckIcon,
      remixicon: RiCheckLine,
      lucide: Check,
    },
    CopyIcon: {
      hugeicons: Copy01Icon,
      tabler: IconCopy,
      phosphor: CopyIcon,
      remixicon: RiFileCopyLine,
      lucide: Copy,
    },
    ArrowDownIcon: {
      hugeicons: ArrowDown02Icon,
      tabler: IconArrowDown,
      phosphor: ArrowDownIcon,
      remixicon: RiArrowDownLine,
      lucide: ArrowDown,
    },
  }[lucide];
  if (library === "hugeicons") {
    return (
      <HugeiconsIcon
        aria-hidden={props.role === undefined ? true : undefined}
        {...props}
        icon={icons.hugeicons}
        strokeWidth={2}
      />
    );
  }
  if (library === "tabler") {
    const Icon = icons.tabler;
    return (
      <Icon
        aria-hidden={props.role === undefined ? true : undefined}
        {...props}
      />
    );
  }
  if (library === "phosphor") {
    const Icon = icons.phosphor;
    return (
      <Icon
        aria-hidden={props.role === undefined ? true : undefined}
        {...props}
      />
    );
  }
  if (library === "remixicon") {
    const Icon = icons.remixicon;
    return (
      <Icon
        aria-hidden={props.role === undefined ? true : undefined}
        {...props}
      />
    );
  }
  const Icon = icons.lucide;
  return (
    <Icon
      aria-hidden={props.role === undefined ? true : undefined}
      {...props}
    />
  );
};
