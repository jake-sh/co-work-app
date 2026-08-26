import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";

export interface VoiceInputItem {
  type: "memo" | "todo";
  title?: string;
  body?: string;
  text?: string;
}

const call = httpsCallable<{ text: string }, { items: VoiceInputItem[] }>(
  functions,
  "structureVoiceInput"
);

export async function structureVoiceInput(text: string): Promise<VoiceInputItem[]> {
  const result = await call({ text });
  return result.data.items ?? [];
}
