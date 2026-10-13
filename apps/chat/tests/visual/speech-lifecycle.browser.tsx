import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { PromptInputSpeechButton } from "@/components/ai-elements/prompt-input";
import { createDomHarness } from "@/components/test-dom-harness";
import "@/tests/visual/sandbox.css";

type Recognition = InstanceType<Window["SpeechRecognition"]>;

test("speech readiness subscribes to the browser API and stops old instances on callback change and unmount", async () => {
  const instances: FakeRecognition[] = [];
  class FakeRecognition extends EventTarget implements Recognition {
    continuous = false;
    interimResults = false;
    lang = "";
    onstart: Recognition["onstart"] = null;
    onend: Recognition["onend"] = null;
    onresult: Recognition["onresult"] = null;
    onerror: Recognition["onerror"] = null;
    start = vi.fn(() => {
      this.onstart?.(new Event("start"));
    });
    stop = vi.fn(() => {
      this.onend?.(new Event("end"));
    });
    constructor() {
      super();
      instances.push(this);
    }
  }
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  let fixture: ReturnType<typeof createDomHarness> | undefined;
  try {
    act(() => {
      fixture = createDomHarness(
        <PromptInputSpeechButton aria-label="Dictate" />
      );
    });
    await expect
      .element(page.getByRole("button", { name: "Dictate" }))
      .toBeEnabled();
    expect(instances).toHaveLength(1);
    expect(instances[0].continuous).toBe(true);
    await act(async () => {
      await page.getByRole("button", { name: "Dictate" }).click();
    });
    expect(instances[0].start).toHaveBeenCalledOnce();
    await act(async () => {
      await page.getByRole("button", { name: "Dictate" }).click();
    });
    expect(instances[0].stop).toHaveBeenCalledOnce();
    act(() => {
      fixture?.update(
        <PromptInputSpeechButton
          aria-label="Dictate"
          onTranscriptionChange={vi.fn<(text: string) => void>()}
        />
      );
    });
    expect(instances).toHaveLength(2);
    expect(instances[0].stop).toHaveBeenCalledTimes(2);
    act(() => {
      fixture?.unmount();
    });
    fixture = undefined;
    expect(instances[1].stop).toHaveBeenCalledOnce();
  } finally {
    act(() => {
      fixture?.unmount();
    });
    vi.unstubAllGlobals();
  }
});
