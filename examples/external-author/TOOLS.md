# Provisional external tool author guide

These source examples target the PR #318 snapshot `1b47cffe`. They are ordinary
shadcn registry items, with native Eve tools and the generated app's existing
`toolRenderer` helper. They do not establish a universal extension contract.

## Item files and composition

Copy files preserving their paths relative to `registry-source`, with explicit
`~/` targets. A drawing item includes `agent/tools/draw_svg.ts`,
`lib/author-svg-contract.ts`, and both files in `components/author-svg/`.
Its `meta.chatjs.requires` is `["eve"]` and `renderers` contains
`{ "mount": "draw_svg", "path": "./components/author-svg/client", "export": "SvgResult" }`.

A search item includes `agent/tools/author_search.ts`,
`lib/author-search-contract.ts`, `lib/author-search.server.ts`, and both files in
`components/author-search/`. Its renderer declaration uses mount `author_search`,
path `./components/author-search/client`, and export `SearchResult`.

Both need the selected minimal app's `lib/tool-renderer.tsx`, Eve, React and Zod.
They add no package dependencies beyond that base. A standalone item is not a
complete app; include the minimal recipe and its required providers in the shared
selection. The companion registry/harness supplies the concrete local install
instruction. Publishing those JSON items is intentionally outside this proof.
The renderer mount must match the final root Eve tool name. Installing a backend
file alone is not evidence that its rendered result is wired correctly.

## Drawing contract

The drawing tool uses native Eve `approval.request: always()` and permits only
responses from the session initiator. The generated app's existing pending-input
controls own approval; the output renderer cannot grant it. This example requires
explicit approval to exercise the interaction boundary, even though drawing has
no external side effects. On a fresh run, no SVG result should render before
approval. Reload while pending must preserve the request; approving then produces
the drawing. A later reload must replay that result without asking again.

The model passes `{ title, shapes }`; the result has the same inferred Zod shape.
The 512×512 canvas accepts 1–32 circles or rectangles. Coordinates, dimensions and
radii are bounded. Shapes use a six-color enum. Shapes extending beyond the
canvas are clipped by SVG. No raw SVG, external references, style strings, links
or event handlers are accepted. The renderer constructs native SVG elements and
uses React text escaping for the title. This is a small drawing tool, not an
arbitrary SVG editor.

A valid invocation/result is:

```json
{"title":"Blue circle","shapes":[{"kind":"circle","x":256,"y":256,"radius":80,"fill":"blue"}]}
```

Reject malformed output, empty/oversized arrays, unknown fields, URL paints,
non-finite/out-of-range numbers and raw markup. A mismatched renderer prop type
must fail the generated-app typecheck. Schema rejection should show the base
helper's unavailable state, without loading the result renderer.

## Alternative search contract

The server environment sets `AUTHOR_SEARCH_ENDPOINT` to an HTTP(S) endpoint
without userinfo, query parameters or fragments. Optional `AUTHOR_SEARCH_KEY`
becomes an Authorization bearer header. The model can choose only a query, not
an endpoint. Use HTTPS for a remote endpoint; plain HTTP exists for the local
fixture. Keep both variables out of shared selection files and client code.

The endpoint receives a POST with JSON `{ "query": "tree histories" }` and
returns:

```json
{"results":[{"title":"History guide","url":"https://example.com/history","snippet":"A short result excerpt."}]}
```

Queries are trimmed and bounded to 300 characters. Output has at most ten
results; titles, snippets and HTTP(S) URLs are bounded, and URLs cannot contain
userinfo. The response body is capped at 64 KiB while streaming and the entire
request/body read has a five-second abort timer. Redirects fail rather than
forwarding credentials. Every failure returns one generic error without provider
body, URL or key details. This timeout is local request cancellation, not a claim
that Eve session cancellation immediately aborts providers.

Conformance should exercise success, malformed JSON/schema, oversized streamed
body, delayed body, non-2xx response and redirect rejection. The fixture should
assert request method, query and authorization. Behavioral tests need only local
HTTP credentials; a passing fixture is not evidence of a live search provider's
quality or authentication contract. Search results are escaped text and external
links, not raw HTML. Endpoint operators control returned public content; they
must not include secrets in successful result fields.

## Import and evidence boundaries

Client entrypoints import only the shared schema, the existing browser helper and
a dynamic import of their renderer. The HTTP module is referenced only by the
backend tool and reads environment variables at execution time. Its `.server.ts`
filename documents ownership; it is not a package-enforced import guard. Bundle
checks must verify that endpoint/key code stays outside client chunks. Browser
checks must verify lazy loading, SVG accessibility/title, result links and invalid
output behavior. Generated-app types prove shape; HTTP and browser fixtures prove
separate behaviors. Unexecuted checks remain pending in the parent evidence.

## Executable local conformance

Copy `conformance.tsx` into the installed studio app root and run
`bun conformance.tsx`, then the generated app's `bun run test:types`. It imports
installed source, uses a local Node HTTP fixture and restores the previous server
environment afterward. It checks schema negatives, invalid-output SSR without a
lazy load, authenticated HTTP success, six HTTP negatives, and redirect refusal.
A compile-only `@ts-expect-error` checks rejection of incompatible renderer props.
A stalled partial response exercises the five-second body-read deadline. This
does not prove upstream session cancellation. Successful lazy loading and rendered
SVG interactions require the parent browser journey.
