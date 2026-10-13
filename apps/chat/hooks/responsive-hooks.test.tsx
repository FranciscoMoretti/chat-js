import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { useIsMobile } from "./use-mobile";
import { useMediaQuery } from "./use-media-query";
import { useMounted } from "./use-mounted";

const ServerValues = (): React.JSX.Element => (
  <>
    <output>{String(useMounted())}</output>
    <output>{String(useIsMobile())}</output>
    <output>{String(useMediaQuery("(min-width: 768px)"))}</output>
  </>
);

test("responsive hooks use false for every server snapshot", () => {
  expect(renderToStaticMarkup(<ServerValues />)).toBe(
    "<output>false</output><output>false</output><output>false</output>"
  );
});
