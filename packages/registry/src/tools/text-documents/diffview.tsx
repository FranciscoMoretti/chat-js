import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
/* oxlint-enable sort-imports */
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { diffWords } from "diff";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { $createParagraphNode, $getRoot, TextNode } from "lexical";
/* oxlint-enable sort-imports */
import type { EditorConfig, LexicalEditor, SerializedTextNode } from "lexical";
import React, { useEffect } from "react";

import { createEditorConfig } from "./editor-config";

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
/* oxlint-disable eslint/no-underscore-dangle -- This identifier follows an external/internal protocol field or an intentionally unused destructured binding. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// Custom diff text node that supports styling
class DiffTextNode extends TextNode {
  public __diffType?: DiffTypeValue;

  public static getType(): string {
    return "diff-text";
  }

  public static clone(node: DiffTextNode): DiffTextNode {
    const newNode = new DiffTextNode(node.__text, node.__key);
    newNode.__diffType = node.__diffType;
    return newNode;
  }

  public static importJSON(
    serializedNode: SerializedDiffTextNode
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
    prevNode: DiffTextNode,
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

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Lexical dispatches nodes of the registered replacement class; the cast preserves that subclass relationship for the superclass DOM update.
    return super.updateDOM(prevNode as this, dom, config);
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-underscore-dangle */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// Proper diff computation using the diff library
const computeProperDiff = (oldText: string, newText: string) => {
  const changes = diffWords(oldText, newText);

  return changes.map((change) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const DiffContentPlugin = ({
  oldContent,
  newContent,
}: {
  oldContent: string;
  newContent: string;
}) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-statements */

interface DiffEditorProps {
  newContent: string;
  oldContent: string;
}

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (DiffView); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- This render slot receives the current JSX state; hoisting it would separate the slot from its captured render inputs. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const DiffView = ({ oldContent, newContent }: DiffEditorProps) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable react/no-multi-comp */
