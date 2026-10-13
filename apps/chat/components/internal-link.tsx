"use client";

import type {
  ComponentProps as ReactComponentProps,
  MouseEventHandler as ReactMouseEventHandler,
} from "react";

import Link from "next/link";
import React from "react";

import type { Route } from "next";

import { isElectronRenderer } from "@/lib/electron-auth";

import { useRouter } from "next/navigation";

const PRIMARY_MOUSE_BUTTON = 0;
const AUXILIARY_MOUSE_BUTTON = 1;

type InternalLinkProps<T extends string> = Omit<
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
  const isElectron = isElectronRenderer();

  const navigate = (): void => {
    onNavigate?.();
    router.push(href);
  };

  const handleClick: ReactMouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);

    if (event.defaultPrevented || event.button !== PRIMARY_MOUSE_BUTTON) {
      return;
    }

    if (isElectron && (event.metaKey || event.ctrlKey || event.shiftKey)) {
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
      !isElectron
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
      onAuxClick={handleAuxClick}
      onClick={handleClick}
    />
  );
};
