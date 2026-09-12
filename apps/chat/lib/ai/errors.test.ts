import { describe, expect, it, vi } from "vitest";

import { ChatSDKError } from "./errors";

describe("ChatSDKError", () => {
  it("preserves chat error metadata and response details", async () => {
    const error = new ChatSDKError("not_found:chat", "missing chat");

    expect(error).toMatchObject({
      message:
        "The requested chat was not found. Please check the chat ID and try again.",
      name: "ChatSDKError",
      statusCode: 404,
      surface: "chat",
      type: "not_found",
    });

    expect(await error.toResponse().json()).toEqual({
      cause: "missing chat",
      code: "not_found:chat",
      message:
        "The requested chat was not found. Please check the chat ID and try again.",
    });
  });

  it("conceals database details from the response while logging them", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new ChatSDKError(
      "not_found:database",
      "database unavailable"
    );

    const response = error.toResponse();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "",
      message: "Something went wrong. Please try again later.",
    });
    expect(errorSpy).toHaveBeenCalledWith({
      cause: "database unavailable",
      code: "not_found:database",
      message: "An error occurred while executing a database query.",
    });

    errorSpy.mockRestore();
  });
});
