"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
  MouseEvent as ReactMouseEvent,
  MouseEventHandler as ReactMouseEventHandler,
} from "react";

import { isElectronRenderer } from "@/lib/electron-auth";

type InternalLinkProps = Omit<ReactComponentProps<typeof Link>, "href"> & {
  href: string | Exclude<ReactComponentProps<typeof Link>["href"], string>;
  onNavigate?: () => void;
};
/* oxlint-disable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- InternalLink: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: React.MouseEvent<HTMLAnchorElement>). */

export const InternalLink = ({
  onAuxClick,
  onClick,
  onNavigate,
  href,
  ...props
}: InternalLinkProps): ReactJSX.Element => {
  const router = useRouter();
  const isElectron = isElectronRenderer();

  const navigate = (event: ReactMouseEvent<HTMLAnchorElement>): void => {
    onNavigate?.();
    const targetHref = event.currentTarget.getAttribute("href");
    if (typeof targetHref === "string" && targetHref !== "") {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #781: Next 16.3 typedRoutes requires Route assertions for nonliteral hrefs (next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md). This resolved anchor also supports Electron navigation; validating against generated route literals would reject supported dynamic/UrlObject links.
      router.push(targetHref as Route);
    }
  };

  const handleClick: ReactMouseEventHandler<HTMLAnchorElement> = (event) => {
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

  const handleAuxClick: ReactMouseEventHandler<HTMLAnchorElement> = (event) => {
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

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #781: Next 16.3 typedRoutes requires Route assertions for nonliteral hrefs (next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md). This resolved anchor also supports Electron navigation; validating against generated route literals would reject supported dynamic/UrlObject links.
      href={href as Route}
      onAuxClick={handleAuxClick}
      onClick={handleClick}
    />
  );
};
/* oxlint-enable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
