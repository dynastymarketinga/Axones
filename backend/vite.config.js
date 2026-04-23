import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
        // Mismo criterio que pulse-ui: túneles (Cloudflare) envían Host *.trycloudflare.com
        host: '0.0.0.0',
        allowedHosts: ['.trycloudflare.com'],
    },
});
