"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/project" : "/login");
  }, [loading, user, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-text-secondary">{t.common.loading}</p>
    </div>
  );
}
