import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { assignMemberColor } from "@/lib/colors";
import type { Locale, UserProfile } from "@/types";

export async function createUserProfile(
  uid: string,
  displayName: string,
  username: string,
  locale: Locale
): Promise<UserProfile> {
  const profile: UserProfile = {
    uid,
    displayName,
    username,
    colorCode: assignMemberColor([]),
    locale,
    createdAt: Date.now(),
  };
  await setDoc(doc(db, "users", uid), profile);
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUserLocale(uid: string, locale: Locale) {
  await updateDoc(doc(db, "users", uid), { locale });
}

export async function updateUserColor(uid: string, colorCode: string) {
  await updateDoc(doc(db, "users", uid), { colorCode });
}

export async function updateUserNickname(uid: string, nickname: string) {
  await updateDoc(doc(db, "users", uid), { nickname });
}

export async function findUserByUsername(username: string): Promise<UserProfile | null> {
  const { collection, query, where, getDocs, limit } = await import("firebase/firestore");
  const q = query(collection(db, "users"), where("username", "==", username), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as UserProfile;
}
