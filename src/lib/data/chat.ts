import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ChatMessage } from "@/types";

function messagesCol(projectId: string) {
  return collection(db, "projects", projectId, "messages");
}

// createdAt is written as a server timestamp (see sendMessage) so ordering is
// authoritative and consistent across devices instead of depending on each
// sender's local clock. Normalize it to millis here; legacy messages stored a
// plain number, and a still-pending local write's server timestamp is filled
// in with an "estimate" so a just-sent message sorts to the bottom immediately.
function normalizeCreatedAt(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (raw && typeof (raw as Timestamp).toMillis === "function") return (raw as Timestamp).toMillis();
  return Date.now();
}

export function subscribeMessages(projectId: string, cb: (messages: ChatMessage[]) => void) {
  const q = query(messagesCol(projectId));
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => {
        const data = d.data({ serverTimestamps: "estimate" });
        return {
          id: d.id,
          text: data.text as string,
          authorId: data.authorId as string,
          authorName: data.authorName as string,
          authorColor: data.authorColor as string,
          createdAt: normalizeCreatedAt(data.createdAt),
        } as ChatMessage;
      })
      .sort((a, b) => a.createdAt - b.createdAt);
    cb(sorted);
  });
}

export async function sendMessage(
  projectId: string,
  text: string,
  authorId: string,
  authorName: string,
  authorColor: string
) {
  await addDoc(messagesCol(projectId), {
    text,
    authorId,
    authorName,
    authorColor,
    createdAt: serverTimestamp(),
  });
}

// Tracks how far each member has read into a project's chat, so unread
// counts per message can be derived without a receipt doc per message.
export async function markChatRead(projectId: string, uid: string) {
  await updateDoc(doc(db, "projects", projectId), { [`lastRead.${uid}`]: Date.now() });
}

export async function deleteAllMessages(projectId: string) {
  const { getDocs, writeBatch } = await import("firebase/firestore");
  const snap = await getDocs(messagesCol(projectId));
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
