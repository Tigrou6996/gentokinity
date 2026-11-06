import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const netlifyFunctionsDevPlugin = (env: Record<string, string>) => ({
  name: 'netlify-functions-dev',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if ((req.url?.startsWith('/api/send-login-alert') || req.url?.startsWith('/.netlify/functions/send-login-alert')) && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
            if (!apiKey) {
              console.log('[Dev Server] send-login-alert: RESEND_API_KEY non impostata in .env.local');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, warning: 'RESEND_API_KEY_MISSING' }));
              return;
            }
            process.env.RESEND_API_KEY = apiKey;
            if (env.RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = env.RESEND_FROM_EMAIL;
            const { handler } = await import('./netlify/functions/send-login-alert.ts');
            const result = await handler({
              httpMethod: 'POST',
              body,
              headers: req.headers,
            });
            res.statusCode = result.statusCode || 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(result.body);
          } catch (e: any) {
            console.error('[Dev Server] send-login-alert error:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      next();
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss(), netlifyFunctionsDevPlugin(env)],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      publicDir: 'public',
      build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-supabase': ['@supabase/supabase-js'],
            },
          },
        },
      }
    };
});
