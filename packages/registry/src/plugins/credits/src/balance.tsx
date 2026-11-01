"use client";

import { DollarSign } from "lucide-react";
import { useGetCredits } from "./use-credits";

const CENTS_PER_DOLLAR = 100;
const DISPLAY_DECIMALS = 2;

export const CreditBalance = () => {
  const { balanceCents, isError } = useGetCredits();
  if (isError) {
    return <span className="truncate text-xs">Balance unavailable</span>;
  }
  if (balanceCents === undefined) {
    return <span className="truncate text-xs">Loading balance…</span>;
  }
  return (
    <span className="flex items-center gap-1 truncate text-xs">
      <DollarSign aria-hidden="true" className="size-3" />
      {(balanceCents / CENTS_PER_DOLLAR).toFixed(DISPLAY_DECIMALS)}
    </span>
  );
};
