import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initCalendarAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleCalendar = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google Calendar.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.message?.includes('popup-closed-by-user') ||
      error?.message?.includes('cancelled-popup-request')
    ) {
      console.warn('Google Calendar auth popup cancelado ou fechado pelo utilizador.');
      return null;
    }
    console.error('Erro de autenticação Google Calendar:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCalendarAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogleCalendar = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export async function syncActivityToGoogleCalendar(activity: {
  title: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  location?: string;
  department?: string;
}, accessToken: string) {
  const parseDateTime = (dateStr: string, timeStr?: string, fallbackHour = '08:30') => {
    const dateOnly = dateStr.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      const timePart = timeStr && /^\d{2}:\d{2}/.test(timeStr) ? timeStr.slice(0, 5) : fallbackHour;
      return new Date(`${dateOnly}T${timePart}:00`);
    }
    return new Date(dateStr);
  };

  const startDateTime = parseDateTime(activity.startDate, activity.startTime, '08:30');
  const endDateTime = activity.endDate
    ? parseDateTime(activity.endDate, activity.endTime, '12:00')
    : activity.endTime
    ? parseDateTime(activity.startDate, activity.endTime, '12:00')
    : new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);

  const safeEnd = endDateTime.getTime() > startDateTime.getTime()
    ? endDateTime
    : new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);

  const descriptionLines = [
    activity.description?.trim(),
    `Atividade do departamento: ${activity.department || 'Geral'}. Sincronizado automaticamente via PioApp.`,
  ].filter(Boolean);

  const event = {
    summary: `[Clube D'Alvorada] ${activity.title}`,
    description: descriptionLines.join('\n\n'),
    location: activity.location || "Sede do Clube de Embaixadores Pioneiros D'Alvorada",
    start: {
      dateTime: startDateTime.toISOString(),
    },
    end: {
      dateTime: safeEnd.toISOString(),
    },
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Erro ao sincronizar evento com o Google Calendar.');
  }

  return await response.json();
}
