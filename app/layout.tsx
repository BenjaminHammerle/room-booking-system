import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Room Booking System',
  description: 'Room Booking System',
  manifest: '/manifest.json',
  themeColor: '#004a87',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning verhindert, dass Browser-Erweiterungen diesen Fehler auslösen
    <html lang="de" suppressHydrationWarning> 
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
