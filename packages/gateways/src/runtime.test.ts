import { afterEach, expect, test, vi } from "vitest";
import { GatewayRuntime } from "./runtime";

class RuntimeProbe extends GatewayRuntime {
  public get request(): typeof fetch {
    return this.fetch;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("default fetch reads the current global and preserves its promise and synchronous failure", () => {
  const runtime = new RuntimeProbe();
  const response = Promise.resolve(new Response("ok"));
  const request = new Request("https://example.com");
  const options = { headers: { "x-test": "forwarded" } };
  const fetchMock = vi.fn<typeof fetch>().mockReturnValue(response);
  vi.stubGlobal("fetch", fetchMock);
  expect(runtime.request(request, options)).toBe(response);
  expect(fetchMock.mock.calls[0]?.[0]).toBe(request);
  expect(fetchMock.mock.calls[0]?.[1]).toBe(options);

  const failure = new Error("custom fetch validation");
  fetchMock.mockImplementation(() => {
    throw failure;
  });
  expect(() => {
    void runtime.request(request);
  }).toThrow(failure);
});
