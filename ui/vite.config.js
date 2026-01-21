import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const appRoot = path.resolve(__dirname, '../apps/dashboard/src');

export default defineConfig({
  root: appRoot,
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../ui-dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(appRoot, 'index.html')
    }
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 8788
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 8788
  }
});
