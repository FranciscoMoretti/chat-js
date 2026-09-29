# Tools instalables y contrato EVE

Investigación del 2026-09-27. Alcance: contrato de autoría, ejecución durable y accounting; no implementación ni ejecución de tests.

Este documento conserva el diagnóstico previo a la implementación. La integración actual está documentada en [Authoring Tools](../apps/docs/tools/authoring.mdx): un único contrato nativo EVE versión 1 para tools instaladas y custom, renderers inferidos de sus schemas y recibos genéricos. Las alternativas y asimetrías descritas abajo son históricas.

## Fuentes y versión

ChatJS instala `eve` como `npm:@chat-js/eve@0.61.0-chatjs.0`, no upstream sin modificaciones. La documentación y los tipos incluidos en ese paquete son la referencia para lo que funciona hoy. El fork corresponde al [commit publicado](https://github.com/FranciscoMoretti/eve/tree/3a7acfe6ba42a8dc9d330132b11856962a675705); ver también [desarrollo del paquete](./eve-package-development.md). No hay checkout en `/Users/fran/code/eve`.

Documentación primaria pública para la discusión:

- [Tools: defineTool, contexto, streaming y errores](https://eve.dev/docs/tools).
- [Workflow tools: waits, pasos, cancelación y cleanup](https://eve.dev/docs/tools/workflows).
- [Modelo de ejecución y durabilidad](https://eve.dev/docs/concepts/execution-model-and-durability).
- [Aprobaciones e interacción humana](https://eve.dev/docs/tools/human-in-the-loop).
- [Instrumentación](https://eve.dev/docs/guides/instrumentation).
- [Connections para MCP y OpenAPI](https://eve.dev/docs/connections).

La página pública de Tools fue consultada también en su [versión Markdown](https://eve.dev/docs/tools.md). Las garantías detalladas abajo se contrastaron con los documentos y `.d.ts` del paquete fijado; una URL pública de upstream no demuestra por sí sola compatibilidad con el fork.

## Garantías verificadas

1. **La autoría nativa ya tiene un contrato común.** `defineTool` recibe esquema, descripción, execute, approval y toModelOutput. El contexto incluye session, callId, toolName, abortSignal, sandbox y auth. No expone una API genérica para reportar costo o consumo de APIs externas. Fuentes: [tipos](../apps/chat/node_modules/eve/dist/src/tools/definition.d.ts), [Tools del paquete](../apps/chat/node_modules/eve/docs/tools/overview.mdx).
2. **Usage del modelo no equivale al costo de toda tool.** `model.call.completed` tiene tokens; `step.attempt.metadata` puede llevar información de costo del gateway. `tool.call.completed` tiene output, sin un campo genérico de costo. Un search HTTP o un sandbox pago necesitan evidencia aportada por su integración. Fuente: [tipos de instrumentación](../apps/chat/node_modules/eve/dist/src/instrumentation/lifecycle.d.ts).
3. **Durabilidad no garantiza una sola llamada externa.** Se reproducen resultados de pasos completados; un paso interrumpido puede ejecutarse otra vez. Una excepción de una tool ordinaria produce un error visible al modelo, sin retry automático por clase de error o HTTP status. El proveedor debe aceptar una clave estable de idempotencia, o la app necesita un registro de operación/reconciliación. Aprobación no reemplaza deduplicación. Fuente: [Tools](../apps/chat/node_modules/eve/docs/tools/overview.mdx), [durabilidad](../apps/chat/node_modules/eve/docs/concepts/execution-model-and-durability.mdx).
4. **Cancelación es cooperativa.** La tool ordinaria recibe abortSignal. Las workflow tools permiten pasos y waits durables; su signal sobrevive replay, con una ventana de cleanup documentada. Ninguna de estas propiedades prueba que el proveedor dejó de consumir o cobrar: eso depende del API externo. Fuente: [workflow tools](../apps/chat/node_modules/eve/docs/tools/workflows.mdx).
5. **La instrumentación no debe asumirse como ledger transaccional.** Los providers son concurrentes y sus fallos se aíslan; comparten idempotencyKey para eventos inicial/final. La documentación recomienda `action.*` para el ciclo durable y `tool.call.*` para el límite de ejecución del AI SDK. Fuente: [providers](../apps/chat/node_modules/eve/docs/guides/instrumentation/providers.mdx).

## Asimetría actual de ChatJS

Las tools en `application.ts` (eliminado) pasan por el adaptador AI SDK sin `ChatToolContext`. Las conocidas por nombre como platform tools reciben costAccumulator, uploads, modelos y ownership del sandbox en `platform-tools.ts` (eliminado). Además, [usage.ts](../apps/chat/lib/eve/usage.ts) filtra nombres platform antes de ingerir el resultado con costo.

El adaptador `adapt-tool.ts` (eliminado) rechaza `needsApproval`, `toModelOutput`, tools provider y descripciones funcionales. No es interoperabilidad completa del AI SDK. La restricción es del adaptador ChatJS: EVE sí tiene aprobaciones y proyección de output nativas.

El [wrapper actual](../apps/chat/lib/eve/platform-operation.ts) preserva costo conocido incluso en ciertos fallos posteriores al trabajo del proveedor. Generalizarlo debe mantener esa propiedad. También arrastra un tipo de progreso específico de research: no es todavía un contrato mínimo y genérico.

## Opciones propuestas — no garantías implementadas

| Opción | Ventaja | Trabajo y límite |
| --- | --- | --- |
| Todas instalables, autoría AI SDK y adaptador común | Menor migración; conserva portabilidad de la implementación | Unificar contexto/receipts/ingestión y mantener traducción explícita de approval, output y otras capacidades |
| Todas instalables, autoría EVE nativa | Usa el contrato del único runtime directamente, incluidas aprobaciones y workflows | Migrar tools y generación del registry; accounting externo sigue necesitando un contrato ChatJS |
| Contrato propietario completo de tools | Libertad para abstraer runtimes | Tercera abstracción y mayor mantenimiento; sin necesidad demostrada hoy |

Recomendación tentativa: todas las capacidades de producto instalables, con ejecución común independiente del origen del registry. Separar distribución de autoría: tanto AI SDK como EVE nativo pueden distribuirse mediante shadcn. Preferir nativo EVE si ChatJS mantiene un único runtime; considerar AI SDK unificado si portabilidad fuera de EVE es un objetivo real.

El core compartido debería aportar identidad de operación, persistencia y accounting, sin importar SDKs de search, sandbox o generación. Cada integración instalada aporta implementación, dependencias, medición y cualquier UI/schema específico. No hace falta una categoría de tool interna para usar servicios comunes.

Decisiones de accounting a explicitar: consumo medido, costo del proveedor y cargo al usuario son conceptos diferentes; `0` significa gratis confirmado, no costo desconocido. Deduplicar una fila por callId evita duplicar el cargo registrado, pero no evita dos consumos reales si un proveedor recibe dos requests. Prueba inicial útil: tool con nombre nuevo instalada en una app mínima, incluyendo éxito, fallo tras consumo, cancelación y recuperación de paso interrumpido.
