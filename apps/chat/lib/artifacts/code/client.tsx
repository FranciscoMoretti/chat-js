import { Copy, List, MessageSquare, Play, Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { CodeEditor } from "@/components/code-editor";
import { Console } from "@/components/console";
import type { ConsoleOutput, ConsoleOutputContent } from "@/components/console";
import { Artifact } from "@/components/create-artifact";
import type { ArtifactMetadata } from "@/components/create-artifact";
import { config } from "@/lib/config";
import { generateUUID, getLanguageFromFileName } from "@/lib/utils";

const OUTPUT_HANDLERS = {
  basic: `
    # Basic output capture setup
  `,
  matplotlib: `
    import io
    import base64
    from matplotlib import pyplot as plt

    # Clear any existing plots
    plt.clf()
    plt.close('all')

    # Switch to agg backend
    plt.switch_backend('agg')

    def setup_matplotlib_output():
        def custom_show():
            if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                print("Warning: Plot size too large, reducing quality")
                plt.gcf().set_dpi(100)

            png_buf = io.BytesIO()
            plt.savefig(png_buf, format='png')
            png_buf.seek(0)
            png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
            print(f'data:image/png;base64,{png_base64}')
            png_buf.close()

            plt.clf()
            plt.close('all')

        plt.show = custom_show
  `,
};

const detectRequiredHandlers = (code: string): string[] => {
  const handlers: string[] = ["basic"];

  if (code.includes("matplotlib") || code.includes("plt.")) {
    handlers.push("matplotlib");
  }

  return handlers;
};

export interface CodeArtifactMetadata {
  language: string;
  outputs: ConsoleOutput[];
}

export const isCodeArtifactMetadata = (
  metadata: ArtifactMetadata
): metadata is CodeArtifactMetadata =>
  metadata !== null &&
  typeof metadata === "object" &&
  "language" in metadata &&
  typeof metadata.language === "string" &&
  "outputs" in metadata &&
  Array.isArray(metadata.outputs);

export const getCodeArtifactMetadata = (
  metadata: ArtifactMetadata
): CodeArtifactMetadata =>
  isCodeArtifactMetadata(metadata)
    ? metadata
    : {
        language: "python",
        outputs: [],
      };

export const codeArtifact = new Artifact<"code", CodeArtifactMetadata>({
  actions: [
    {
      description: "Execute code",
      icon: <Play size={18} />,
      isDisabled: ({ isReadonly, content: _content, metadata }) => {
        if (isReadonly) {
          return true;
        }
        const language = metadata?.language || "python";
        return language !== "python";
      },
      label: "Run",
      onClick: async ({ content, setMetadata, metadata: _metadata }) => {
        const runId = generateUUID();
        const outputContent: ConsoleOutputContent[] = [];

        setMetadata((metadata) => ({
          ...metadata,
          outputs: [
            ...metadata.outputs,
            {
              contents: [],
              id: runId,
              status: "in_progress",
            },
          ],
        }));

        try {
          // Python execution using Pyodide
          // @ts-expect-error - loadPyodide is not defined
          const currentPyodideInstance = await globalThis.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
          });

          currentPyodideInstance.setStdout({
            batched: (output: string) => {
              outputContent.push({
                type: output.startsWith("data:image/png;base64")
                  ? "image"
                  : "text",
                value: output,
              });
            },
          });

          await currentPyodideInstance.loadPackagesFromImports(content, {
            messageCallback: (message: string) => {
              setMetadata((metadata) => ({
                ...metadata,
                outputs: [
                  ...metadata.outputs.filter((output) => output.id !== runId),
                  {
                    contents: [{ type: "text", value: message }],
                    id: runId,
                    status: "loading_packages",
                  },
                ],
              }));
            },
          });

          const requiredHandlers = detectRequiredHandlers(content);
          for (const handler of requiredHandlers) {
            if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
              await currentPyodideInstance.runPythonAsync(
                OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]
              );

              if (handler === "matplotlib") {
                await currentPyodideInstance.runPythonAsync(
                  "setup_matplotlib_output()"
                );
              }
            }
          }

          await currentPyodideInstance.runPythonAsync(content);

          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((output) => output.id !== runId),
              {
                contents: outputContent,
                id: runId,
                status: "completed",
              },
            ],
          }));
        } catch (error: unknown) {
          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((output) => output.id !== runId),
              {
                contents: [
                  {
                    type: "text",
                    value:
                      error instanceof Error ? error.message : String(error),
                  },
                ],
                id: runId,
                status: "failed",
              },
            ],
          }));
        }
      },
    },
    {
      description: "View Previous version",
      icon: <Undo2 size={18} />,
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
    },
    {
      description: "View Next version",
      icon: <Redo2 size={18} />,
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
    },
    {
      description: "Copy code to clipboard",
      icon: <Copy size={18} />,
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
  ],
  content: ({ isReadonly, content, title, ...props }) => {
    const language = getLanguageFromFileName(title) || "python";

    return (
      <CodeEditor
        {...props}
        content={content}
        isReadonly={isReadonly}
        language={language}
      />
    );
  },
  description:
    "Useful for code generation; Code execution is only available for Python code.",
  footer: ({ metadata, setMetadata }) => {
    if (!metadata?.outputs?.length) {
      return null;
    }

    return (
      <Console
        className="min-h-[200px]"
        consoleOutputs={metadata.outputs}
        setConsoleOutputs={() => {
          setMetadata({
            ...metadata,
            outputs: [],
          });
        }}
      />
    );
  },
  initialize: ({ setMetadata }) => {
    setMetadata({
      language: "python",
      outputs: [],
    });
  },
  kind: "code",
  toolbar: [
    {
      description: "Add comments",
      icon: <MessageSquare size={16} />,
      onClick: ({ sendMessage, storeApi }) => {
        const selectedModel = config.ai.tools.code.edits;
        const createdAt = new Date();
        const parentMessageId = storeApi.getState().getLastMessageId();

        sendMessage({
          metadata: {
            activeStreamId: null,
            createdAt,
            parentMessageId,
            selectedModel,
          },
          parts: [
            {
              text: "Add comments to the code snippet for understanding",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
    {
      description: "Add logs",
      icon: <List size={16} />,
      onClick: ({ sendMessage, storeApi }) => {
        const selectedModel = config.ai.tools.code.edits;
        const createdAt = new Date();
        const parentMessageId = storeApi.getState().getLastMessageId();

        sendMessage({
          metadata: {
            activeStreamId: null,
            createdAt,
            parentMessageId,
            selectedModel,
          },
          parts: [
            {
              text: "Add logs to the code snippet for debugging",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
  ],
});
