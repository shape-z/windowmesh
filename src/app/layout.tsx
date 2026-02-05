import "./globals.css";
import { VirtualViewportProvider } from "@/components/virtual/VirtualViewportProvider";

// layout.tsx remains a server component (no 'use client')
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <VirtualViewportProvider>{children}</VirtualViewportProvider>
      </body>
    </html>
  );
}
