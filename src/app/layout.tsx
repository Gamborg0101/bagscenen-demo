import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { ORG } from "@/lib/org";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bagscenen",
  description: `Planlægning af studentermedhjælpere til arrangementer på ${ORG.short}`,
  applicationName: "Bagscenen",
  appleWebApp: { capable: true, title: "Bagscenen", statusBarStyle: "default" },
  icons: { apple: "/app-icon/180", icon: "/app-icon/192" },
  // Internal tool: keep it out of search engines.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Applies the saved theme (or the system preference) before first paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="da" suppressHydrationWarning>
      <head>
        {/* Browsers hide the nonce attribute from scripts, so the client always sees "" — expected, not a mismatch. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans text-sm antialiased`}>
        {children}
      </body>
    </html>
  );
}
