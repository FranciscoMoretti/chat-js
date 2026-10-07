"use client";

import type { Route } from "next";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import Link from "next/link";
/* oxlint-enable sort-imports */
import { useRouter } from "next/navigation";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
  MouseEvent as ReactMouseEvent,
  MouseEventHandler as ReactMouseEventHandler,
} from "react";
/* oxlint-enable sort-imports */

import { isElectronRenderer } from "@/lib/electron-auth";

type InternalLinkProps = Omit<ReactComponentProps<typeof Link>, "href"> & {
  href: string | Exclude<ReactComponentProps<typeof Link>["href"], string>;
  onNavigate?: () => void;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (InternalLink); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- InternalLink: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: React.MouseEvent<HTMLAnchorElement>). */

/* oxlint-disable react/react-in-jsx-scope -- InternalLink uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
export const InternalLink = ({
  onAuxClick,
  onClick,
  onNavigate,
  href,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes onAuxClick, onClick, onNavigate, href from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: InternalLinkProps): ReactJSX.Element => {
  const router = useRouter();
  const isElectron = isElectronRenderer();

  const navigate = (event: ReactMouseEvent<HTMLAnchorElement>): void => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onNavigate; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
    onNavigate?.();
    const targetHref = event.currentTarget.getAttribute("href");
    if (typeof targetHref === "string" && targetHref !== "") {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: This wrapper accepts dynamic application URLs beyond Next generated literal routes; narrowing its public href contract requires a navigation API decision.
      router.push(targetHref as Route);
    }
  };

  const handleClick: ReactMouseEventHandler<HTMLAnchorElement> = (event) => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onClick; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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

    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onNavigate; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
    onNavigate?.();
  };

  const handleAuxClick: ReactMouseEventHandler<HTMLAnchorElement> = (event) => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onAuxClick; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
