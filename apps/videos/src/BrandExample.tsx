import { AbsoluteFill } from "remotion";

import { Logo } from "./shared/brand";

export function BrandExample() {
  return (
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
}
