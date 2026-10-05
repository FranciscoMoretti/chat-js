import React from "react";
import type { ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import "./presentation.css";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Caption: React/library props and refs retain their declared mutability contract; deep-readonly wrapping would change assignability. */
const Caption = ({
  children,
  opacity,
}: {
  children: ReactNode;
  opacity: number;
}): React.JSX.Element => (
  <div className="captionPause" style={{ opacity }}>
    <span>{children}</span>
  </div>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp -- Pointer: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
/* oxlint-disable eslint/id-length -- Pointer: Short coordinate/index symbols follow the local layout/animation notation and library callback contract. */

const Pointer = ({
  x,
  y,
}: {
  readonly x: number;
  readonly y: number;
}): React.JSX.Element => (
  <svg
    aria-hidden="true"
    className="cursor"
    viewBox="0 0 26 32"
    style={{ left: x, top: y }}
  >
    <path
      d="M3 2 L3 25 L9 20 L14 30 L19 27 L14 17 L23 16 Z"
      fill="#17283e"
      stroke="white"
      strokeWidth={2}
    />
  </svg>
);

/* oxlint-enable eslint/id-length */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- ClickPulse: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
/* oxlint-disable eslint/id-length -- ClickPulse: Short coordinate/index symbols follow the local layout/animation notation and library callback contract. */
/* oxlint-disable eslint/no-magic-numbers -- ClickPulse: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */

/* oxlint-disable unicorn/no-null -- ClickPulse: React refs/rendering and selected-state contracts use null as an explicit empty state. */
const ClickPulse = ({
  age,
  x,
  y,
}: {
  readonly age: number;
  readonly x: number;
  readonly y: number;
}): React.JSX.Element | null =>
  age >= 0 && age < 0.5 ? (
    <div
      className="clickPulse"
      style={{
        left: x,
        opacity: 1 - age / 0.5,
        top: y,
        transform: `translate(-50%,-50%) scale(${0.6 + age * 3})`,
      }}
    />
  ) : null;
/* oxlint-enable unicorn/no-null */

/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable react/no-multi-comp */
export { Caption, ClickPulse, Pointer };
