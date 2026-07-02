import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/I18nContext";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ProjectProvider } from "@/lib/context/ProjectContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "co-work",
  description: "Project / To-Do / Memo / Schedule / Chat for teams",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full overflow-hidden flex flex-col bg-bg-base text-text-primary">
        <I18nProvider>
          <AuthProvider>
            <ProjectProvider>
              {children}
              <ServiceWorkerRegistration />
            </ProjectProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
