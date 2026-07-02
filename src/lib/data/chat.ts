import { addDoc, collection, onSnapshot, query } from "firebase/firestore";
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
