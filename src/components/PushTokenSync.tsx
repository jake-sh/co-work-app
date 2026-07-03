"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { enablePush } from "@/lib/messaging";

// FCM registration tokens can rotate, so whenever a signed-in user who has
// notifications enabled (and has already granted browser permission) opens the
// app, silently refresh their token for this device. Never prompts — a fresh
// permission request only happens from the explicit Settings toggle.
export function PushTokenSync() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    if ((profile.notificationsEnabled ?? true) === false) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    enablePush(profile.uid).catch(() => {});
  }, [profile]);

  return null;
}
