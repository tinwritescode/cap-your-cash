<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- All financial writes (create/edit/trash/restore transactions + photo metadata) go through Postgres SECURITY DEFINER RPCs; clients only SELECT transactions/photos. Why: server-side validation, idempotency and version conflicts.
- Totals, balances and reports come from SQL functions using Asia/Ho_Chi_Minh boundaries; client helpers in src/lib/finance.ts mirror them for display only. Why: one source of financial truth.
- No financial data in localStorage/IndexedDB/service worker caches; unsaved forms live only in memory. Why: online-only product requirement.
- Storage photos live at <uid>/<txId>/<photoId>; cleanup/purge runs from /api/public/jobs/cleanup on a daily schedule. Why: owner-scoped RLS and retryable deletion.
- Accent contrast is auto-tuned per light/dark mode and checked with WCAG ratios in src/lib/themes.ts; its BG values must mirror src/styles.css. Why: theme colours stay readable.

## UI component rules

`src/components/ui/` is the canonical primitive registry. Before adding or changing UI, search it and existing domain components with `rg`; reuse the existing primitive before creating another one. Each control type has one canonical primitive: one `Input`, one `Button`, one `Select`, one `Textarea`, one `Card`, and so on. A domain component may compose a primitive and add domain behavior, but it must not replace or fork the primitive.

Routes orchestrate data, mutations, navigation, and state. Routes render components and pass props; they do not own control markup or control behavior. Keep native controls, visual `className` rules, event handlers for controls, validation, loading, error, empty, and interaction states inside the responsible component. In `src/routes`, use the canonical component instead of raw `input`, `button`, `select`, `textarea`, or `label` elements. A route may keep layout composition and page-level orchestration.

Component boundaries follow meaning and behavior. Extract reusable controls and repeated UI patterns. Do not create one-use wrappers only to hide JSX from a route. A component needs a clear responsibility and prop API. Prefer variants and composition over copied markup when the responsibility is the same.

Keep UI code DRY by responsibility. Remove duplicated logic or markup with the same responsibility in the touched area before finishing a task. Do not merge unrelated domain concepts only because their markup looks similar. Report pre-existing duplication outside the touched area instead of expanding scope without instruction.

Native elements are allowed inside their canonical primitive, an adapter that must wrap a third-party library, or an accessibility/platform fallback. Keep those exceptions out of routes, document the reason beside the implementation, and report the exception in the final summary. File upload and camera inputs belong in their dedicated component.

Financial and profile writes follow the same boundary rule as UI: call the approved SECURITY DEFINER RPC from the data layer. Do not call direct Supabase `insert`, `update`, `delete`, or `upsert` for protected writes from routes or presentational components.

## Agent workflow for UI changes

1. Read this file and locate the canonical primitive and the closest existing pattern with `rg`.
2. Decide the lowest responsible layer: primitive, shared pattern, domain component, or route orchestration.
3. Reuse or extend that layer. Do not add a second primitive for the same control type.
4. Keep routes free of native control markup and control UI logic.
5. Run `bun run lint:architecture`, `bun run duplication:check`, and relevant tests. Update `.architecture-baseline.json` or `.jscpd-baseline.json` only after review; do not replace them with a broad ignore.
6. Report reused components, new components, duplication removed or deferred, and every documented exception.

New violations fail review. Existing violations are migration work: do not add to them, fix violations in files the task already touches, and track broader cleanup separately with an explicit baseline. The baseline must shrink over time and must not hide new clones or new route-level controls.

## Completion gate

UI work is complete only when the touched routes use canonical components, touched components have one clear responsibility, no new same-responsibility duplication exists, protected writes use the data-layer RPC path, and architecture lint, duplication check, and relevant tests pass.
