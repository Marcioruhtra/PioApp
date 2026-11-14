/**
 * Configuração do Firebase (Auth, Firestore, Storage)
 * Mantém sincronia absoluta com firebase-applet-config.json e ambiente de produção.
 */

import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import configJson from '../../firebase-applet-config.json';
import { app as sharedApp, auth as sharedAuth, db as sharedDb } from '../firebase';

export interface FirebaseConnectionStatus {
  isConfigured: boolean;
  projectId?: string;
  authDomain?: string;
  mode: 'firebase_live' | 'local_demonstracao';
  missingEnvVars: string[];
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || configJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || configJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || configJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || configJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || configJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || configJson.appId,
};

const missing = ['apiKey', 'projectId', 'authDomain'].filter((key) => !(firebaseConfig as any)[key]);

const app: FirebaseApp | null = missing.length === 0 ? sharedApp : null;
const auth: Auth | null = missing.length === 0 ? sharedAuth : null;
const db: Firestore | null = missing.length === 0 ? sharedDb : null;

export const firebaseStatus: FirebaseConnectionStatus = {
  isConfigured: missing.length === 0 && app !== null,
  projectId: firebaseConfig.projectId || undefined,
  authDomain: firebaseConfig.authDomain || undefined,
  mode: missing.length === 0 && app !== null ? 'firebase_live' : 'local_demonstracao',
  missingEnvVars: missing,
};

export { app, auth, db };
