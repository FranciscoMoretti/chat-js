import type { ReactNode } from "react";

import "./presentation.css";

export function Caption({
  children,
  opacity,
}: {
  children: ReactNode;
  opacity: number;
}) {
  return (
    <div className="captionPause" style={{ opacity }}>
      <span>{children}</span>
    </div>
  );
}
export function Pointer({ x, y }: { x: number; y: number }) {
  return (
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
}
export function ClickPulse({
  age,
  x,
  y,
}: {
  age: number;
  x: number;
  y: number;
}) {
  return age >= 0 && age < 0.5 ? (
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
}
