"use client";

import type {
  ComponentProps as ReactComponentProps,
  MouseEventHandler as ReactMouseEventHandler,
} from "react";

import Link from "next/link";
import React from "react";

import type { Route } from "next";
import type { UrlObject } from "node:url";

import { isElectronRenderer } from "@/lib/electron-auth";

import { useRouter } from "next/navigation";

const PRIMARY_MOUSE_BUTTON = 0;
const AUXILIARY_MOUSE_BUTTON = 1;

type InternalLinkProps<T extends string> = Omit<
  ReactComponentProps<typeof Link>,
  "href"
> & {
  href: Route<T> | UrlObject;
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

  const navigate = (
    event: Readonly<{
      currentTarget: Readonly<Pick<HTMLAnchorElement, "getAttribute">>;
    }>
  ): void => {
    onNavigate?.();
    const targetHref = event.currentTarget.getAttribute("href");
    if (typeof targetHref === "string" && targetHref !== "") {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Electron modified/auxiliary clicks route the actual rendered anchor href, including URL objects and caller changes to the DOM.
      router.push(targetHref as Route);
    }
  };

  const handleClick: ReactMouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);

    if (event.defaultPrevented || event.button !== PRIMARY_MOUSE_BUTTON) {
      return;
    }

    if (isElectron && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      navigate(event);
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
    navigate(event);
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
