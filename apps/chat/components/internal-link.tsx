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

type InternalLinkProps = Omit<ReactComponentProps<typeof Link>, "href"> & {
  href: string | Exclude<ReactComponentProps<typeof Link>["href"], string>;
  onNavigate?: () => void;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (InternalLink); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading -- InternalLink: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes */

export const InternalLink = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    onAuxClick,
    onClick,
    onNavigate,
    href,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes onAuxClick, onClick, onNavigate, href from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: InternalLinkProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const router = useRouter();
  const isElectron = isElectronRenderer();

  const navigate = (
    event: Readonly<{
      currentTarget: Readonly<Pick<HTMLAnchorElement, "getAttribute">>;
    }>
  ): void => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onNavigate; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
    onNavigate?.();
    const targetHref = event.currentTarget.getAttribute("href");
    if (typeof targetHref === "string" && targetHref !== "") {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #781: Next 16.3 typedRoutes requires Route assertions for nonliteral hrefs (next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md). This resolved anchor also supports Electron navigation; validating against generated route literals would reject supported dynamic/UrlObject links.
      router.push(targetHref as Route);
    }
  };

  const handleClick: ReactMouseEventHandler<HTMLAnchorElement> = (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- The original native event is forwarded to its caller or native handler; retain event methods and mutable target DOM identity. */
    event
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ) => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onClick; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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

    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onNavigate; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
    onNavigate?.();
  };

  const handleAuxClick: ReactMouseEventHandler<HTMLAnchorElement> = (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- The original native event is forwarded to its caller or native handler; retain event methods and mutable target DOM identity. */
    event
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ) => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onAuxClick; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #781: Next 16.3 typedRoutes requires Route assertions for nonliteral hrefs (next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md). This resolved anchor also supports Electron navigation; validating against generated route literals would reject supported dynamic/UrlObject links.
      href={href as Route}
      onAuxClick={handleAuxClick}
      onClick={handleClick}
    />
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading */
