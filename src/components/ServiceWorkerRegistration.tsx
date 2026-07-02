"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker.register("/sw.js").then((r) => {
      reg = r;
    }).catch(() => {});

    // When a new SW takes over, reload to pick up fresh JS bundles
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    // Check for SW updates whenever the app comes to foreground
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reg?.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return null;
}
