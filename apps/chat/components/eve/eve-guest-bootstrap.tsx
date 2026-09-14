"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export const EveGuestBootstrap = () => {
  const router = useRouter();
  const pending = useRef<
    { attempt: number; request: Promise<void> } | undefined
  >(undefined);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const createRequest = async () => {
      const response = await fetch("/api/eve-guest", { method: "POST" });
      if (!response.ok) {
        throw new Error("Chat could not be prepared.");
      }
    };
    if (pending.current?.attempt !== attempt) {
      pending.current = {
        attempt,
        request: createRequest(),
      };
    }
    const { request } = pending.current;
    void (async () => {
      try {
        await request;
        if (active) {
          router.refresh();
        }
      } catch {
        if (active) {
          setError(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [router, attempt]);
  return (
    <div className="flex h-full items-center justify-center p-6">
      {error ? (
        <div className="space-y-3 text-center" role="alert">
          <p>Could not start chat. Please try again.</p>
          <Button
            onClick={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <output className="text-muted-foreground text-sm">
          Preparing chat…
        </output>
      )}
    </div>
  );
};
