import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Razvoj: Vite (frontend) na :5173 prosleđuje /api i /files Express serveru na :3000
// Produkcija: `npm run build` → dist/, a Express servira sve na :3000
export default defineConfig({
    root: 'client',
    plugins: [vue()],
    build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000',
            '/files': 'http://localhost:3000'
        }
    }
});
