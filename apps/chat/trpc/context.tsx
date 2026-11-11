"use client";

import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "./routers/_app";

// Transport-independent context shared by installed controllers and local previews.
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
