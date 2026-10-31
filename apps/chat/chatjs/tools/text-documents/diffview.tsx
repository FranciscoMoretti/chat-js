import { $createParagraphNode, $getRoot, TextNode } from "lexical";
import type { EditorConfig, LexicalEditor, SerializedTextNode } from "lexical";
import React, { useEffect } from "react";
import type { ChangeObject } from "diff";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { createEditorConfig } from "./editor-config";
import { diffWords } from "diff";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

const DiffType = {
  Deleted: -1,
  Inserted: 1,
  Unchanged: 0,
};

// Define diff types
type DiffTypeValue = (typeof DiffType)[keyof typeof DiffType];
type SerializedDiffTextNode = SerializedTextNode & {
  diffType?: DiffTypeValue;
  type: "diff-text";
  version: 1;
};

// Custom diff text node that supports styling
class DiffTextNode extends TextNode {
  public __diffType?: DiffTypeValue;

  public static getType(): string {
    return "diff-text";
  }

  public static clone(
    node: Readonly<Pick<DiffTextNode, "__text" | "__key" | "__diffType">>
  ): DiffTextNode {
    const newNode = new DiffTextNode(node.__text, node.__key);
    newNode.__diffType = node.__diffType;
    return newNode;
  }

  public static importJSON(
    serializedNode: ReadonlyNativeSurface<SerializedDiffTextNode>
  ): DiffTextNode {
    const { text, diffType } = serializedNode;
    const node = new DiffTextNode(text);
    if (diffType !== undefined) {
      node.setDiffType(diffType);
    }
    return node;
  }

  public exportJSON(): SerializedDiffTextNode {
    return {
      ...super.exportJSON(),
      diffType: this.__diffType,
      type: "diff-text",
      version: 1,
    };
  }

  public setDiffType(diffType: DiffTypeValue): void {
    const writable = this.getWritable();
    writable.__diffType = diffType;
  }

  public getDiffType(): DiffTypeValue | undefined {
    return this.__diffType;
  }

  public createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const element = super.createDOM(config, editor);
    const diffType = this.getDiffType();

    if (
      diffType !== null &&
      diffType !== undefined &&
      diffType !== 0 &&
      !Number.isNaN(diffType)
    ) {
      let className = "";
      switch (diffType) {
        case DiffType.Inserted: {
          className =
            "bg-green-100 text-green-700 dark:bg-green-500/70 dark:text-green-300";
          break;
        }
        case DiffType.Deleted: {
          className =
            "bg-red-100 line-through text-red-600 dark:bg-red-500/70 dark:text-red-300";
          break;
        }
        default: {
          className = "";
        }
      }
      element.className = className;
    }

    return element;
  }

  public updateDOM(
    prevNode: this,
    dom: HTMLElement,
    config: EditorConfig
  ): boolean {
    const prevDiffType = prevNode.getDiffType();
    const currentDiffType = this.getDiffType();

    if (prevDiffType !== currentDiffType) {
      // Update classes if diff type changed
      // Recreate the span when its diff styling changes.
      return true;
    }

    return super.updateDOM(prevNode, dom, config);
  }
}

// Proper diff computation using the diff library
const computeProperDiff = (
  oldText: string,
  newText: string
): { text: string; type: number }[] => {
  const changes = diffWords(oldText, newText);

  return changes.map((change: Readonly<ChangeObject<string>>) => {
    let type: DiffTypeValue;
    if (change.added) {
      type = DiffType.Inserted;
    } else if (change.removed) {
      type = DiffType.Deleted;
    } else {
      type = DiffType.Unchanged;
    }

    return {
      text: change.value,
      type,
    };
  });
};

const DiffContentPlugin = ({
  oldContent,
  newContent,
}: ReadonlyNativeSurface<{
  oldContent: string;
  newContent: string;
}>): null => {
  const [editor] = useLexicalComposerContext();

  useEffect((): void => {
    editor.update((): void => {
      const root = $getRoot();

      // Clear existing content
      const children = root.getChildren();
      for (const child of children) {
        child.remove();
      }

      // Compute proper diff using LCS algorithm
      const diffResult = computeProperDiff(oldContent, newContent);

      // Create a single paragraph with all diff nodes
      const paragraphNode = $createParagraphNode();

      for (const { text, type } of diffResult) {
        const textNode = new DiffTextNode(text);
        textNode.setDiffType(type);
        paragraphNode.append(textNode);
      }

      root.append(paragraphNode);
    });
  }, [oldContent, newContent, editor]);

  return null;
};

interface DiffEditorProps {
  newContent: string;
  oldContent: string;
}

export const DiffView = ({
  oldContent,
  newContent,
}: ReadonlyNativeSurface<DiffEditorProps>): React.JSX.Element => {
  const initialConfig = {
    ...createEditorConfig(),
    editable: false,
    nodes: [DiffTextNode],
  };

  return (
    <div className="prose dark:prose-invert relative w-full text-left">
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="lexical-editor text-left outline-hidden" />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={null}
        />
        <DiffContentPlugin newContent={newContent} oldContent={oldContent} />
      </LexicalComposer>
    </div>
  );
};
