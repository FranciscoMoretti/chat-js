import { createElement } from "react";
import type { ReactNode } from "react";
import {
  Bot,
  CircleHelp,
  Clock,
  FilePenLine,
  FileText,
  FolderSearch,
  Globe,
  ImagePlus,
  Video,
  MessageCircleOff,
  MessagesSquare,
  Search,
  Terminal,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const symbols: Readonly<Record<string, LucideIcon>> = {
  "sandbox/default": WandSparkles,
  "tool/agent": Bot,
  "tool/ask_question": CircleHelp,
  "tool/bash": Terminal,
  "tool/read_file": FileText,
  "tool/write_file": FilePenLine,
  "tool/edit_file": FilePenLine,
  "tool/web_fetch": Globe,
  "tool/web_search": Search,
  "tool/glob": FolderSearch,
  "tool/grep": Search,
  "tool/sleep": Clock,
  "tool/no_reply": MessageCircleOff,
  "extension/code": Terminal,
  "extension/agent-browser": Globe,
  "memory/file": FileText,
  "channel/web": MessagesSquare,
  "@chatjs/generate-image": ImagePlus,
  "@chatjs/generate-video": Video,
  "@chatjs/attach-workspace-file": FileText,
};

export const capabilitySymbol = (id: string): ReactNode => {
  const Icon = Object.hasOwn(symbols, id) ? symbols[id] : undefined;
  return Icon === undefined
    ? undefined
    : createElement(Icon, { className: "size-4", strokeWidth: 1.75 });
};
