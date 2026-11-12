import { getToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { messaging, db } from '../firebase';

// Chave pública VAPID do Firebase Cloud Messaging (Web Push)
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export const isPushSupported = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      typeof Notification !== 'undefined' &&
      Notification.permission !== undefined
    );
  } catch {
    return false;
  }
};

export const getPushPermissionStatus = (): 'granted' | 'denied' | 'default' | 'unsupported' => {
  try {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
};

/**
 * Solicita autorização de notificações ao utilizador e regista o Service Worker
 */
export const requestPushPermission = async (userId: string) => {
  if (!isPushSupported()) {
    return { success: false, error: 'Notificações push não são suportadas neste navegador/dispositivo.' };
  }

  try {
    // Regista o Service Worker dedicado do Firebase
    let swReg: ServiceWorkerRegistration | null = null;
    if ('serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: permission === 'denied'
          ? 'Notificações bloqueadas nas definições do navegador. Permita as notificações para receber alertas no dispositivo.'
          : 'Permissão de notificações não concedida.',
        permission,
      };
    }

    let token: string | undefined = undefined;

    // Se tiver a chave VAPID e o messaging ativo, gera o token FCM
    if (messaging && VAPID_KEY && VAPID_KEY !== 'YOUR_VAPID_PUBLIC_KEY') {
      try {
        token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg || undefined,
        });

        if (token) {
          await setDoc(doc(db, 'push_subscriptions', userId), {
            token,
            userId,
            device: navigator.userAgent,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn('FCM token registration fallback:', err?.message || err);
      }
    }

    return {
      success: true,
      permission: 'granted',
      token,
    };
  } catch (error: any) {
    console.warn('Erro ao solicitar permissão de push:', error);
    return { success: false, error: error?.message || 'Falha ao ativar notificações.' };
  }
};

/**
 * Dispara uma notificação nativa no sistema operativo do utilizador (computador ou telemóvel)
 */
export const showNativeNotification = async (
  title: string,
  body: string,
  options?: { targetModule?: string; tag?: string }
) => {
  if (!isPushSupported() || Notification.permission !== 'granted') return;

  const notificationOptions = {
    body,
    icon: '/assets/aistudio/IMG_3033_9ef579ca.PNG',
    badge: '/assets/aistudio/IMG_3033_9ef579ca.PNG',
    vibrate: [200, 100, 200],
    tag: options?.tag || 'club-notification',
    data: {
      targetModule: options?.targetModule,
      timestamp: Date.now(),
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') ||
                  await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return;
      }
    }

    // Fallback nativo
    new Notification(title, notificationOptions);
  } catch (err) {
    console.warn('Falha ao disparar notificação nativa:', err);
  }
};

export const removePushSubscription = async (userId: string) => {
  try {
    await deleteDoc(doc(db, 'push_subscriptions', userId));
    return { success: true };
  } catch (error: any) {
    console.warn('Remoção de subscrição push ignorada:', error?.message || error);
    return { success: false, error: 'Falha ao remover subscrição de push.' };
  }
};
