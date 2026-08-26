import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import Anthropic from "@anthropic-ai/sdk";

initializeApp();
const db = getFirestore();

interface ChatMessage {
  text: string;
  authorId: string;
  authorName: string;
}

// Fires on every new chat message. Sends an FCM data-only push to every
// project member (except the sender) who has notifications enabled and at
// least one registered device token. Cloud Functions are event-triggered, so
// this keeps working no matter how long the app has been idle.
export const sendChatNotification = onDocumentCreated(
  "projects/{projectId}/messages/{messageId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const msg = snap.data() as ChatMessage;
    const { projectId } = event.params;

    const projectSnap = await db.doc(`projects/${projectId}`).get();
    const project = projectSnap.data();
    if (!project) return;

    const memberIds: string[] = project.memberIds ?? [];
    const recipients = memberIds.filter((id) => id !== msg.authorId);
    if (recipients.length === 0) return;

    // Collect { token, uid } for each recipient who hasn't disabled push.
    const targets: { token: string; uid: string }[] = [];
    await Promise.all(
      recipients.map(async (uid) => {
        const userSnap = await db.doc(`users/${uid}`).get();
        if (userSnap.data()?.notificationsEnabled === false) return;
        const tokensSnap = await db.collection(`users/${uid}/fcmTokens`).get();
        tokensSnap.forEach((doc) => targets.push({ token: doc.id, uid }));
      })
    );
    if (targets.length === 0) return;

    const title = project.name ?? "cowork";
    const body = `${msg.authorName}: ${msg.text}`.slice(0, 140);

    const response = await getMessaging().sendEachForMulticast({
      tokens: targets.map((t) => t.token),
      data: { title, body, url: "/chat", tag: `chat-${projectId}` },
      webpush: {
        headers: { Urgency: "high", TTL: "86400" },
      },
    });

    // Prune tokens the push service reports as permanently invalid.
    const deletions: Promise<unknown>[] = [];
    response.responses.forEach((res, i) => {
      if (res.success) return;
      const code = res.error?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument"
      ) {
        const { uid, token } = targets[i];
        deletions.push(db.doc(`users/${uid}/fcmTokens/${token}`).delete().catch(() => undefined));
      }
    });
    await Promise.all(deletions);
  }
);

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

interface VoiceInputItem {
  type: "memo" | "todo" | "event";
  title?: string;
  body?: string;
  text?: string;
  date?: string;
  time?: string | null;
}

function buildVoiceInputSystemPrompt(): string {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now); // YYYY-MM-DD
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "long" }).format(now);

  return `You turn one dictated voice utterance (Korean or English) into one or more app entries for a team collaboration app. Each entry is exactly one of:

- "event": something tied to a specific date/time — a meeting, appointment, deadline, trip. Has "title" (short), "date" (YYYY-MM-DD, resolved from relative expressions like "내일"/"다음주 화요일"/"tomorrow" using today's date below), and "time" (HH:mm 24-hour, or null if no time was said).
- "todo": an actionable task with no specific date/time attached — something to get done, but not scheduled to a moment. Has "text".
- "memo": a freeform note that isn't an action item — information to remember, an idea, a record of something. Has "title" (short) and "body" (the detail).

Today is ${today} (${weekday}), Asia/Seoul time — use this to resolve any relative date the speaker mentions.

A single utterance may describe several distinct items — split those into one entry per item (e.g. "다음주 화요일 3시 회의 있고 보고서 작성해야해" → one "event" for the meeting + one "todo" for the report). If a task also has a specific date/time, classify it as "event", not "todo". Preserve the speaker's original wording in title/body/text; do not add information that wasn't said, and do not invent a date/time that wasn't mentioned.

Respond with ONLY a JSON object matching this shape, no other text, no markdown code fence:
{"items": [{"type": "event", "title": "...", "date": "YYYY-MM-DD", "time": "HH:mm"}, {"type": "todo", "text": "..."}, {"type": "memo", "title": "...", "body": "..."}]}`;
}

// Turns one dictated sentence into memo/todo entries via Claude Haiku — cheap
// and fast enough for this (short input, short structured output), so there's
// no reason to reach for a larger model. Runs server-side so the Anthropic
// API key never reaches the client.
export const structureVoiceInput = onCall(
  // Same region as sendChatNotification, closer to this app's users.
  { secrets: [anthropicApiKey], region: "asia-northeast3" },
  async (request): Promise<{ items: VoiceInputItem[] }> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }
    const text = request.data?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new HttpsError("invalid-argument", "text is required.");
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey.value() });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: buildVoiceInputSystemPrompt(),
      messages: [{ role: "user", content: text.trim() }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new HttpsError("internal", "No response from model.");
    }

    let parsed: { items?: unknown };
    try {
      // The model is instructed to return only JSON; strip an accidental
      // markdown code fence defensively before parsing.
      const jsonText = block.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(jsonText);
    } catch {
      throw new HttpsError("internal", "Could not parse model response.");
    }

    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((item): item is VoiceInputItem => {
          if (!item || typeof item !== "object") return false;
          const i = item as Partial<VoiceInputItem>;
          if (i.type === "event") return typeof i.title === "string" && typeof i.date === "string";
          return i.type === "memo" || i.type === "todo";
        })
      : [];
    return { items };
  }
);
