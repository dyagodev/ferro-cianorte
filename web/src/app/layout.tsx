import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ElectronTitlebar } from "@/components/ElectronTitlebar";
import { UpdateProgressBar } from "@/components/UpdateProgressBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DM Nexus",
  description: "Sistema de ponto de venda multiloja",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        <ElectronTitlebar />
        {children}
      </body>
    </html>
  );
}
