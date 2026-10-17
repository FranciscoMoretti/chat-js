"use client";

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "@/trpc/react";
import type {
  DeliveryReceipt,
  PendingEveMessage,
} from "@/lib/eve/message-delivery";

const receiptPollMilliseconds = 1000;
const maximumReceiptPolls = 15;

/** Querying an unknown send never dispatches it again. */
export const useEveDeliveryReceipt = (
  sessionId: string,
  pending: PendingEveMessage | null,
  accept: (receipt: DeliveryReceipt) => void
) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const receipt = useQuery({
    ...trpc.eve.sendReceipt.queryOptions(
      pending !== null && typeof pending.operationId === "string"
        ? { sessionId, operationId: pending.operationId }
        : skipToken
    ),
    retry: false,
    refetchInterval: (query) =>
      query.state.dataUpdateCount < maximumReceiptPolls &&
      query.state.data === null
        ? receiptPollMilliseconds
        : false,
  });
  useEffect(() => {
    if (receipt.data) {
      accept(receipt.data);
      void queryClient.invalidateQueries({
        queryKey: trpc.eve.messageDisplay.queryKey({ sessionId }),
      });
    }
  }, [receipt.data, accept, queryClient, trpc, sessionId]);
  return receipt.refetch;
};
