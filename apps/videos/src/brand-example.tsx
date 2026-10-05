import React from "react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { AbsoluteFill } from "remotion";
/* oxlint-enable sort-imports */

import { Logo } from "./shared/brand";
/* oxlint-disable react/jsx-no-literals -- BrandExample renders authored authored presentation captions and demonstration labels; no translation-layer contract is defined here. */

/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- BrandExample: The prop object depends on current render/scene state; memoization needs lifecycle/dependency review and an identity-sensitive consumer. */
export const BrandExample = (): React.JSX.Element => (
  <AbsoluteFill
    // oxlint-disable-next-line react/forbid-component-props -- AbsoluteFill accepts style in its styling contract; preserve this caller's layout and appearance.
    style={{
      alignItems: "center",
      background: "#0a0a0a",
      color: "#eeece7",
      fontFamily: "Geist",
      gap: 32,
      justifyContent: "center",
    }}
  >
    <div style={{ width: 88 }}>
      <Logo />
    </div>
    <h1 style={{ fontSize: 76, margin: 0 }}>Build your next ChatJS video</h1>
    <p style={{ color: "#b7b5b1", fontSize: 30 }}>
      One action. One visible result.
    </p>
  </AbsoluteFill>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
