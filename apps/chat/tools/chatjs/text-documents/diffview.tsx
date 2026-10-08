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
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
type SerializedDiffTextNode = SerializedTextNode & {
  diffType?: DiffTypeValue;
  type: "diff-text";
  version: 1;
};
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
// Custom diff text node that supports styling
/* oxlint-disable eslint/no-underscore-dangle -- This Lexical node's clone and serialization contract uses Lexical 0.32.1's double-underscore base and custom backing fields. */
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing super.exportJSON() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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

  public createDOM(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TextNode.createDOM receives and caches theme class-name arrays on the original EditorConfig; recursive readonly arrays fail that actual Lexical receiver (TS2345).
    config: EditorConfig,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Pass the original LexicalEditor to TextNode.createDOM; recursive readonly projections drop its nominal members and fail that actual Lexical receiver (TS2345).
    editor?: LexicalEditor
  ): HTMLElement {
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TextNode.updateDOM mutates this original DOM subtree; deeply readonly DOM children/styles fail its native HTMLElement receiver (TS2345).
    dom: HTMLElement,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TextNode.updateDOM caches class-name arrays on the original EditorConfig; recursively readonly theme data fails that actual Lexical receiver (TS2345).
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
/* oxlint-enable eslint/no-underscore-dangle */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
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
/* oxlint-enable eslint/init-declarations */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
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
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */

interface DiffEditorProps {
  newContent: string;
  oldContent: string;
}

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (DiffView); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- This render slot receives the current JSX state; hoisting it would separate the slot from its captured render inputs. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
export const DiffView = ({
  oldContent,
  newContent,
}: ReadonlyNativeSurface<DiffEditorProps>): React.JSX.Element => {
  const initialConfig = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing createEditorConfig() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...createEditorConfig(),
    editable: false,
    nodes: [DiffTextNode],
  };

  return (
    <div className="prose dark:prose-invert relative w-full text-left">
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              // oxlint-disable-next-line react/forbid-component-props -- ContentEditable accepts className in its styling contract; preserve this caller's layout and appearance.
              className="lexical-editor text-left outline-hidden"
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={null}
        />
        <DiffContentPlugin newContent={newContent} oldContent={oldContent} />
      </LexicalComposer>
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable react/no-multi-comp */
