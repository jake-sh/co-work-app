import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
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
// getAuth() picks a single default persistence and hydrates it at init
// time; if that first choice hits a hard storage failure (confirmed via a
// DOMException 22 / QuotaExceededError under Safari Private Browsing,
// where every Web Storage quota is capped at 0), the resulting Auth
// instance stays broken for every later call on it — including manual
// setPersistence()+retry attempts in signIn(), which kept failing with the
// exact same error no matter what was retried. initializeAuth's explicit
// persistence array is Firebase's own fallback mechanism for this: it
// tries each in order at init and keeps the first that actually works,
// with inMemoryPersistence guaranteeing there's always a working option.
export const auth = isNewApp
  ? initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
    })
  : getAuth(firebaseApp);
export const db = isNewApp
  ? initializeFirestore(firebaseApp, {
      // In-memory cache instead of the persistent (IndexedDB) cache. The
      // offline persistence layer was the common cause behind every chat sync
      // problem we hit — writes queued and flushed hours later, deletes not
      // propagating, and (with the multi-tab manager) a hard init deadlock.
      // Memory cache removes IndexedDB entirely, so listeners always talk
      // straight to the server for live data and init can never stall. The
      // only cost is a brief cold-start load and no offline reads; within an
      // open session reads are still served from memory and stay fast.
      localCache: memoryLocalCache(),
    })
  : getFirestore(firebaseApp);
