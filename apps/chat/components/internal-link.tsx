"use client";

import type {
  ComponentProps as ReactComponentProps,
  MouseEventHandler as ReactMouseEventHandler,
} from "react";

import Link from "next/link";
import { useChatNavigation } from "./chat/chat-navigation";
import React from "react";

import type { Route } from "next";

import { handleModifiedNavigation } from "@/integrations/navigation";

import { useRouter } from "next/navigation";

const PRIMARY_MOUSE_BUTTON = 0;
const AUXILIARY_MOUSE_BUTTON = 1;

export type InternalLinkProps<T extends string> = Omit<
  ReactComponentProps<typeof Link>,
  "href" | "as"
> & {
  href: Route<T>;
  onNavigate?: () => void;
};

export const InternalLink = <T extends string>({
  onAuxClick,
  onClick,
  onNavigate,
  href,
  ...props
}: InternalLinkProps<T>): React.JSX.Element => {
  const router = useRouter();
  const embedded = useChatNavigation();
  const captureModifiedNavigation = handleModifiedNavigation();

  const navigate = (): void => {
    onNavigate?.();
    if (embedded) {
      embedded.navigate(href);
    } else {
      router.push(href);
    }
  };

  const handleClick: ReactMouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);

    if (event.defaultPrevented || event.button !== PRIMARY_MOUSE_BUTTON) {
      return;
    }

    if (embedded) {
      event.preventDefault();
      navigate();
      return;
    }

    if (
      captureModifiedNavigation &&
      (event.metaKey || event.ctrlKey || event.shiftKey)
    ) {
      event.preventDefault();
      navigate();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    onNavigate?.();
  };

  const handleAuxClick: ReactMouseEventHandler<HTMLAnchorElement> = (event) => {
    onAuxClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== AUXILIARY_MOUSE_BUTTON ||
      !(captureModifiedNavigation || embedded)
    ) {
      return;
    }

    event.preventDefault();
    navigate();
  };

  return (
    <Link
      {...props}
      href={href}
      prefetch={embedded ? false : props.prefetch}
      onAuxClick={handleAuxClick}
      onClick={handleClick}
    />
  );
};
