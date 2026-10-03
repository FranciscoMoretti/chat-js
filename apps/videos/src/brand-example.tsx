import React from "react";
import { AbsoluteFill } from "remotion";

import { Logo } from "./shared/brand";

/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- BrandExample: The prop object depends on current render/scene state; memoization needs lifecycle/dependency review and an identity-sensitive consumer. */
export const BrandExample = (): React.JSX.Element => (
  <AbsoluteFill
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
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
