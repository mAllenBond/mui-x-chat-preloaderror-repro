# `@mui/x-chat`: rendering an assistant markdown reply dispatches `vite:preloadError` in a production build

## Summary

In a **production build** (`vite build`), sending a message in `<ChatBox>` dispatches a
global `vite:preloadError` event. Apps that follow Vite's documented
[load-error-handling recipe](https://vite.dev/guide/build#load-error-handling) —
`window.addEventListener('vite:preloadError', () => window.location.reload())` —
therefore **reload the page on every assistant reply**, which is an infinite loop.

It does **not** reproduce with `vite dev`.

## Root cause

`@mui/x-chat` renders assistant replies through `renderStreamingMarkdown`
(`ChatMessage/renderMarkdown.mjs`), which calls `useStreamingMarkdownRepair` →
`loadRemend` in `internals/streamingMarkdownRepair.mjs`:

```js
const REMEND_SPECIFIER = 'remend';
function defaultRemendImporter() {
  return import(/* @vite-ignore */ /* webpackIgnore: true */ REMEND_SPECIFIER);
}
```

The intent is a best-effort upgrade that degrades via `.catch(() => fallbackRepair)`.
Under Vite 8 (rolldown), this dynamic import is wrapped in the `__vitePreload` helper:

```js
var jT = 'remend';
function MT() { return kT(/* __vitePreload */ () => import(jT), []); }
```

`__vitePreload` ends in `baseModule().catch(handlePreloadError)`, and
`handlePreloadError` dispatches `vite:preloadError` for **any** rejection — including
this one. `remend` is a bare specifier with no import map, so the browser throws
`TypeError: Failed to resolve module specifier 'remend'`, the event fires globally, and
MUI's own `.catch` fallback runs too late to prevent it.

Consequences:

1. `remend` never actually loads in a browser bundle, so `fallbackRepair` is always
   used — the richer repair is dead code in any bundled app.
2. The global `vite:preloadError` misfires on every assistant reply. MUI's internal
   `.catch` cannot suppress the event, because Vite dispatches it before the rejection
   reaches that `.catch`.

## Reproduce

```bash
npm install
npm run build
npm run preview      # http://localhost:4173
```

Open the preview, type anything, and send. The on-page log turns red:

```
vite:preloadError fired -> Failed to resolve module specifier 'remend'
```

(`src/main.tsx` listens for the event and calls `event.preventDefault()` so the page is
*not* reloaded — that is only so the repro is observable. The documented recipe would
`window.location.reload()` here and loop forever.)

With `npm run dev` instead, the event never fires: `__vitePreload` only exists in build
output.

## Environment

- `@mui/x-chat` 9.0.0-alpha.13
- `vite` 8.1.4 (rolldown)
- `react` / `react-dom` 19

## Notes

- Reproduces with or without `build.modulePreload: false`.
- The `@vite-ignore` comment is honored (the specifier is left bare); the problem is that
  rolldown *additionally* wraps the unresolvable import in `__vitePreload`, unlike
  rollup-based Vite 7, which left such variable-specifier imports unwrapped.
- Screenshot: `screenshot.png`.
