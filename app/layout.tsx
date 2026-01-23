
import "./globals.css";


export const metadata = {
  title: 'Room Booking System',
  description: 'Room Booking System',
  manifest: '/manifest.json',
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
