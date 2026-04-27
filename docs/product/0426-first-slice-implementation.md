# 0426 ThinkFlow First Slice Implementation

This document records the implemented first slice for `docs/product/0426产品交互逻辑梳理.md`.

## Layout Contract

- The main workspace keeps the three-column layout:
  - Left: conversations, materials, outputs.
  - Center: conversation area.
  - Right: document workbench.
- PPT/output workspace may use a special output mode, but the normal ThinkFlow workspace must not collapse into a two-column chat/document layout.

## Backend

- Conversation workspace state is persisted per conversation:
  - `source_refs`
  - `active_document_id`
  - `last_sent_at`
- Document metadata is persisted per document:
  - `document_type`
  - `focus_state`
  - `stash_items`
  - `change_logs`
  - arbitrary `metadata`
- Chat context is assembled server-side from the active document, focus, source refs, recent change logs, history, and the new user message.
- Structured document push supports:
  - target: focus, section, new section, stash, document end
  - transform: raw append, AI append, AI merge
  - trace and change-log records
- Output documents can be created as `document_type = output_doc` with output metadata.

## Frontend

- The center column has a conversation source row backed by conversation `source_refs`.
- Chat send uses backend-built context and marks the conversation as sent after a successful answer.
- The right panel normal mode is now the document workbench shell rather than the old summary/document/guidance mode switch.
- Displayed document and conversation active document are tracked separately.
- Document tabs show the active document marker.
- The document workbench shows:
  - focus bar
  - active-document mismatch warning
  - selectable `##` section focus rail
  - stash area
  - recent change strip
- Push actions are available for both user and assistant messages.
- Multi-message push opens the same structured document push flow.
- Push popover is target/transform based, not summary/document/guidance destination based.
- Output documents can be created from the document workbench and remain separate from final output artifacts in the outputs tab.

## Known Deferred Work

- A full output-document wizard with range checkboxes for every selected summary document still needs a richer UI.
- Output-document metadata editing is stored at creation time in this slice; a dedicated settings editor remains to be added.
- PPT output generation continues to reuse the existing output-v2 path. The output document can be used as the active document/source, but the output workbench has not been fully rebuilt around output-document phases.
- Manual smoke testing should still cover: upload source, create conversation, add source refs, activate document, focus section, push message, inspect change log.
