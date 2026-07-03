import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

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
