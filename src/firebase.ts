import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let appInstance: any = null;
let dbInstance: any = null;
let authInstance: any = null;
let messagingInstance: any = null;
let googleProviderInstance: any = null;

try {
  appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const dbId = (firebaseConfig as any).firestoreDatabaseId as string | undefined;
  const firestoreSettings = {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
  };
  try {
    dbInstance = dbId
      ? initializeFirestore(appInstance, firestoreSettings, dbId)
      : initializeFirestore(appInstance, firestoreSettings);
  } catch {
    dbInstance = dbId ? getFirestore(appInstance, dbId) : getFirestore(appInstance);
  }
  authInstance = getAuth(appInstance);
  // Default to session persistence to avoid localStorage, but we can upgrade to local for 'remember me'
  setPersistence(authInstance, browserSessionPersistence).catch(() => {});

  if (typeof window !== 'undefined' && dbInstance && (dbInstance as any).app) {
    (async function testConnection() {
      try {
        await getDocFromServer(doc(dbInstance, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    })();
  }
} catch (e) {
  console.warn('Firebase initialization warning (running in offline/mock mode):', e);
  appInstance = { name: '[DEFAULT]' };
  dbInstance = {} as any;
  authInstance = { currentUser: null, onAuthStateChanged: () => () => {} } as any;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authInstance?.currentUser?.uid,
      email: authInstance?.currentUser?.email,
      emailVerified: authInstance?.currentUser?.emailVerified,
      isAnonymous: authInstance?.currentUser?.isAnonymous,
      tenantId: authInstance?.currentUser?.tenantId,
      providerInfo:
        authInstance?.currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

try {
  if (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    appInstance && appInstance.name
  ) {
    try {
      messagingInstance = getMessaging(appInstance);
    } catch {
      // Ignored if messaging restricted
    }
  }
} catch {
  // Ignored
}

try {
  googleProviderInstance = new GoogleAuthProvider();
} catch {
  googleProviderInstance = {} as any;
}

export const app = appInstance;
export const db = dbInstance;
export const auth = authInstance;
export const messaging = messagingInstance;
export const googleProvider = googleProviderInstance;

export { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence };

export async function signInWithGoogle() {
  try {
    if (!auth || !googleProvider) {
      return { success: false, error: 'Firebase Auth não disponível neste ambiente.' };
    }
    const result = await signInWithPopup(auth, googleProvider);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao autenticar com Google.' };
  }
}

export async function logOutUser() {
  try {
    if (!auth) return { success: true };
    await fbSignOut(auth);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao terminar sessão.' };
  }
}
