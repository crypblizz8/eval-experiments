---
name: manage-specs
description: Create, read, organize, and update Markdown planning artifacts exclusively in a repository's specs/ directory. Use for project plans, task plans, checklists, implementation specs, decision records, research notes, progress updates, and status tracking when the requested deliverables are .md files under specs/. Do not use this skill to implement code or modify files outside specs/.
---

# Manage Specs

Maintain concise, accurate Markdown plans and task records in `specs/` while keeping all file changes inside that directory.

## Enforce the boundary

- Treat `<repository-root>/specs/**/*.md` as the complete working set.
- Read, create, edit, move, or rename only Markdown files inside `specs/`.
- Do not modify source code, configuration, root documentation, generated files, or non-Markdown files.
- Do not move a file into or out of `specs/`.
- If the request requires implementation or changes outside this boundary, update the relevant spec with the proposed work and report that implementation remains out of scope.
- Ask before deleting a document or replacing substantial user-authored content.

## Follow the workflow

1. Locate the repository root and confirm the target resolves beneath `specs/`.
2. Inventory existing documents with `rg --files specs -g '*.md'`.
3. Read the smallest relevant set of documents before editing. Reuse existing terminology, structure, filenames, and status conventions.
4. Select an existing document when it clearly owns the topic. Create a new document only when no suitable owner exists.
5. Make the smallest coherent Markdown edit. Preserve useful history, unresolved questions, and user decisions.
6. Re-read changed documents and inspect the scoped diff. Confirm every changed path is a Markdown file beneath `specs/`.
7. Summarize which spec documents changed and call out unresolved decisions or blockers.

## Write useful planning artifacts

Use only the sections the document needs. Prefer short headings, concrete statements, and checkable outcomes.

### Task plan

Use checkboxes and update them only when evidence supports the status.

```markdown
# Task Plan: <name>

## Goal
<Observable outcome>

## Tasks
- [ ] <Concrete task>
- [ ] <Concrete task>

## Decisions
- <Decision and brief reason>

## Open Questions
- <Question that blocks or changes the work>

## Status
<Current state and next action>
```

### Implementation or project plan

```markdown
# <Name> Plan

## Outcome
<What success looks like>

## Scope
- <Included work>

## Non-goals
- <Explicit exclusion>

## Approach
1. <Ordered step>
2. <Ordered step>

## Verification
- <Test or acceptance criterion>

## Risks and Open Questions
- <Known uncertainty>
```

### Notes or decision record

Separate observations from conclusions. Attribute important sources using Markdown links or repository paths, and never present an assumption as a confirmed decision.

## Maintain document quality

- Prefer kebab-case filenames for new documents, such as `invoice-eval-plan.md`; retain established filenames unless renaming is requested.
- Use repository-relative paths in document prose.
- Keep tasks atomic and begin them with verbs.
- Preserve checked items as a progress record unless they are demonstrably invalid.
- Record decisions in the document that owns the subject; avoid duplicating competing sources of truth.
- Mark unknowns as open questions, assumptions, or risks.
- Do not invent completion evidence, owners, deadlines, commands, metrics, or requirements.
- Keep links and heading hierarchy valid and use CommonMark-compatible Markdown.
