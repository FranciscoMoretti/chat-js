"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function EveGuestBootstrap() {
  const router = useRouter();
  const pending = useRef<
    { attempt: number; request: Promise<void> } | undefined
  >(undefined);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    if (pending.current?.attempt !== attempt) {
      pending.current = {
        attempt,
        request: fetch("/api/eve-guest", { method: "POST" }).then(
          (response) => {
            if (!response.ok) {
              throw new Error("Chat could not be prepared.");
            }
          }
        ),
      };
    }
    pending.current.request
      .then(() => {
        if (active) {
          router.refresh();
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });
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
        <p className="text-muted-foreground text-sm" role="status">
          Preparing chat…
        </p>
      )}
    </div>
  );
}
