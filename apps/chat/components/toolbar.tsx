"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowUp, Square } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { nanoid } from "nanoid";
import { memo, useEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useOnClickOutside } from "usehooks-ts";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatMessage } from "@/lib/ai/types";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import { useChatActions } from "@/lib/stores/base";
import type { useChatStoreApi } from "@/lib/stores/base";
import { cn } from "@/lib/utils";
import { useChatInput } from "@/providers/chat-input-provider";

import { artifactDefinitions } from "./artifact-panel";
import type {
  ArtifactToolbarContext,
  ArtifactToolbarItem,
} from "./create-artifact";
import { SummarizeIcon } from "./icons";

interface ToolProps {
  description: string;
  icon: ReactNode;
  isAnimating: boolean;
  isSingleTool?: boolean;
  isToolbarVisible?: boolean;
  onClick: (context: ArtifactToolbarContext) => void;
  selectedTool: string | null;
  setIsToolbarVisible?: Dispatch<SetStateAction<boolean>>;
  setSelectedTool: Dispatch<SetStateAction<string | null>>;

  storeApi: ReturnType<typeof useChatStoreApi<ChatMessage>>;
}

const Tool = ({
  description,
  icon,
  selectedTool,
  setSelectedTool,
  isToolbarVisible,
  setIsToolbarVisible,
  isAnimating,
  isSingleTool,
  onClick,
  storeApi,
}: ToolProps) => {
  const { sendMessage } = useChatActions<ChatMessage>();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (selectedTool !== description) {
      setIsHovered(false);
    }
  }, [selectedTool, description]);

  const handleSelect = () => {
    // If there's only one tool, execute directly on click
    if (isSingleTool) {
      onClick({ sendMessage, storeApi });
      return;
    }

    if (!isToolbarVisible && setIsToolbarVisible) {
      setIsToolbarVisible(true);
      return;
    }

    if (!selectedTool) {
      setIsHovered(true);
      setSelectedTool(description);
      return;
    }

    if (selectedTool === description) {
      setSelectedTool(null);
      onClick({ sendMessage, storeApi });
    } else {
      setSelectedTool(description);
    }
  };

  return (
    <Tooltip open={isHovered && !isAnimating}>
      <TooltipTrigger asChild>
        <motion.div
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
          className={cn("rounded-full p-3", {
            "bg-primary text-primary-foreground!": selectedTool === description,
          })}
          exit={{
            opacity: 0,
            scale: 0.9,
            transition: { duration: 0.1 },
          }}
          initial={{ opacity: 0, scale: 1 }}
          onClick={() => {
            handleSelect();
          }}
          onHoverEnd={() => {
            if (selectedTool !== description) {
              setIsHovered(false);
            }
          }}
          onHoverStart={() => {
            setIsHovered(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSelect();
            }
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {selectedTool === description ? <ArrowUp size={16} /> : icon}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent
        className="bg-foreground text-background rounded-2xl p-3 px-4"
        side="left"
        sideOffset={16}
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
};

const randomArr = Array.from({ length: 6 }, () => nanoid(5));

const ReadingLevelSelector = ({
  setSelectedTool,
  isAnimating,
  storeApi,
}: {
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isAnimating: boolean;
  storeApi: ReturnType<typeof useChatStoreApi<ChatMessage>>;
}) => {
  const { sendMessage } = useChatActions<ChatMessage>();
  const LEVELS = [
    "Elementary",
    "Middle School",
    "Keep current level",
    "High School",
    "College",
    "Graduate",
  ];

  const { selectedModelId } = useChatInput();

  const y = useMotionValue(-40 * 2);
  const dragConstraints = 5 * 40 + 2;
  const yToLevel = useTransform(y, [0, -dragConstraints], [0, 5]);

  const [currentLevel, setCurrentLevel] = useState(2);
  const [hasUserSelectedLevel, setHasUserSelectedLevel] =
    useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = yToLevel.on("change", (latest) => {
      const level = Math.min(5, Math.max(0, Math.round(Math.abs(latest))));
      setCurrentLevel(level);
    });

    return () => unsubscribe();
  }, [yToLevel]);

  return (
    <div className="relative flex flex-col items-center justify-end">
      {randomArr.map((id) => (
        <motion.div
          animate={{ opacity: 1 }}
          className="flex size-[40px] flex-row items-center justify-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={id}
          transition={{ delay: 0.1 }}
        >
          <div className="bg-muted-foreground/40 size-2 rounded-full" />
        </motion.div>
      ))}

      <Tooltip open={!isAnimating}>
        <TooltipTrigger asChild>
          <motion.div
            className={cn(
              "bg-background absolute flex flex-row items-center rounded-full border p-3",
              {
                "bg-background text-foreground": currentLevel === 2,
                "bg-primary text-primary-foreground": currentLevel !== 2,
              }
            )}
            drag="y"
            dragConstraints={{ bottom: 0, top: -dragConstraints }}
            dragElastic={0}
            dragMomentum={false}
            onClick={() => {
              if (currentLevel !== 2 && hasUserSelectedLevel) {
                sendMessage?.({
                  metadata: {
                    activeStreamId: null,
                    createdAt: new Date(),
                    parentMessageId: storeApi.getState().getLastMessageId(),
                    selectedModel: selectedModelId,
                  },
                  parts: [
                    {
                      text: `Please adjust the reading level to ${LEVELS[currentLevel]} level.`,
                      type: "text",
                    },
                  ],
                  role: "user",
                });

                setSelectedTool(null);
              }
            }}
            onDragEnd={() => {
              if (currentLevel === 2) {
                setSelectedTool(null);
              } else {
                setHasUserSelectedLevel(true);
              }
            }}
            onDragStart={() => {
              setHasUserSelectedLevel(false);
            }}
            style={{ y }}
            transition={{ duration: 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {currentLevel === 2 ? <SummarizeIcon /> : <ArrowUp size={16} />}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent
          className="bg-foreground text-background rounded-2xl p-3 px-4 text-sm"
          side="left"
          sideOffset={16}
        >
          {LEVELS[currentLevel]}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

const Tools = ({
  isToolbarVisible,
  selectedTool,
  setSelectedTool,
  isAnimating,
  setIsToolbarVisible,
  tools,
  storeApi,
}: {
  isToolbarVisible: boolean;
  selectedTool: string | null;
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isAnimating: boolean;
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>;
  tools: ArtifactToolbarItem[];
  storeApi: ReturnType<typeof useChatStoreApi<ChatMessage>>;
}) => {
  const [primaryTool, ...secondaryTools] = tools;
  const handlePrimaryToolClick = primaryTool.onClick;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-1.5"
      exit={{ opacity: 0, scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.95 }}
    >
      <AnimatePresence>
        {isToolbarVisible &&
          secondaryTools.map((secondaryTool) => {
            const handleToolClick = secondaryTool.onClick;

            return (
              <Tool
                description={secondaryTool.description}
                icon={secondaryTool.icon}
                isAnimating={isAnimating}
                key={secondaryTool.description}
                onClick={handleToolClick}
                selectedTool={selectedTool}
                setSelectedTool={setSelectedTool}
                storeApi={storeApi}
              />
            );
          })}
      </AnimatePresence>

      <Tool
        description={primaryTool.description}
        icon={primaryTool.icon}
        isAnimating={isAnimating}
        isSingleTool={tools.length === 1}
        isToolbarVisible={isToolbarVisible}
        onClick={handlePrimaryToolClick}
        selectedTool={selectedTool}
        setIsToolbarVisible={setIsToolbarVisible}
        setSelectedTool={setSelectedTool}
        storeApi={storeApi}
      />
    </motion.div>
  );
};

const PureToolbar = ({
  isToolbarVisible,
  setIsToolbarVisible,
  status,
  stop,
  artifactKind,
  storeApi,
}: {
  isToolbarVisible: boolean;
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  artifactKind: ArtifactKind;
  storeApi: ReturnType<typeof useChatStoreApi<ChatMessage>>;
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useOnClickOutside(toolbarRef as React.RefObject<HTMLElement>, () => {
    setIsToolbarVisible(false);
    setSelectedTool(null);
  });

  const startCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setSelectedTool(null);
      setIsToolbarVisible(false);
    }, 2000);
  };

  const cancelCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (status === "streaming") {
      setIsToolbarVisible(false);
    }
  }, [status, setIsToolbarVisible]);

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifactKind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  const toolsByArtifactKind = artifactDefinition.toolbar;

  if (toolsByArtifactKind.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.div
        animate={(() => {
          if (!isToolbarVisible) {
            return { height: 54, opacity: 1, transition: { delay: 0 }, y: 0 };
          }
          if (selectedTool === "adjust-reading-level") {
            return {
              height: 6 * 43,
              opacity: 1,
              scale: 0.95,
              transition: { delay: 0 },
              y: 0,
            };
          }
          return {
            height: toolsByArtifactKind.length * 50,
            opacity: 1,
            scale: 1,
            transition: { delay: 0 },
            y: 0,
          };
        })()}
        className="bg-background absolute right-6 bottom-6 flex cursor-pointer flex-col justify-end rounded-full border p-1.5 shadow-lg"
        exit={{ opacity: 0, transition: { duration: 0.1 }, y: -20 }}
        initial={{ opacity: 0, scale: 1, y: -20 }}
        onAnimationComplete={() => {
          setIsAnimating(false);
        }}
        onAnimationStart={() => {
          setIsAnimating(true);
        }}
        onHoverEnd={() => {
          if (status === "streaming") {
            return;
          }

          startCloseTimer();
        }}
        onHoverStart={() => {
          if (status === "streaming") {
            return;
          }

          cancelCloseTimer();
          setIsToolbarVisible(true);
        }}
        ref={toolbarRef}
        transition={{ damping: 25, stiffness: 300, type: "spring" }}
      >
        {(() => {
          if (status === "streaming") {
            return (
              <motion.div
                animate={{ scale: 1.4 }}
                className="p-3"
                exit={{ scale: 1 }}
                initial={{ scale: 1 }}
                key="stop-icon"
                onClick={() => {
                  stop();
                }}
              >
                <Square size={16} />
              </motion.div>
            );
          }
          if (selectedTool === "adjust-reading-level") {
            return (
              <ReadingLevelSelector
                isAnimating={isAnimating}
                key="reading-level-selector"
                setSelectedTool={setSelectedTool}
                storeApi={storeApi}
              />
            );
          }
          return (
            <Tools
              isAnimating={isAnimating}
              isToolbarVisible={isToolbarVisible}
              key="tools"
              selectedTool={selectedTool}
              setIsToolbarVisible={setIsToolbarVisible}
              setSelectedTool={setSelectedTool}
              storeApi={storeApi}
              tools={toolsByArtifactKind}
            />
          );
        })()}
      </motion.div>
    </TooltipProvider>
  );
};

export const Toolbar = memo(PureToolbar, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.isToolbarVisible !== nextProps.isToolbarVisible) {
    return false;
  }
  if (prevProps.artifactKind !== nextProps.artifactKind) {
    return false;
  }

  return true;
});
