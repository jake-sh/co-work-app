import { addDoc, collection, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ChatMessage } from "@/types";

function messagesCol(projectId: string) {
  return collection(db, "projects", projectId, "messages");
}

export function subscribeMessages(projectId: string, cb: (messages: ChatMessage[]) => void) {
  const q = query(messagesCol(projectId));
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => ({ ...(d.data() as Omit<ChatMessage, "id">), id: d.id }))
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
    createdAt: Date.now(),
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
