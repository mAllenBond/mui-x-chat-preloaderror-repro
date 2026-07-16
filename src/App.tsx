import { ChatBox } from '@mui/x-chat';
import { createEchoAdapter } from '@mui/x-chat-headless';
import { useMemo } from 'react';

// Echo an assistant reply that contains markdown. Rendering an assistant text
// part runs ChatMessageContent -> renderStreamingMarkdown ->
// useStreamingMarkdownRepair -> loadRemend -> import('remend'). In a production
// build (`vite build`), rolldown wraps that @vite-ignore'd bare specifier in
// __vitePreload, so its rejection dispatches a global vite:preloadError.
const respond = (text: string) =>
  `**Echo:** ${text}\n\nThis reply is markdown, which triggers the lazy import.`;

export const App = () => {
  const adapter = useMemo(() => createEchoAdapter({ respond, delayMs: 100 }), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100vh', padding: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 18 }}>@mui/x-chat vite:preloadError repro</h1>
        <p style={{ margin: '4px 0' }}>
          Run a <strong>production build</strong> (<code>npm run build && npm run preview</code>),
          then send a message. The assistant reply renders markdown, and{' '}
          <code>vite:preloadError</code> fires for <code>import('remend')</code>.
        </p>
        <p id="preload-error-log" style={{ margin: '4px 0', fontFamily: 'monospace' }}>
          No vite:preloadError yet — send a message.
        </p>
      </div>
      <div style={{ flex: 1, minHeight: 0, border: '1px solid #ccc', borderRadius: 8 }}>
        <ChatBox adapter={adapter} />
      </div>
    </div>
  );
};
