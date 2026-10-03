import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { ThemeProvider } from "@/lib/theme";
import { LanguageProvider } from "@/lib/language";
import { QueryProvider } from "@/lib/query-client";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://daftar1.com"),
  title: "دفتر - إدارة حسابات محلك بسهولة",
  description: "دفتر يساعدك تتابع مبيعاتك ومصاريفك وفواتيرك بكل سهولة، خاص بأصحاب المشاريع الصغيرة.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "دفتر",
  },
  openGraph: {
    type: "website",
    siteName: "دفتر",
    locale: "ar_SA",
  },
  twitter: {
    card: "summary_large_image",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6D28D9",
};

/* Anti-FOUC: apply dark class before React hydrates */
const themeScript = `
(function(){
  try {
    var s = localStorage.getItem('daftar-theme');
    var dark = s === 'dark' || ((!s || s === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e){}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cn("font-sans", tajawal.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>
          <ThemeProvider>
            <LanguageProvider>
              <ServiceWorkerRegistration />
              {children}
            </LanguageProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
