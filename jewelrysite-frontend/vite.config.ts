/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    server: {
        port: 51600,
    },
    resolve: {
        alias: {
            '@paypal/react-paypal-js': '/src/lib/paypal/index.tsx',
        },
    },
})
