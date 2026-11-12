import express from 'express';
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
