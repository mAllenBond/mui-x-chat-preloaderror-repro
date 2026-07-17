<!--
DRAFT for mui/mui-x "Bug report 🐛" (.github/ISSUE_TEMPLATE/1.bug.yml).
Nothing here has been submitted. Review, then file it yourself at:
https://github.com/mui/mui-x/issues/new?template=1.bug.yml
Each ## heading below maps to a field in the issue form.
-->

## Title
[x-chat] Rendering an assistant markdown reply fires a global `vite:preloadError` on every reply in a production build (`import('remend')` can never resolve in a browser bundle)

## Search keywords
x-chat, ChatBox, vite:preloadError, remend, preloadError, renderStreamingMarkdown, streamingMarkdownRepair, rolldown, production build

## Latest version
- [x] I have tested the latest version  (`@mui/x-chat` 9.0.0-alpha.13 — current `latest` on npm)

## Affected products
_(leave blank — Chat is not in the dropdown list)_

## Steps to reproduce
**Live example (hosted production build):** https://mallenbond.github.io/mui-x-chat-preloaderror-repro/
Source repo: https://github.com/mAllenBond/mui-x-chat-preloaderror-repro

Steps:
1. Open the live example above.
2. Type anything into `<ChatBox>` and send.
3. The assistant echoes a markdown reply, and the on-page log turns red:
   `vite:preloadError fired -> Failed to resolve module specifier 'remend'`.

> The demo's handler logs the event and calls `event.preventDefault()` instead of
> `window.location.reload()`, so the page does **not** reload — that is only to keep the
> bug observable. The event still fires on every reply; an app using Vite's documented
> reload recipe would reload-loop here. `preventDefault()` does not prevent the event
> from being dispatched, which is the bug.

The live example is the actual `vite build` output served as a static site (GitHub
Pages), which is all `vite preview` is — so it reproduces the bug directly. To run it
locally instead:

```bash
git clone https://github.com/mAllenBond/mui-x-chat-preloaderror-repro
cd mui-x-chat-preloaderror-repro
npm install
npm run build
npm run preview   # http://localhost:4173
```

This only manifests in a **production build**; with `npm run dev` the event never fires
(`__vitePreload` exists only in build output).

## Current behavior
In a production build, sending a message dispatches a global `vite:preloadError`:

```
vite:preloadError -> TypeError: Failed to resolve module specifier 'remend'
```

`@mui/x-chat` renders assistant replies through `renderStreamingMarkdown`
(`ChatMessage/renderMarkdown.mjs`) → `useStreamingMarkdownRepair` → `loadRemend`
in `internals/streamingMarkdownRepair.mjs`, which lazily does:

```js
const REMEND_SPECIFIER = 'remend';
function defaultRemendImporter() {
  return import(/* @vite-ignore */ /* webpackIgnore: true */ REMEND_SPECIFIER);
}
```

Two problems:

1. **`remend` is a bare specifier**, so `import('remend')` can never resolve at runtime in
   a browser bundle (no import map). The `.catch(() => fallbackRepair)` always runs, so the
   richer `remend` repair is effectively dead code in any bundled browser app — independent
   of the bundler.
2. **Under Vite 8 (rolldown)** the unresolvable import is wrapped in `__vitePreload`
   (`MT(() => import(PT), [])`). `__vitePreload` ends in `baseModule().catch(handlePreloadError)`,
   and `handlePreloadError` dispatches the global `vite:preloadError` for any rejection.
   MUI's own `.catch` runs too late to suppress it. Apps following Vite's documented
   [load-error reload recipe](https://vite.dev/guide/build#load-error-handling)
   (`vite:preloadError` → `window.location.reload()`) therefore reload on **every**
   assistant reply — an infinite loop. (Rollup-based Vite 7 left the variable-specifier
   import unwrapped, so the event never fired there.)

## Expected behavior
Rendering an assistant markdown reply should not dispatch a global error event. The
intended `remend` upgrade should either resolve or degrade silently to `fallbackRepair`
with no side effects.

Suggested direction: fix (1) regardless of bundler — resolve `remend` to a static
specifier the bundler can code-split, gate the attempt to environments where it can
resolve, or drop the lazy upgrade for the browser build. Fixing (1) also removes (2),
since there is no longer an unresolvable import for `__vitePreload` to wrap.

## Context
Building an app with `<ChatBox>`. The app follows Vite's documented `vite:preloadError`
reload recipe, so the spurious event reloads the page on every assistant reply.

Key detail for reproduction: **this only manifests in a production build**
(`vite build` + `vite preview`), because `__vitePreload` exists only in build output.
With `vite dev` the event never fires. Reproduces with or without `build.modulePreload: false`.

## Your environment
<details>
  <summary><code>npx @mui/envinfo</code></summary>

```
  System:
    OS: Windows 11 10.0.26200
  Binaries:
    Node: 24.18.0
    npm: 11.16.0
  Browsers:
    Chrome: 150.0.7871.124
  npmPackages:
    @emotion/react: ^11.13.0 => 11.14.0
    @emotion/styled: ^11.13.0 => 11.14.1
    @mui/icons-material: ^9.2.0 => 9.2.0
    @mui/material: ^9.2.0 => 9.2.0
    @mui/x-chat: 9.0.0-alpha.13 => 9.0.0-alpha.13
    @mui/x-chat-headless: 9.0.0-alpha.13 => 9.0.0-alpha.13
    react: ^19.0.0 => 19.2.7
    react-dom: ^19.0.0 => 19.2.7
```
Build tooling: vite 8.1.5 (rolldown), @vitejs/plugin-react 5.2.0.
The dispatched `vite:preloadError` originates in Vite's runtime, so it is
browser-independent; observed in Chrome 150.
</details>

## Order ID or Support key
_(optional — leave blank)_
