import { AbsoluteFill } from "remotion";

import { Logo } from "./shared/brand";
export function BrandExample() {
  return (
    <AbsoluteFill
      style={{
        background: "#0a0a0a",
        color: "#eeece7",
        fontFamily: "Geist",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <div style={{ width: 88 }}>
        <Logo />
      </div>
      <h1 style={{ fontSize: 76, margin: 0 }}>Build your next ChatJS video</h1>
      <p style={{ fontSize: 30, color: "#b7b5b1" }}>
        One action. One visible result.
      </p>
    </AbsoluteFill>
  );
}
