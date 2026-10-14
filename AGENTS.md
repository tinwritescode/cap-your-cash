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
