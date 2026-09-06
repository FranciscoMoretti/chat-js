"use client";

import {
  Code2Icon,
  GraduationCapIcon,
  PenLineIcon,
  SparklesIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AppModelId } from "@/lib/ai/app-models";
import type { ChatMessage } from "@/lib/ai/types";
import { useChatActions } from "@/lib/chat/view-hooks";
import { useCurrentChatRoute } from "@/lib/chat-route";
import { buildDraftChatSubmission } from "@/lib/draft-chat-submission";
import { runParallelThreadRequestSpecs } from "@/lib/parallel-chat-requests";
import { useStartProvisionalChat } from "@/lib/start-provisional-chat";
import { useCustomChatStoreApi } from "@/lib/stores/custom-store-provider";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";

interface SuggestedActionsProps {
  chatId: string;
  className?: string;
  selectedModelId: AppModelId;
}

function PureSuggestedActions({
  chatId,
  selectedModelId,
  className,
}: SuggestedActionsProps) {
  const { startRun } = useChatActions();
  const storeApi = useCustomChatStoreApi<ChatMessage>();
  const startProvisionalChat = useStartProvisionalChat(chatId);
  const { data: session } = useSession();
  const currentRoute = useCurrentChatRoute();
  const containerRef = useRef<HTMLDivElement>(null);
  const categories = useMemo(
    () =>
      [
        {
          id: "write",
          label: "Write",
          icon: PenLineIcon,
          prompts: [
            "Write a concise email to reschedule a meeting",
            "Turn these bullet points into a clear memo",
            "Rewrite this paragraph to be more direct",
            "Draft a blog post outline about this topic",
            "Brainstorm 10 headline ideas for this",
          ],
        },
        {
          id: "learn",
          label: "Learn",
          icon: GraduationCapIcon,
          prompts: [
            "Explain this concept like I'm smart but new to it",
            "Quiz me on this topic (start easy, ramp up)",
            "Give me a mental model + common pitfalls",
            "Summarize this in 5 bullets + 3 key takeaways",
            "Compare these two approaches and when to use each",
          ],
        },
        {
          id: "code",
          label: "Code",
          icon: Code2Icon,
          prompts: [
            "Implement this feature and explain tradeoffs",
            "Find the bug in this snippet and fix it",
            "Refactor this for readability + performance",
            "Write tests for this module (edge cases too)",
            "Design a clean API for this requirement",
          ],
        },
        {
          id: "life",
          label: "Life stuff",
          icon: SparklesIcon,
          prompts: [
            "Plan a simple healthy meal prep for the week",
            "Help me choose between these options (pros/cons)",
            "Create a 30-minute daily routine I'll stick to",
            "Write a message to resolve a conflict calmly",
            "Suggest a weekend plan based on my constraints",
          ],
        },
      ] as const,
    []
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState<
    (typeof categories)[number]["id"] | null
  >(null);

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)
    : null;

  // Click outside to close
  useEffect(() => {
    if (!selectedCategoryId) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setSelectedCategoryId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedCategoryId]);

  const sendPrompt = (text: string) => {
    setSelectedCategoryId(null);
    const submission = buildDraftChatSubmission({
      attachments: [],
      input: text,
      normalizedSelectedModel: selectedModelId,
      parallelResponsesEnabled: false,
      parentMessageId: null,
      selectedTool: null,
    });

    if (
      startProvisionalChat({
        message: submission.message,
        requestSpecs: submission.requestSpecs,
      })
    ) {
      return;
    }

    const primaryRequest = submission.requestSpecs[0];
    if (primaryRequest) {
      runParallelThreadRequestSpecs({
        chatId,
        isAuthenticated: !!session?.user,
        message: submission.message,
        onRunStarted: storeApi.getState().registerParallelRun,
        projectId: currentRoute.projectId,
        requestSpecs: submission.requestSpecs,
        startRun,
      }).catch(() => {
        // The chat-level error callback owns user-facing request errors.
      });
    }
  };

  return (
    <div
      className={cn("relative flex w-full flex-col", className)}
      data-testid="suggested-actions"
      ref={containerRef}
    >
      <Suggestions className="mx-auto gap-1.5">
        {categories.map((c, index) => {
          const Icon = c.icon;
          const selected = c.id === selectedCategoryId;

          return (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              initial={{ opacity: 0, y: 6 }}
              key={c.id}
              transition={{ delay: 0.03 * index }}
            >
              <Suggestion
                aria-pressed={selected}
                className={cn(
                  "gap-2",
                  selected && "border border-transparent shadow-sm"
                )}
                onClick={() =>
                  setSelectedCategoryId((prev) => (prev === c.id ? null : c.id))
                }
                suggestion={c.label}
                variant={selected ? "default" : "outline"}
              >
                <Icon className="size-4" />
                <span className="@[500px]:inline hidden">{c.label}</span>
              </Suggestion>
            </motion.div>
          );
        })}
      </Suggestions>

      {selectedCategory ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="absolute start-0 @[500px]:top-full @[500px]:bottom-auto bottom-full z-20 w-full @[500px]:pt-2 @[500px]:pb-0 pb-2"
          initial={{ opacity: 0, y: 6 }}
          key={selectedCategory.id}
          transition={{ duration: 0.15 }}
        >
          <div className="w-full rounded-xl border bg-background p-2 shadow-sm">
            <div className="flex w-full flex-col">
              {selectedCategory.prompts.map((prompt, index) => (
                <div className="w-full" key={prompt}>
                  <Button
                    className="h-auto w-full justify-start whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm"
                    onClick={() => sendPrompt(prompt)}
                    type="button"
                    variant="ghost"
                  >
                    {prompt}
                  </Button>
                  {index < selectedCategory.prompts.length - 1 ? (
                    <Separator className="my-1" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions);
