import type { ComponentType, ReactNode } from "react";

type AttachmentSurface = ComponentType<{ children?: ReactNode }>;

/** Presentation only: callers own media loading, file actions and upload state. */
export const AttachmentCardView = ({
  title,
  media,
  mediaVariant = "icon",
  variant = "card",
  state = "done",
  children,
  actions,
  primitives,
}: {
  readonly title: string;
  readonly media: ReactNode;
  readonly mediaVariant?: "icon" | "image";
  readonly variant?: "card" | "pill";
  readonly state?: "idle" | "uploading" | "processing" | "error" | "done";
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly primitives: {
    Attachment: ComponentType<{
      children?: ReactNode;
      orientation: "vertical" | "horizontal";
      size: "default" | "xs";
      state: "idle" | "uploading" | "processing" | "error" | "done";
    }>;
    AttachmentContent: AttachmentSurface;
    AttachmentTitle: AttachmentSurface;
    AttachmentMedia: ComponentType<{
      children?: ReactNode;
      variant: "icon" | "image";
    }>;
  };
}) => (
  <primitives.Attachment
    data-testid="input-attachment-preview"
    orientation={variant === "card" ? "vertical" : "horizontal"}
    size={variant === "card" ? "default" : "xs"}
    state={state}
  >
    <primitives.AttachmentMedia variant={mediaVariant}>
      {media}
    </primitives.AttachmentMedia>
    <primitives.AttachmentContent>
      <primitives.AttachmentTitle>{title}</primitives.AttachmentTitle>
    </primitives.AttachmentContent>
    {children}
    {actions}
  </primitives.Attachment>
);
