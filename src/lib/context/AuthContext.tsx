"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createUserProfile, getUserProfile, updateUserLocale } from "@/lib/data/users";
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
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  const signIn = async (username: string, password: string) => {
    await signInWithEmailAndPassword(auth, usernameToAuthEmail(username), password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, loading, signUp, signIn, signOut }),
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
