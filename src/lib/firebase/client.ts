import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
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
      // Single-tab persistence with forced ownership. The multi-tab manager was
      // tried to improve realtime sync, but its cross-tab lock acquisition
      // deadlocked persistence init on some PWA/browser setups — getUserProfile
      // (a getDoc) then never resolved, so AuthContext's loading flag stayed
      // true and the app hung on the splash/loading screen forever. The actual
      // realtime chat regression was an unrelated infinite write loop, fixed
      // separately, so this stays on the known-good single-tab config.
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: true }) }),
    })
  : getFirestore(firebaseApp);
