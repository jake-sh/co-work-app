import type { Metadata, Viewport } from "next";
import { Titillium_Web } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/I18nContext";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ProjectProvider } from "@/lib/context/ProjectContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const titilliumWeb = Titillium_Web({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-titillium",
});

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
    // suppressHydrationWarning: the <head> script below mutates this
    // element's data-theme attribute (and --app-font-offset below it)
    // before React hydrates, per Next's documented pattern for applying a
    // localStorage-only preference before first paint without a flash
    // (node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md).
    <html lang="ko" className={`h-full antialiased ${titilliumWeb.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m={S:'0px',M:'2px',L:'4px'},s=localStorage.getItem('cowork.fontScale');if(s&&m[s])document.documentElement.style.setProperty('--app-font-offset',m[s]);}catch(e){}try{if(localStorage.getItem('cowork.theme')==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg-base text-text-primary">
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
