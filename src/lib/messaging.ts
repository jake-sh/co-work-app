import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { firebaseApp } from "@/lib/firebase/client";
import { saveFcmToken, deleteFcmToken } from "@/lib/data/users";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Web Push is only available in secure contexts with a service worker + the
// Notification/Push APIs. On iOS it additionally requires the PWA to be
// installed to the home screen (standalone display mode).
export async function pushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
    return false;
  }
  if (!VAPID_KEY) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

async function getSwRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return undefined;
  }
}

// Requests notification permission (if not already decided), obtains an FCM
// token bound to our service worker, and persists it for the current user.
// Returns true if a token was registered. Safe to call repeatedly — FCM
// returns the same token and we just refresh its timestamp.
export async function enablePush(uid: string): Promise<boolean> {
  if (!(await pushSupported())) return false;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return false;

  const registration = await getSwRegistration();
  if (!registration) return false;

  try {
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;
    await saveFcmToken(uid, token);
    return true;
  } catch {
    return false;
  }
}

// Removes the current device's token from FCM and from the user's stored
// tokens so this device stops receiving push.
export async function disablePush(uid: string): Promise<void> {
  if (!(await pushSupported())) return;
  try {
    const messaging = getMessaging(firebaseApp);
    const registration = await getSwRegistration();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    }).catch(() => null);
    await deleteToken(messaging).catch(() => {});
    if (token) await deleteFcmToken(uid, token).catch(() => {});
  } catch {
    // best effort
  }
}
