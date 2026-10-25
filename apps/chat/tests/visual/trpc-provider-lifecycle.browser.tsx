import { useQuery, useQueryClient } from "@tanstack/react-query";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { serialize } from "superjson";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { TRPCReactProvider, useTRPC, useTRPCClient } from "@/trpc/react";
import { renderRoot, unmountRoot } from "./primitive-mount";
import "./sandbox.css";

vi.mock("@/lib/env", () => ({ env: {} }));

interface Owner {
  readonly client: ReturnType<typeof useTRPCClient>;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly trpc: ReturnType<typeof useTRPC>;
}

const Probe = ({
  name,
  onOwner,
}: {
  readonly name: string;
  readonly onOwner: (name: string, owner: Owner) => void;
}): React.JSX.Element => {
  const client = useTRPCClient();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.modelPreferences.getModelPreferences.queryOptions(),
    enabled: false,
  });
  useEffect(() => {
    onOwner(name, { client, queryClient, trpc });
  }, [client, name, onOwner, queryClient, trpc]);
  return <output aria-label={name}>{data?.length ?? 0} preferences</output>;
};

test("provider hydration and client recreation retain cached data and in-flight requests", async () => {
  const owners = new Map<string, Owner>();
  const onOwner = (name: string, owner: Owner): void => {
    owners.set(name, owner);
  };
  const owner = (name: string): Owner => {
    const value = owners.get(name);
    if (!value) {
      throw new Error(`Missing provider ${name}`);
    }
    return value;
  };
  const tree = (key: string): React.JSX.Element => (
    <React.StrictMode>
      <TRPCReactProvider key={key}>
        <Probe name="Primary" onOwner={onOwner} />
      </TRPCReactProvider>
      <TRPCReactProvider>
        <Probe name="Independent" onOwner={onOwner} />
      </TRPCReactProvider>
    </React.StrictMode>
  );
  const container = document.createElement("main");
  container.innerHTML = renderToString(tree("original"));
  document.body.append(container);
  const hydrationError = vi.fn<(error: unknown) => void>();
  const root = hydrateRoot(container, tree("original"), {
    onRecoverableError: hydrationError,
  });
  const response = Promise.withResolvers<Response>();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockReturnValue(response.promise);
  vi.stubGlobal("fetch", fetch);
  try {
    await expect.poll(() => owners.size).toBe(2);
    expect(hydrationError).not.toHaveBeenCalled();
    const original = owner("Primary");
    expect(original.client).not.toBe(owner("Independent").client);
    await renderRoot(root, tree("original"));
    expect(owner("Primary").client).toBe(original.client);

    const pending = original.queryClient.query(
      original.trpc.modelPreferences.getModelPreferences.queryOptions()
    );
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    await renderRoot(root, tree("recreated"));
    const recreated = owner("Primary");
    expect(recreated.client).not.toBe(original.client);
    expect(recreated.queryClient).toBe(original.queryClient);
    const preferences = [{ modelId: "fixture/model", enabled: true }];
    await act(async () => {
      response.resolve(
        Response.json([{ result: { data: serialize(preferences) } }])
      );
      await pending;
    });
    expect(await pending).toEqual(preferences);
    await expect
      .element(page.getByLabelText("Primary"))
      .toHaveTextContent("1 preferences");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      recreated.queryClient.getQueryData(
        recreated.trpc.modelPreferences.getModelPreferences.queryKey()
      )
    ).toEqual(preferences);
    await takeSnapshot("trpc-provider-recreated-client");
    await page.screenshot();

    // A subsequent request uses the new transport with the existing cache owner.
    fetch.mockResolvedValue(
      Response.json([{ result: { data: serialize([]) } }])
    );
    await act(async () => {
      await recreated.queryClient.query({
        ...recreated.trpc.modelPreferences.getModelPreferences.queryOptions(),
        staleTime: 0,
      });
    });
    await expect
      .element(page.getByLabelText("Primary"))
      .toHaveTextContent("0 preferences");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(hydrationError).not.toHaveBeenCalled();
  } finally {
    await unmountRoot(root);
    container.remove();
    owner("Primary").queryClient.clear();
    vi.unstubAllGlobals();
  }
});
