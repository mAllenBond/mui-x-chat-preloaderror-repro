import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// modulePreload:false mirrors the reporting app; the bug reproduces with or
// without it (see https://github.com/vitejs/vite/issues/18551).
export default defineConfig({
  build: { modulePreload: false },
  plugins: [react()],
});
