import { defineConfig } from 'vite';

export default defineConfig({
  base: '/moodcut/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        photoStudio: 'photo-studio.html',
        nutrition: 'nutrition.html',
      },
    },
  },
});
