import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rolldownOptions: {
              external: ['node-pty', 'typescript'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rolldownOptions: {
              output: {
                entryFileNames: 'preload.cjs',
                chunkFileNames: '[name].cjs',
              },
            },
          },
        },
        onstart(options) {
          options.reload();
        },
      },
      renderer: {},
    }),
  ],
});
