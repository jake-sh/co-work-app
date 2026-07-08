"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser as deleteFirebaseUser,
  EmailAuthProvider,
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
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
    // browserLocalPersistence is IndexedDB-backed, the same layer that
    // deadlocked Firestore entirely (the app got stuck on the loading
    // screen) before it was moved to a memory-only cache. If IndexedDB is
    // similarly unavailable/broken here, don't let "keep me logged in"
    // block the sign-in itself — fall back to session-only persistence
    // (sessionStorage, no IndexedDB) so login still succeeds.
    try {
      await withTimeout(
        setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence),
        3000
      );
    } catch (err) {
      console.error("setPersistence failed, falling back to session persistence:", err);
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (fallbackErr) {
        console.error("Session persistence also failed, signing in without it:", fallbackErr);
      }
    }
    await signInWithEmailAndPassword(auth, usernameToAuthEmail(username), password);
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
