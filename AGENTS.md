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

- Keep budget computations and inverse remaining-balance edits in the browser-safe budget module so all displayed values share one source of truth.
- Inline amount edits adjust the category starting balance rather than rewriting transactions, preserving spending history.
- Persist selected period and committed block ordering with the existing browser budget state; layout settings use a draft until Save Layout.
- Use dnd-kit sortable handles for layout ordering so touch and keyboard interactions share the desktop drag behavior.
- Mount the browser budget provider around all content routes so tab navigation shares existing saved state without reloading or overwriting it.
- Keep Dashboard, Overview and Settings as separate TanStack content routes with shared budget views; recent transactions travel with the spending block so layout reordering preserves their adjacency.
