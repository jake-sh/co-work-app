import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isNewApp = !getApps().length;
export const firebaseApp = isNewApp ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(firebaseApp);
export const db = isNewApp
  ? initializeFirestore(firebaseApp, {
      // Multiple-tab manager: coordinates one shared realtime connection across
      // every open instance (installed PWA + browser tab, etc.). The previous
      // single-tab manager with forceOwnership had each instance seize the
      // persistence lease from the others, which left the losing instance's
      // onSnapshot listeners stalled — chat not arriving live and deletes not
      // propagating.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      // Force long-polling. On mobile/PWA networks Firestore's default
      // streaming WebChannel can silently fail to receive server pushes;
      // long-polling is slightly less efficient but reliably delivers realtime
      // updates (new messages, deletions) instead of appearing to hang.
      experimentalForceLongPolling: true,
    })
  : getFirestore(firebaseApp);
