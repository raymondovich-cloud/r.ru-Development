# Development Agent Rules

**Document version:** 1.0.0  
**Status:** Active  
**Scope:** All development work in the r.ru-Development repository.

## 1. General requirements

- Before making changes, inspect the existing repository structure and the files relevant to the task.
- Follow the established architecture and conventions. Do not introduce a parallel implementation without an explicit architectural decision.
- Keep changes limited to the requested scope.
- Do not silently delete, replace, or rewrite existing project functionality.
- Verify the result after each implementation step and report the files changed.

## 2. Naming conventions

- Use lowercase names for all files and directories.
- Replace spaces in file and directory names with hyphens (`-`).
- Use consistent naming within each module.

## 3. File versioning

- Every change to a file must be reflected in that file's version.
- Keep the version in a clear, consistent location appropriate to the file format.
- For this document, update the **Document version** when its contents change.

## 4. Clean architecture and domain boundaries

The five root domains are:

- `profile`
- `ideas`
- `team`
- `tools`
- `projects`

Each root domain must have its own directory under `source/domain/`. Domain-specific functionality belongs inside its owning domain.

- Do not mix unrelated domain responsibilities in one module.
- Do not place domain logic in another domain merely for convenience.
- Cross-domain relationships and shared coordination must be implemented outside the individual domain boundaries, in an explicitly designated shared/application layer.
- Keep dependencies explicit and avoid circular dependencies.

## 5. Visual layer

- All visual-layer code and styles must be located under `source/design-sistem/`.
- Do not add visual styles elsewhere.
- Do not use inline `<style>` blocks, `style` attributes, `element.style`, or CSS embedded in JavaScript.
- Use semantic design tokens for colors and other shared visual values.
- Keep presentation separate from domain and business logic.

## 6. Technology constraints

Unless the project owner explicitly approves a change:

- Use vanilla JavaScript with ES modules.
- Do not introduce frontend frameworks, bundlers, a `package.json`, or additional dependencies.
- Preserve the existing application and routing approach.
- Do not change backend schemas, access policies, authentication, or routes as part of a visual-only task.

## 7. Change and verification workflow

1. Inspect the relevant files and current implementation.
2. Identify the owning domain and the correct architectural layer.
3. Make the smallest complete change that satisfies the request.
4. Update the version of every modified file.
5. Check imports, references, naming, and architecture boundaries.
6. Run available relevant checks; if checks cannot be run, state that explicitly.
7. Summarize the implementation, changed files, verification performed, and any remaining limitations.

## 8. Conflict resolution

If a task conflicts with these rules or the existing architecture, do not guess. Explain the conflict and request a decision before making a change that would weaken or bypass these requirements.
