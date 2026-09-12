import { takeSnapshot } from "@uiverify/vitest";
import { getInstanceByDom } from "echarts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { CodeExecution } from "../src/tools/vercel-code-execution/renderer";

import "../../../apps/chat/app/globals.css";

vi.mock(
  "@/components/interactive-charts",
  () => import("../../../apps/chat/components/interactive-chart-impl")
);

// Focus this capture on chart output, independently of the code editor.
vi.mock("@/components/sandbox", () => ({ SandboxComposed: () => null }));

const malformed = [
  { elements: [null], type: "line" },
  { elements: [{ label: "bad", points: "invalid" }], type: "scatter" },
  { elements: [{ label: "bad", points: [[1, "invalid"]] }], type: "line" },
  { elements: [{ group: "g", label: "bad", value: "invalid" }], type: "bar" },
  { elements: [], type: "unknown" },
];

test("chart output validates shapes and fits PNG output", async () => {
  const container = document.createElement("main");
  document.documentElement.classList.add("dark");
  container.style.cssText =
    "padding:24px;background:#171717;width:1000px;display:grid;grid-template-columns:1fr 1fr;gap:16px";
  document.body.append(container);
  const root = createRoot(container);
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 200;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas unavailable");
  }
  context.fillStyle = "#e5e7eb";
  context.fillRect(0, 0, 600, 200);
  context.fillStyle = "#2563eb";
  context.fillRect(40, 50, 140, 150);
  context.fillRect(220, 10, 140, 190);
  context.fillRect(400, 90, 140, 110);
  const png = { base64: canvas.toDataURL().split(",")[1], format: "png" };
  const valid = [
    ...["line", "scatter"].map((type) => ({
      elements: [
        {
          label: "Series",
          points: [
            [1, 2],
            [2, 4],
          ],
        },
      ],
      title: type,
      type,
    })),
    {
      elements: [{ group: "Series", label: "A", value: 4 }],
      title: "bar",
      type: "bar",
    },
  ];
  const outputs = [...malformed, ...valid, png];
  await act(() => {
    root.render(
      <>
        {outputs.map((chart, index) => (
          <section
            key={JSON.stringify(chart)}
            data-testid={`output-${index}`}
            style={index < malformed.length ? { display: "none" } : undefined}
          >
            <CodeExecution
              tool={{
                input: { code: "", language: "python", title: "Chart" },
                output: { chart, message: "" },
                state: "output-available",
                toolCallId: `fixture-${index}`,
              }}
            />
          </section>
        ))}
      </>
    );
  });
  for (let index = 0; index < malformed.length; index += 1) {
    expect(
      container.querySelector(`[data-testid="output-${index}"]`)?.textContent
    ).toBe("");
    expect(
      container.querySelector(`[data-testid="output-${index}"] canvas`)
    ).toBeNull();
  }
  await expect.poll(() => container.querySelectorAll("canvas").length).toBe(3);
  await expect
    .poll(() =>
      [...container.querySelectorAll("h3")].every((heading) => {
        const panel = heading.parentElement?.parentElement?.parentElement;
        return panel && getComputedStyle(panel).opacity === "1";
      })
    )
    .toBe(true);
  await expect
    .poll(() =>
      [
        ...container.querySelectorAll<HTMLElement>("[_echarts_instance_]"),
      ].every((element) =>
        getInstanceByDom(element)?.getZr().animation.isFinished()
      )
    )
    .toBe(true);
  const img = container.querySelector("img");
  if (!img) {
    throw new Error("PNG output missing");
  }
  await img.decode();
  expect(img.naturalWidth).toBe(600);
  expect(img.getBoundingClientRect().width).toBeLessThanOrEqual(900);
  await takeSnapshot("validated-chart-output");
  await act(() => root.unmount());
  container.remove();
});
