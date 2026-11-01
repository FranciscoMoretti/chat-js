"use client";
import type { ComponentProps } from "react";
import { AttachmentTrigger } from "@/components/ui/attachment";
import { HoverCardTrigger } from "@/components/ui/hover-card";

export const AttachmentPreviewTrigger = (
  props: ComponentProps<typeof AttachmentTrigger>
) => <HoverCardTrigger render={<AttachmentTrigger {...props} />} />;
