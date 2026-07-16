<!--
Draft GitHub issue for mui/mui-x. Copy the body below the divider.
Attach screenshot.png and link the repro (push this folder to a repo, or import into
a StackBlitz Vite-React project — but note the bug only shows in a BUILT preview,
not the StackBlitz dev server).
-->

**Title:** `[x-chat] import('remend') can never resolve in a browser bundle; under Vite 8 it also fires a spurious global vite:preloadError on every assistant reply`

---

### Summary

`@mui/x-chat` renders assistant replies through `renderStreamingMarkdown`, which lazily does `import('remend')` to upgrade its markdown repair. In any browser bundle this import can never resolve, so `remend` never loads and `fallbackRepair` is always used. Under **Vite 8 (rolldown)** there is a second, more visible consequence: the rejected import dispatches a global `vite:preloadError`, so apps that follow Vite's [documented reload recipe](https://vite.dev/guide/build#load-error-handling) reload the page on **every assistant reply**.

### Expected behavior

Rendering an assistant markdown reply should not dispatch a global error event, and the intended `remend` upgrade should either load or degrade silently to `fallbackRepair` without side effects.

### Actual behavior

In a production build, sending a message dispatches:

```
vite:preloadError -> TypeError: Failed to resolve module specifier 'remend'
```

With the documented `vite:preloadError` → `window.location.reload()` handler, this is an infinite reload loop: every reply reloads the page, which re-renders the reply, which reloads again. It does **not** reproduce with `vite dev`.

### Root cause

`internals/streamingMarkdownRepair.mjs` (9.0.0-alpha.13):

```js
const REMEND_SPECIFIER = 'remend';
function defaultRemendImporter() {
  return import(/* @vite-ignore */ /* webpackIgnore: true */ REMEND_SPECIFIER);
}
```

Reached on every assistant reply via `ChatMessage/renderMarkdown.mjs` → `useStreamingMarkdownRepair` → `loadRemend`, which is designed to degrade: `.then(...).catch(() => fallbackRepair)`.

Two problems:

1. **`remend` is a bare specifier.** With no import map, a browser cannot resolve `import('remend')` at runtime — it throws `Failed to resolve module specifier 'remend'`. This is true in **every** bundled browser app (Vite 7, Vite 8, webpack). So the `remend` upgrade never happens and `fallbackRepair` is effectively the only code path. The richer repair is dead code in a browser.

2. **Under Vite 8 (rolldown), the import is wrapped in `__vitePreload`**, e.g. `MT(() => import(PT), [])` where `MT` is `__vitePreload`. That helper ends in `baseModule().catch(handlePreloadError)`, and `handlePreloadError` dispatches the global `vite:preloadError` for any rejection. MUI's own `.catch(() => fallbackRepair)` runs too late — Vite dispatches the event before the rejection reaches it. (Rollup-based Vite 7 left this variable-specifier import unwrapped, so the event never fired there. The `@vite-ignore` hint is honored in both — it keeps the specifier bare — but rolldown additionally wraps it, which is arguably a separate rolldown/Vite question. The dead-code problem in (1), however, is independent of the bundler.)

### Reproduction

Minimal repro (`<ChatBox>` + `createEchoAdapter`, ~40 lines): <LINK>

```bash
npm install
npm run build
npm run preview   # http://localhost:4173
```

Send any message. The on-page log turns red with the `vite:preloadError`. (The repro calls `event.preventDefault()` only so the page is observable instead of reload-looping.) With `npm run dev`, the event never fires — `__vitePreload` only exists in build output.

### Environment

- `@mui/x-chat` 9.0.0-alpha.13
- `vite` 8.1.4 (rolldown)
- `react` / `react-dom` 19.2

### Suggested direction

The dead-code issue (1) is worth fixing regardless of bundler: a bare `import('remend')` cannot work in a browser bundle, so either resolve `remend` to something a bundler will include (a static specifier it can code-split), gate the attempt to environments where it can resolve, or drop the lazy upgrade for the browser build. Fixing (1) also removes (2), since there would no longer be an unresolvable import for `__vitePreload` to wrap.
