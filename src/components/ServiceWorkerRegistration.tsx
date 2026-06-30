"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA install/offline support is a progressive enhancement; ignore failures.
      });
    }
  }, []);

  return null;
}
