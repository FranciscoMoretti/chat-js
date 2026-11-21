import { beforeEach, expect, test, vi } from "vitest";
import type * as EveModels from "eve/models";
import { defineDynamic } from "eve/models";
import { MockLanguageModelV4 } from "ai/test";
import { testDynamicContext } from "../../tests/helpers/eve-dynamic-context";
import { applicationModel } from "./application-model";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  defaultModel: vi.fn(),
  account: vi.fn(),
  billing: { debit: undefined },
  modelSettings: { modelIds: ["test/allowed"], model: "test/preferred" },
}));
vi.mock("eve/models", async (original) => {
  const actual = await original<typeof EveModels>();
  return { ...actual, defineDynamic: vi.fn(actual.defineDynamic) };
});
vi.mock("@/integrations/chat/models", () => ({
  webModels: mocks.modelSettings,
}));
vi.mock("@/integrations/billing", () => ({ billing: mocks.billing }));
vi.mock("@/integrations/chat/session-profiles", () => ({
  sessionProfiles: [],
}));
vi.mock("./model-selection", () => ({
  loadDefaultEveWebModelId: mocks.defaultModel,
  resolveEveModel: mocks.resolve,
}));
vi.mock("./model-accounting", () => ({
  resolveAccountedEveModel: mocks.account,
}));
vi.mock("./tool-availability", () => ({
  installedToolAvailabilityMiddleware: () => ({ specificationVersion: "v4" }),
}));
vi.mock("eve/context", () => ({
  defineState: <T>(_name: string, initial: () => T) => {
    let value = initial();
    return {
      get: () => value,
      update: (update: (state: T) => T) => {
        value = update(value);
      },
    };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modelSettings.modelIds = ["test/allowed"];
  mocks.defaultModel.mockResolvedValue("test/allowed");
});

test.each(["slack-webhook", "discord", "schedule", undefined])(
  "native caller %s resolves the native model without a ChatJS account or ledger",
  async (authenticator) => {
    applicationModel("test/native");
    const resolve = vi.mocked(defineDynamic).mock.lastCall?.[0];
    if (!resolve) {
      throw new Error("Missing model definition");
    }
    const identity = {
      authenticator: authenticator ?? "runtime",
      principalId: "native-caller",
      principalType: "user",
      attributes: { modelId: "untrusted/override" },
    };
    expect(
      await resolve(
        testDynamicContext({
          session: {
            id: "native",
            auth: { current: identity, initiator: identity },
          },
        })
      )
    ).toBe("test/native");
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
  }
);

test("web model selection rejects models outside an explicit list", async () => {
  applicationModel("test/native");
  const resolve = vi.mocked(defineDynamic).mock.lastCall?.[0];
  if (!resolve) {
    throw new Error("Missing model definition");
  }
  const identity = {
    authenticator: "chatjs-gateway",
    principalId: "owner",
    principalType: "user",
    attributes: { modelId: "untrusted/override" },
  };
  await expect(
    resolve(
      testDynamicContext({
        session: {
          id: "native",
          auth: { current: identity, initiator: identity },
        },
      })
    )
  ).rejects.toThrow("not enabled");
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.account).not.toHaveBeenCalled();
});

test("web chat without billing resolves its model without an accounting adapter", async () => {
  applicationModel("test/native");
  const resolve = vi.mocked(defineDynamic).mock.lastCall?.[0];
  if (!resolve) {
    throw new Error("Missing model definition");
  }
  const model = new MockLanguageModelV4({ modelId: "test/allowed" });
  mocks.resolve.mockResolvedValue({ model });
  const identity = {
    authenticator: "chatjs-gateway",
    principalId: "owner",
    principalType: "user",
    attributes: {},
  };
  await resolve(
    testDynamicContext({
      session: {
        id: "web-without-billing",
        auth: { current: identity, initiator: identity },
      },
    })
  );
  expect(mocks.defaultModel).toHaveBeenCalledWith("test/preferred");
  expect(mocks.resolve).toHaveBeenCalledWith("test/allowed");
  expect(mocks.account).not.toHaveBeenCalled();
});

test("an empty list lets the gateway resolve a discovered web model", async () => {
  mocks.modelSettings.modelIds = [];
  const modelId = "test/discovered";
  mocks.resolve.mockResolvedValue({
    model: new MockLanguageModelV4({ modelId }),
  });
  applicationModel("test/native");
  const resolve = vi.mocked(defineDynamic).mock.lastCall?.[0];
  if (!resolve) {
    throw new Error("Missing model definition");
  }
  const identity = {
    authenticator: "chatjs-gateway",
    principalId: "owner",
    principalType: "user",
    attributes: { modelId },
  };
  await resolve(
    testDynamicContext({
      session: {
        id: "web-discovery",
        auth: { current: identity, initiator: identity },
      },
    })
  );
  expect(mocks.resolve).toHaveBeenCalledWith(modelId);
  expect(mocks.defaultModel).not.toHaveBeenCalled();
});
