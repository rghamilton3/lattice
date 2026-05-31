# Contract: Annotation Search Results

The existing search endpoints must include annotation matches in the normal result set when annotation comment text matches the query.

## Result Requirements

When a match comes from annotation text, the result must include enough context for Surface to open the annotated source and identify the matching annotation.

Required fields for annotation-origin matches:

- `kind`: Existing search result kind or an annotation-aware kind supported by Surface.
- `id`: The original target id or a stable result id that Surface can route from.
- `title`: Target title or a readable fallback.
- `snippet`: Snippet containing matched annotation/comment context.
- `target_kind`: One of `capture`, `local_file`, `working`, `archive`.
- `target_id`: Original annotated target id.
- `annotation_id`: Matching annotation id.

Rules:

- Opening the result must navigate to the annotated source item, not to a detached annotation-only page.
- Surface must be able to highlight or otherwise reveal the annotation that caused the match.
- Deleted annotations must not appear in search results.
- Diagram source remains searchable as working-doc markdown content through existing working-doc indexing.
