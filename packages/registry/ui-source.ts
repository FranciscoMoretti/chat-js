import ts from "typescript";

const nativeUiImport = /(?:^|\/)components\/ui\/(?<component>[^/]+)$/u;
const radixAttributeNames = new Map([["Checkbox.readOnly", "aria-readonly"]]);
const isFalseAttribute = (attribute: ts.JsxAttribute): boolean =>
  attribute.initializer !== undefined &&
  ts.isJsxExpression(attribute.initializer) &&
  attribute.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword;

const containsSearchBackdrop = (node: ts.Node): boolean => {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "createPortal"
  ) {
    const [content] = node.arguments;
    return (
      content !== undefined &&
      ts.isJsxSelfClosingElement(content) &&
      ts.isIdentifier(content.tagName) &&
      content.tagName.text === "DialogOverlay"
    );
  }
  return (
    ts.forEachChild(node, (child) =>
      containsSearchBackdrop(child) ? true : undefined
    ) === true
  );
};

/** Emit maintained ChatJS compositions using the selected shadcn native API. */
export const transformUiSource = (
  source: string,
  fileName: string,
  base: "base" | "radix"
): string => {
  if (base === "base") {
    return source;
  }
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const imports = new Map<string, string>();
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const moduleName = nativeUiImport.exec(statement.moduleSpecifier.text)
      ?.groups?.component;
    // @shadcn/react exposes render for either primitive library.
    if (
      moduleName === undefined ||
      moduleName === "message-scroller" ||
      moduleName === "questionnaire"
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) {
        imports.set(
          binding.name.text,
          (binding.propertyName ?? binding.name).text
        );
      }
    }
  }
  if (imports.size === 0) {
    return source;
  }
  let changed = false;
  const omitSearchBackdrop =
    fileName.endsWith("/search-chats.tsx") && containsSearchBackdrop(file);
  const transformed = ts.transform(file, [
    (context) => {
      const { factory } = context;
      const withoutSearchBackdrop = (node: ts.Node): ts.Node | undefined => {
        if (
          ts.isJsxExpression(node) &&
          (containsSearchBackdrop(node) ||
            node.getText(file).includes("Base UI omits nested backdrops"))
        ) {
          return undefined;
        }
        if (
          ts.isImportDeclaration(node) &&
          node.importClause?.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings)
        ) {
          const elements = node.importClause.namedBindings.elements.filter(
            (binding) =>
              !["createPortal", "DialogOverlay"].includes(
                (binding.propertyName ?? binding.name).text
              )
          );
          if (elements.length === 0) {
            return undefined;
          }
          return factory.updateImportDeclaration(
            node,
            node.modifiers,
            factory.updateImportClause(
              node.importClause,
              node.importClause.phaseModifier,
              node.importClause.name,
              factory.updateNamedImports(
                node.importClause.namedBindings,
                elements
              )
            ),
            node.moduleSpecifier,
            node.attributes
          );
        }
        if (ts.isObjectBindingPattern(node)) {
          return factory.updateObjectBindingPattern(
            node,
            node.elements.filter(
              (binding) =>
                !ts.isIdentifier(binding.name) ||
                !["isMobile", "openMobile"].includes(binding.name.text)
            )
          );
        }
        return node;
      };
      const withChildren = (
        element: ts.JsxElement,
        children: readonly ts.JsxChild[]
      ): ts.JsxElement => {
        const slot = element.openingElement.attributes.properties.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            ts.isIdentifier(attribute.name) &&
            attribute.name.text === "asChild"
        );
        const meaningful = element.children.filter(
          (child) => !ts.isJsxText(child) || child.text.trim() !== ""
        );
        const [only] = meaningful;
        return factory.updateJsxElement(
          element,
          element.openingElement,
          slot &&
            meaningful.length === 1 &&
            only !== undefined &&
            ts.isJsxElement(only)
            ? [withChildren(only, children)]
            : children,
          element.closingElement
        );
      };
      const renderChild = (
        expression: ts.Expression,
        children: readonly ts.JsxChild[],
        component: string
      ): ts.JsxChild => {
        if (ts.isParenthesizedExpression(expression)) {
          return renderChild(expression.expression, children, component);
        }
        if (ts.isJsxSelfClosingElement(expression)) {
          return factory.createJsxElement(
            factory.createJsxOpeningElement(
              expression.tagName,
              expression.typeArguments,
              expression.attributes
            ),
            children,
            factory.createJsxClosingElement(expression.tagName)
          );
        }
        const hasChildren = children.some(
          (child) => !ts.isJsxText(child) || child.text.trim() !== ""
        );
        if (ts.isJsxElement(expression)) {
          return hasChildren ? withChildren(expression, children) : expression;
        }
        // The editable user bubble optionally replaces its native div with a button.
        if (
          component === "BubbleContent" &&
          ts.isConditionalExpression(expression)
        ) {
          const branch = (value: ts.Expression): ts.Expression => {
            if (ts.isIdentifier(value) && value.text === "undefined") {
              return factory.createJsxElement(
                factory.createJsxOpeningElement(
                  factory.createIdentifier("div"),
                  undefined,
                  factory.createJsxAttributes([])
                ),
                children,
                factory.createJsxClosingElement(factory.createIdentifier("div"))
              );
            }
            const child = renderChild(value, children, component);
            if (ts.isJsxElement(child)) {
              return child;
            }
            throw new Error(
              `Unsupported conditional native render in ${fileName}`
            );
          };
          return factory.createJsxExpression(
            undefined,
            factory.updateConditionalExpression(
              expression,
              expression.condition,
              expression.questionToken,
              branch(expression.whenTrue),
              expression.colonToken,
              branch(expression.whenFalse)
            )
          );
        }
        if (
          !hasChildren &&
          !ts.isArrowFunction(expression) &&
          !ts.isFunctionExpression(expression)
        ) {
          return factory.createJsxExpression(undefined, expression);
        }
        throw new Error(
          `Unsupported native render composition in ${fileName}: ${component}`
        );
      };
      const visit: ts.Visitor = (node) => {
        const prepared = omitSearchBackdrop
          ? withoutSearchBackdrop(node)
          : node;
        if (prepared === undefined) {
          changed = true;
          return [];
        }
        const visited = ts.visitEachChild(prepared, visit, context);
        if (!ts.isJsxElement(visited) && !ts.isJsxSelfClosingElement(visited)) {
          return visited;
        }
        const opening = ts.isJsxElement(visited)
          ? visited.openingElement
          : visited;
        const component = ts.isIdentifier(opening.tagName)
          ? imports.get(opening.tagName.text)
          : undefined;
        if (component === undefined) {
          return visited;
        }
        let render: ts.Expression | undefined;
        const properties: ts.JsxAttributeLike[] = [];
        const classVisitor: ts.Visitor = (child) => {
          if (
            ts.isStringLiteral(child) ||
            ts.isNoSubstitutionTemplateLiteral(child)
          ) {
            const text = child.text
              .replaceAll("data-open:", "data-[state=open]:")
              .replaceAll("data-closed:", "data-[state=closed]:")
              .replaceAll(
                "--anchor-width",
                component === "DropdownMenuContent"
                  ? "--radix-dropdown-menu-trigger-width"
                  : "--anchor-width"
              );
            if (text !== child.text) {
              changed = true;
              return factory.createStringLiteral(text);
            }
          }
          return ts.visitEachChild(child, classVisitor, context);
        };
        const transformAttribute = (attribute: ts.JsxAttributeLike): void => {
          if (
            !ts.isJsxAttribute(attribute) ||
            !ts.isIdentifier(attribute.name)
          ) {
            properties.push(attribute);
            return;
          }
          const name = attribute.name.text;
          const { initializer } = attribute;
          const renamed = radixAttributeNames.get(`${component}.${name}`);
          if (renamed !== undefined) {
            properties.push(
              factory.updateJsxAttribute(
                attribute,
                factory.createIdentifier(renamed),
                initializer
              )
            );
            changed = true;
            return;
          }
          if (
            name === "render" &&
            initializer !== undefined &&
            ts.isJsxExpression(initializer)
          ) {
            render = initializer.expression;
            changed = true;
            return;
          }
          if (
            name === "nativeButton" ||
            (name === "items" && component === "Select")
          ) {
            changed = true;
            return;
          }
          if (
            name === "closeOnClick" &&
            component.startsWith("DropdownMenu") &&
            isFalseAttribute(attribute)
          ) {
            properties.push(
              factory.createJsxAttribute(
                factory.createIdentifier("onSelect"),
                factory.createJsxExpression(
                  undefined,
                  factory.createArrowFunction(
                    undefined,
                    undefined,
                    [
                      factory.createParameterDeclaration(
                        undefined,
                        undefined,
                        "event"
                      ),
                    ],
                    undefined,
                    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    factory.createBlock(
                      [
                        factory.createExpressionStatement(
                          factory.createCallExpression(
                            factory.createPropertyAccessExpression(
                              factory.createIdentifier("event"),
                              "preventDefault"
                            ),
                            undefined,
                            []
                          )
                        ),
                      ],
                      true
                    )
                  )
                )
              )
            );
            changed = true;
            return;
          }
          if (name === "closeOnClick" && component.startsWith("DropdownMenu")) {
            changed = true;
            return;
          }
          // This maintained compound component splits root and trigger across functions.
          if (
            fileName.endsWith("ai-elements/context.tsx") &&
            component === "HoverCardTrigger" &&
            ["delay", "closeDelay"].includes(name)
          ) {
            changed = true;
            return;
          }
          if (name === "className") {
            properties.push(
              ts.visitNode(attribute, classVisitor, ts.isJsxAttribute) ??
                attribute
            );
          } else {
            properties.push(attribute);
          }
        };
        for (const attribute of opening.attributes.properties) {
          transformAttribute(attribute);
        }
        if (
          fileName.endsWith("ai-elements/context.tsx") &&
          component === "HoverCard" &&
          !properties.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              ts.isIdentifier(attribute.name) &&
              attribute.name.text === "openDelay"
          )
        ) {
          properties.unshift(
            factory.createJsxAttribute(
              factory.createIdentifier("openDelay"),
              factory.createJsxExpression(
                undefined,
                factory.createNumericLiteral(0)
              )
            ),
            factory.createJsxAttribute(
              factory.createIdentifier("closeDelay"),
              factory.createJsxExpression(
                undefined,
                factory.createNumericLiteral(0)
              )
            )
          );
          changed = true;
        }
        const children = ts.isJsxElement(visited) ? [...visited.children] : [];
        if (render) {
          properties.push(
            factory.createJsxAttribute(
              factory.createIdentifier("asChild"),
              // oxlint-disable-next-line unicorn/no-useless-undefined -- TypeScript requires the initializer argument for a boolean JSX attribute.
              undefined
            )
          );
          const child = renderChild(render, children, component);
          return factory.createJsxElement(
            factory.createJsxOpeningElement(
              opening.tagName,
              opening.typeArguments,
              factory.createJsxAttributes(properties)
            ),
            [child],
            factory.createJsxClosingElement(opening.tagName)
          );
        }
        const attributes = factory.createJsxAttributes(properties);
        return ts.isJsxElement(visited)
          ? factory.updateJsxElement(
              visited,
              factory.updateJsxOpeningElement(
                visited.openingElement,
                opening.tagName,
                opening.typeArguments,
                attributes
              ),
              visited.children,
              visited.closingElement
            )
          : factory.updateJsxSelfClosingElement(
              visited,
              visited.tagName,
              visited.typeArguments,
              attributes
            );
      };
      return (root) => ts.visitNode(root, visit, ts.isSourceFile) ?? root;
    },
  ]);
  try {
    const [output] = transformed.transformed;
    return changed && output !== undefined
      ? ts.createPrinter().printFile(output)
      : source;
  } finally {
    transformed.dispose();
  }
};
