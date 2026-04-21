# Source-First Output Design

## Goal

Make ThinkFlow formal output generation source-first.

The user should be able to create reports, mind maps, podcasts, and PPT outputs directly from selected sources. A structured document may enhance the result, but it must not be a required bridge and the system must not automatically create a source-derived document just to satisfy the output pipeline.

The selected product rule is:

```text
Sources + optional document/reference documents + optional guidance -> output
```

No new Brief object is introduced in this iteration.

## Product Rationale

The current product direction is to make Chat and sources the main path into output. Structured documents remain valuable as independent user-maintained artifacts, but they should not be the default prerequisite for every generated result.

The current implementation still treats a document as mandatory for non-PPT outputs. The frontend works around this by automatically generating a "source-derived document" when the user has sources but no active document. That behavior makes the product feel like "sources -> document -> output", which conflicts with the intended source-first model.

This change removes that bridge behavior.

## Scope

In scope:

- `frontend` output creation flow
- `fastapi_app/services/output_v2_service.py`
- Output context validation for non-PPT output types
- Prompt/context assembly for report, mind map, and podcast generation
- UI wording that currently says a source-derived document will be generated
- Tests for creating non-PPT output without `document_id`

Out of scope:

- Creating a new Brief data model
- Creating Skill Template support
- Removing summary, guidance, or document features
- Changing PPT source-lock behavior beyond keeping it source-first-compatible
- Redesigning the output workspace UI
- Migrating existing output artifacts

## Current Behavior

The frontend resolves output inputs in `resolveOutputCreationInputs()`.

For non-PPT outputs, if there is no active document or the document is empty, it calls `buildSourceDerivedDocument()`. That function asks `/api/v1/kb/chat` to generate a markdown source summary, creates a document, saves the generated content, and then uses that new document as the output's required document.

The backend reinforces this by rejecting non-PPT outline creation when `document_id` is missing.

The result is that non-PPT output cannot currently be truly source-first.

## Target Behavior

### Input Rules

All output types should accept this input model:

- At least one selected source, or
- At least one selected/bound document, or
- At least one selected guidance item, or
- A non-empty active document

For non-PPT outputs, `document_id` is optional.

If no usable input exists, the UI and backend should reject the request with a clear message:

```text
请先选择至少一个来源，或选择一份梳理文档 / 参考文档 / 产出指导。
```

### Document Rules

Documents remain supported in three ways:

- The active document may be used as an optional primary structured context.
- Bound/reference documents may be used as optional supplemental context.
- Users may still manually create and maintain documents.

The system must not automatically create a document only because the output pipeline needs one.

### Source Rules

Selected sources are the primary factual input when present.

For source-first outputs, the output artifact must retain the same source snapshot fields already used by the output pipeline:

- `source_paths`
- `source_names`

If no `document_id` is provided, the output item should still be persisted normally, with `document_id` set to an empty string.

## Frontend Design

### Resolve Inputs

Update `resolveOutputCreationInputs()` so non-PPT output no longer calls `buildSourceDerivedDocument()`.

Instead:

- Preserve selected source IDs, paths, and names.
- Preserve selected guidance item IDs.
- Preserve bound/reference document IDs.
- Preserve active document ID/content only if a real active document exists and has content.
- Validate that at least one usable input exists.

`deferSourceDerivedDocument` should be removed or made irrelevant because source-derived document creation is no longer part of the flow.

### Direct Output Intent

The direct output confirmation modal should describe the actual locked context:

- Sources
- Optional structured document/reference documents
- Optional guidance

It should not say that a document will be generated before continuing.

The placeholder title currently saying "将基于当前来源自动生成梳理文档" should be replaced with source-first language, such as:

```text
基于当前来源直接生成
```

### Removed Auto-Bridge

`buildSourceDerivedDocument()` should no longer be used by output creation.

It may be deleted if no other feature uses it. If retained temporarily, it must not be part of the output flow.

### Output Payload

The outline payload should allow:

```json
{
  "document_id": "",
  "source_paths": ["..."],
  "source_names": ["..."],
  "bound_document_ids": [],
  "guidance_item_ids": []
}
```

for non-PPT output types.

## Backend Design

### Outline Creation Validation

Update `OutputV2Service.create_outline()` so `document_id` is not mandatory for non-PPT outputs.

Validation should require at least one usable context input:

- loaded document content
- normalized source paths
- bound documents
- guidance snapshot text

If all are empty, raise `400`.

### Context Assembly

For non-PPT fallback outline generation, the context should be assembled from:

1. Optional active document content
2. Optional bound/reference documents
3. Optional guidance snapshot text
4. Selected source names and paths as source metadata

The existing fallback outline function does not read source file contents directly. That is acceptable for this iteration only if final generation reads sources elsewhere. If final non-PPT generation also only consumes the source document markdown, then generation context must be extended in the same change so selected source files are included through the existing source-reading mechanisms or a source summary step.

The implementation must verify this path before coding the final change.

### Persistence

Output items created without a document should persist cleanly:

- `document_id`: empty string
- `source_document_path`: empty string unless a real document was provided
- `source_paths`: selected source paths
- `source_names`: selected source names
- `bound_document_ids`: selected bound documents
- `guidance_item_ids`: selected guidance items

Existing output loading should not assume `document_id` is non-empty.

## Prompting Rules

Prompts should describe the hierarchy explicitly:

```text
来源是事实主输入。
梳理文档和参考文档是可选增强上下文。
产出指导只约束重点、风格和组织方式，不能引入来源中没有的事实。
```

For non-PPT outputs without a document, avoid language like:

```text
基于梳理文档生成
```

Use source-first language instead:

```text
基于本次选定来源生成
```

## Error Handling

Frontend validation should catch empty input before calling the backend.

Backend validation remains authoritative and should return `400` for truly empty input.

If source file reading fails during final generation, the error should mention the source issue, not ask the user to create a document.

## Tests

Add or update tests for:

- Non-PPT outline creation succeeds with sources and no `document_id`.
- Non-PPT outline creation succeeds with bound documents and no `document_id`.
- Non-PPT outline creation fails with no document, no sources, no bound documents, and no guidance.
- Frontend no longer calls source-derived document creation when confirming direct output.
- UI copy no longer says it will automatically generate a source-derived structured document.

Keep existing PPT tests passing.

## Implementation Notes

The first implementation pass should inspect non-PPT final generation before editing. The key risk is that outline creation may accept source paths, but final generation may still rely on `source_document.md` content. If so, this change must update both outline creation and final generation context assembly in the same pass.

Do not introduce the Brief object in this change. If later needed, it should be a separate product and data-model change.

## Acceptance Criteria

- A user can select sources and generate a non-PPT output without any active structured document.
- No source-derived document is automatically created during output generation.
- The output record stores selected sources and optional context.
- Existing document-based output still works.
- UI wording clearly says documents are optional enhancement, not required bridge.
- Backend rejects only truly empty context, not missing `document_id`.
