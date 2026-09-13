import { describe, expect, it } from "vitest";

import {
  getStreamErrorMessage,
  getStreamErrorToastContent,
} from "./stream-errors";

describe("getStreamErrorMessage", () => {
  it("returns actionable gateway billing guidance", () => {
    expect(
      getStreamErrorMessage(
        new Error("AI Gateway requires a valid credit card to run this model.")
      )
    ).toBe(
      "AI Gateway requires a valid credit card. Add one in your Vercel dashboard and try again."
    );
  });

  it("returns a context-window specific message", () => {
    expect(
      getStreamErrorMessage(
        new Error("This model exceeded its maximum context length.")
      )
    ).toBe(
      "This conversation is too long for the selected model. Start a new chat or shorten the message and try again."
    );
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(getStreamErrorMessage(new Error("Provider exploded"))).toBe(
      "An error occurred while generating a response. Please try again."
    );
  });
});

describe("getStreamErrorToastContent", () => {
  it("uses the streamed cause as description when the message is truncated", () => {
    const error = new Error("O", {
      cause: "Oops, the provider returned a 429.",
    });

    expect(getStreamErrorToastContent(error)).toEqual({
      message:
        "An error occurred while generating a response. Please try again.",
      description: "Oops, the provider returned a 429.",
    });
  });

  it("extracts message from an Error object used as cause", () => {
    const error = new Error("An error occurred, please try again!", {
      cause: new Error("Rate limit exceeded. Try again in 30 seconds."),
    });

    expect(getStreamErrorToastContent(error)).toEqual({
      message: "Rate limit exceeded. Please wait a moment and try again.",
      description: "Rate limit exceeded. Try again in 30 seconds.",
    });
  });

  it("keeps a specific message and moves the cause to the description", () => {
    const error = new Error(
      "Rate limit exceeded. Please wait a moment and try again.",
      {
        cause: "Provider returned HTTP 429",
      }
    );

    expect(getStreamErrorToastContent(error)).toEqual({
      message: "Rate limit exceeded. Please wait a moment and try again.",
      description: "Provider returned HTTP 429",
    });
  });
});
