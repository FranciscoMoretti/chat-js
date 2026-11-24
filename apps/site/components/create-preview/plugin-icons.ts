import {
  ArrowRight,
  FileText,
  Folder,
  Images,
  Video,
  Link2,
  MessageSquare,
  Monitor,
  Plug,
  Search,
  SlidersHorizontal,
  TextCursorInput,
  ThumbsUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Use the homepage illustrations’ motifs at the scale of a catalog row.
export const pluginIcons: Readonly<Partial<Record<string, LucideIcon>>> = {
  projects: Folder,
  "image-viewer": Images,
  "video-viewer": Video,
  search: Search,
  "ai-titles": TextCursorInput,
  sharing: Link2,
  feedback: ThumbsUp,
  "followup-suggestions": ArrowRight,
  "model-preferences": SlidersHorizontal,
  "attachment-uploads": FileText,
  mcp: Plug,
  "guest-chat": MessageSquare,
  credits: Wallet,
  desktop: Monitor,
};
