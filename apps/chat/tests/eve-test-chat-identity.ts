import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { z } from "zod";

export const readLogicalChatId = async (
  request: Pick<APIRequestContext, "get">,
  branchId: string
): Promise<string> => {
  const response = await request.get(`/api/agent-conversations/${branchId}`);
  expect(response.ok(), await response.text()).toBe(true);
  return z.object({ chatId: z.uuid() }).parse(await response.json()).chatId;
};
