import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { ENV } from './backend/config/env.ts';
import { createBackendApp } from './backend/app.ts';
import { seedInitialDatabase } from './backend/db/seed.ts';
import { attachLiveVoiceServer } from './backend/services/liveVoiceService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await seedInitialDatabase();

  const app = createBackendApp();
  const httpServer = http.createServer(app);
  attachLiveVoiceServer(httpServer);

  if (ENV.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`OyoPasal Server running on http://0.0.0.0:${ENV.PORT} (PostgreSQL + Live Voice ready)`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
