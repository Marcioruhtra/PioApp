import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin
const adminAny = admin as any;
if (!adminAny.apps || adminAny.apps.length === 0) {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const fc = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      adminAny.initializeApp({
        projectId: fc.projectId,
      });
    } else {
      adminAny.initializeApp();
    }
  } catch (e) {
    console.error('Failed to initialize firebase-admin:', e);
    try {
      adminAny.initializeApp();
    } catch (inner) {
      console.error('Fallback firebase-admin init failed:', inner);
    }
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json());

  // Admin API endpoint to permanently delete a user and revoke sessions
  app.post('/api/admin/delete-user', async (req, res) => {
    try {
      const { uid, email } = req.body;
      if (!uid && !email) {
        return res.status(400).json({ success: false, error: 'UID ou e-mail obrigatório.' });
      }

      const authInstance = adminAny.auth();
      let targetUid = uid;
      if (!targetUid && email) {
        try {
          const userRecord = await authInstance.getUserByEmail(email);
          targetUid = userRecord.uid;
        } catch (e) {
          console.warn('User not found in Firebase Auth by email:', email);
        }
      }

      if (targetUid) {
        try {
          await authInstance.deleteUser(targetUid);
          await authInstance.revokeRefreshTokens(targetUid);
          return res.json({ success: true, message: `Utilizador ${targetUid} eliminado com sucesso do Firebase Auth.` });
        } catch (authErr: any) {
          console.warn('Firebase Auth deletion warning (user might already be deleted):', authErr.message);
          return res.json({ success: true, message: 'Utilizador processado (já inexistente ou removido).' });
        }
      }

      return res.status(404).json({ success: false, error: 'Utilizador não encontrado no Firebase Authentication.' });
    } catch (err: any) {
      console.error('Error in /api/admin/delete-user:', err);
      return res.status(500).json({ success: false, error: err.message || 'Erro interno ao eliminar utilizador.' });
    }
  });

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  const args = process.argv.slice(2);
  let cliPort: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (!Number.isNaN(parsed) && parsed > 0) cliPort = parsed;
    } else if (args[i].startsWith('--port=')) {
      const parsed = Number(args[i].split('=')[1]);
      if (!Number.isNaN(parsed) && parsed > 0) cliPort = parsed;
    }
  }

  const envPort = Number(process.env.PORT);
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT) || 3000;
  const port =
    cliPort ||
    (!isProduction && envPort === 8080 ? defaultAppPort : envPort || defaultAppPort);

  httpServer.on('error', (err: any) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
    }
  });

  const onShutdown = () => {
    httpServer.close(() => {
      process.exit(0);
    });
  };
  process.once('SIGTERM', onShutdown);
  process.once('SIGINT', onShutdown);

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
