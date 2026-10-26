"use client";

import { createContext, useContext } from "react";
import type { PresetConfig } from "shadcn/preset";
import {
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  IconCopy,
  IconCheck,
  IconChevronRight,
  IconArrowDown,
} from "@tabler/icons-react";
import {
  CopyIcon,
  CheckIcon,
  CaretRightIcon,
  ArrowDownIcon,
} from "@phosphor-icons/react";
import {
  RiFileCopyLine,
  RiCheckLine,
  RiArrowRightSLine,
  RiArrowDownLine,
} from "@remixicon/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Tick02Icon,
  ArrowRight01Icon,
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
  className,
}: Readonly<{
  lucide: "ChevronRightIcon" | "CheckIcon" | "ArrowDownIcon" | "CopyIcon";
  tabler: string;
  hugeicons: string;
  phosphor: string;
  remixicon: string;
  className?: string;
}>) => {
  const library = useContext(IconLibraryContext);
  const icons = {
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
        aria-hidden
        className={className}
        icon={icons.hugeicons}
        strokeWidth={2}
      />
    );
  }
  if (library === "tabler") {
    const Icon = icons.tabler;
    return <Icon aria-hidden className={className} />;
  }
  if (library === "phosphor") {
    const Icon = icons.phosphor;
    return <Icon aria-hidden className={className} />;
  }
  if (library === "remixicon") {
    const Icon = icons.remixicon;
    return <Icon aria-hidden className={className} />;
  }
  const Icon = icons.lucide;
  return <Icon aria-hidden className={className} />;
};
