import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ReactNode } from "react";
import { Layout } from "@/components/Header";

const inter = Inter({ subsets: ['latin'] });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'EventJoy',
  description: 'Simple & joyful event management platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // misal isLoggedIn bisa dihandle di context atau prop, sementara aku set false dulu
  const isLoggedIn = false;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={inter.className}>
        <Layout isLoggedIn={isLoggedIn}>
          {children}
        </Layout>
      </body>
    </html>
  );
}
