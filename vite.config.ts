import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use relative base './' so GitHub Pages works seamlessly on any repo name (e.g. /split-mates/)
export default defineConfig({
  plugins: [react()],
  base: './',
});
