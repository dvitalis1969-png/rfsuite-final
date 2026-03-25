import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false,
      },
      plugins: [
        react(),
        tailwindcss(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg'],
          manifest: {
            name: 'RF Frequency Suite',
            short_name: 'RF Suite',
            description: 'Professional RF Coordination & Spectrum Analysis Tool',
            theme_color: '#020617',
            background_color: '#020617',
            display: 'standalone',
            icons: [
              {
                src: '/icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              },
              {
                src: '/icon.svg',
                sizes: '192x192',
                type: 'image/svg+xml'
              },
              {
                src: '/icon.svg',
                sizes: '512x512',
                type: 'image/svg+xml'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
            clientsClaim: true,
            skipWaiting: true,
            navigateFallbackDenylist: [/^\/api/],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          },
          devOptions: {
            enabled: false,
            type: 'module',
          }
        })
      ],
      define: {
        '__BUILD_TIMESTAMP__': JSON.stringify(new Date().toISOString())
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
