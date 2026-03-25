import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/stride/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*tile.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /^https:\/\/(api\.openrouteservice|overpass-api|router\.project-osrm)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-responses',
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }
            }
          }
        ]
      },
      manifest: {
        name: 'Stride - AI Running Route Generator',
        short_name: 'Stride',
        theme_color: '#2d5016',
        display: 'standalone'
      }
    })
  ]
});
