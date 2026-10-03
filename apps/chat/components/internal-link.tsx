"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { isElectronRenderer } from "@/lib/electron-auth";
/* oxlint-enable sort-imports */

type InternalLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string | Exclude<React.ComponentProps<typeof Link>["href"], string>;
  onNavigate?: () => void;
};
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-magic-numbers, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- InternalLink: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including onNavigate?.()); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: React.MouseEvent<HTMLAnchorElement>). */

export const InternalLink = ({
  onAuxClick,
  onClick,
  onNavigate,
  href,
  ...props
}: InternalLinkProps): React.JSX.Element => {
  const router = useRouter();
  const isElectron = isElectronRenderer();

  const navigate = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    onNavigate?.();
    const targetHref = event.currentTarget.getAttribute("href");
    if (typeof targetHref === "string" && targetHref !== "") {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: This wrapper accepts dynamic application URLs beyond Next generated literal routes; narrowing its public href contract requires a navigation API decision.
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

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: This wrapper accepts dynamic application URLs beyond Next generated literal routes; narrowing its public href contract requires a navigation API decision.
      href={href as Route}
      onAuxClick={handleAuxClick}
      onClick={handleClick}
    />
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-magic-numbers, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
