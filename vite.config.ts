import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          notation: ['vexflow'],
          pitch: ['pitchy'],
          react: ['react', 'react-dom', 'lucide-react'],
        },
      },
    },
  },
});
