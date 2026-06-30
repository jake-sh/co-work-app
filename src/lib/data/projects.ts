import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { findUserByEmail } from "@/lib/data/users";
import type { Project } from "@/types";

const projectsCol = collection(db, "projects");

export function subscribeUserProjects(uid: string, cb: (projects: Project[]) => void) {
  const q = query(projectsCol, where("memberIds", "array-contains", uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Project, "id">), id: d.id })));
  });
}

export async function createProject(
  name: string,
  description: string,
  ownerId: string,
  startDate: string | null,
  endDate: string | null
): Promise<string> {
  const ref = await addDoc(projectsCol, {
    name,
    description,
    ownerId,
    memberIds: [ownerId],
    startDate,
    endDate,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function addMemberByEmail(projectId: string, email: string) {
  const member = await findUserByEmail(email);
  if (!member) throw new Error("USER_NOT_FOUND");
  await updateDoc(doc(db, "projects", projectId), {
    memberIds: arrayUnion(member.uid),
  });
  return member;
}

export async function updateProjectPeriod(
  projectId: string,
  startDate: string | null,
  endDate: string | null
) {
  await updateDoc(doc(db, "projects", projectId), { startDate, endDate });
}
