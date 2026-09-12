"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as React from "react";

import { isElectronRenderer } from "@/lib/electron-auth";

type InternalLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: React.ComponentProps<typeof Link>["href"] | string;
  onNavigate?: () => void;
};

export const InternalLink = ({
  onAuxClick,
  onClick,
  onNavigate,
  href,
  ...props
}: InternalLinkProps) => {
  const router = useRouter();
  const isElectron = isElectronRenderer();

  const navigate = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.();
    const targetHref = event.currentTarget.getAttribute("href");
    if (targetHref) {
      router.push(targetHref as Route);
    }
  };

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);

    if (event.defaultPrevented || event.button !== 0) {
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

  const handleAuxClick: React.MouseEventHandler<HTMLAnchorElement> = (
    event
  ) => {
    onAuxClick?.(event);

    if (event.defaultPrevented || event.button !== 1 || !isElectron) {
      return;
    }

    event.preventDefault();
    navigate(event);
  };

  return (
    <Link
      {...props}
      href={href as Route}
      onAuxClick={handleAuxClick}
      onClick={handleClick}
    />
  );
};
