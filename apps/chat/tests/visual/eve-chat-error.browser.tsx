import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { EveChatError } from "@/components/eve/eve-chat-error";

import "./sandbox.css";

const messages = [
  "AI Gateway rejected the provided API key.",
  `Unable to send this message. Request reference: ${"reference".repeat(20)}`,
];

test("chat alerts retain error details and fit narrow and wide composers", async () => {
  const container = document.createElement("main");
  container.style.cssText =
    "padding:24px;width:980px;background:var(--background);color:var(--foreground)";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() =>
      root.render(
        <div className="flex flex-col gap-6">
          {(["light", "dark"] as const).map((theme) => (
            <section className={theme} key={theme}>
              <div className="bg-background flex flex-col gap-4 p-4">
                {messages.map((message, index) => (
                  <div key={message} style={{ width: index === 0 ? 700 : 300 }}>
                    <EveChatError message={message} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )
    );
    const alerts = [...container.querySelectorAll('[role="alert"]')];
    expect(alerts).toHaveLength(4);
    for (const alert of alerts) {
      expect(alert.textContent).toContain("Chat error");
      expect(alert.scrollWidth).toBeLessThanOrEqual(alert.clientWidth);
    }
    expect(container.textContent).toContain(messages[0]);
    expect(container.textContent).toContain(messages[1]);
    await takeSnapshot("chat-error-alerts");
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
