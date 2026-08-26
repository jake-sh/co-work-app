"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/context/AuthContext";
import { BottomNav } from "@/components/nav/BottomNav";
import { ProjectTabBar } from "@/components/nav/ProjectTabBar";
import { PushTokenSync } from "@/components/PushTokenSync";
import { DataProvider } from "@/lib/context/DataContext";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-secondary">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <DataProvider>
      <PushTokenSync />
      <div className="h-full" style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
        <ProjectTabBar />
        <motion.div layoutScroll className="overflow-y-auto overscroll-y-contain pb-20">
          {children}
        </motion.div>
        <BottomNav />
      </div>
    </DataProvider>
  );
}
