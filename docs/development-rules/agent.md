# Agent rules

## Naming
1. Use lowercase Latin letters for all file and directory names.
2. Separate multiple words with hyphens (`kebab-case`); never use spaces or underscores.
3. Use established technical terms consistently. The directory is named `design-system`, not a phonetic or misspelled variant.

## Architecture boundaries
1. `source/domain/` contains business concepts, entities, value objects, domain rules, and domain services only. It must not contain UI, navigation, infrastructure, external-service clients, or generic tooling.
2. `source/application/` contains use cases and application orchestration. It coordinates domain logic and ports; it does not implement database, network, or vendor-specific adapters.
3. `source/infrastructure/` contains technical implementations and adapters: database access, external APIs, storage, messaging, and integrations.
4. `source/presentation/` (when introduced) contains browser/Telegram UI, screens, components, routing, and user interaction. Presentation code must call application use cases rather than access infrastructure directly.
5. `source/design-system/` contains shared design tokens, themes, typography, and reusable visual primitives. It must not contain business rules or data access.
6. Keep business domains grouped by responsibility. A folder belongs in `domain` only when it represents a business capability, not merely an interface or technical category.
7. Dependencies point inward: presentation and infrastructure may depend on application contracts; application may depend on domain; domain must remain independent of all outer layers. Avoid circular dependencies.
8. Do not create speculative layers or empty feature folders without an approved requirement. Add a vertical slice only when its use case and ownership are clear.

## Change discipline
1. Before changing structure, inspect the existing tree and relevant documentation.
2. Keep each file and folder responsible for one clear concern.
3. Update imports, references, and documentation whenever a path changes.
4. Do not add secrets, credentials, personal data, or production configuration to the repository.
5. Verify the resulting tree and run available checks before considering a change complete.
