import { Loader2, Terminal, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import { useArtifactSelector } from "@/hooks/use-artifact";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

export interface ConsoleOutputContent {
  type: "text" | "image";
  value: string;
}

export interface ConsoleOutput {
  contents: ConsoleOutputContent[];
  id: string;
  status: "in_progress" | "loading_packages" | "completed" | "failed";
}

const getConsoleStatusText = (consoleOutput: ConsoleOutput): string | null => {
  if (consoleOutput.status === "in_progress") {
    return "Initializing...";
  }
  if (consoleOutput.status === "loading_packages") {
    const textContents = consoleOutput.contents
      .filter((content) => content.type === "text")
      .map((content) => content.value)
      .join("");
    return textContents;
  }
  return null;
};

export const Console = ({
  consoleOutputs,
  setConsoleOutputs,
  className,
}: {
  consoleOutputs: ConsoleOutput[];
  setConsoleOutputs: Dispatch<SetStateAction<ConsoleOutput[]>>;
  className?: string;
}) => {
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!isArtifactVisible) {
      setConsoleOutputs([]);
    }
  }, [isArtifactVisible, setConsoleOutputs]);

  return consoleOutputs.length > 0 ? (
    <div className={cn("flex w-full flex-col overflow-hidden", className)}>
      <div className="border-border bg-muted flex h-full w-full flex-col overflow-x-hidden overflow-y-scroll border-t">
        <div className="border-border bg-muted sticky top-0 z-50 flex h-fit w-full flex-row items-center justify-between border-b px-2 py-1">
          <div className="text-foreground flex flex-row items-center gap-3 pl-2 text-sm">
            <div className="text-muted-foreground">
              <Terminal size={16} />
            </div>
            <div>Console</div>
          </div>
          <Button
            className="hover:bg-accent size-fit p-1"
            onClick={() => setConsoleOutputs([])}
            size="icon"
            variant="ghost"
          >
            <X size={16} />
          </Button>
        </div>

        <div>
          {consoleOutputs.map((consoleOutput, index) => (
            <div
              className="border-border bg-muted flex flex-row border-b px-4 py-2 font-mono text-sm"
              key={consoleOutput.id}
            >
              <div
                className={cn("w-12 shrink-0", {
                  "text-emerald-500": consoleOutput.status === "completed",
                  "text-muted-foreground": [
                    "in_progress",
                    "loading_packages",
                  ].includes(consoleOutput.status),
                  "text-red-400": consoleOutput.status === "failed",
                })}
              >
                [{index + 1}]
              </div>
              {["in_progress", "loading_packages"].includes(
                consoleOutput.status
              ) ? (
                <div className="flex flex-row gap-2">
                  <div className="mt-0.5 mb-auto size-fit animate-spin self-center">
                    <Loader2 size={16} />
                  </div>
                  <div className="text-muted-foreground">
                    {getConsoleStatusText(consoleOutput)}
                  </div>
                </div>
              ) : (
                <div className="text-foreground flex w-full flex-col gap-2 overflow-x-scroll">
                  {consoleOutput.contents.map((content) =>
                    content.type === "image" ? (
                      <picture key={`${consoleOutput.id}-${content.value}`}>
                        <img
                          alt="output"
                          className="w-full max-w-(--breakpoint-toast-mobile) rounded-md"
                          height="auto"
                          src={content.value}
                          width="100%"
                        />
                      </picture>
                    ) : (
                      <div
                        className="break-word-wrap w-full whitespace-pre-line"
                        key={`${consoleOutput.id}-${content.type}-${content.value}`}
                      >
                        {content.value}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  ) : null;
};
