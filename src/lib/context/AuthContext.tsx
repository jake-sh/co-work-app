"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser as deleteFirebaseUser,
  EmailAuthProvider,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createUserProfile, deleteUserProfile, getUserProfile, updateUserColor, updateUserLocale, updateUserNickname, updateMemoDefaultShared, updateNotificationsEnabled } from "@/lib/data/users";
import { useI18n } from "@/lib/i18n/I18nContext";
import type { UserProfile } from "@/types";

// Firebase Auth requires an email-shaped identifier; IDs are mapped to a
// synthetic address in a reserved, non-routable domain under the hood.
function usernameToAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@id.co-work.local`;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (displayName: string, username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  updateColorCode: (color: string) => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updateMemoDefaultShared: (value: boolean) => Promise<void>;
  updateNotificationsEnabled: (value: boolean) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (currentPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { locale, setLocale } = useI18n();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const existing = await getUserProfile(firebaseUser.uid);
        setProfile(existing);
        if (existing) setLocale(existing.locale);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (displayName: string, username: string, password: string) => {
    const normalizedUsername = username.trim().toLowerCase();
    const credential = await createUserWithEmailAndPassword(
      auth,
      usernameToAuthEmail(normalizedUsername),
      password
    );
    await updateProfile(credential.user, { displayName });
    const newProfile = await createUserProfile(
      credential.user.uid,
      displayName,
      normalizedUsername,
      locale
    );
    setProfile(newProfile);
  };

  const signIn = async (username: string, password: string, rememberMe = true) => {
    const email = usernameToAuthEmail(username);
    // Honor the "keep me logged in" toggle. Uses indexedDBLocalPersistence,
    // not browserLocalPersistence (localStorage) — they're separate storage
    // backends, and firebase/client.ts's initializeAuth tries
    // indexedDBLocalPersistence *first* when restoring a session on app
    // launch. Writing to browserLocalPersistence here meant "keep me logged
    // in" silently didn't survive a restart: sign-in succeeded and looked
    // fine in the moment, but the session was saved to a storage location
    // the next launch never checked. setPersistence() itself just *records*
    // which storage to use — it doesn't touch storage yet, so it resolves
    // fine even when that storage is actually broken. The write only
    // happens later, when signInWithEmailAndPassword succeeds and Firebase
    // tries to persist the new session: that's where a QuotaExceededError
    // (confirmed via its DOMException name — Safari Private Browsing caps
    // every Web Storage quota at 0) actually surfaces. Retry once with
    // inMemoryPersistence (touches no storage API, can't hit this) rather
    // than blocking sign-in entirely.
    await setPersistence(auth, rememberMe ? indexedDBLocalPersistence : browserSessionPersistence).catch(
      () => {}
    );
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if ((err as { name?: string })?.name !== "QuotaExceededError") throw err;
      console.error("Sign-in failed persisting session (storage quota), retrying in-memory:", err);
      await setPersistence(auth, inMemoryPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const updateColorCode = async (color: string) => {
    if (!user) return;
    await updateUserColor(user.uid, color);
    setProfile((prev) => (prev ? { ...prev, colorCode: color } : prev));
  };

  const updateNickname = async (nickname: string) => {
    if (!user) return;
    await updateUserNickname(user.uid, nickname);
    setProfile((prev) => (prev ? { ...prev, nickname } : prev));
  };

  const updateMemoDefaultSharedFn = async (value: boolean) => {
    if (!user) return;
    // Optimistic: flip the UI immediately, then persist.
    setProfile((prev) => (prev ? { ...prev, memoDefaultShared: value } : prev));
    await updateMemoDefaultShared(user.uid, value);
  };

  const updateNotificationsEnabledFn = async (value: boolean) => {
    if (!user) return;
    // Optimistic: flip the UI immediately, then persist.
    setProfile((prev) => (prev ? { ...prev, notificationsEnabled: value } : prev));
    await updateNotificationsEnabled(user.uid, value);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email) throw new Error("NO_USER");
    // Firebase requires a recent login to change the password; reauthenticate
    // with the current password first (the synthetic email is user.email).
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  const deleteAccount = async (currentPassword: string) => {
    if (!user || !user.email) throw new Error("NO_USER");
    // Same reauthentication requirement as changePassword: Firebase rejects
    // account deletion without a recent login.
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await deleteUserProfile(user.uid);
    await deleteFirebaseUser(user);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      updateColorCode,
      updateNickname,
      updateMemoDefaultShared: updateMemoDefaultSharedFn,
      updateNotificationsEnabled: updateNotificationsEnabledFn,
      changePassword,
      deleteAccount,
    }),
    // signUp/signIn/signOut are stable in behavior; only re-derive when auth state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export async function persistLocale(uid: string, locale: UserProfile["locale"]) {
  await updateUserLocale(uid, locale);
}
