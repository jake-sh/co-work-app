import { addDoc, arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Memo } from "@/types";

function memosCol(projectId: string) {
  return collection(db, "projects", projectId, "memos");
}

export function deriveTitle(title: string, body: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle) return trimmedTitle;
  const tokens = body.trim().split(/\s+/).filter(Boolean);
  return tokens.slice(0, 10).join(" ") || "Untitled";
}

export function subscribeMemos(projectId: string, cb: (memos: Memo[]) => void) {
  const q = query(memosCol(projectId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Memo, "id">), id: d.id })));
  });
}

export async function addMemo(
  projectId: string,
  title: string,
  body: string,
  authorId: string,
  authorName: string,
  authorColor: string
) {
  await addDoc(memosCol(projectId), {
    title: deriveTitle(title, body),
    body,
    authorId,
    authorName,
    authorColor,
    createdAt: Date.now(),
    sharedWith: [],
  });
}

export async function shareMemoWithMembers(projectId: string, memoId: string, memberIds: string[]) {
  await updateDoc(doc(db, "projects", projectId, "memos", memoId), {
    sharedWith: arrayUnion(...memberIds),
  });
}
