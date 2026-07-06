import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
export const auth = getAuth(firebaseApp);
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
