import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

let app: any = null;
let dbInstance: any = null;
let authInstance: any = null;
let messagingInstance: any = null;
let googleProviderInstance: any = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  dbInstance = (firebaseConfig as any).firestoreDatabaseId ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) : getFirestore(app);
  authInstance = getAuth(app);
  // Default to session persistence to avoid localStorage, but we can upgrade to local for 'remember me'
  setPersistence(authInstance, browserSessionPersistence);
} catch (e) {
  console.warn('Firebase initialization warning (running in offline/mock mode):', e);
  app = { name: '[DEFAULT]' };
  dbInstance = {} as any;
  authInstance = { currentUser: null, onAuthStateChanged: () => () => {} } as any;
}

try {
  if (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    app && app.name
  ) {
    try {
      messagingInstance = getMessaging(app);
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
